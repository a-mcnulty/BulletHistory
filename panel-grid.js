// panel-grid.js — Cell grid rendering & virtualization

BulletHistory.prototype.renderDateHeader = function() {
    // Cleanup old calendar scroll handlers
    if (this.calendarScrollHandlers && this.calendarScrollHandlers.length > 0) {
      for (const { element, handler } of this.calendarScrollHandlers) {
        if (element) element.removeEventListener('scroll', handler);
      }
      this.calendarScrollHandlers = [];
    }

    const monthRow = document.getElementById('monthRow');
    const calendarEventsRow = document.getElementById('calendarEventsRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    monthRow.innerHTML = '';
    calendarEventsRow.innerHTML = '';
    weekdayRow.innerHTML = '';
    dayRow.innerHTML = '';

    const totalWidth = this.getTimelineWidth() + 16;
    const dateHeaderInner = document.querySelector('.date-header-inner');
    if (dateHeaderInner) dateHeaderInner.style.width = `${totalWidth}px`;

    const pxPerHour = this.pixelsPerHour;
    const pxPerDay = pxPerHour * 24;
    const pxPerWeek = pxPerDay * 7;
    const todayStr = this.formatDate(new Date());

    // Determine header granularity — matches cell granularity thresholds (10px min)
    const minCellWidth = 10;
    let headerMode;
    if (pxPerHour >= minCellWidth + 1) headerMode = 'hour';
    else if (pxPerDay >= minCellWidth + 3) headerMode = 'day';
    else if (pxPerWeek >= minCellWidth + 3) headerMode = 'week';
    else headerMode = 'month';

    // --- Month row (top) — always show month spans ---
    let currentMonth = '';
    let monthStartX = 0;

    this.dates.forEach((dateStr, index) => {
      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) return;
      const dayStartMs = date.getTime();
      const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
      const x1 = this.timeToX(dayStartMs) + 8;

      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear();
      const monthYearKey = `${monthName} ${year}`;

      if (monthYearKey !== currentMonth) {
        if (currentMonth) {
          const monthCell = document.createElement('div');
          monthCell.className = 'month-cell';
          const mWidth = x1 - monthStartX;
          monthCell.style.width = `${mWidth}px`;
          monthCell.style.minWidth = `${mWidth}px`;
          monthCell.textContent = currentMonth;
          monthRow.appendChild(monthCell);
        }
        currentMonth = monthYearKey;
        monthStartX = x1;
      }

      if (index === this.dates.length - 1) {
        const endX = this.timeToX(dayEndMs) + 8;
        const monthCell = document.createElement('div');
        monthCell.className = 'month-cell';
        const mWidth = endX - monthStartX;
        monthCell.style.width = `${mWidth}px`;
        monthCell.style.minWidth = `${mWidth}px`;
        monthCell.textContent = currentMonth;
        monthRow.appendChild(monthCell);
      }
    });

    // --- Day row + Weekday row — adapt to zoom granularity ---

    if (headerMode === 'hour') {
      // Weekday row (upper): day labels spanning 24 hours each
      // Day row (lower): hour ticks
      this.dates.forEach((dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return;
        const dayStartMs = date.getTime();
        const x1 = this.timeToX(dayStartMs) + 8;
        const dayWidth = pxPerDay - 3;
        const isToday = dateStr === todayStr;

        const dayLabel = document.createElement('div');
        dayLabel.className = 'weekday-cell';
        if (isToday) dayLabel.classList.add('col-today');
        dayLabel.style.position = 'absolute';
        dayLabel.style.left = `${x1}px`;
        dayLabel.style.width = `${dayWidth}px`;
        dayLabel.style.fontSize = '11px';
        dayLabel.style.fontWeight = '500';
        dayLabel.style.color = '#666';
        dayLabel.dataset.date = dateStr;
        dayLabel.style.cursor = 'pointer';
        dayLabel.addEventListener('click', () => this.showDayExpandedView(dateStr));
        const weekday = date.toLocaleString('en-US', { weekday: 'short' });
        dayLabel.textContent = `${weekday} ${date.getDate()}`;
        weekdayRow.appendChild(dayLabel);

        // Hour ticks below the date
        for (let h = 0; h < 24; h++) {
          const hourMs = dayStartMs + h * 60 * 60 * 1000;
          const hx = this.timeToX(hourMs) + 8;
          const showLabel = pxPerHour > 15 || (h % 3 === 0 && pxPerHour > 5) || (h % 6 === 0);
          if (!showLabel) continue;

          const hourCell = document.createElement('div');
          hourCell.className = 'day-cell hour-tick';
          hourCell.style.position = 'absolute';
          hourCell.style.left = `${hx}px`;
          hourCell.style.width = `${pxPerHour}px`;
          const hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
          hourCell.textContent = `${hour12}${h >= 12 ? 'p' : 'a'}`;
          dayRow.appendChild(hourCell);
        }
      });

    } else if (headerMode === 'day') {
      // Day row: day numbers, weekday row: weekday letters
      const dayWidth = Math.max(minCellWidth, pxPerDay - 3);
      const narrow = dayWidth < 20;
      const labelEveryN = narrow ? Math.ceil(14 / dayWidth) : 1;

      this.dates.forEach((dateStr, idx) => {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return;
        const dayStartMs = date.getTime();
        const x1 = this.timeToX(dayStartMs) + 8;
        const isToday = dateStr === todayStr;
        const showLabel = (idx % labelEveryN === 0) || isToday;

        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (isToday) dayCell.classList.add('col-today');
        if (narrow) dayCell.classList.add('rotated');
        dayCell.style.position = 'absolute';
        dayCell.style.left = `${x1}px`;
        dayCell.style.width = `${dayWidth}px`;
        dayCell.dataset.date = dateStr;
        dayCell.style.cursor = 'pointer';
        dayCell.addEventListener('click', () => this.showDayExpandedView(dateStr));
        if (showLabel) {
          if (dayWidth > 40) {
            const weekday = date.toLocaleString('en-US', { weekday: 'short' });
            dayCell.textContent = `${weekday} ${date.getDate()}`;
          } else {
            dayCell.textContent = date.getDate();
          }
        }
        dayRow.appendChild(dayCell);

        if (showLabel && !narrow) {
          const weekdayCell = document.createElement('div');
          weekdayCell.className = 'weekday-cell';
          if (isToday) weekdayCell.classList.add('col-today');
          weekdayCell.style.position = 'absolute';
          weekdayCell.style.left = `${x1}px`;
          weekdayCell.style.width = `${dayWidth}px`;
          weekdayCell.textContent = date.toLocaleString('en-US', { weekday: 'short' }).charAt(0);
          weekdayRow.appendChild(weekdayCell);
        }
      });

    } else if (headerMode === 'week') {
      // Day row: week date ranges, weekday row: empty
      const first = new Date(this.dates[0] + 'T00:00:00');
      const dayOfWeek = (first.getDay() + 6) % 7;
      let weekStart = first.getTime() - dayOfWeek * 24 * 60 * 60 * 1000;
      const lastMs = new Date(this.dates[this.dates.length - 1] + 'T23:59:59').getTime();
      const labelMinSpacing = 12;
      let lastLabelEnd = -Infinity;

      while (weekStart <= lastMs) {
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
        const x1 = this.timeToX(weekStart) + 8;
        const x2 = this.timeToX(weekEnd) + 8;
        const naturalWidth = (x2 - x1) - 3;
        const cellWidth = Math.max(1, naturalWidth);
        const wStart = new Date(weekStart);
        const wEnd = new Date(weekEnd - 1);
        const containsToday = this.dates.some(d => {
          const ms = new Date(d + 'T00:00:00').getTime();
          return ms >= weekStart && ms < weekEnd && d === todayStr;
        });

        const narrow = cellWidth < 20;
        const showLabel = x1 >= lastLabelEnd;

        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (containsToday) dayCell.classList.add('col-today');
        if (narrow && showLabel) dayCell.classList.add('rotated');
        dayCell.style.position = 'absolute';
        dayCell.style.left = `${x1}px`;
        dayCell.style.width = `${cellWidth}px`;
        dayCell.style.cursor = 'pointer';
        dayCell.addEventListener('click', () => {
          const clickDate = this.formatDate(wStart);
          this.showDayExpandedView(clickDate);
        });

        if (showLabel) {
          const startLabel = `${wStart.toLocaleString('en-US', { month: 'short' })} ${wStart.getDate()}`;
          if (cellWidth > 60 || narrow) {
            dayCell.textContent = `${startLabel}–${wEnd.getDate()}`;
          } else {
            dayCell.textContent = startLabel;
          }
          lastLabelEnd = x1 + Math.max(cellWidth, labelMinSpacing);
        }
        dayRow.appendChild(dayCell);

        weekStart = weekEnd;
      }

    } else {
      // Month mode — day row shows month names centered over their span
      const seen = new Set();
      const monthCells = [];
      this.dates.forEach((dateStr) => {
        const key = dateStr.substring(0, 7);
        if (seen.has(key)) return;
        seen.add(key);
        const [y, m] = key.split('-').map(Number);
        const startMs = new Date(y, m - 1, 1).getTime();
        const endMs = new Date(y, m, 1).getTime();
        const x1 = this.timeToX(startMs) + 8;
        const x2 = this.timeToX(endMs) + 8;
        const naturalWidth = (x2 - x1) - 3;
        monthCells.push({ key, y, m, startMs, endMs, x1, naturalWidth });
      });

      // Thin labels to avoid overlap — skip cells that would collide
      const labelMinSpacing = 12;
      let lastLabelEnd = -Infinity;

      for (const mc of monthCells) {
        const cellWidth = Math.max(1, mc.naturalWidth);
        const monthDate = new Date(mc.y, mc.m - 1, 1);
        const containsToday = todayStr.startsWith(mc.key);
        const narrow = cellWidth < 20;
        const showLabel = mc.x1 >= lastLabelEnd;

        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (containsToday) dayCell.classList.add('col-today');
        if (narrow && showLabel) dayCell.classList.add('rotated');
        dayCell.style.position = 'absolute';
        dayCell.style.left = `${mc.x1}px`;
        dayCell.style.width = `${cellWidth}px`;
        dayCell.style.cursor = 'pointer';
        dayCell.addEventListener('click', () => {
          this.showDayExpandedView(this.formatDate(monthDate));
        });
        if (showLabel) {
          dayCell.textContent = monthDate.toLocaleString('en-US', { month: 'short' });
          lastLabelEnd = mc.x1 + Math.max(cellWidth, labelMinSpacing);
        }
        dayRow.appendChild(dayCell);
      }
    }

    // --- Calendar events row — only at day zoom or higher ---
    if (headerMode === 'day' || headerMode === 'hour') {
      this.dates.forEach((dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return;
        const x1 = this.timeToX(date.getTime()) + 8;
        const dayWidth = Math.max(1, pxPerDay - 3);
        if (dayWidth < 6) return;
        const isToday = dateStr === todayStr;

        const eventColumn = document.createElement('div');
        eventColumn.className = 'calendar-event-column';
        eventColumn.dataset.date = dateStr;
        eventColumn.style.position = 'absolute';
        eventColumn.style.left = `${x1}px`;
        eventColumn.style.width = `${dayWidth}px`;
        if (isToday) eventColumn.classList.add('col-today');

        const hasEvents = this.renderCalendarEventColumn(eventColumn, dateStr);
        if (!hasEvents) {
          eventColumn.style.height = '0';
          eventColumn.style.padding = '0';
        } else {
          eventColumn.style.cursor = 'pointer';
          eventColumn.addEventListener('click', () => this.showDayExpandedView(dateStr));
        }
        calendarEventsRow.appendChild(eventColumn);
      });
    }

    // Make rows position relative for absolute children
    const rotatedCells = dayRow.querySelectorAll('.rotated');
    let rotatedHeight = 0;
    if (rotatedCells.length > 0) {
      let maxChars = 0;
      rotatedCells.forEach(c => { if (c.textContent.length > maxChars) maxChars = c.textContent.length; });
      rotatedHeight = Math.max(20, maxChars * 6 + 6);
    }
    dayRow.style.position = 'relative';
    dayRow.style.width = `${totalWidth}px`;
    dayRow.style.minHeight = rotatedHeight ? `${rotatedHeight}px` : '20px';
    dayRow.style.height = rotatedHeight ? `${rotatedHeight}px` : 'auto';
    weekdayRow.style.position = 'relative';
    weekdayRow.style.width = `${totalWidth}px`;
    if (headerMode === 'hour') {
      weekdayRow.style.minHeight = '20px';
      weekdayRow.style.height = 'auto';
    } else if (headerMode === 'week' || headerMode === 'month') {
      weekdayRow.style.minHeight = '0';
      weekdayRow.style.height = '0';
    } else {
      weekdayRow.style.minHeight = '16px';
      weekdayRow.style.height = 'auto';
    }
    calendarEventsRow.style.position = 'relative';
    calendarEventsRow.style.width = `${totalWidth}px`;
};

  // Legacy — kept for compatibility, no longer used as separate function
