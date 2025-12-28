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

    // Open Graph metadata cache (title and description only, no images)
    this.ogCache = new Map();

    this.init();
  }

  async init() {
    // Initialize state before loading data
    this.selectedCell = null;
    this.expandedViewType = null; // 'cell', 'domain', or 'full'
    this.currentDomain = null; // Track current domain for domain view
    this.sortMode = 'recent'; // 'recent', 'frequency', or 'alphabetical'
    this.searchFilter = ''; // Search filter text
    this.virtualGridInitialized = false; // Track if listeners are set up
    this.itemsPerPage = 100; // Items per page
    // Track pagination per view type
    this.viewPagination = {
      full: 1,
      recent: 1,
      bookmarks: 1,
      frequent: 1,
      domain: 1,
      cell: 1
    };

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
    this.setupLiveUpdates();
    this.setupSortDropdown();
    this.setupSearchInput();
    this.setupBottomMenu();
    this.setupZoomControls();
    this.setupResizeHandle();
    this.setupDateChangeDetection();
    this.setupExpandedViewZoomHandler();

    // Show full history by default
    this.showFullHistory();

    // Scroll to show today (not future days)
    this.scrollToToday();
  }

  // Detect when the date changes and update the header
  setupDateChangeDetection() {
    // Store the current date
    let lastDate = this.formatDate(new Date());

    // Update when the page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentDate = this.formatDate(today);

        if (currentDate !== lastDate) {
          // Date changed while user was away!
          lastDate = currentDate;
          this.renderDateHeader();
          this.updateVirtualGrid();
          this.scrollToToday();
        } else {
          // Date hasn't changed, but still scroll to today in case TLD width changed
          this.scrollToToday();
        }
      }
    });

    // Also check on focus (when side panel is opened)
    window.addEventListener('focus', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentDate = this.formatDate(today);

      if (currentDate !== lastDate) {
        lastDate = currentDate;
        this.renderDateHeader();
        this.updateVirtualGrid();
        this.scrollToToday();
      } else {
        // Date hasn't changed, but still scroll to today in case TLD width changed
        this.scrollToToday();
      }
    });
  }

  // Handle zoom changes to recalculate expanded view scroll area
  setupExpandedViewZoomHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const expandedView = document.getElementById('expandedView');
        if (expandedView && expandedView.style.display !== 'none') {
          // Force browser to recalculate scroll area
          expandedView.style.overflow = 'hidden';
          expandedView.offsetHeight; // Force reflow
          expandedView.style.overflow = 'auto';
        }
      }, 100);
    });
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

    // Always show through today + 1 week
    const latestDate = new Date();
    latestDate.setHours(0, 0, 0, 0);
    latestDate.setDate(latestDate.getDate() + 7); // Add next week

    // If no history, show last 30 days
    if (!Object.keys(this.historyData).length) {
      earliestDate = new Date();
      earliestDate.setDate(earliestDate.getDate() - 30);
    }

    // Extend earliest date by 1 week
    earliestDate.setDate(earliestDate.getDate() - 7); // Add previous week

    // Generate all dates between (earliest - 1 week) and (today + 1 week)
    this.dates = [];
    const current = new Date(earliestDate);
    current.setHours(0, 0, 0, 0);

    while (current <= latestDate) {
      this.dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }

  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateHeader(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today or yesterday
    if (this.formatDate(date) === this.formatDate(today)) {
      return 'Today';
    } else if (this.formatDate(date) === this.formatDate(yesterday)) {
      return 'Yesterday';
    }

    // Otherwise, format as "Day, Month Date, Year" (e.g., "Monday, Dec 23, 2025")
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

  }

  // Parse history into domain/day structure
  parseHistory(results) {
    this.historyData = {};


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

  // Get sorted domains based on current sort mode and filter
  getSortedDomains() {
    let domains = Object.keys(this.historyData);

    // Apply search filter
    if (this.searchFilter) {
      const filterLower = this.searchFilter.toLowerCase();
      domains = domains.filter(domain => domain.toLowerCase().includes(filterLower));
    }

    // Apply sort
    switch (this.sortMode) {
      case 'recent':
        // Most recent visit first
        return domains.sort((a, b) => {
          return this.historyData[b].lastVisit - this.historyData[a].lastVisit;
        });

      case 'popular':
        // Most days with visits first
        return domains.sort((a, b) => {
          const aDays = Object.keys(this.historyData[a].days).length;
          const bDays = Object.keys(this.historyData[b].days).length;
          return bDays - aDays;
        });

      case 'alphabetical':
        // A to Z
        return domains.sort((a, b) => a.localeCompare(b));

      default:
        return domains;
    }
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

      // Weekday letter
      const weekdayCell = document.createElement('div');
      weekdayCell.className = 'weekday-cell';
      if (isToday) weekdayCell.classList.add('col-today');
      weekdayCell.textContent = weekdayName;
      weekdayCell.dataset.colIndex = index;
      weekdayRow.appendChild(weekdayCell);

      // Day number
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      if (isToday) dayCell.classList.add('col-today');
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

  // Get GitHub-style color based on visit count
  // Uses discrete levels like GitHub's contribution graph
  getGitHubStyleColor(count, maxCount, baseColor) {
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

    // Get today's date string for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);
    const todayIndex = this.dates.indexOf(todayStr);

    // Render visible rows
    for (let rowIndex = startRow; rowIndex < endRow; rowIndex++) {
      const domain = this.sortedDomains[rowIndex];
      if (!domain) continue;

      // Find max visit count for THIS DOMAIN (row-normalized)
      let maxCount = 0;
      Object.values(this.historyData[domain].days).forEach(day => {
        maxCount = Math.max(maxCount, day.count);
      });

      // TLD label
      const tldRow = document.createElement('div');
      tldRow.className = 'tld-row';
      tldRow.dataset.rowIndex = rowIndex;
      tldRow.style.position = 'absolute';
      tldRow.style.top = `${rowIndex * this.rowHeight + 8}px`; // Add 8px padding
      tldRow.style.width = '100%';

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
        this.deleteDomainData(domain);
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
      cellRow.style.width = `${this.dates.length * this.colWidth + 13}px`; // Match date-header-inner width

      // Add today column highlight
      if (todayIndex !== -1) {
        cellRow.classList.add('has-today-col');
        // Add special class for first row to extend highlight upward
        if (rowIndex === startRow) {
          cellRow.classList.add('first-row-today');
        }
        const todayColLeft = todayIndex * this.colWidth + 8 - 1; // Position to center the 20px highlight (1px padding on each side)
        cellRow.style.setProperty('--today-col-left', `${todayColLeft}px`);
      }

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

        // Check if this is today's column
        if (dateStr === todayStr) {
          cell.classList.add('col-today');
        }

        const dayData = this.historyData[domain].days[dateStr];

        if (dayData && dayData.count > 0) {
          const baseColor = this.colors[domain];
          // Use GitHub-style discrete color levels
          cell.style.backgroundColor = this.getGitHubStyleColor(dayData.count, maxCount, baseColor);

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

    let isHeaderScrolling = false;
    let isGridScrolling = false;
    let isTldScrolling = false;

    // Sync horizontal scroll: grid -> header
    // Sync vertical scroll: grid -> tld column
    cellGridWrapper.addEventListener('scroll', () => {
      if (isHeaderScrolling || isTldScrolling) return;
      isGridScrolling = true;
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
      cellGridWrapper.scrollLeft = dateHeader.scrollLeft;
      requestAnimationFrame(() => {
        isHeaderScrolling = false;
      });
    }, { passive: true });

    // Sync vertical scroll: tld column -> grid
    tldColumn.addEventListener('scroll', () => {
      if (isGridScrolling) return;
      isTldScrolling = true;
      cellGridWrapper.scrollTop = tldColumn.scrollTop;
      requestAnimationFrame(() => {
        isTldScrolling = false;
      });
    }, { passive: true });

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

    // Keyboard navigation (arrow keys)
    document.addEventListener('keydown', (e) => {
      if (expandedView.style.display !== 'block') return;

      const domain = this.selectedCell?.dataset.domain;
      const date = this.selectedCell?.dataset.date;

      if (!domain || !date) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.navigateDay(domain, date, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.navigateDay(domain, date, 1);
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

      if (!domain || !date) return;

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
          this.navigateDay(domain, date, 1);
        } else {
          this.navigateDay(domain, date, -1);
        }
      }
    }, { passive: false });
  }

  // Show full history view with all URLs from all domains
  showFullHistory() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    // Set view type
    this.expandedViewType = 'full';
    this.currentDomain = null;

    // Calculate total visits across all domains
    let totalVisits = 0;
    Object.values(this.historyData).forEach(domainData => {
      Object.values(domainData.days).forEach(day => {
        totalVisits += day.count;
      });
    });

    // Set title
    expandedTitle.textContent = `Full History (${totalVisits} total)`;

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Collect all URLs from all domains with their dates
    const allUrls = [];
    Object.keys(this.historyData).forEach(domain => {
      Object.keys(this.historyData[domain].days).forEach(dateStr => {
        const dayData = this.historyData[domain].days[dateStr];
        dayData.urls.forEach(urlData => {
          allUrls.push({
            ...urlData,
            domain: domain,
            date: dateStr
          });
        });
      });
    });

    // Sort based on current sort mode
    if (this.sortMode === 'popular') {
      // Most Popular: Sort by visit count (descending)
      allUrls.sort((a, b) => b.visitCount - a.visitCount);
    } else if (this.sortMode === 'alphabetical') {
      // Alphabetical: Sort by domain, then by URL
      allUrls.sort((a, b) => {
        const domainCompare = a.domain.localeCompare(b.domain);
        if (domainCompare !== 0) return domainCompare;
        return a.url.localeCompare(b.url);
      });
    } else {
      // Most Recent (default): Sort by most recent visit
      allUrls.sort((a, b) => b.lastVisit - a.lastVisit);
    }

    // Store URLs and render with pagination
    this.expandedUrls = allUrls;
    this.renderUrlList();

    expandedView.style.display = 'block';
  }

  // Show domain view with all URLs grouped by date
  showDomainView(domain) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');
    const expandedHeader = document.querySelector('.expanded-header');

    // Set view type
    this.expandedViewType = 'domain';
    this.currentDomain = domain;

    // Calculate total visits
    const domainData = this.historyData[domain];
    let totalVisits = 0;
    Object.values(domainData.days).forEach(day => {
      totalVisits += day.count;
    });

    // Set title (no navigation buttons for domain view)
    expandedTitle.textContent = `${domain} (${totalVisits} total visit${totalVisits !== 1 ? 's' : ''})`;

    // Remove navigation if it exists
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) {
      navContainer.remove();
    }

    // Add delete domain button if not exists
    let deleteBtn = document.getElementById('deleteDomain');
    if (!deleteBtn) {
      deleteBtn = document.createElement('button');
      deleteBtn.id = 'deleteDomain';
      deleteBtn.className = 'delete-domain-btn';
      deleteBtn.textContent = 'delete all';
      deleteBtn.title = 'Delete all history for this domain';

      // Insert before close button
      const closeBtn = document.getElementById('closeExpanded');
      expandedHeader.insertBefore(deleteBtn, closeBtn);
    }

    // Update delete button click handler
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => this.deleteDomain(domain));

    // Collect all URLs for this domain
    const allUrls = [];
    Object.keys(domainData.days).forEach(dateStr => {
      const dayData = domainData.days[dateStr];
      dayData.urls.forEach(urlData => {
        allUrls.push({
          ...urlData,
          domain: domain,
          date: dateStr
        });
      });
    });

    // Sort by most recent first
    allUrls.sort((a, b) => b.lastVisit - a.lastVisit);

    // Store URLs and render with pagination
    this.expandedUrls = allUrls;
    this.renderUrlList();

    expandedView.style.display = 'block';
  }

  // Show expanded view with URLs
  showExpandedView(domain, date, count) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Set view type
    this.expandedViewType = 'cell';
    this.currentDomain = null;

    // Remove delete domain button if it exists
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) {
      deleteBtn.remove();
    }

    // Format date nicely
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Set title and date
    expandedTitle.textContent = `${domain} (${count} visit${count !== 1 ? 's' : ''})`;

    // Update or create navigation controls
    let navContainer = document.getElementById('expandedNav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.id = 'expandedNav';
      navContainer.className = 'expanded-nav';

      const dateElement = document.createElement('span');
      dateElement.id = 'expandedDate';
      dateElement.className = 'expanded-date';

      const prevBtn = document.createElement('button');
      prevBtn.id = 'prevDay';
      prevBtn.className = 'nav-btn';
      prevBtn.innerHTML = '‹';
      prevBtn.title = 'Previous day';

      const nextBtn = document.createElement('button');
      nextBtn.id = 'nextDay';
      nextBtn.className = 'nav-btn';
      nextBtn.innerHTML = '›';
      nextBtn.title = 'Next day';

      navContainer.appendChild(prevBtn);
      navContainer.appendChild(dateElement);
      navContainer.appendChild(nextBtn);

      document.querySelector('.expanded-header').insertBefore(
        navContainer,
        document.getElementById('closeExpanded')
      );
    }

    // Update click handlers with current date
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');

    // Remove old listeners by cloning
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

    // Add new listeners with current date
    newPrevBtn.addEventListener('click', () => this.navigateDay(domain, date, -1));
    newNextBtn.addEventListener('click', () => this.navigateDay(domain, date, 1));

    // Update date text
    document.getElementById('expandedDate').textContent = formattedDate;

    // Update button states
    this.updateNavButtons(domain, date);

    // Get URLs for this cell
    const dayData = this.historyData[domain].days[date];
    if (!dayData || !dayData.urls) {
      urlList.innerHTML = '<div style="padding: 16px; color: #999;">No URLs found</div>';
      expandedView.style.display = 'block';
      return;
    }

    // Sort URLs chronologically (most recent first)
    const urls = [...dayData.urls].sort((a, b) => b.lastVisit - a.lastVisit);

    // Add domain and date to each URL
    const urlsWithContext = urls.map(urlData => ({
      ...urlData,
      domain: domain,
      date: date
    }));

    // Store URLs and render with pagination
    this.expandedUrls = urlsWithContext;
    this.renderUrlList();

    expandedView.style.display = 'block';
  }

  // Get the display name for the current view type
  getViewName() {
    switch (this.expandedViewType) {
      case 'full':
      case 'recent':
        return 'Full History';
      case 'bookmarks':
        return 'Bookmarks';
      case 'closed':
        return 'Recently Closed';
      case 'domain':
        return this.currentDomain || 'Domain';
      case 'cell':
        return this.selectedCell?.dataset.domain || 'History';
      default:
        return 'History';
    }
  }

  // Render URL list with pagination
  renderUrlList() {
    const urlList = document.getElementById('urlList');
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    // Filter URLs based on search filter
    let filteredUrls = this.expandedUrls;
    if (this.searchFilter) {
      const filterLower = this.searchFilter.toLowerCase();
      filteredUrls = this.expandedUrls.filter(urlData => {
        const domain = urlData.domain?.toLowerCase() || '';
        const url = urlData.url?.toLowerCase() || '';
        const title = urlData.title?.toLowerCase() || '';
        return domain.includes(filterLower) || url.includes(filterLower) || title.includes(filterLower);
      });
    }

    // Update title with filtered count
    if (this.searchFilter && filteredUrls.length !== this.expandedUrls.length) {
      const viewName = this.getViewName();
      expandedTitle.textContent = `${viewName} (${filteredUrls.length} found)`;
    } else {
      const viewName = this.getViewName();
      expandedTitle.textContent = `${viewName} (${this.expandedUrls.length} total)`;
    }

    // Get current page for this view type
    const currentPage = this.viewPagination[this.expandedViewType] || 1;

    // Calculate pagination
    const totalItems = filteredUrls.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const startIndex = (currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);

    // Clear list
    urlList.innerHTML = '';

    // Render items for current page with grouping headers
    let currentGroup = null;
    for (let i = startIndex; i < endIndex; i++) {
      const urlData = filteredUrls[i];

      // Determine group based on view type and sort mode
      let groupKey = null;
      let groupLabel = null;

      if (this.expandedViewType === 'bookmarks') {
        // Bookmarks: Always group by folder
        groupKey = urlData.folder || 'Root';
        groupLabel = groupKey;
      } else if (this.expandedViewType === 'closed' || this.expandedViewType === 'full' || this.expandedViewType === 'recent') {
        // All and Closed: Only show date headers in "Most Recent" mode
        if (this.sortMode === 'recent') {
          if (this.expandedViewType === 'closed') {
            // Group by date closed
            groupKey = this.formatDate(new Date(urlData.closedAt));
            groupLabel = this.formatDateHeader(groupKey);
          } else {
            // Group by date visited
            groupKey = this.formatDate(new Date(urlData.lastVisit));
            groupLabel = this.formatDateHeader(groupKey);
          }
        }
        // For 'popular' and 'alphabetical' modes, don't show any headers
      }

      // Add group header if group changed
      if (groupKey && groupKey !== currentGroup) {
        currentGroup = groupKey;
        const groupHeader = document.createElement('div');
        groupHeader.className = 'date-group-header';
        groupHeader.textContent = groupLabel;
        urlList.appendChild(groupHeader);
      }

      const urlItem = this.createUrlItem(urlData, urlData.domain, urlData.date);
      urlList.appendChild(urlItem);
    }

    // Add extra whitespace if fewer than 20 items to ensure expanded view can open fully
    const itemsOnPage = endIndex - startIndex;
    if (itemsOnPage < 20) {
      const spacer = document.createElement('div');
      spacer.style.minHeight = '400px'; // Ensure enough space for resizing
      urlList.appendChild(spacer);
    }

    // Update or create pagination controls
    this.renderPaginationControls(totalPages, totalItems, currentPage);

    // Force recalculation of scroll area to handle zoom/text wrapping
    // This ensures the browser recognizes the full content height
    requestAnimationFrame(() => {
      expandedView.style.overflow = 'hidden';
      expandedView.offsetHeight; // Force reflow
      expandedView.style.overflow = 'auto';
    });
  }

  // Render pagination controls
  renderPaginationControls(totalPages, totalItems, currentPage) {
    const expandedView = document.getElementById('expandedView');
    const urlList = document.getElementById('urlList');

    // Remove existing pagination if present
    let pagination = document.getElementById('pagination');
    if (pagination) {
      pagination.remove();
    }

    // Only show pagination if there's more than one page
    if (totalPages <= 1) return;

    // Create pagination container
    pagination = document.createElement('div');
    pagination.id = 'pagination';
    pagination.className = 'pagination';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '‹ Previous';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        this.viewPagination[this.expandedViewType]--;
        this.renderUrlList();
        expandedView.scrollTop = 0;
      }
    });

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    const start = (currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(currentPage * this.itemsPerPage, totalItems);
    pageInfo.textContent = `${start}-${end} of ${totalItems}`;

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = 'Next ›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        this.viewPagination[this.expandedViewType]++;
        this.renderUrlList();
        expandedView.scrollTop = 0;
      }
    });

    pagination.appendChild(prevBtn);
    pagination.appendChild(pageInfo);
    pagination.appendChild(nextBtn);

    urlList.appendChild(pagination);
  }

  // Create a URL item element
  createUrlItem(urlData, domain, date) {
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

    // For bookmarks view: Show "Manage" button instead of delete
    if (this.expandedViewType === 'bookmarks') {
      const manageBtn = document.createElement('button');
      manageBtn.className = 'icon-btn manage';
      manageBtn.textContent = 'manage';
      manageBtn.title = 'Manage bookmark in Chrome';
      manageBtn.addEventListener('click', () => {
        // Open Chrome's bookmark manager to the specific folder
        const folderId = urlData.folderId || '';
        const bookmarkUrl = folderId ? `chrome://bookmarks/?id=${folderId}` : 'chrome://bookmarks/';
        chrome.tabs.create({ url: bookmarkUrl });
      });
      actionsDiv.appendChild(manageBtn);
    } else {
      // For other views: Show delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete';
      deleteBtn.textContent = 'delete';
      deleteBtn.title = 'Delete from history';
      deleteBtn.addEventListener('click', () => this.deleteUrl(urlData.url, domain, date));
      actionsDiv.appendChild(deleteBtn);
    }

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'icon-btn bookmark';
    bookmarkBtn.textContent = 'save';
    bookmarkBtn.title = 'Toggle bookmark';
    bookmarkBtn.addEventListener('click', () => this.toggleBookmark(urlData.url, urlData.title, bookmarkBtn));

    // Check if URL is already bookmarked
    this.checkBookmarkStatus(urlData.url, bookmarkBtn);

    actionsDiv.appendChild(bookmarkBtn);

    leftDiv.appendChild(countSpan);
    leftDiv.appendChild(actionsDiv);

    // Right side: Favicon + URL as clickable link
    const rightDiv = document.createElement('div');
    rightDiv.className = 'url-item-right';

    // Add favicon
    const favicon = document.createElement('img');
    favicon.className = 'url-favicon';
    favicon.src = `https://www.google.com/s2/favicons?domain=${urlData.url}&sz=16`;
    favicon.alt = '';
    favicon.width = 16;
    favicon.height = 16;

    const urlLink = document.createElement('a');
    urlLink.href = urlData.url;

    // Truncate URLs longer than 400 characters
    if (urlData.url.length > 400) {
      urlLink.textContent = urlData.url.substring(0, 400) + '...';
      urlLink.title = urlData.url; // Show full URL on hover
    } else {
      urlLink.textContent = urlData.url;
    }

    urlLink.target = '_blank';
    urlLink.rel = 'noopener noreferrer';

    rightDiv.appendChild(favicon);
    rightDiv.appendChild(urlLink);

    urlItem.appendChild(leftDiv);
    urlItem.appendChild(rightDiv);

    // Add hover preview functionality to the URL link only
    this.attachUrlPreview(urlLink, urlData);

    return urlItem;
  }

  // Attach URL preview tooltip to a URL item
  attachUrlPreview(urlItem, urlData) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');
    let hoverTimeout;

    urlItem.addEventListener('mouseenter', (e) => {
      // Delay showing the preview slightly
      hoverTimeout = setTimeout(() => {
        this.showUrlPreview(urlData, e);
      }, 300);
    });

    urlItem.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      previewTooltip.classList.remove('visible');
    });

    urlItem.addEventListener('mousemove', (e) => {
      if (previewTooltip.classList.contains('visible')) {
        this.positionUrlPreview(e);
      }
    });
  }

  // Show URL preview tooltip
  async showUrlPreview(urlData, event) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');

    // Format last visit date
    const lastVisitDate = new Date(urlData.lastVisit);
    const now = new Date();
    const diffMs = now - lastVisitDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo;
    if (diffMins < 1) {
      timeAgo = 'Just now';
    } else if (diffMins < 60) {
      timeAgo = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      timeAgo = lastVisitDate.toLocaleDateString();
    }

    // Determine if this is from recently closed view
    const isClosedTab = this.expandedViewType === 'closed';
    const timeLabel = isClosedTab ? 'Closed' : 'Last visited';

    // Show loading state first
    previewTooltip.innerHTML = `
      <div class="url-preview-content">
        <div class="url-preview-header">
          <img src="https://www.google.com/s2/favicons?domain=${urlData.url}&sz=32"
               class="url-preview-favicon"
               width="32"
               height="32"
               alt="">
          <div class="url-preview-title">${urlData.title || 'Untitled'}</div>
        </div>
        <div class="url-preview-url">${urlData.url}</div>
        <div class="url-preview-meta">
          ${isClosedTab ? '' : `<div class="url-preview-meta-item">
            <span class="url-preview-meta-label">Visits</span>
            <span class="url-preview-meta-value">${urlData.visitCount}</span>
          </div>`}
          <div class="url-preview-meta-item">
            <span class="url-preview-meta-label">${timeLabel}</span>
            <span class="url-preview-meta-value">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;

    this.positionUrlPreview(event);
    previewTooltip.classList.add('visible');

    // Fetch OG metadata (title and description only)
    const ogData = await this.fetchOpenGraphData(urlData.url);

    // Update with OG data if available
    const descriptionHtml = ogData.description ? `
      <div class="url-preview-description">${ogData.description}</div>
    ` : '';

    previewTooltip.innerHTML = `
      <div class="url-preview-content">
        <div class="url-preview-header">
          <img src="https://www.google.com/s2/favicons?domain=${urlData.url}&sz=32"
               class="url-preview-favicon"
               width="32"
               height="32"
               alt="">
          <div class="url-preview-title">${ogData.title || urlData.title || 'Untitled'}</div>
        </div>
        ${descriptionHtml}
        <div class="url-preview-url">${urlData.url}</div>
        <div class="url-preview-meta">
          ${isClosedTab ? '' : `<div class="url-preview-meta-item">
            <span class="url-preview-meta-label">Visits</span>
            <span class="url-preview-meta-value">${urlData.visitCount}</span>
          </div>`}
          <div class="url-preview-meta-item">
            <span class="url-preview-meta-label">${timeLabel}</span>
            <span class="url-preview-meta-value">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;

    this.positionUrlPreview(event);
  }

  // Position the URL preview tooltip
  positionUrlPreview(event) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');
    const offsetX = 15;
    const offsetY = 15;

    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;

    // Get tooltip dimensions
    const rect = previewTooltip.getBoundingClientRect();

    // Prevent tooltip from going off screen
    if (x + rect.width > window.innerWidth) {
      x = event.clientX - rect.width - offsetX;
    }

    if (y + rect.height > window.innerHeight) {
      y = event.clientY - rect.height - offsetY;
    }

    previewTooltip.style.left = `${x}px`;
    previewTooltip.style.top = `${y}px`;
  }

  // Fetch Open Graph metadata (title and description only, no images)
  async fetchOpenGraphData(url) {
    // Check cache first
    if (this.ogCache.has(url)) {
      return this.ogCache.get(url);
    }

    // Default empty data
    const defaultData = {
      title: null,
      description: null
    };

    try {
      // Fetch the HTML page
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
      });

      if (!response.ok) {
        this.ogCache.set(url, defaultData);
        return defaultData;
      }

      const html = await response.text();

      // Parse OG meta tags
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const ogData = {
        title: this.getMetaContent(doc, 'og:title') || this.getMetaContent(doc, 'twitter:title'),
        description: this.getMetaContent(doc, 'og:description') || this.getMetaContent(doc, 'twitter:description') || this.getMetaContent(doc, 'description')
      };

      // Cache the result
      this.ogCache.set(url, ogData);

      return ogData;
    } catch (error) {
      // CORS blocked or other error - cache empty data
      this.ogCache.set(url, defaultData);
      return defaultData;
    }
  }

  // Helper to extract meta tag content
  getMetaContent(doc, property) {
    const meta = doc.querySelector(`meta[property="${property}"]`) ||
                 doc.querySelector(`meta[name="${property}"]`);
    return meta ? meta.getAttribute('content') : null;
  }

  // Close expanded view
  closeExpandedView() {
    const expandedView = document.getElementById('expandedView');
    expandedView.style.display = 'none';

    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected');
      this.selectedCell = null;
    }

    this.expandedViewType = null;
    this.currentDomain = null;
  }

  // Navigate to previous or next day for the same domain
  navigateDay(domain, currentDate, direction) {
    // Get all dates for this domain sorted chronologically
    const domainDates = Object.keys(this.historyData[domain].days).sort();

    // Find current date index
    const currentIndex = domainDates.indexOf(currentDate);

    if (currentIndex === -1) return;

    // Get next/prev date
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < domainDates.length) {
      const newDate = domainDates[newIndex];
      const dayData = this.historyData[domain].days[newDate];

      // Update selected cell
      if (this.selectedCell) {
        this.selectedCell.classList.remove('selected');
      }

      // Find and select the new cell (if visible)
      const colIndex = this.dates.indexOf(newDate);
      const rowIndex = this.sortedDomains.indexOf(domain);
      const newCell = document.querySelector(`.cell[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);

      if (newCell) {
        newCell.classList.add('selected');
        this.selectedCell = newCell;
      } else {
        this.selectedCell = null;
      }

      // Show expanded view for new date
      this.showExpandedView(domain, newDate, dayData.count);
    }
  }

  // Update navigation button states based on available data
  updateNavButtons(domain, currentDate) {
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');

    if (!prevBtn || !nextBtn) return;

    // Get all dates for this domain sorted chronologically
    const domainDates = Object.keys(this.historyData[domain].days).sort();

    // Find current date index
    const currentIndex = domainDates.indexOf(currentDate);

    // Disable buttons at boundaries
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= domainDates.length - 1;
  }

  // Delete URL from history
  async deleteUrl(url, domain, date) {
    // Delete from Chrome history
    chrome.history.deleteUrl({ url: url }, async () => {

      // If in closed tabs view, also remove from closed tabs storage
      if (this.expandedViewType === 'closed') {
        const result = await chrome.storage.local.get(['closedTabs']);
        const closedTabs = result.closedTabs || [];
        const updatedClosedTabs = closedTabs.filter(tab => tab.url !== url);
        await chrome.storage.local.set({ closedTabs: updatedClosedTabs });
      }

      // Update local data
      const dayData = this.historyData[domain].days[date];
      if (dayData) {
        // Remove URL from list
        const urlIndex = dayData.urls.findIndex(u => u.url === url);
        if (urlIndex !== -1) {
          const deletedUrl = dayData.urls[urlIndex];
          dayData.urls.splice(urlIndex, 1);
          dayData.count -= deletedUrl.visitCount;

          // If no more URLs for this day, remove the day
          if (dayData.urls.length === 0 || dayData.count <= 0) {
            delete this.historyData[domain].days[date];
          }

          // If domain has no more days, remove domain and close view
          if (Object.keys(this.historyData[domain].days).length === 0) {
            delete this.historyData[domain];
            this.sortedDomains = this.getSortedDomains();
            this.closeExpandedView();

            // Force complete re-render
            this.virtualState = {
              startRow: -1,
              endRow: -1,
              startCol: -1,
              endCol: -1,
              viewportHeight: 0,
              viewportWidth: 0
            };
            this.setupVirtualGrid();
          } else {
            // Refresh the appropriate view
            if (this.expandedViewType === 'domain') {
              this.showDomainView(domain);

              // Force complete re-render
              this.virtualState = {
                startRow: -1,
                endRow: -1,
                startCol: -1,
                endCol: -1,
                viewportHeight: 0,
                viewportWidth: 0
              };
              this.setupVirtualGrid();
            } else if (this.expandedViewType === 'cell') {
              // If current day still has URLs, refresh cell view
              if (this.historyData[domain].days[date]) {
                this.showExpandedView(domain, date, this.historyData[domain].days[date].count);

                // Force complete re-render
                this.virtualState = {
                  startRow: -1,
                  endRow: -1,
                  startCol: -1,
                  endCol: -1,
                  viewportHeight: 0,
                  viewportWidth: 0
                };
                this.setupVirtualGrid();
              } else {
                // Day is empty, close the view
                this.closeExpandedView();

                // Force complete re-render
                this.virtualState = {
                  startRow: -1,
                  endRow: -1,
                  startCol: -1,
                  endCol: -1,
                  viewportHeight: 0,
                  viewportWidth: 0
                };
                this.setupVirtualGrid();
              }
            } else if (this.expandedViewType === 'full' || this.expandedViewType === 'recent') {
              // Refresh "All" view
              this.showFullHistory();

              // Force complete re-render
              this.virtualState = {
                startRow: -1,
                endRow: -1,
                startCol: -1,
                endCol: -1,
                viewportHeight: 0,
                viewportWidth: 0
              };
              this.setupVirtualGrid();
            } else if (this.expandedViewType === 'closed') {
              // Refresh "Closed" view
              this.showRecentlyClosed();

              // Force complete re-render
              this.virtualState = {
                startRow: -1,
                endRow: -1,
                startCol: -1,
                endCol: -1,
                viewportHeight: 0,
                viewportWidth: 0
              };
              this.setupVirtualGrid();
            } else {
              // For any other view (bookmarks, etc), just refresh the grid
              this.virtualState = {
                startRow: -1,
                endRow: -1,
                startCol: -1,
                endCol: -1,
                viewportHeight: 0,
                viewportWidth: 0
              };
              this.setupVirtualGrid();
            }
          }
        }
      }
    });
  }

  // Delete all history for a domain (alias for use in TLD row delete button)
  deleteDomainData(domain) {
    this.deleteDomain(domain);
  }

  // Delete all history for a domain
  async deleteDomain(domain) {
    if (!confirm(`Delete all history for ${domain}? This will remove all ${Object.keys(this.historyData[domain].days).length} days of history for this domain.`)) {
      return;
    }

    // Get all URLs for this domain
    const allUrls = [];
    Object.values(this.historyData[domain].days).forEach(dayData => {
      dayData.urls.forEach(urlData => {
        allUrls.push(urlData.url);
      });
    });

    // Delete each URL from Chrome history
    let deletedCount = 0;
    allUrls.forEach(url => {
      chrome.history.deleteUrl({ url: url }, () => {
        deletedCount++;

        // When all URLs are deleted, update UI
        if (deletedCount === allUrls.length) {

          // Remove domain from local data
          delete this.historyData[domain];
          this.sortedDomains = this.getSortedDomains();

          // Close view and refresh grid
          this.closeExpandedView();

          // Force complete re-render by resetting virtual state
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
        }
      });
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
        bookmarkBtn.classList.remove('saved');
        delete bookmarkBtn.dataset.bookmarkId;
      });
    } else {
      // Add bookmark
      chrome.bookmarks.create({
        title: title || url,
        url: url
      }, (bookmark) => {
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.dataset.bookmarkId = bookmark.id;
      });
    }
  }

  // Setup sort dropdown handler
  setupSortDropdown() {
    const sortDropdown = document.getElementById('sortMode');

    sortDropdown.addEventListener('change', (e) => {
      this.sortMode = e.target.value;

      // Check if expanded view is open and what type
      const expandedView = document.getElementById('expandedView');
      const wasOpen = expandedView.style.display === 'block';
      const viewType = this.expandedViewType;

      this.refreshGrid();

      // Re-open and refresh the expanded view if it was open and it's 'all' or 'closed'
      if (wasOpen && (viewType === 'full' || viewType === 'recent' || viewType === 'closed')) {
        if (viewType === 'full' || viewType === 'recent') {
          this.showFullHistory();
        } else if (viewType === 'closed') {
          this.showRecentlyClosed();
        }
      }
    });
  }

  // Setup search input handler
  setupSearchInput() {
    const searchInput = document.getElementById('searchInput');

    searchInput.addEventListener('input', (e) => {
      this.searchFilter = e.target.value.trim();

      // Check if expanded view is open and what type
      const expandedView = document.getElementById('expandedView');
      const wasOpen = expandedView.style.display === 'block';
      const viewType = this.expandedViewType;

      this.refreshGrid();

      // Re-open the expanded view if it was open
      if (wasOpen) {
        if (viewType === 'recent' || viewType === 'full') {
          this.showFullHistory();
        } else if (viewType === 'bookmarks') {
          this.showBookmarks();
        } else if (viewType === 'closed') {
          this.showRecentlyClosed();
        }
        // Note: We don't re-open 'cell' or 'domain' views since filtering changes which domains are visible
      }
    });
  }

  // Refresh grid with current sort and filter
  refreshGrid() {
    // Re-sort/filter domains
    this.sortedDomains = this.getSortedDomains();

    // Close any expanded view since row indices will change
    this.closeExpandedView();

    // Reset virtual state to force re-render
    this.virtualState = {
      startRow: -1,
      endRow: -1,
      startCol: -1,
      endCol: -1,
      viewportHeight: 0,
      viewportWidth: 0
    };

    // Rebuild the entire virtual grid
    this.setupVirtualGrid();
  }

  // Setup live updates for new visits
  setupLiveUpdates() {
    // Don't set up live updates for fake data
    if (this.useFakeData) {
      return;
    }

    // Listen for new history visits
    chrome.history.onVisited.addListener((historyItem) => {
      this.handleNewVisit(historyItem);
    });

    // Listen for storage changes (recently closed tabs)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.closedTabs) {
        // If we're currently viewing recently closed, refresh it
        if (this.expandedViewType === 'closed') {
          this.showRecentlyClosed();
        }
      }
    });
  }

  // Handle a new visit from chrome.history.onVisited
  handleNewVisit(historyItem) {
    try {
      const url = new URL(historyItem.url);
      const domain = url.hostname.replace('www.', '');

      // Create date from timestamp
      const visitDateObj = new Date(historyItem.lastVisitTime);
      visitDateObj.setHours(0, 0, 0, 0);
      const visitDate = this.formatDate(visitDateObj);

      // Initialize domain if new
      if (!this.historyData[domain]) {
        this.historyData[domain] = {
          lastVisit: historyItem.lastVisitTime,
          days: {}
        };

        // Generate color for new domain
        if (!this.colors[domain]) {
          this.colors[domain] = this.generatePastelColor();
          this.saveColors();
        }

        // Update sorted domains
        this.sortedDomains = this.getSortedDomains();
      }

      // Initialize day if new
      if (!this.historyData[domain].days[visitDate]) {
        this.historyData[domain].days[visitDate] = {
          count: 0,
          urls: []
        };
      }

      // Update last visit if more recent
      if (historyItem.lastVisitTime > this.historyData[domain].lastVisit) {
        this.historyData[domain].lastVisit = historyItem.lastVisitTime;
      }

      // Find or add URL
      const urlData = this.historyData[domain].days[visitDate].urls.find(u => u.url === historyItem.url);

      if (urlData) {
        // URL exists, increment count
        urlData.visitCount++;
        urlData.lastVisit = historyItem.lastVisitTime;
      } else {
        // New URL
        this.historyData[domain].days[visitDate].urls.push({
          url: historyItem.url,
          title: historyItem.title,
          lastVisit: historyItem.lastVisitTime,
          visitCount: 1
        });
      }

      // Update day count
      this.historyData[domain].days[visitDate].count++;

      // Check if date is new and needs to be added to dates array
      if (!this.dates.includes(visitDate)) {
        // Check if date is today or in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = this.formatDate(today);

        const visitDateCheck = new Date(visitDate + 'T00:00:00');

        if (visitDateCheck >= new Date(this.dates[this.dates.length - 1] + 'T00:00:00')) {
          // Date is newer than our current range, regenerate dates
          this.generateDates();
          this.renderDateHeader();
        }
      }

      // Refresh the grid
      this.updateVirtualGrid();

      // Update expanded view based on what's currently open
      if (this.expandedViewType === 'domain' && this.currentDomain === domain) {
        this.showDomainView(domain);
      } else if (this.expandedViewType === 'cell' && this.selectedCell) {
        const cellDomain = this.selectedCell.dataset.domain;
        const cellDate = this.selectedCell.dataset.date;

        if (cellDomain === domain && cellDate === visitDate) {
          // Update the cell view
          const dayData = this.historyData[domain].days[visitDate];
          this.showExpandedView(domain, visitDate, dayData.count);
        }
      } else if (this.expandedViewType === 'recent' || this.expandedViewType === 'full') {
        // Refresh full history view
        this.showFullHistory();
      }
      // Note: bookmarks and closed tabs don't need live updates from history

    } catch (e) {
      console.warn('Invalid URL in live update:', historyItem.url);
    }
  }

  // Setup bottom menu buttons
  setupBottomMenu() {
    document.getElementById('recentHistoryBtn').addEventListener('click', () => {
      this.showFullHistory();
    });

    document.getElementById('bookmarksBtn').addEventListener('click', () => {
      this.showBookmarks();
    });

    document.getElementById('recentlyClosedBtn').addEventListener('click', () => {
      this.showRecentlyClosed();
    });
  }

  // Scroll to show tomorrow on load
  scrollToToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);
    const todayIndex = this.dates.indexOf(todayStr);

    if (todayIndex !== -1) {
      const cellGridWrapper = document.getElementById('cellGridWrapper');
      const dateHeader = document.getElementById('dateHeader');

      // Calculate scroll position to show tomorrow (todayIndex + 1) at the right edge
      // This means today is visible, plus one day into the future
      const scrollLeft = (todayIndex + 2) * this.colWidth - cellGridWrapper.clientWidth;

      // Ensure we don't scroll past the end or before the beginning
      const maxScroll = Math.max(0, scrollLeft);

      cellGridWrapper.scrollLeft = maxScroll;
      dateHeader.scrollLeft = maxScroll;
    }
  }

  // Setup zoom controls (Command+/Command-)
  setupZoomControls() {
    let currentZoom = 1.0;

    document.addEventListener('keydown', (e) => {
      // Check for Command/Ctrl + Plus/Minus
      if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '0')) {
        e.preventDefault();

        if (e.key === '+' || e.key === '=') {
          // Zoom in
          currentZoom = Math.min(currentZoom + 0.1, 3.0);
        } else if (e.key === '-') {
          // Zoom out
          currentZoom = Math.max(currentZoom - 0.1, 0.5);
        } else if (e.key === '0') {
          // Reset zoom
          currentZoom = 1.0;
        }

        document.body.style.zoom = currentZoom;
      }
    });
  }

  // Setup resize handles for TLD column and expanded view
  setupResizeHandle() {
    // TLD Column resize
    const tldHandle = document.getElementById('tldResizeHandle');
    const tldColumn = document.getElementById('tldColumn');
    const headerSpacer = document.querySelector('.header-spacer');
    let isTldResizing = false;
    let startX = 0;
    let startWidth = 0;

    // Function to update handle position
    const updateHandlePosition = () => {
      const tldWidth = tldColumn.offsetWidth;
      tldHandle.style.left = `${tldWidth}px`;
    };

    // Load saved TLD width from storage
    chrome.storage.local.get(['tldColumnWidth'], (result) => {
      if (result.tldColumnWidth) {
        tldColumn.style.width = `${result.tldColumnWidth}px`;
        headerSpacer.style.width = `${result.tldColumnWidth}px`;
      }
      updateHandlePosition();

      // Scroll to today after TLD width is restored
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        this.scrollToToday();
      });
    });

    tldHandle.addEventListener('mousedown', (e) => {
      isTldResizing = true;
      startX = e.clientX;
      startWidth = tldColumn.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    // Expanded view resize
    const expandedHandle = document.getElementById('expandedResizeHandle');
    const expandedView = document.getElementById('expandedView');
    let isExpandedResizing = false;
    let startY = 0;
    let startHeight = 0;

    // Load saved expanded view height from storage
    chrome.storage.local.get(['expandedViewHeight'], (result) => {
      if (result.expandedViewHeight) {
        expandedView.style.height = `${result.expandedViewHeight}px`;
      } else {
        // Default height if none saved - use 60% of viewport
        expandedView.style.height = `${window.innerHeight * 0.6}px`;
      }
    });

    expandedHandle.addEventListener('mousedown', (e) => {
      isExpandedResizing = true;
      startY = e.clientY;
      startHeight = expandedView.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });

    // Combined mousemove handler
    document.addEventListener('mousemove', (e) => {
      if (isTldResizing) {
        const delta = e.clientX - startX;
        const newWidth = Math.max(100, Math.min(400, startWidth + delta)); // Min 100px, max 400px

        tldColumn.style.width = `${newWidth}px`;
        headerSpacer.style.width = `${newWidth}px`;
        updateHandlePosition();
      }

      if (isExpandedResizing) {
        const delta = startY - e.clientY; // Inverted because dragging up increases height
        const newHeight = Math.max(150, Math.min(window.innerHeight * 0.95, startHeight + delta)); // Min 150px, max 95vh

        expandedView.style.height = `${newHeight}px`;
      }
    });

    // Combined mouseup handler
    document.addEventListener('mouseup', () => {
      if (isTldResizing) {
        isTldResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Save the new width to storage
        const newWidth = tldColumn.offsetWidth;
        chrome.storage.local.set({ tldColumnWidth: newWidth });
      }

      if (isExpandedResizing) {
        isExpandedResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Save the new height to storage
        const newHeight = expandedView.offsetHeight;
        chrome.storage.local.set({ expandedViewHeight: newHeight });
      }
    });
  }

  // Show recent history (last 100 visits)
  showRecentHistory() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    this.expandedViewType = 'recent';
    this.currentDomain = null;

    expandedTitle.textContent = 'Recent History';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get recent history from Chrome
    chrome.history.search({
      text: '',
      maxResults: 1000,
      startTime: 0
    }, (results) => {
      const recentUrls = results.map(item => ({
        url: item.url,
        title: item.title || item.url,
        visitCount: item.visitCount,
        lastVisit: item.lastVisitTime,
        domain: new URL(item.url).hostname.replace(/^www\./, ''),
        date: new Date(item.lastVisitTime).toISOString().split('T')[0]
      }));

      // Sort by most recent
      recentUrls.sort((a, b) => b.lastVisit - a.lastVisit);

      this.expandedUrls = recentUrls;
      expandedTitle.textContent = `Recent History (${recentUrls.length} total)`;
      this.renderUrlList();

      expandedView.style.display = 'block';
    });
  }

  // Show bookmarks organized by folders
  async showBookmarks() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    this.expandedViewType = 'bookmarks';
    this.currentDomain = null;

    expandedTitle.textContent = 'Bookmarks';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get all bookmarks
    chrome.bookmarks.getTree((bookmarkTree) => {
      const bookmarks = [];

      // Recursively collect all bookmarks with folder info
      const collectBookmarks = (nodes, folderPath = [], parentId = null) => {
        nodes.forEach(node => {
          if (node.url) {
            // It's a bookmark
            try {
              bookmarks.push({
                url: node.url,
                title: node.title || node.url,
                folder: folderPath.join(' > ') || 'Root',
                folderId: node.parentId || parentId, // Store the parent folder ID
                dateAdded: node.dateAdded,
                domain: new URL(node.url).hostname.replace(/^www\./, ''),
                visitCount: 1,
                lastVisit: node.dateAdded
              });
            } catch (e) {
              console.warn('Invalid bookmark URL:', node.url);
            }
          } else if (node.children) {
            // It's a folder
            const newPath = node.title ? [...folderPath, node.title] : folderPath;
            collectBookmarks(node.children, newPath, node.id);
          }
        });
      };

      collectBookmarks(bookmarkTree);

      // Sort by date added (most recent first)
      bookmarks.sort((a, b) => b.dateAdded - a.dateAdded);

      // Store bookmarks and render with filtering
      this.expandedUrls = bookmarks;
      expandedTitle.textContent = `Bookmarks (${bookmarks.length} total)`;
      this.renderUrlList();

      expandedView.style.display = 'block';
    });
  }


  // Show recently closed tabs with restore functionality
  showRecentlyClosed() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    this.expandedViewType = 'closed';
    this.currentDomain = null;

    expandedTitle.textContent = 'Recently Closed';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get closed tabs from storage
    chrome.storage.local.get(['closedTabs'], (result) => {
      const closedTabs = result.closedTabs || [];

      // Convert to URL format and add domain
      const closedUrls = closedTabs.map(tabData => {
        try {
          return {
            url: tabData.url,
            title: tabData.title,
            favIconUrl: tabData.favIconUrl,
            closedAt: tabData.closedAt,
            domain: new URL(tabData.url).hostname.replace(/^www\./, ''),
            visitCount: 1,
            lastVisit: tabData.closedAt
          };
        } catch (e) {
          return {
            url: tabData.url,
            title: tabData.title,
            favIconUrl: tabData.favIconUrl,
            closedAt: tabData.closedAt,
            domain: tabData.url,
            visitCount: 1,
            lastVisit: tabData.closedAt
          };
        }
      });

      // Sort based on current sort mode
      if (this.sortMode === 'popular') {
        // Most Popular: For closed tabs, just use most recent since we don't have visit counts
        closedUrls.sort((a, b) => b.closedAt - a.closedAt);
      } else if (this.sortMode === 'alphabetical') {
        // Alphabetical: Sort by domain, then by URL
        closedUrls.sort((a, b) => {
          const domainCompare = a.domain.localeCompare(b.domain);
          if (domainCompare !== 0) return domainCompare;
          return a.url.localeCompare(b.url);
        });
      } else {
        // Most Recent (default): Sort by most recently closed
        closedUrls.sort((a, b) => b.closedAt - a.closedAt);
      }

      this.expandedUrls = closedUrls;
      expandedTitle.textContent = `Recently Closed (${closedUrls.length} total)`;
      this.renderUrlList();

      expandedView.style.display = 'block';
    });
  }

  // Create a closed tab item
  createClosedTabItem(tabData, index) {
    const item = document.createElement('div');
    item.className = 'url-item';

    // Left side: restore button
    const leftDiv = document.createElement('div');
    leftDiv.className = 'url-item-left';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'icon-btn restore';
    restoreBtn.textContent = 'restore';
    restoreBtn.title = 'Reopen this tab';
    restoreBtn.addEventListener('click', async () => {
      // Open the URL in a new tab
      chrome.tabs.create({ url: tabData.url });

      // Remove this item from storage
      const result = await chrome.storage.local.get(['closedTabs']);
      const closedTabs = result.closedTabs || [];
      closedTabs.splice(index, 1);
      await chrome.storage.local.set({ closedTabs });

      // Refresh the list
      this.showRecentlyClosed();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete';
    deleteBtn.textContent = 'delete';
    deleteBtn.title = 'Remove from list';
    deleteBtn.addEventListener('click', async () => {
      // Remove this item from storage
      const result = await chrome.storage.local.get(['closedTabs']);
      const closedTabs = result.closedTabs || [];
      closedTabs.splice(index, 1);
      await chrome.storage.local.set({ closedTabs });

      // Refresh the list
      this.showRecentlyClosed();
    });

    leftDiv.appendChild(restoreBtn);
    leftDiv.appendChild(deleteBtn);

    // Right side: Favicon + Title/URL info
    const rightDiv = document.createElement('div');
    rightDiv.className = 'url-item-right';

    // Add favicon
    const favicon = document.createElement('img');
    favicon.className = 'url-favicon';
    favicon.src = tabData.favIconUrl || `https://www.google.com/s2/favicons?domain=${tabData.url}&sz=16`;
    favicon.alt = '';
    favicon.width = 16;
    favicon.height = 16;

    // Create clickable link
    const urlLink = document.createElement('a');
    urlLink.href = tabData.url;
    urlLink.target = '_blank';

    // Truncate URLs longer than 400 characters
    if (tabData.url.length > 400) {
      urlLink.textContent = tabData.title || tabData.url.substring(0, 400) + '...';
      urlLink.title = tabData.url;
    } else {
      urlLink.textContent = tabData.title || tabData.url;
    }

    rightDiv.appendChild(favicon);
    rightDiv.appendChild(urlLink);

    item.appendChild(leftDiv);
    item.appendChild(rightDiv);

    // Add hover preview to the URL link
    // Create urlData object compatible with attachUrlPreview
    const urlData = {
      url: tabData.url,
      title: tabData.title,
      visitCount: 1, // We don't track visit count for closed tabs
      lastVisit: tabData.closedAt // Use closed time as "last visit"
    };
    this.attachUrlPreview(urlLink, urlData);

    return item;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BulletHistory();
});
