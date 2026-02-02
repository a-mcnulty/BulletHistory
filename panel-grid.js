// panel-grid.js — Cell grid rendering & virtualization

BulletHistory.prototype.renderDateHeader = function() {
    console.log('renderDateHeader called, viewMode:', this.viewMode);

    // Cleanup old calendar scroll handlers to prevent accumulation
    if (this.calendarScrollHandlers && this.calendarScrollHandlers.length > 0) {
      for (const { element, handler } of this.calendarScrollHandlers) {
        if (element) {
          element.removeEventListener('scroll', handler);
        }
      }
      this.calendarScrollHandlers = [];
    }

    // Check if we're in hour view mode
    if (this.viewMode === 'hour') {
      this.renderHourHeader();
      return;
    }

    // Remove hour-view class when in day view
    document.querySelector('.container').classList.remove('hour-view');

    const monthRow = document.getElementById('monthRow');
    const calendarEventsRow = document.getElementById('calendarEventsRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    monthRow.innerHTML = '';
    calendarEventsRow.innerHTML = '';
    weekdayRow.innerHTML = '';
    dayRow.innerHTML = '';

    let currentMonth = '';
    let monthSpan = 0;

    // Get today's date string for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);

    this.dates.forEach((dateStr, index) => {
      const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues

      // Check for invalid date
      if (isNaN(date.getTime())) {
        console.error(`Invalid date: ${dateStr}`);
        return;
      }

      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      const monthYearKey = `${monthName} ${year}`;
      const dayNum = date.getDate();
      const weekdayName = date.toLocaleString('en-US', { weekday: 'short' }).charAt(0);

      // Check if this is today
      const isToday = dateStr === todayStr;

      // Debug first few dates
      if (index < 3 || index > this.dates.length - 3) {
      }

      // Month header (only show when month changes)
      if (monthYearKey !== currentMonth) {
        if (monthSpan > 0) {
          // Create month cell for previous month
          const monthCell = document.createElement('div');
          monthCell.className = 'month-cell';
          monthCell.style.width = `${monthSpan * 21 - 3}px`; // 18px cell + 3px gap per day, minus last gap
          monthCell.style.minWidth = `${monthSpan * 21 - 3}px`;
          monthCell.textContent = currentMonth;
          monthRow.appendChild(monthCell);
        }
        currentMonth = monthYearKey;
        monthSpan = 1;
      } else {
        monthSpan++;
      }

      // Calendar events column
      const eventColumn = document.createElement('div');
      eventColumn.className = 'calendar-event-column';
      eventColumn.dataset.date = dateStr;

      // Render events (if any)
      const hasEvents = this.renderCalendarEventColumn(eventColumn, dateStr);

      // Set empty columns to zero height to save vertical space
      if (!hasEvents) {
        eventColumn.style.height = '0';
        eventColumn.style.padding = '0';
      } else if (isToday) {
        eventColumn.classList.add('col-today');
      }

      // Add click handler to switch to hour view for this day
      eventColumn.addEventListener('click', () => {
        this.switchToHourViewForDate(dateStr);
      });
      eventColumn.style.cursor = 'pointer';

      calendarEventsRow.appendChild(eventColumn);

      // Weekday letter
      const weekdayCell = document.createElement('div');
      weekdayCell.className = 'weekday-cell';
      if (isToday) weekdayCell.classList.add('col-today');
      weekdayCell.textContent = weekdayName;
      weekdayCell.dataset.colIndex = index;
      weekdayCell.dataset.date = dateStr;

      // Add click handler to switch to hour view for this day
      weekdayCell.addEventListener('click', () => {
        this.switchToHourViewForDate(dateStr);
      });
      weekdayCell.style.cursor = 'pointer';

      weekdayRow.appendChild(weekdayCell);

      // Day number
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      if (isToday) dayCell.classList.add('col-today');
      dayCell.textContent = dayNum;
      dayCell.dataset.colIndex = index;
      dayCell.dataset.date = dateStr;

      // Add click handler to switch to hour view for this day
      dayCell.addEventListener('click', () => {
        this.switchToHourViewForDate(dateStr);
      });
      dayCell.style.cursor = 'pointer';

      dayRow.appendChild(dayCell);

      // Last month cell
      if (index === this.dates.length - 1) {
        const monthCell = document.createElement('div');
        monthCell.className = 'month-cell';
        monthCell.style.width = `${monthSpan * 21 - 3}px`; // 18px cell + 3px gap per day, minus last gap
        monthCell.style.minWidth = `${monthSpan * 21 - 3}px`;
        monthCell.textContent = currentMonth;
        monthRow.appendChild(monthCell);
      }
    });
};

  // Render hour header for hour view
BulletHistory.prototype.renderHourHeader = function() {
    console.log('renderHourHeader called, hours:', this.hours.length);

    // Add class to container to enable hour-view specific CSS
    document.querySelector('.container').classList.add('hour-view');

    const monthRow = document.getElementById('monthRow');
    const calendarEventsRow = document.getElementById('calendarEventsRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    monthRow.innerHTML = '';
    calendarEventsRow.innerHTML = '';
    weekdayRow.innerHTML = '';
    dayRow.innerHTML = '';

    // Get current hour string for highlighting
    const currentHourStr = DateUtils.getCurrentHourISO();

    let currentDay = '';
    let daySpan = 0;

    // Iterate through all hours
    this.hours.forEach((hourStr, index) => {
      // Parse hourStr like '2025-12-01T00'
      const [datePart, hourPart] = hourStr.split('T');
      const date = new Date(datePart + 'T00:00:00');
      const hour = parseInt(hourPart);

      // Check if this is the current hour
      const isCurrentHour = hourStr === currentHourStr;

      // Month/Year line: "January 2026"
      const monthYear = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

      // Weekday/Day line: "Saturday 3rd"
      const weekdayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const dayNum = date.getDate();

      const weekdayDay = `${weekdayName} ${dayNum}${DateUtils.getOrdinalSuffix(dayNum)}`;

      // Combine for tracking day changes (include datePart for click handler)
      const dayBanner = `${monthYear}|${weekdayDay}|${datePart}`;

      // Calendar events column
      const eventColumn = document.createElement('div');
      eventColumn.className = 'calendar-event-column';
      eventColumn.dataset.date = hourStr;
      if (isCurrentHour) eventColumn.classList.add('col-today');

      // Render events (if any) for this specific hour
      const hasEvents = this.renderCalendarEventColumnForHour(eventColumn, hourStr);

      // Set empty columns to zero height to save vertical space
      if (!hasEvents) {
        eventColumn.style.height = '0';
        eventColumn.style.padding = '0';
      } else {
        // Make event column clickable if it has events
        eventColumn.style.cursor = 'pointer';
        eventColumn.addEventListener('click', () => {
          this.showHourExpandedView(hourStr);
        });
      }

      calendarEventsRow.appendChild(eventColumn);

      // Day banner (show when day changes) - spans 24 hours
      if (dayBanner !== currentDay) {
        if (daySpan > 0) {
          // Split the stored banner back into parts
          const [prevMonthYear, prevWeekdayDay, prevDatePart] = currentDay.split('|');

          const bannerCell = document.createElement('div');
          bannerCell.className = 'weekday-cell hour-view-day-banner';
          bannerCell.style.width = `${daySpan * 21 - 3}px`;
          bannerCell.style.minWidth = `${daySpan * 21 - 3}px`;
          bannerCell.style.textAlign = 'center';
          bannerCell.style.display = 'flex';
          bannerCell.style.flexDirection = 'column';
          bannerCell.style.alignItems = 'center';
          bannerCell.style.gap = '2px';
          bannerCell.style.padding = '4px 0';

          // Month/Year line (clickable to switch back to day view)
          const monthYearDiv = document.createElement('div');
          monthYearDiv.className = 'hour-view-month-year';
          monthYearDiv.style.fontWeight = '700';
          monthYearDiv.style.fontSize = '11px';
          monthYearDiv.style.cursor = 'pointer';
          monthYearDiv.style.color = '#4285f4';
          monthYearDiv.style.transition = 'opacity 0.15s ease';
          monthYearDiv.textContent = prevMonthYear;
          monthYearDiv.title = 'Click to switch to day view';

          // Add hover effect
          monthYearDiv.addEventListener('mouseenter', () => {
            monthYearDiv.style.opacity = '0.7';
          });
          monthYearDiv.addEventListener('mouseleave', () => {
            monthYearDiv.style.opacity = '1';
          });

          // Click to switch to day view
          monthYearDiv.addEventListener('click', async () => {
            await this.switchView('day');
          });

          // Weekday/Day line (clickable to show expanded view for that day)
          const weekdayDayDiv = document.createElement('div');
          weekdayDayDiv.className = 'hour-view-weekday-day';
          weekdayDayDiv.style.fontWeight = '600';
          weekdayDayDiv.style.fontSize = '10px';
          weekdayDayDiv.style.color = '#666';
          weekdayDayDiv.style.cursor = 'pointer';
          weekdayDayDiv.style.transition = 'opacity 0.15s ease';
          weekdayDayDiv.textContent = prevWeekdayDay;
          weekdayDayDiv.title = 'Click to view all URLs for this day';

          // Add hover effect
          weekdayDayDiv.addEventListener('mouseenter', () => {
            weekdayDayDiv.style.opacity = '0.7';
          });
          weekdayDayDiv.addEventListener('mouseleave', () => {
            weekdayDayDiv.style.opacity = '1';
          });

          // Click to show expanded view for this day
          weekdayDayDiv.addEventListener('click', () => {
            this.showDayExpandedView(prevDatePart);
          });

          bannerCell.appendChild(monthYearDiv);
          bannerCell.appendChild(weekdayDayDiv);
          weekdayRow.appendChild(bannerCell);
        }
        currentDay = dayBanner;
        daySpan = 1;
      } else {
        daySpan++;
      }

      // Hour number - use two-line format (AM/PM + 12-hour)
      const hourCell = document.createElement('div');
      hourCell.className = 'day-cell hour-cell';
      if (isCurrentHour) hourCell.classList.add('col-today');
      hourCell.dataset.colIndex = index; // Add column index for hover functionality
      hourCell.dataset.hourStr = hourStr; // Store hour string for click handler
      hourCell.style.cursor = 'pointer'; // Make it clickable

      // Create two-line layout
      hourCell.style.display = 'flex';
      hourCell.style.flexDirection = 'column';
      hourCell.style.alignItems = 'center';
      hourCell.style.justifyContent = 'center';
      hourCell.style.gap = '0';
      hourCell.style.lineHeight = '1';

      // AM/PM line
      const ampmDiv = document.createElement('div');
      ampmDiv.style.fontSize = '8px';
      ampmDiv.style.fontWeight = '500';
      ampmDiv.style.color = '#999';
      ampmDiv.textContent = hour >= 12 ? 'PM' : 'AM';

      // Hour number line (12-hour format)
      const hourNumDiv = document.createElement('div');
      hourNumDiv.style.fontSize = '11px';
      hourNumDiv.style.fontWeight = '600';
      const hour12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      hourNumDiv.textContent = hour12;

      // Add click handler to show hour expanded view
      hourCell.addEventListener('click', () => {
        this.showHourExpandedView(hourStr);
      });

      hourCell.appendChild(ampmDiv);
      hourCell.appendChild(hourNumDiv);
      dayRow.appendChild(hourCell);

      // Last day banner
      if (index === this.hours.length - 1) {
        // Split the stored banner back into parts
        const [lastMonthYear, lastWeekdayDay, lastDatePart] = currentDay.split('|');

        const bannerCell = document.createElement('div');
        bannerCell.className = 'weekday-cell hour-view-day-banner';
        bannerCell.style.width = `${daySpan * 21 - 3}px`;
        bannerCell.style.minWidth = `${daySpan * 21 - 3}px`;
        bannerCell.style.textAlign = 'center';
        bannerCell.style.display = 'flex';
        bannerCell.style.flexDirection = 'column';
        bannerCell.style.alignItems = 'center';
        bannerCell.style.gap = '2px';
        bannerCell.style.padding = '4px 0';

        // Month/Year line (clickable to switch back to day view)
        const monthYearDiv = document.createElement('div');
        monthYearDiv.className = 'hour-view-month-year';
        monthYearDiv.style.fontWeight = '700';
        monthYearDiv.style.fontSize = '11px';
        monthYearDiv.style.cursor = 'pointer';
        monthYearDiv.style.color = '#4285f4';
        monthYearDiv.style.transition = 'opacity 0.15s ease';
        monthYearDiv.textContent = lastMonthYear;
        monthYearDiv.title = 'Click to switch to day view';

        // Add hover effect
        monthYearDiv.addEventListener('mouseenter', () => {
          monthYearDiv.style.opacity = '0.7';
        });
        monthYearDiv.addEventListener('mouseleave', () => {
          monthYearDiv.style.opacity = '1';
        });

        // Click to switch to day view
        monthYearDiv.addEventListener('click', async () => {
          await this.switchView('day');
        });

        // Weekday/Day line (clickable to show expanded view for that day)
        const weekdayDayDiv = document.createElement('div');
        weekdayDayDiv.className = 'hour-view-weekday-day';
        weekdayDayDiv.style.fontWeight = '600';
        weekdayDayDiv.style.fontSize = '10px';
        weekdayDayDiv.style.color = '#666';
        weekdayDayDiv.style.cursor = 'pointer';
        weekdayDayDiv.style.transition = 'opacity 0.15s ease';
        weekdayDayDiv.textContent = lastWeekdayDay;
        weekdayDayDiv.title = 'Click to view all URLs for this day';

        // Add hover effect
        weekdayDayDiv.addEventListener('mouseenter', () => {
          weekdayDayDiv.style.opacity = '0.7';
        });
        weekdayDayDiv.addEventListener('mouseleave', () => {
          weekdayDayDiv.style.opacity = '1';
        });

        // Click to show expanded view for this day
        weekdayDayDiv.addEventListener('click', () => {
          this.showDayExpandedView(lastDatePart);
        });

        bannerCell.appendChild(monthYearDiv);
        bannerCell.appendChild(weekdayDayDiv);
        weekdayRow.appendChild(bannerCell);
      }
    });
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
    const columnCount = this.viewMode === 'hour' ? this.hours.length : this.dates.length;
    const totalWidth = columnCount * this.colWidth;

    // Create spacer to maintain scroll area
    tldColumn.innerHTML = '<div class="virtual-spacer"></div>';
    cellGrid.innerHTML = '<div class="virtual-spacer"></div>';

    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');

    tldSpacer.style.height = `${totalHeight}px`;
    tldSpacer.style.width = '1px';
    cellSpacer.style.height = `${totalHeight}px`;
    // Width calculation: (N dates * 21px) - 3px (last gap) + 16px (left+right padding) = N*21 + 13
    cellSpacer.style.width = `${totalWidth + 13}px`; // Match date-header-inner width

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

  // Update which rows/columns are visible and render them
BulletHistory.prototype.updateVirtualGrid = function(forceUpdate = false) {
    const tldColumn = document.getElementById('tldColumn');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const cellGrid = document.getElementById('cellGrid');

    // Get viewport dimensions
    const viewportHeight = cellGridWrapper.clientHeight;
    const viewportWidth = cellGridWrapper.clientWidth;
    const scrollTop = cellGridWrapper.scrollTop;
    const scrollLeft = cellGridWrapper.scrollLeft;

    // Calculate visible range with buffer
    const startRow = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.rowBuffer);
    const endRow = Math.min(
      this.sortedDomains.length,
      Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.rowBuffer
    );

    const startCol = Math.max(0, Math.floor(scrollLeft / this.colWidth) - this.colBuffer);
    const columnCount = this.viewMode === 'hour' ? this.hours.length : this.dates.length;
    const endCol = Math.min(
      columnCount,
      Math.ceil((scrollLeft + viewportWidth) / this.colWidth) + this.colBuffer
    );


    // Only update if range changed (unless forced)
    if (
      !forceUpdate &&
      startRow === this.virtualState.startRow &&
      endRow === this.virtualState.endRow &&
      startCol === this.virtualState.startCol &&
      endCol === this.virtualState.endCol
    ) {
      return;
    }

    this.virtualState = { startRow, endRow, startCol, endCol, viewportHeight, viewportWidth };

    // Render visible rows
    this.renderVirtualRows(startRow, endRow, startCol, endCol);
};

  // Render only visible rows
BulletHistory.prototype.renderVirtualRows = function(startRow, endRow, startCol, endCol) {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');

    // Clear existing rows (keep spacer)
    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');
    tldColumn.innerHTML = '';
    cellGrid.innerHTML = '';
    tldColumn.appendChild(tldSpacer);
    cellGrid.appendChild(cellSpacer);

    // Clear column cells map and hovered elements for fresh render
    this.columnCells.clear();
    this.hoveredElements.clear();

    // Pre-compute maxCount for all visible domains (avoid recalculating per row)
    this.maxCountCache.clear();
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain || domain.trim().length === 0 || this.maxCountCache.has(domain)) continue;

      let maxCount = 0;
      if (this.viewMode === 'hour') {
        if (this.hourlyData[domain]) {
          for (const hourStr of Object.keys(this.hourlyData[domain])) {
            const count = this.getUniqueUrlCountForCell(domain, hourStr, true);
            if (count > maxCount) maxCount = count;
          }
        }
      } else {
        if (this.historyData[domain]) {
          for (const dateStr of Object.keys(this.historyData[domain].days)) {
            const count = this.getUniqueUrlCountForCell(domain, dateStr, false);
            if (count > maxCount) maxCount = count;
          }
        }
      }
      this.maxCountCache.set(domain, maxCount || 1); // At least 1 to avoid division by zero
    }

    // Get today's date string for comparison (day view)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);
    const todayIndex = this.dates.indexOf(todayStr);

    // Get current hour string for comparison (hour view)
    const currentHourStr = DateUtils.getCurrentHourISO();
    const currentHourIndex = this.hours.indexOf(currentHourStr);

    // Render visible rows
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain || domain.trim().length === 0) continue;

      // Use pre-computed maxCount from cache
      const maxCount = this.maxCountCache.get(domain) || 1;

      // TLD label
      const tldRow = document.createElement('div');
      tldRow.className = 'tld-row';
      tldRow.dataset.rowIndex = rowIndex;
      tldRow.style.position = 'absolute';
      tldRow.style.top = `${rowIndex * this.rowHeight + 8}px`; // Add 8px padding
      tldRow.style.width = '100%';

      // Favicon
      const favicon = document.createElement('img');
      favicon.className = 'tld-favicon';

      // Use indexed faviconsByDomain for O(1) lookup instead of O(n) iteration
      const cachedTldFavicon = this.faviconsByDomain.get(domain);

      // Use cached favicon if available, otherwise fall back to Google's service
      const tldFaviconSrc = `https://www.google.com/s2/favicons?domain=https://${domain}&sz=16`;
      favicon.src = cachedTldFavicon || tldFaviconSrc;
      favicon.alt = '';
      favicon.width = 16;
      favicon.height = 16;

      // Add error handler with multi-level fallback
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
          // All fallbacks failed - hide the broken image
          favicon.style.display = 'none';
        }
      };

      tldRow.appendChild(favicon);

      // Domain name span
      const domainSpan = document.createElement('span');
      domainSpan.className = 'tld-name';
      domainSpan.textContent = domain;
      tldRow.appendChild(domainSpan);

      // Delete button (shown on hover)
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'tld-delete-btn';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Delete all history for this domain';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent row click
        // Find the TLD row element and animate it
        const tldRow = e.target.closest('.tld-row');
        this.deleteDomainWithAnimation(tldRow, domain);
      });
      tldRow.appendChild(deleteBtn);

      tldColumn.appendChild(tldRow);

      // Cell row
      const cellRow = document.createElement('div');
      cellRow.className = 'cell-row';
      cellRow.dataset.rowIndex = rowIndex;
      cellRow.style.position = 'absolute';
      cellRow.style.top = `${rowIndex * this.rowHeight + 8}px`; // Add 8px padding
      cellRow.style.left = '0';
      const columnCount = this.viewMode === 'hour' ? this.hours.length : this.dates.length;
      cellRow.style.width = `${columnCount * this.colWidth + 13}px`; // Match date-header-inner width

      // Add today/current hour column highlight
      if (this.viewMode === 'day' && todayIndex !== -1) {
        cellRow.classList.add('has-today-col');
        // Add special class for first row to extend highlight upward
        if (rowIndex === startRow) {
          cellRow.classList.add('first-row-today');
        }
        const todayColLeft = todayIndex * this.colWidth + 8 - 1; // Position to center the 20px highlight (1px padding on each side)
        cellRow.style.setProperty('--today-col-left', `${todayColLeft}px`);
      } else if (this.viewMode === 'hour' && currentHourIndex !== -1) {
        cellRow.classList.add('has-today-col');
        // Add special class for first row to extend highlight upward
        if (rowIndex === startRow) {
          cellRow.classList.add('first-row-today');
        }
        const currentHourColLeft = currentHourIndex * this.colWidth + 8 - 1;
        cellRow.style.setProperty('--today-col-left', `${currentHourColLeft}px`);
      }

      // Render visible columns
      for (let colIndex = startCol; colIndex < endCol; colIndex++) {
        let columnKey, visitData;

        if (this.viewMode === 'hour') {
          // Hour view: column key is hour (0-23)
          columnKey = this.hours[colIndex];
          if (columnKey === undefined) continue;
          visitData = this.hourlyData[domain]?.[columnKey];
        } else {
          // Day view: column key is date string
          columnKey = this.dates[colIndex];
          if (!columnKey) continue;
          visitData = this.historyData[domain].days[columnKey];
        }

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.domain = domain;
        cell.dataset.date = columnKey; // columnKey is hourStr in hour view, dateStr in day view
        cell.dataset.colIndex = colIndex;
        cell.dataset.rowIndex = rowIndex;
        cell.style.position = 'absolute';
        cell.style.left = `${colIndex * this.colWidth + 8}px`; // Add left padding

        // Add cell to columnCells map for fast column highlighting (use string key for consistency with dataset)
        const colKey = String(colIndex);
        if (!this.columnCells.has(colKey)) {
          this.columnCells.set(colKey, new Set());
        }
        this.columnCells.get(colKey).add(cell);

        // Check if this is today's column (day view) or current hour (hour view)
        if (this.viewMode === 'day' && columnKey === todayStr) {
          cell.classList.add('col-today');
        } else if (this.viewMode === 'hour' && columnKey === currentHourStr) {
          cell.classList.add('col-today');
        }

        // Get unique URL count from time data (or fallback to visit data)
        const isHourView = this.viewMode === 'hour';
        const uniqueUrlCount = this.getUniqueUrlCountForCell(domain, columnKey, isHourView);

        if (uniqueUrlCount > 0) {
          const baseColor = this.colors[domain];
          // Use GitHub-style discrete color levels based on unique URL count
          cell.style.backgroundColor = this.getGitHubStyleColor(uniqueUrlCount, maxCount, baseColor);

          cell.dataset.count = uniqueUrlCount;
        } else if (visitData && visitData.count > 0) {
          // Fallback: if no time data but has visits, show with minimal intensity
          const baseColor = this.colors[domain];
          cell.style.backgroundColor = this.getGitHubStyleColor(1, maxCount, baseColor);
          cell.dataset.count = 1;
        } else {
          cell.classList.add('empty');
          cell.dataset.count = 0;
        }

        cellRow.appendChild(cell);
      }

      cellGrid.appendChild(cellRow);
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
      if (e.target.classList.contains('cell')) {
        const count = parseInt(e.target.dataset.count) || 0;
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;

        if (count > 0) {
          tooltip.textContent = `${count} tab${count !== 1 ? 's' : ''} open`;
          tooltip.classList.add('visible');

          // Position tooltip near cursor
          const rect = e.target.getBoundingClientRect();
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - 30}px`;
          tooltip.style.transform = 'translateX(-50%)';
        }
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('cell')) {
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

    // Hover over cell
    cellGrid.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('cell')) {
        const rowIndex = e.target.dataset.rowIndex;
        const colIndex = e.target.dataset.colIndex;

        // Highlight the TLD row
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.add('row-hover');
          this.hoveredElements.add(tldRow);
        }

        // Highlight the cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
          this.hoveredElements.add(cellRow);
        }

        // Highlight the weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.add('col-hover');
          this.hoveredElements.add(weekdayCell);
        }

        // Highlight the day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.add('col-hover');
          this.hoveredElements.add(dayCell);
        }

        // Highlight the calendar event column
        const calendarEventsRow = document.getElementById('calendarEventsRow');
        if (calendarEventsRow) {
          const eventColumns = calendarEventsRow.children;
          if (eventColumns[colIndex]) {
            eventColumns[colIndex].classList.add('col-hover');
            this.hoveredElements.add(eventColumns[colIndex]);
          }
        }

        // Highlight all cells in the column - use cached columnCells map for O(1) lookup
        const columnCellSet = this.columnCells.get(colIndex);
        if (columnCellSet) {
          for (const cell of columnCellSet) {
            cell.classList.add('col-hover');
            this.hoveredElements.add(cell);
          }
        }
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('cell')) {
        const rowIndex = e.target.dataset.rowIndex;
        const colIndex = e.target.dataset.colIndex;

        // Remove highlight from TLD row
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.remove('row-hover');
          this.hoveredElements.delete(tldRow);
        }

        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
          this.hoveredElements.delete(cellRow);
        }

        // Remove highlight from weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.remove('col-hover');
          this.hoveredElements.delete(weekdayCell);
        }

        // Remove highlight from day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.remove('col-hover');
          this.hoveredElements.delete(dayCell);
        }

        // Remove highlight from calendar event column
        const calendarEventsRow = document.getElementById('calendarEventsRow');
        if (calendarEventsRow) {
          const eventColumns = calendarEventsRow.children;
          if (eventColumns[colIndex]) {
            eventColumns[colIndex].classList.remove('col-hover');
            this.hoveredElements.delete(eventColumns[colIndex]);
          }
        }

        // Remove highlight from column cells - use cached columnCells map
        const columnCellSet = this.columnCells.get(colIndex);
        if (columnCellSet) {
          for (const cell of columnCellSet) {
            cell.classList.remove('col-hover');
            this.hoveredElements.delete(cell);
          }
        }
      }
    });
};

  // Setup column header hover (for day-cell and weekday-cell in header)
BulletHistory.prototype.setupColumnHeaderHover = function() {
    const dayRow = document.getElementById('dayRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const calendarEventsRow = document.getElementById('calendarEventsRow');
    const cellGrid = document.getElementById('cellGrid');

    // Helper function to highlight column - optimized to use columnCells map
    const highlightColumn = (colIndex) => {
      // Highlight the weekday cell
      const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
      if (weekdayCell) {
        weekdayCell.classList.add('col-hover');
        this.hoveredElements.add(weekdayCell);
      }

      // Highlight the day cell
      const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
      if (dayCell) {
        dayCell.classList.add('col-hover');
        this.hoveredElements.add(dayCell);
      }

      // Highlight the calendar event column
      if (calendarEventsRow) {
        const eventColumns = calendarEventsRow.children;
        if (eventColumns[colIndex]) {
          eventColumns[colIndex].classList.add('col-hover');
          this.hoveredElements.add(eventColumns[colIndex]);
        }
      }

      // Highlight all cells in the column - use cached columnCells map for O(1) lookup
      const columnCellSet = this.columnCells.get(colIndex);
      if (columnCellSet) {
        for (const cell of columnCellSet) {
          cell.classList.add('col-hover');
          this.hoveredElements.add(cell);
        }
      }
    };

    // Helper function to remove column highlight - optimized to use columnCells map
    const removeColumnHighlight = (colIndex) => {
      // Remove highlight from weekday cell
      const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
      if (weekdayCell) {
        weekdayCell.classList.remove('col-hover');
        this.hoveredElements.delete(weekdayCell);
      }

      // Remove highlight from day cell
      const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
      if (dayCell) {
        dayCell.classList.remove('col-hover');
        this.hoveredElements.delete(dayCell);
      }

      // Remove highlight from calendar event column
      if (calendarEventsRow) {
        const eventColumns = calendarEventsRow.children;
        if (eventColumns[colIndex]) {
          eventColumns[colIndex].classList.remove('col-hover');
          this.hoveredElements.delete(eventColumns[colIndex]);
        }
      }

      // Remove highlight from column cells - use cached columnCells map
      const columnCellSet = this.columnCells.get(colIndex);
      if (columnCellSet) {
        for (const cell of columnCellSet) {
          cell.classList.remove('col-hover');
          this.hoveredElements.delete(cell);
        }
      }
    };

    // Day cell hover
    dayRow.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('day-cell')) {
        const colIndex = e.target.dataset.colIndex;
        if (colIndex !== undefined) {
          highlightColumn(colIndex);
        }
      }
    });

    dayRow.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('day-cell')) {
        const colIndex = e.target.dataset.colIndex;
        if (colIndex !== undefined) {
          removeColumnHighlight(colIndex);
        }
      }
    });

    // Weekday cell hover
    weekdayRow.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('weekday-cell')) {
        const colIndex = e.target.dataset.colIndex;
        if (colIndex !== undefined) {
          highlightColumn(colIndex);
        }
      }
    });

    weekdayRow.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('weekday-cell')) {
        const colIndex = e.target.dataset.colIndex;
        if (colIndex !== undefined) {
          removeColumnHighlight(colIndex);
        }
      }
    });

    // Hour cell hover (for hourly view)
    // Need to check both target and closest parent since hour cells contain child divs
    dayRow.addEventListener('mouseover', (e) => {
      const hourCell = e.target.classList.contains('hour-cell') ? e.target : e.target.closest('.hour-cell');
      if (hourCell) {
        const colIndex = hourCell.dataset.colIndex;
        if (colIndex !== undefined) {
          highlightColumn(colIndex);
        }
      }
    });

    dayRow.addEventListener('mouseout', (e) => {
      const hourCell = e.target.classList.contains('hour-cell') ? e.target : e.target.closest('.hour-cell');
      if (hourCell) {
        const colIndex = hourCell.dataset.colIndex;
        if (colIndex !== undefined) {
          removeColumnHighlight(colIndex);
        }
      }
    });

    // Calendar event column hover (works for both day and hour views)
    if (calendarEventsRow) {
      calendarEventsRow.addEventListener('mouseover', (e) => {
        const eventColumn = e.target.classList.contains('calendar-event-column') ? e.target : e.target.closest('.calendar-event-column');
        if (eventColumn) {
          // Find the column index by getting the index of this element among its siblings
          const colIndex = Array.from(calendarEventsRow.children).indexOf(eventColumn);
          if (colIndex !== -1) {
            highlightColumn(colIndex);
          }
        }
      });

      calendarEventsRow.addEventListener('mouseout', (e) => {
        const eventColumn = e.target.classList.contains('calendar-event-column') ? e.target : e.target.closest('.calendar-event-column');
        if (eventColumn) {
          // Find the column index by getting the index of this element among its siblings
          const colIndex = Array.from(calendarEventsRow.children).indexOf(eventColumn);
          if (colIndex !== -1) {
            removeColumnHighlight(colIndex);
          }
        }
      });
    }
};

  // Setup cell click to expand and show URLs
BulletHistory.prototype.setupCellClick = function() {
    const cellGrid = document.getElementById('cellGrid');
    const expandedView = document.getElementById('expandedView');
    const closeBtn = document.getElementById('closeExpanded');

    // Click on cell to expand
    cellGrid.addEventListener('click', (e) => {
      if (e.target.classList.contains('cell') && !e.target.classList.contains('empty')) {
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;
        const count = parseInt(e.target.dataset.count);

        // If clicking the same cell, close it
        if (this.selectedCell === e.target) {
          this.closeExpandedView();
          return;
        }

        // Remove previous selection
        if (this.selectedCell) {
          this.selectedCell.classList.remove('selected');
        }

        // Mark as selected
        e.target.classList.add('selected');
        this.selectedCell = e.target;

        // Show expanded view based on view mode
        if (this.viewMode === 'hour') {
          // In hour view, date is actually hourStr, show URLs for specific domain and hour
          this.showDomainHourView(domain, date, count);
        } else {
          // In day view, show URLs for specific domain and date
          this.showExpandedView(domain, date, count);
        }
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.closeExpandedView();
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