BulletHistory.prototype.renderHourHeader = function() {
    this.renderDateHeader();
};

  // Get GitHub-style color based on visit count
  // Uses discrete levels like GitHub's contribution graph
BulletHistory.prototype.getGitHubStyleColor = function(count, maxCount, baseColor) {
    if (count === 0) return '#ebedf0'; // GitHub's empty cell color (light gray)

    // Calculate which quartile this count falls into
    const normalized = count / maxCount;

    // GitHub uses 4 distinct levels
    // Parse the base color to get the hue
    const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    const hue = hslMatch ? hslMatch[1] : '140'; // Default to green if parsing fails

    if (normalized <= 0.25) {
      // Level 1: Lightest (1-25%)
      return `hsl(${hue}, 42%, 86%)`;
    } else if (normalized <= 0.5) {
      // Level 2: Light-medium (26-50%)
      return `hsl(${hue}, 50%, 76%)`;
    } else if (normalized <= 0.75) {
      // Level 3: Medium-dark (51-75%)
      return `hsl(${hue}, 54%, 66%)`;
    } else {
      // Level 4: Darkest (76-100%) - dialed back one more step
      return `hsl(${hue}, 58%, 60%)`;
    }
};

  // Setup virtual grid with spacers
BulletHistory.prototype.setupVirtualGrid = function() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const cellGrid = document.getElementById('cellGrid');

    // Calculate total dimensions
    const totalHeight = this.sortedDomains.length * this.rowHeight + 11; // Add top (8px) + bottom (3px) padding
    const totalWidth = this.getTimelineWidth() + 16; // Add padding

    // Create spacer to maintain scroll area
    tldColumn.innerHTML = '<div class="virtual-spacer"></div>';
    cellGrid.innerHTML = '<div class="virtual-spacer"></div>';

    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');

    tldSpacer.style.height = `${totalHeight}px`;
    tldSpacer.style.width = '1px';
    cellSpacer.style.height = `${totalHeight}px`;
    cellSpacer.style.width = `${totalWidth}px`;

    // Pre-compute line segments for all domains (cached per render cycle)
    this.domainSegmentsCache = new Map();
    for (const domain of this.sortedDomains) {
      this.domainSegmentsCache.set(domain, this.buildDomainLineSegments(domain));
    }

    // Initial render
    this.updateVirtualGrid();

    // Only add listeners on first setup
    if (!this.virtualGridInitialized) {
      // Re-render on scroll
      cellGridWrapper.addEventListener('scroll', () => {
        this.updateVirtualGrid();
      });

      // Re-render on resize
      window.addEventListener('resize', () => {
        this.updateVirtualGrid();
      });

      this.virtualGridInitialized = true;
    }
};

  // Update which rows are visible and render them
