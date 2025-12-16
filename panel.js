// Bullet History - Main Panel Script

class BulletHistory {
  constructor() {
    this.historyData = {}; // { domain: { lastVisit, days: { date: { count, urls } } } }
    this.colors = {}; // { domain: color }
    this.dates = [];
    this.sortedDomains = []; // Cached sorted domain list

    // Virtualization settings
    this.rowHeight = 21; // 18px cell + 3px gap
    this.colWidth = 21; // 18px cell + 3px gap
    this.rowBuffer = 10; // Extra rows to render above/below viewport
    this.colBuffer = 5; // Extra columns to render left/right of viewport

    // Virtualization state
    this.virtualState = {
      startRow: 0,
      endRow: 0,
      startCol: 0,
      endCol: 0,
      viewportHeight: 0,
      viewportWidth: 0
    };

    // DEBUG MODE: Set to true to generate fake history for testing
    this.useFakeData = false;
    this.fakeDomainCount = 100; // Number of domains to generate
    this.fakeDaysBack = 365; // Days of history to generate

    this.init();
  }

  async init() {
    await this.loadColors();
    await this.fetchHistory();
    this.generateDates();
    this.sortedDomains = this.getSortedDomains();
    this.renderDateHeader();
    this.setupVirtualGrid();
    this.setupScrollSync();
    this.setupTooltips();
    this.setupRowHover();
    this.setupCellClick();
    this.selectedCell = null;
  }