BulletHistory.prototype.updateVirtualGrid = function(forceUpdate = false) {
    const tldColumn = document.getElementById('tldColumn');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const cellGrid = document.getElementById('cellGrid');

    // Get viewport dimensions
    const viewportHeight = cellGridWrapper.clientHeight;
    const viewportWidth = cellGridWrapper.clientWidth;
    const scrollTop = cellGridWrapper.scrollTop;
    const scrollLeft = cellGridWrapper.scrollLeft;

    // Calculate visible row range with buffer
    const startRow = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.rowBuffer);
    const endRow = Math.min(
      this.sortedDomains.length,
      Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.rowBuffer
    );

    // Calculate visible time range (with buffer)
    const bufferPx = 50;
    const viewStartMs = this.xToTime(Math.max(0, scrollLeft - bufferPx));
    const viewEndMs = this.xToTime(scrollLeft + viewportWidth + bufferPx);

    // Only update if range changed (unless forced)
    if (
      !forceUpdate &&
      startRow === this.virtualState.startRow &&
      endRow === this.virtualState.endRow &&
      Math.abs(viewStartMs - (this.virtualState.viewStartMs || 0)) < 60000 &&
      Math.abs(viewEndMs - (this.virtualState.viewEndMs || 0)) < 60000
    ) {
      return;
    }

    this.virtualState = { startRow, endRow, viewStartMs, viewEndMs, viewportHeight, viewportWidth };

    // Render visible rows
    this.renderVirtualRows(startRow, endRow, viewStartMs, viewEndMs);
};

  // Render only visible rows — draws horizontal line segments per domain
BulletHistory.prototype.renderVirtualRows = function(startRow, endRow, viewStartMs, viewEndMs) {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');

    // Clear existing rows (keep spacer)
    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');
    tldColumn.innerHTML = '';
    cellGrid.innerHTML = '';
    tldColumn.appendChild(tldSpacer);
    cellGrid.appendChild(cellSpacer);

    this.hoveredElements.clear();

    const totalWidth = this.getTimelineWidth() + 16;
    const pxPerDay = this.pixelsPerHour * 24;
    const pxPerHour = this.pixelsPerHour;

    // Determine cell granularity based on zoom
    // Pick the finest granularity where each cell is at least 10px wide
    const minCellWidth = 10;
    let cellMode, cellGap;
    if (pxPerHour >= minCellWidth + 1) {
      cellMode = 'hour';
      cellGap = 1;
    } else if (pxPerDay >= minCellWidth + 3) {
      cellMode = 'day';
      cellGap = 3;
    } else if (pxPerDay * 7 >= minCellWidth + 3) {
      cellMode = 'week';
      cellGap = 3;
    } else {
      cellMode = 'month';
      cellGap = 3;
    }

    // Build cell buckets: [{startMs, endMs, dateKeys: [...]}]
    const cellBuckets = [];
    if (cellMode === 'month') {
      // Group by calendar month
      const seen = new Set();
      for (const dateStr of this.dates) {
        const key = dateStr.substring(0, 7); // YYYY-MM
        if (seen.has(key)) continue;
        seen.add(key);
        const [y, m] = key.split('-').map(Number);
        const startMs = new Date(y, m - 1, 1).getTime();
        const endMs = new Date(y, m, 1).getTime();
        cellBuckets.push({ startMs, endMs, dateKeys: [] });
      }
      for (const dateStr of this.dates) {
        const dayMs = new Date(dateStr + 'T00:00:00').getTime();
        for (const b of cellBuckets) {
          if (dayMs >= b.startMs && dayMs < b.endMs) { b.dateKeys.push(dateStr); break; }
        }
      }
    } else if (cellMode === 'week') {
      // Group by ISO week (Monday-aligned)
      const first = new Date(this.dates[0] + 'T00:00:00');
      const dayOfWeek = (first.getDay() + 6) % 7; // Monday = 0
      let weekStart = new Date(first.getTime() - dayOfWeek * 24 * 60 * 60 * 1000).getTime();
      const lastDate = new Date(this.dates[this.dates.length - 1] + 'T23:59:59').getTime();
      while (weekStart <= lastDate) {
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
        cellBuckets.push({ startMs: weekStart, endMs: weekEnd, dateKeys: [] });
        weekStart = weekEnd;
      }
      for (const dateStr of this.dates) {
        const dayMs = new Date(dateStr + 'T00:00:00').getTime();
        for (const b of cellBuckets) {
          if (dayMs >= b.startMs && dayMs < b.endMs) { b.dateKeys.push(dateStr); break; }
        }
      }
    } else if (cellMode === 'hour') {
      // Generate hour buckets from timeline range, only within visible range
      const hourMs = 60 * 60 * 1000;
      let t = Math.floor(viewStartMs / hourMs) * hourMs;
      const end = Math.min(viewEndMs + hourMs, this.timelineEndMs + hourMs);
      while (t < end) {
        const dateStr = new Date(t).toISOString().split('T')[0];
        const hourStr = `${dateStr}T${String(new Date(t).getHours()).padStart(2, '0')}`;
        cellBuckets.push({ startMs: t, endMs: t + hourMs, dateKeys: [dateStr], hourStr });
        t += hourMs;
      }
    } else {
      // Day buckets
      for (const dateStr of this.dates) {
        const startMs = new Date(dateStr + 'T00:00:00').getTime();
        cellBuckets.push({ startMs, endMs: startMs + 24 * 60 * 60 * 1000, dateKeys: [dateStr] });
      }
    }

    // Helper to get aggregated count for a bucket
    const getBucketCount = (domain, bucket) => {
      if (cellMode === 'hour' && bucket.hourStr) {
        return this.getUniqueUrlCountForCell(domain, bucket.hourStr, true);
      }
      let total = 0;
      for (const dateStr of bucket.dateKeys) {
        total += this.getUniqueUrlCountForCell(domain, dateStr, false);
      }
      return total;
    };

    // Pre-compute maxCount for visible domains at current granularity
    this.maxCountCache.clear();
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain || domain.trim().length === 0 || this.maxCountCache.has(domain)) continue;
      let maxCount = 0;
      for (const bucket of cellBuckets) {
        const count = getBucketCount(domain, bucket);
        if (count > maxCount) maxCount = count;
      }
      this.maxCountCache.set(domain, maxCount || 1);
    }

    const todayStr = this.formatDate(new Date());

    // Render visible rows
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain || domain.trim().length === 0) continue;

      // TLD label
      const tldRow = document.createElement('div');
      tldRow.className = 'tld-row';
      tldRow.dataset.rowIndex = rowIndex;
      tldRow.style.position = 'absolute';
      tldRow.style.top = `${rowIndex * this.rowHeight + 8}px`;
      tldRow.style.width = '100%';

      // Favicon
      const favicon = document.createElement('img');
      favicon.className = 'tld-favicon';
      const cachedTldFavicon = this.faviconsByDomain.get(domain);
      const tldFaviconSrc = `https://www.google.com/s2/favicons?domain=https://${domain}&sz=16`;
      favicon.src = cachedTldFavicon || tldFaviconSrc;
      favicon.alt = '';
      favicon.width = 16;
      favicon.height = 16;

      let tldFallbackAttempts = 0;
      const tldFallbackUrls = [
        tldFaviconSrc,
        `https://${domain}/favicon.ico`,
        `https://${domain}/favicon.png`,
        `https://${domain}/apple-touch-icon.png`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`
      ];
      favicon.onerror = () => {
        tldFallbackAttempts++;
        if (tldFallbackAttempts < tldFallbackUrls.length) {
          favicon.src = tldFallbackUrls[tldFallbackAttempts];
        } else {
          favicon.style.display = 'none';
        }
      };
      tldRow.appendChild(favicon);

      const domainSpan = document.createElement('span');
      domainSpan.className = 'tld-name';
      domainSpan.textContent = domain;
      tldRow.appendChild(domainSpan);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'tld-delete-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete all history for this domain';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tldRow = e.target.closest('.tld-row');
        this.deleteDomainWithAnimation(tldRow, domain);
      });
      tldRow.appendChild(deleteBtn);
      tldColumn.appendChild(tldRow);

      // Cell row — grid cells behind the lines
      const maxCount = this.maxCountCache.get(domain) || 1;
      const baseColor = this.colors[domain] || 'hsl(200, 50%, 70%)';
      const cellRow = document.createElement('div');
      cellRow.className = 'cell-row';
      cellRow.dataset.rowIndex = rowIndex;
      cellRow.style.position = 'absolute';
      cellRow.style.top = `${rowIndex * this.rowHeight + 8}px`;
      cellRow.style.left = '0';
      cellRow.style.width = `${totalWidth}px`;
      cellRow.style.height = `${this.rowHeight}px`;

      for (const bucket of cellBuckets) {
        if (bucket.endMs < viewStartMs || bucket.startMs > viewEndMs) continue;

        const x1 = this.timeToX(bucket.startMs) + 8;
        const x2 = this.timeToX(bucket.endMs) + 8;
        const cellWidth = Math.max(minCellWidth, (x2 - x1) - cellGap);
        const count = getBucketCount(domain, bucket);

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.domain = domain;
        cell.dataset.date = bucket.dateKeys[0] || '';
        cell.dataset.rowIndex = rowIndex;
        cell.style.left = `${x1}px`;
        cell.style.width = `${cellWidth}px`;

        if (count > 0) {
          cell.style.backgroundColor = this.getGitHubStyleColor(count, maxCount, baseColor);
          cell.dataset.count = count;
        } else {
          cell.classList.add('empty');
          cell.dataset.count = 0;
        }

        const bucketContainsToday = bucket.dateKeys.includes(todayStr);
        if (bucketContainsToday) cell.classList.add('col-today');

        cellRow.appendChild(cell);
      }
      cellGrid.appendChild(cellRow);

      // Line row — container for line segments, rendered on top of cells
      const lineRow = document.createElement('div');
      lineRow.className = 'cell-row line-row';
      lineRow.dataset.rowIndex = rowIndex;
      lineRow.dataset.domain = domain;
      lineRow.style.position = 'absolute';
      lineRow.style.top = `${rowIndex * this.rowHeight + 8}px`;
      lineRow.style.left = '0';
      lineRow.style.width = `${totalWidth}px`;
      lineRow.style.height = `${this.rowHeight}px`;

      // Get pre-computed segments for this domain
      const segments = this.domainSegmentsCache?.get(domain) || [];
      const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      const hue = hslMatch ? hslMatch[1] : '200';

      for (const seg of segments) {
        // Skip segments completely outside the viewport
        if (seg.endMs < viewStartMs || seg.startMs > viewEndMs) continue;

        const x1 = this.timeToX(seg.startMs) + 8; // 8px left padding
        const x2 = this.timeToX(seg.endMs) + 8;
        const width = Math.max(1, x2 - x1); // At least 1px visible

        const n = seg.concurrentTabs;
        const thickness = 2 + Math.log2(n) * 2;
        const half = thickness / 2;
        const peakOpacity = 0.85;
        const coreRadius = 1;
        const stops = [];
        const numStops = Math.max(3, Math.ceil(thickness));
        for (let i = 0; i <= numStops; i++) {
          const pct = (i / numStops) * 100;
          const distFromCenter = Math.abs((i / numStops) - 0.5) * thickness;
          const alpha = distFromCenter <= coreRadius
            ? peakOpacity
            : peakOpacity * Math.max(0, 1 - (distFromCenter - coreRadius) / (half - coreRadius));
          stops.push(`hsla(${hue}, 55%, 65%, ${alpha.toFixed(3)}) ${pct.toFixed(1)}%`);
        }

        const line = document.createElement('div');
        line.className = 'timeline-line';
        line.dataset.domain = domain;
        line.dataset.startMs = seg.startMs;
        line.dataset.endMs = seg.endMs;
        line.dataset.tabs = n;
        line.style.position = 'absolute';
        line.style.left = `${x1}px`;
        line.style.width = `${width}px`;
        line.style.height = `${thickness}px`;
        line.style.top = `${(this.rowHeight - thickness) / 2}px`;
        line.style.background = `linear-gradient(to bottom, ${stops.join(', ')})`;
        line.style.borderRadius = '1.5px';
        line.style.boxShadow = `0 0 0 0.5px hsl(${hue}, 70%, 55%)`;

        lineRow.appendChild(line);
      }

      cellGrid.appendChild(lineRow);
    }
};

  // Sync scrolling between date header and cell grid
BulletHistory.prototype.setupScrollSync = function() {
    const dateHeader = document.getElementById('dateHeader');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const tldColumn = document.getElementById('tldColumn');

    let isHeaderScrolling = false;
    let isGridScrolling = false;
    let isTldScrolling = false;

    // Helper function to clear all hover states - optimized to only clear tracked elements
    const clearAllHoverStates = () => {
      for (const el of this.hoveredElements) {
        el.classList.remove('col-hover', 'row-hover');
      }
      this.hoveredElements.clear();
    };

    // Sync horizontal scroll: grid -> header
    // Sync vertical scroll: grid -> tld column
    cellGridWrapper.addEventListener('scroll', () => {
      if (isHeaderScrolling || isTldScrolling) return;
      isGridScrolling = true;
      clearAllHoverStates(); // Clear hover states when scrolling
      dateHeader.scrollLeft = cellGridWrapper.scrollLeft;
      tldColumn.scrollTop = cellGridWrapper.scrollTop;
      requestAnimationFrame(() => {
        isGridScrolling = false;
      });
    }, { passive: true });

    // Sync horizontal scroll: header -> grid
    dateHeader.addEventListener('scroll', () => {
      if (isGridScrolling) return;
      isHeaderScrolling = true;
      clearAllHoverStates(); // Clear hover states when scrolling
      cellGridWrapper.scrollLeft = dateHeader.scrollLeft;
      requestAnimationFrame(() => {
        isHeaderScrolling = false;
      });
    }, { passive: true });

    // Sync vertical scroll: tld column -> grid
    tldColumn.addEventListener('scroll', () => {
      if (isGridScrolling) return;
      isTldScrolling = true;
      clearAllHoverStates(); // Clear hover states when scrolling
      cellGridWrapper.scrollTop = tldColumn.scrollTop;
      requestAnimationFrame(() => {
        isTldScrolling = false;
      });
    }, { passive: true });

    // Scroll to show today (right edge)
    cellGridWrapper.scrollLeft = cellGridWrapper.scrollWidth;
};

  // Setup hover tooltips
BulletHistory.prototype.setupTooltips = function() {
    const tooltip = document.getElementById('tooltip');
    const cellGrid = document.getElementById('cellGrid');

    cellGrid.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('timeline-line')) {
        const tabs = parseInt(e.target.dataset.tabs) || 1;
        const domain = e.target.dataset.domain;
        const startMs = parseInt(e.target.dataset.startMs);
        const endMs = parseInt(e.target.dataset.endMs);
        const duration = DateUtils.formatDuration(endMs - startMs);
        tooltip.textContent = `${domain} — ${tabs} tab${tabs !== 1 ? 's' : ''}, ${duration}`;
        tooltip.classList.add('visible');
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 30}px`;
        tooltip.style.transform = 'translateX(-50%)';
      } else if (e.target.classList.contains('cell') && !e.target.classList.contains('empty')) {
        const count = parseInt(e.target.dataset.count) || 0;
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;
        tooltip.textContent = `${domain} — ${count} tab${count !== 1 ? 's' : ''} on ${date}`;
        tooltip.classList.add('visible');
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 30}px`;
        tooltip.style.transform = 'translateX(-50%)';
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('timeline-line') || e.target.classList.contains('cell')) {
        tooltip.classList.remove('visible');
      }
    });
};

  // Setup row hover highlighting
BulletHistory.prototype.setupRowHover = function() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    // Click on TLD row to show full domain view
    tldColumn.addEventListener('click', (e) => {
      // Find the tld-row element (could be the target or a parent)
      const tldRow = e.target.closest('.tld-row');
      if (tldRow) {
        const rowIndex = tldRow.dataset.rowIndex;
        const domain = this.sortedDomains[rowIndex];

        if (domain) {
          // Close any existing expanded view
          if (this.selectedCell) {
            this.selectedCell.classList.remove('selected');
            this.selectedCell = null;
          }

          // Show domain view
          this.showDomainView(domain);
        }
      }
    });

    // Hover over TLD row
    tldColumn.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Highlight the TLD row
        e.target.classList.add('row-hover');
        this.hoveredElements.add(e.target);
        // Highlight the corresponding cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
          this.hoveredElements.add(cellRow);
        }
      }
    });

    tldColumn.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Remove highlight from TLD row
        e.target.classList.remove('row-hover');
        this.hoveredElements.delete(e.target);
        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
          this.hoveredElements.delete(cellRow);
        }
      }
    });

    // Hover over cell-row or line-row — highlight corresponding TLD row
    cellGrid.addEventListener('mouseover', (e) => {
      const row = e.target.closest('.cell-row');
      if (row) {
        const rowIndex = row.dataset.rowIndex;
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.add('row-hover');
          this.hoveredElements.add(tldRow);
        }
        // Highlight all cell-rows for this index (both cell row and line row)
        cellGrid.querySelectorAll(`.cell-row[data-row-index="${rowIndex}"]`).forEach(r => {
          r.classList.add('row-hover');
          this.hoveredElements.add(r);
        });
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      const row = e.target.closest('.cell-row');
      if (row) {
        const rowIndex = row.dataset.rowIndex;
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.remove('row-hover');
          this.hoveredElements.delete(tldRow);
        }
        cellGrid.querySelectorAll(`.cell-row[data-row-index="${rowIndex}"]`).forEach(r => {
          r.classList.remove('row-hover');
          this.hoveredElements.delete(r);
        });
      }
    });
};

  // Setup header hover — simple hover feedback on day/weekday cells
BulletHistory.prototype.setupColumnHeaderHover = function() {
    const dayRow = document.getElementById('dayRow');

    dayRow.addEventListener('mouseover', (e) => {
      const dayCell = e.target.closest('.day-cell');
      if (dayCell) {
        dayCell.classList.add('col-hover');
        this.hoveredElements.add(dayCell);
      }
    });

    dayRow.addEventListener('mouseout', (e) => {
      const dayCell = e.target.closest('.day-cell');
      if (dayCell) {
        dayCell.classList.remove('col-hover');
        this.hoveredElements.delete(dayCell);
      }
    });
};

  // Setup cell click to expand and show URLs
BulletHistory.prototype.setupCellClick = function() {
    const cellGrid = document.getElementById('cellGrid');
    const expandedView = document.getElementById('expandedView');
    const closeBtn = document.getElementById('closeExpanded');

    cellGrid.addEventListener('click', (e) => {
      // Click on a grid cell — show expanded view for that domain+date
      if (e.target.classList.contains('cell') && !e.target.classList.contains('empty')) {
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;
        if (domain && date) {
          const count = parseInt(e.target.dataset.count) || 0;
          this.showExpandedView(domain, date, count);
          return;
        }
      }
      // Click on timeline line or line-row — show domain view
      const lineRow = e.target.closest('.line-row');
      if (lineRow) {
        const domain = lineRow.dataset.domain;
        if (domain) this.showDomainView(domain);
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.closeExpandedView();
    });

    // Refresh time data button
    const refreshBtn = document.getElementById('refreshTimeData');
    refreshBtn.addEventListener('animationend', () => {
      refreshBtn.classList.remove('spinning');
    });
    refreshBtn.addEventListener('click', async () => {
      // Restart animation
      refreshBtn.classList.remove('spinning');
      void refreshBtn.offsetWidth;
      refreshBtn.classList.add('spinning');

      // Reload all data sources
      await this.loadFaviconCache();
      await this.fetchHistory();
      await this.loadOpenTabsData();
      await this.refreshUrlTimeCache();
      await this.loadTabSessions();

      // Regenerate grid structure
      this.generateDates();
      this.computeTimeline();
      this.sortedDomains = this.getSortedDomains();

      // Re-render everything
      this.renderDateHeader();
      this.setupVirtualGrid();
      this.refreshCalendarUI();
      this.refreshExpandedView();
    });

    // Expand All / Collapse All button
    const expandAllBtn = document.getElementById('expandAllBtn');
    this.allExpanded = false;
    expandAllBtn.addEventListener('click', () => {
      this.allExpanded = !this.allExpanded;
      expandAllBtn.textContent = this.allExpanded ? 'Collapse All' : 'Expand All';
      expandAllBtn.classList.toggle('active', this.allExpanded);

      const urlItems = expandedView.querySelectorAll('.url-item');
      urlItems.forEach(item => {
        const wasExpanded = item.classList.contains('expanded');
        item.classList.toggle('expanded', this.allExpanded);

        // Lazy-load visit times when expanding
        if (this.allExpanded && !wasExpanded) {
          const expandBtn = item.querySelector('.url-item-expand-btn');
          if (expandBtn) expandBtn.dispatchEvent(new Event('_expand'));
        }

        // Adjust placeholder height
        const placeholder = item.closest('.url-item-placeholder') || item;
        placeholder.style.height = this.allExpanded ? 'auto' : `${this.urlListRowHeight}px`;
      });
    });

    // Keyboard navigation (arrow keys)
    document.addEventListener('keydown', (e) => {
      if (expandedView.style.display !== 'block') return;

      const domain = this.selectedCell?.dataset.domain;
      const date = this.selectedCell?.dataset.date;

      if (!date) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.viewMode === 'hour') {
          this.navigateDomainHour(domain, date, -1);
        } else {
          this.navigateDay(domain, date, -1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (this.viewMode === 'hour') {
          this.navigateDomainHour(domain, date, 1);
        } else {
          this.navigateDay(domain, date, 1);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeExpandedView();
      }
    });

    // Horizontal scroll/swipe navigation
    let scrollTimeout = null;
    expandedView.addEventListener('wheel', (e) => {
      if (expandedView.style.display !== 'block') return;

      const domain = this.selectedCell?.dataset.domain;
      const date = this.selectedCell?.dataset.date;

      if (!date) return;

      // Detect horizontal scroll (deltaX for horizontal, deltaY for vertical)
      const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (isHorizontalScroll && Math.abs(e.deltaX) > 10) {
        e.preventDefault();

        // Debounce rapid scroll events
        if (scrollTimeout) return;

        scrollTimeout = setTimeout(() => {
          scrollTimeout = null;
        }, 200);

        // Scroll right = next, scroll left = previous
        if (e.deltaX > 0) {
          if (this.viewMode === 'hour') {
            this.navigateDomainHour(domain, date, 1);
          } else {
            this.navigateDay(domain, date, 1);
          }
        } else {
          if (this.viewMode === 'hour') {
            this.navigateDomainHour(domain, date, -1);
          } else {
            this.navigateDay(domain, date, -1);
          }
        }
      }
    }, { passive: false });
};