  // Generate date range from first to last history date
  generateDates() {
    // Find the earliest visit date from history data
    let earliestDate = new Date();

    for (const domain in this.historyData) {
      for (const dateStr in this.historyData[domain].days) {
        const date = new Date(dateStr);
        if (date < earliestDate) earliestDate = date;
      }
    }

    // Always show through today
    const latestDate = new Date();
    latestDate.setHours(0, 0, 0, 0);

    // If no history, show last 30 days
    if (!Object.keys(this.historyData).length) {
      earliestDate = new Date();
      earliestDate.setDate(earliestDate.getDate() - 30);
    }

    // Generate all dates between earliest and today
    this.dates = [];
    const current = new Date(earliestDate);
    current.setHours(0, 0, 0, 0);

    while (current <= latestDate) {
      this.dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

    console.log('Generated dates:', this.dates);
    console.log(`Showing ${this.dates.length} days of history`);
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fetch Chrome history (all available) or generate fake data
  async fetchHistory() {
    if (this.useFakeData) {
      this.generateFakeHistory();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      chrome.history.search({
        text: '',
        startTime: 0, // Get all history
        maxResults: 0  // No limit
      }, (results) => {
        this.parseHistory(results);
        resolve();
      });
    });
  }

  // Generate fake history data for testing
  generateFakeHistory() {
    this.historyData = {};

    const fakeDomains = [
      'google.com', 'github.com', 'stackoverflow.com', 'reddit.com', 'twitter.com',
      'youtube.com', 'facebook.com', 'amazon.com', 'netflix.com', 'linkedin.com',
      'wikipedia.org', 'medium.com', 'dev.to', 'hackernews.com', 'producthunt.com',
      'dribbble.com', 'behance.net', 'figma.com', 'notion.so', 'slack.com',
      'discord.com', 'twitch.tv', 'spotify.com', 'soundcloud.com', 'pinterest.com',
      'instagram.com', 'tiktok.com', 'snapchat.com', 'tumblr.com', 'vimeo.com',
      'dropbox.com', 'drive.google.com', 'docs.google.com', 'sheets.google.com',
      'mail.google.com', 'outlook.com', 'zoom.us', 'meet.google.com', 'teams.microsoft.com',
      'trello.com', 'asana.com', 'jira.atlassian.com', 'confluence.atlassian.com',
      'gitlab.com', 'bitbucket.org', 'docker.com', 'kubernetes.io', 'aws.amazon.com',
      'azure.microsoft.com', 'cloud.google.com', 'heroku.com', 'vercel.com', 'netlify.com'
    ];

    // Generate additional random domains to reach fakeDomainCount
    while (fakeDomains.length < this.fakeDomainCount) {
      const randomName = Math.random().toString(36).substring(7);
      fakeDomains.push(`${randomName}.com`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // For each domain, generate random visit data
    fakeDomains.forEach(domain => {
      const lastVisit = Date.now() - Math.random() * (this.fakeDaysBack * 24 * 60 * 60 * 1000);

      this.historyData[domain] = {
        lastVisit: lastVisit,
        days: {}
      };

      // Generate visits for random days
      const numDaysWithVisits = Math.floor(Math.random() * this.fakeDaysBack * 0.3); // Visit 30% of days on average

      for (let i = 0; i < numDaysWithVisits; i++) {
        const daysAgo = Math.floor(Math.random() * this.fakeDaysBack);
        const date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        const dateStr = this.formatDate(date);

        if (!this.historyData[domain].days[dateStr]) {
          const visitCount = Math.floor(Math.random() * 50) + 1; // 1-50 visits per day
          this.historyData[domain].days[dateStr] = {
            count: visitCount,
            urls: Array(Math.min(visitCount, 10)).fill(null).map((_, idx) => ({
              url: `https://${domain}/page${idx}`,
              title: `Page ${idx} - ${domain}`,
              lastVisit: date.getTime(),
              visitCount: 1
            }))
          };
        }
      }
    });

    // Generate colors for all domains
    for (const domain in this.historyData) {
      if (!this.colors[domain]) {
        this.colors[domain] = this.generatePastelColor();
      }
    }

    console.log(`Generated fake history: ${fakeDomains.length} domains, ${this.fakeDaysBack} days`);
  }

  // Parse history into domain/day structure
  parseHistory(results) {
    this.historyData = {};

    console.log(`Parsing ${results.length} history items`);

    for (const item of results) {
      try {
        const url = new URL(item.url);
        const domain = url.hostname.replace('www.', '');

        // Create date from timestamp and normalize to local midnight
        const visitDateObj = new Date(item.lastVisitTime);
        visitDateObj.setHours(0, 0, 0, 0);
        const visitDate = this.formatDate(visitDateObj);

        if (!this.historyData[domain]) {
          this.historyData[domain] = {
            lastVisit: item.lastVisitTime,
            days: {}
          };
        }

        if (!this.historyData[domain].days[visitDate]) {
          this.historyData[domain].days[visitDate] = {
            count: 0,
            urls: []
          };
        }

        // Update last visit if more recent
        if (item.lastVisitTime > this.historyData[domain].lastVisit) {
          this.historyData[domain].lastVisit = item.lastVisitTime;
        }

        this.historyData[domain].days[visitDate].count += item.visitCount || 1;
        this.historyData[domain].days[visitDate].urls.push({
          url: item.url,
          title: item.title,
          lastVisit: item.lastVisitTime,
          visitCount: item.visitCount || 1
        });

      } catch (e) {
        // Skip invalid URLs
        console.warn('Invalid URL:', item.url);
      }
    }

    // Generate colors for new domains
    for (const domain in this.historyData) {
      if (!this.colors[domain]) {
        this.colors[domain] = this.generatePastelColor();
      }
    }

    // Debug: show unique dates in history data
    const allDates = new Set();
    for (const domain in this.historyData) {
      for (const date in this.historyData[domain].days) {
        allDates.add(date);
      }
    }
    console.log('Dates with history data:', Array.from(allDates).sort());

    this.saveColors();
  }

  // Generate a random pastel color
  generatePastelColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 20); // 60-80%
    const lightness = 80 + Math.floor(Math.random() * 10);  // 80-90%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // Load colors from storage
  async loadColors() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['domainColors'], (result) => {
        this.colors = result.domainColors || {};
        resolve();
      });
    });
  }

  // Save colors to storage
  saveColors() {
    chrome.storage.local.set({ domainColors: this.colors });
  }

  // Get sorted domains (most recent first)
  getSortedDomains() {
    return Object.keys(this.historyData).sort((a, b) => {
      return this.historyData[b].lastVisit - this.historyData[a].lastVisit;
    });
  }

  // Render date header
  renderDateHeader() {
    const monthRow = document.getElementById('monthRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    monthRow.innerHTML = '';
    weekdayRow.innerHTML = '';
    dayRow.innerHTML = '';

    let currentMonth = '';
    let monthSpan = 0;

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

      // Debug first few dates
      if (index < 3 || index > this.dates.length - 3) {
        console.log(`Date ${index}: ${dateStr} -> day ${dayNum}, ${weekdayName}`);
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

      // Weekday letter
      const weekdayCell = document.createElement('div');
      weekdayCell.className = 'weekday-cell';
      weekdayCell.textContent = weekdayName;
      weekdayCell.dataset.colIndex = index;
      weekdayRow.appendChild(weekdayCell);

      // Day number
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      dayCell.textContent = dayNum;
      dayCell.dataset.colIndex = index;
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
  }

  // Calculate cell saturation based on visit count
  getCellSaturation(count, maxCount) {
    if (count === 0) return 0;
    const minSaturation = 40; // Raised from 20 for more vivid colors
    const maxSaturation = 90;
    // Use square root for better distribution - makes lower values more vivid
    const normalized = Math.sqrt(Math.min(count / maxCount, 1));
    return minSaturation + (normalized * (maxSaturation - minSaturation));
  }

  // Setup virtual grid with spacers
  setupVirtualGrid() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const cellGrid = document.getElementById('cellGrid');

    // Calculate total dimensions
    const totalHeight = this.sortedDomains.length * this.rowHeight + 11; // Add top (8px) + bottom (3px) padding
    const totalWidth = this.dates.length * this.colWidth;

    // Create spacer to maintain scroll area
    tldColumn.innerHTML = '<div class="virtual-spacer"></div>';
    cellGrid.innerHTML = '<div class="virtual-spacer"></div>';

    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');

    tldSpacer.style.height = `${totalHeight}px`;
    tldSpacer.style.width = '1px';
    cellSpacer.style.height = `${totalHeight}px`;
    cellSpacer.style.width = `${totalWidth + 16}px`; // Add padding

    // Initial render
    this.updateVirtualGrid();

    // Re-render on scroll
    cellGridWrapper.addEventListener('scroll', () => {
      this.updateVirtualGrid();
    });

    // Re-render on resize
    window.addEventListener('resize', () => {
      this.updateVirtualGrid();
    });
  }

  // Update which rows/columns are visible and render them
  updateVirtualGrid() {
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
    const endCol = Math.min(
      this.dates.length,
      Math.ceil((scrollLeft + viewportWidth) / this.colWidth) + this.colBuffer
    );

    // Only update if range changed
    if (
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
  }

  // Render only visible rows
  renderVirtualRows(startRow, endRow, startCol, endCol) {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');

    // Clear existing rows (keep spacer)
    const tldSpacer = tldColumn.querySelector('.virtual-spacer');
    const cellSpacer = cellGrid.querySelector('.virtual-spacer');
    tldColumn.innerHTML = '';
    cellGrid.innerHTML = '';
    tldColumn.appendChild(tldSpacer);
    cellGrid.appendChild(cellSpacer);

    // Find max visit count for saturation calculation
    let maxCount = 0;
    this.sortedDomains.forEach(domain => {
      Object.values(this.historyData[domain].days).forEach(day => {
        maxCount = Math.max(maxCount, day.count);
      });
    });

    // Render visible rows
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain) continue;

      // TLD label
      const tldRow = document.createElement('div');
      tldRow.className = 'tld-row';
      tldRow.textContent = domain;
      tldRow.dataset.rowIndex = rowIndex;
      tldRow.style.position = 'absolute';
      tldRow.style.top = `${rowIndex * this.rowHeight + 8}px`; // Add 8px padding
      tldRow.style.width = '150px';
      tldColumn.appendChild(tldRow);

      // Cell row
      const cellRow = document.createElement('div');
      cellRow.className = 'cell-row';
      cellRow.dataset.rowIndex = rowIndex;
      cellRow.style.position = 'absolute';
      cellRow.style.top = `${rowIndex * this.rowHeight + 8}px`; // Add 8px padding
      cellRow.style.left = '0';
      cellRow.style.width = `${this.dates.length * this.colWidth + 16}px`; // Full width of all dates + padding

      // Render visible columns
      for (let colIndex = startCol; colIndex < endCol; colIndex++) {
        const dateStr = this.dates[colIndex];
        if (!dateStr) continue;

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.domain = domain;
        cell.dataset.date = dateStr;
        cell.dataset.colIndex = colIndex;
        cell.dataset.rowIndex = rowIndex;
        cell.style.position = 'absolute';
        cell.style.left = `${colIndex * this.colWidth + 8}px`; // Add left padding

        const dayData = this.historyData[domain].days[dateStr];

        if (dayData && dayData.count > 0) {
          const baseColor = this.colors[domain];
          const saturation = this.getCellSaturation(dayData.count, maxCount);

          // Parse HSL and adjust saturation
          const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
          if (hslMatch) {
            const [, h, , l] = hslMatch;
            cell.style.backgroundColor = `hsl(${h}, ${saturation}%, ${l}%)`;
          } else {
            cell.style.backgroundColor = baseColor;
          }

          cell.dataset.count = dayData.count;
        } else {
          cell.classList.add('empty');
          cell.dataset.count = 0;
        }

        cellRow.appendChild(cell);
      }

      cellGrid.appendChild(cellRow);
    }
  }

  // Sync scrolling between date header and cell grid
  setupScrollSync() {
    const dateHeader = document.getElementById('dateHeader');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const tldColumn = document.getElementById('tldColumn');

    // Sync horizontal scroll: grid -> header
    // Sync vertical scroll: grid -> tld column
    cellGridWrapper.addEventListener('scroll', () => {
      dateHeader.scrollLeft = cellGridWrapper.scrollLeft;
      tldColumn.scrollTop = cellGridWrapper.scrollTop;
    });

    // Sync horizontal scroll: header -> grid
    dateHeader.addEventListener('scroll', () => {
      cellGridWrapper.scrollLeft = dateHeader.scrollLeft;
    });

    // Sync vertical scroll: tld column -> grid
    tldColumn.addEventListener('scroll', () => {
      cellGridWrapper.scrollTop = tldColumn.scrollTop;
    });

    // Scroll to show today (right edge)
    cellGridWrapper.scrollLeft = cellGridWrapper.scrollWidth;
  }

  // Setup hover tooltips
  setupTooltips() {
    const tooltip = document.getElementById('tooltip');
    const cellGrid = document.getElementById('cellGrid');

    cellGrid.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('cell')) {
        const count = parseInt(e.target.dataset.count) || 0;
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;

        if (count > 0) {
          tooltip.textContent = `${count} visit${count !== 1 ? 's' : ''}`;
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
  }

  // Setup row hover highlighting
  setupRowHover() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    // Hover over TLD row
    tldColumn.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Highlight the TLD row
        e.target.classList.add('row-hover');
        // Highlight the corresponding cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
        }
      }
    });

    tldColumn.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Remove highlight from TLD row
        e.target.classList.remove('row-hover');
        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
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
        }

        // Highlight the cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
        }

        // Highlight the weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.add('col-hover');
        }

        // Highlight the day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.add('col-hover');
        }

        // Highlight all cells in the column
        const columnCells = cellGrid.querySelectorAll(`.cell[data-col-index="${colIndex}"]`);
        columnCells.forEach(cell => cell.classList.add('col-hover'));
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
        }

        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
        }

        // Remove highlight from weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.remove('col-hover');
        }

        // Remove highlight from day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.remove('col-hover');
        }

        // Remove highlight from column cells
        const columnCells = cellGrid.querySelectorAll(`.cell[data-col-index="${colIndex}"]`);
        columnCells.forEach(cell => cell.classList.remove('col-hover'));
      }
    });
  }

  // Setup cell click to expand and show URLs
  setupCellClick() {
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

        // Show expanded view
        this.showExpandedView(domain, date, count);
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      this.closeExpandedView();
    });
  }

  // Show expanded view with URLs
  showExpandedView(domain, date, count) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Format date nicely
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Set title
    expandedTitle.textContent = `${domain} - ${formattedDate} (${count} visit${count !== 1 ? 's' : ''})`;

    // Get URLs for this cell
    const dayData = this.historyData[domain].days[date];
    if (!dayData || !dayData.urls) {
      urlList.innerHTML = '<div style="padding: 16px; color: #999;">No URLs found</div>';
      expandedView.style.display = 'block';
      return;
    }

    // Sort URLs chronologically (most recent first)
    const urls = [...dayData.urls].sort((a, b) => b.lastVisit - a.lastVisit);

    // Render URL list
    urlList.innerHTML = '';
    urls.forEach(urlData => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';

      // Left side: count + actions
      const leftDiv = document.createElement('div');
      leftDiv.className = 'url-item-left';

      const countSpan = document.createElement('span');
      countSpan.className = 'url-item-count';
      countSpan.textContent = `${urlData.visitCount}×`;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'url-item-actions';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete';
      deleteBtn.textContent = 'delete';
      deleteBtn.title = 'Delete from history';
      deleteBtn.addEventListener('click', () => this.deleteUrl(urlData.url, domain, date));

      const bookmarkBtn = document.createElement('button');
      bookmarkBtn.className = 'icon-btn bookmark';
      bookmarkBtn.textContent = 'save';
      bookmarkBtn.title = 'Toggle bookmark';
      bookmarkBtn.addEventListener('click', () => this.toggleBookmark(urlData.url, urlData.title, bookmarkBtn));

      // Check if URL is already bookmarked
      this.checkBookmarkStatus(urlData.url, bookmarkBtn);

      actionsDiv.appendChild(deleteBtn);
      actionsDiv.appendChild(bookmarkBtn);

      leftDiv.appendChild(countSpan);
      leftDiv.appendChild(actionsDiv);

      // Right side: URL as clickable link
      const rightDiv = document.createElement('div');
      rightDiv.className = 'url-item-right';

      const urlLink = document.createElement('a');
      urlLink.href = urlData.url;
      urlLink.textContent = urlData.url;
      urlLink.target = '_blank';
      urlLink.rel = 'noopener noreferrer';

      rightDiv.appendChild(urlLink);

      urlItem.appendChild(leftDiv);
      urlItem.appendChild(rightDiv);
      urlList.appendChild(urlItem);
    });

    // Show expanded view
    expandedView.style.display = 'block';
  }

  // Close expanded view
  closeExpandedView() {
    const expandedView = document.getElementById('expandedView');
    expandedView.style.display = 'none';

    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected');
      this.selectedCell = null;
    }
  }

  // Delete URL from history
  async deleteUrl(url, domain, date) {
    // Delete from Chrome history
    chrome.history.deleteUrl({ url: url }, () => {
      console.log(`Deleted: ${url}`);

      // Update local data
      const dayData = this.historyData[domain].days[date];
      if (dayData) {
        // Remove URL from list
        const urlIndex = dayData.urls.findIndex(u => u.url === url);
        if (urlIndex !== -1) {
          const deletedUrl = dayData.urls[urlIndex];
          dayData.urls.splice(urlIndex, 1);
          dayData.count -= deletedUrl.visitCount;

          // If no more URLs for this day, remove the day and close view
          if (dayData.urls.length === 0 || dayData.count <= 0) {
            delete this.historyData[domain].days[date];
            this.closeExpandedView();
            this.updateVirtualGrid();
          } else {
            // Refresh expanded view with updated URLs
            this.showExpandedView(domain, date, dayData.count);
            this.updateVirtualGrid();
          }

          // If domain has no more days, remove domain
          if (Object.keys(this.historyData[domain].days).length === 0) {
            delete this.historyData[domain];
            this.sortedDomains = this.getSortedDomains();
          }
        }
      }
    });
  }

  // Check if URL is bookmarked and update button state
  checkBookmarkStatus(url, bookmarkBtn) {
    chrome.bookmarks.search({ url: url }, (results) => {
      if (results && results.length > 0) {
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.dataset.bookmarkId = results[0].id;
      }
    });
  }

  // Toggle bookmark (add or remove)
  toggleBookmark(url, title, bookmarkBtn) {
    const bookmarkId = bookmarkBtn.dataset.bookmarkId;

    if (bookmarkId) {
      // Remove bookmark
      chrome.bookmarks.remove(bookmarkId, () => {
        console.log(`Removed bookmark: ${url}`);
        bookmarkBtn.classList.remove('saved');
        delete bookmarkBtn.dataset.bookmarkId;
      });
    } else {
      // Add bookmark
      chrome.bookmarks.create({
        title: title || url,
        url: url
      }, (bookmark) => {
        console.log(`Bookmarked: ${url}`);
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.dataset.bookmarkId = bookmark.id;
      });
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BulletHistory();
});
