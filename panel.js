// Bullet History - Main Panel Script

class BulletHistory {
  constructor() {
    this.historyData = {}; // { domain: { lastVisit, days: { date: { count, urls } } } }
    this.colors = {}; // { domain: color }
    this.dates = [];
    this.sortedDomains = []; // Cached sorted domain list
    this.filteredMode = false; // Track if domains are filtered to expanded view
    this.originalSortedDomains = null; // Store full domain list when filtering
    this.faviconCache = {}; // Cached favicons from active tabs: { url: { favicon, timestamp } }
    this.faviconsByDomain = new Map(); // Performance optimization: domain -> favicon URL for O(1) lookup
    this.urlTimeCache = {}; // Cached URL time tracking data: { url: { activeSeconds, openSeconds } }
    this.urlTimeDataByDomain = {}; // Time data organized by domain for cell rendering: { domain: { dateStr: { urls: Set, hourToUrls: { hour: Set } } } }
    this.openTabsByUrl = {}; // Map of URL to openedAt timestamp for currently open tabs
    this.openTabGroupByUrl = {}; // Map of URL to groupId for currently open tabs
    this.tabGroupsById = {}; // Map of groupId to { title, color }

    this.hours = []; // Array of hour strings like ['2025-12-01T00', '2025-12-01T01', ...]
    this.hourlyData = {}; // { domain: { 'YYYY-MM-DDTHH': { count, urls } } }

    // Timeline zoom settings
    this.zoomLevel = 50; // 0 = week, 100 = hourly (slider value)
    this.pixelsPerHour = 3; // Computed from zoomLevel
    this.timelineStartMs = 0; // Start of timeline in ms
    this.timelineEndMs = 0; // End of timeline in ms
    this.tabSessions = {}; // { dateStr: [{domain, tabId, openedAt, closedAt}] }
    this.liveSessions = {}; // Currently open sessions from background

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

    // Performance optimization: track hovered elements to avoid querySelectorAll on clear
    this.hoveredElements = new Set();
    // Performance optimization: map column index to cell elements for fast column highlighting
    this.columnCells = new Map(); // Map<colIndex, Set<element>>
    // Performance optimization: cache maxCount per domain to avoid recalculating per row
    this.maxCountCache = new Map(); // Map<domain, maxCount>
    // Track calendar event scroll handlers for cleanup
    this.calendarScrollHandlers = [];

    this.init();
  }

  async init() {
    // Load saved zoom level
    const savedZoom = localStorage.getItem('bulletHistoryZoomLevel');
    if (savedZoom !== null) {
      this.zoomLevel = parseInt(savedZoom) || 50;
    }
    this.updatePixelsPerHour();

    // Initialize state before loading data
    this.selectedCell = null;
    this.expandedViewType = null; // 'cell', 'domain', 'full', 'day', or 'hour'
    this.previousExpandedViewType = null; // Track previous view type to detect switches
    this.currentDomain = null; // Track current domain for domain view
    this.currentDate = null; // Track current date for day view
    this.currentHour = null; // Track current hour for hour view
    this.sortMode = 'recent'; // 'recent', 'frequency', or 'alphabetical'
    this.searchFilter = ''; // Search filter text
    this.virtualGridInitialized = false; // Track if listeners are set up
    // Virtual scrolling for URL list
    this.urlListRowHeight = 28; // Estimated height per item row
    this.urlListHeaderHeight = 28; // Height for group headers
    this.urlListBuffer = 5; // Extra items to render above/below viewport
    this.virtualRows = []; // Flat list of rows (items + headers)
    this.filteredUrlsCache = []; // Cache of filtered URLs
    this.currentFilteredUrls = []; // Current filtered URLs for rebuild
    this.urlListScrollHandler = null; // Scroll handler reference
    this.collapsedGroups = new Set(); // Track collapsed groups in expanded views
    this.lastExpandedViewType = null; // Track last view type to clear collapsed groups on change

    await this.loadColors();
    await this.loadFaviconCache();
    await this.fetchHistory();
    await this.loadOpenTabsData();
    await this.loadUrlTimeDataForCells();
    await this.loadTabSessions();

    this.generateDates();
    this.computeTimeline();
    this.sortedDomains = this.getSortedDomains();
    this.renderDateHeader();
    this.setupVirtualGrid();
    this.setupScrollSync();
    this.setupTooltips();
    this.setupRowHover();
    this.setupColumnHeaderHover();
    this.setupCellClick();
    this.setupLiveUpdates();
    this.setupSortDropdown();
    this.setupSearchInput();
    this.setupBottomMenu();
    this.setupZoomControls();
    this.setupResizeHandle();
    this.setupDateChangeDetection();
    this.setupExpandedViewZoomHandler();
    this.setupZoomSlider();

    // Initialize calendar integration
    await this.initializeCalendar();
    this.setupCalendarUI();

    // Re-render date header to show calendar events now that data is loaded
    this.renderDateHeader();

    // Listen for calendar data updates from background sync
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'calendarDataUpdated') {
        // Reload calendar data and refresh UI
        this.refreshCalendarUI();
      } else if (message.type === 'tabsUpdated') {
        // Refresh group data so any open expanded view reflects current groups
        this.loadOpenTabsData().then(() => {
          if (this.expandedViewType === 'active') {
            this.showActiveTabs();
          } else if (this.expandedViewType === 'closed') {
            this.showRecentlyClosed();
          } else if (this.expandedViewType && this.currentFilteredUrls) {
            // Other expanded views (recent, day, hour, domain, full):
            // re-render in place so group cohesion and visuals update
            this.renderUrlList();
          }
        });
      }
    });

    // Listen for tab changes to refresh active tabs view
    let activeTabsRefreshTimer = null;
    const refreshActiveTabs = () => {
      if (this.expandedViewType !== 'active') return;
      // Debounce rapid tab events
      if (activeTabsRefreshTimer) clearTimeout(activeTabsRefreshTimer);
      activeTabsRefreshTimer = setTimeout(() => {
        activeTabsRefreshTimer = null;
        this.showActiveTabs();
      }, 200);
    };
    chrome.tabs.onCreated.addListener(refreshActiveTabs);
    chrome.tabs.onRemoved.addListener(refreshActiveTabs);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
        refreshActiveTabs();
      }
    });

    // Listen for background script notifications
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'tabsUpdated') {
        refreshActiveTabs();
      }
    });

    // Listen for bookmark changes
    chrome.bookmarks.onCreated.addListener(() => {
      if (this.expandedViewType === 'bookmarks') {
        this.showBookmarks();
      }
    });

    chrome.bookmarks.onRemoved.addListener(() => {
      if (this.expandedViewType === 'bookmarks') {
        this.showBookmarks();
      }
    });

    chrome.bookmarks.onChanged.addListener(() => {
      if (this.expandedViewType === 'bookmarks') {
        this.showBookmarks();
      }
    });

    chrome.bookmarks.onMoved.addListener(() => {
      if (this.expandedViewType === 'bookmarks') {
        this.showBookmarks();
      }
    });

    // Don't show expanded view on load
    // User can open it by clicking a cell or bottom menu buttons

    this.scrollToToday();
  }

  setupDateChangeDetection() {
    let lastDate = this.formatDate(new Date());

    const checkForDateChange = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentDate = this.formatDate(today);
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        return true;
      }
      return false;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (checkForDateChange()) {
          this.renderDateHeader();
          this.updateVirtualGrid();
        }
        this.scrollToToday();
      }
    });

    window.addEventListener('focus', () => {
      if (checkForDateChange()) {
        this.renderDateHeader();
        this.updateVirtualGrid();
      }
      this.scrollToToday();
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

  // Generate hour range from first to last history date
  generateHours() {
    // Find the earliest visit date from history data
    let earliestDate = new Date();

    for (const domain in this.historyData) {
      for (const dateStr in this.historyData[domain].days) {
        const date = new Date(dateStr);
        if (date < earliestDate) earliestDate = date;
      }
    }

    // Always show at least 24 hours into the future from now
    const now = new Date();
    const latestDate = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // Add 24 hours
    latestDate.setMinutes(59, 59, 999); // Round to end of the hour

    // If no history, show last 30 days
    if (!Object.keys(this.historyData).length) {
      earliestDate = new Date();
      earliestDate.setDate(earliestDate.getDate() - 30);
    }

    earliestDate.setHours(0, 0, 0, 0);

    // Generate all hours between earliest and latest
    this.hours = [];
    const current = new Date(earliestDate);

    while (current <= latestDate) {
      this.hours.push(DateUtils.formatHourISO(current));
      current.setHours(current.getHours() + 1);
    }

  }

  formatDate(date) {
    return DateUtils.formatDateISO(date);
  }

  formatDateHeader(dateStr) {
    return DateUtils.formatDateForDisplay(dateStr);
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
        const domain = UrlUtils.extractDomain(item.url);

        // Skip if domain is empty or whitespace
        if (!domain || domain.trim().length === 0) {
          continue;
        }

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
          visitCount: item.visitCount || 1,
          favIconUrl: item.favIconUrl  // Store actual favicon from Chrome
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

  // Load favicon cache from storage
  async loadFaviconCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['faviconCache'], (result) => {
        this.faviconCache = result.faviconCache || {};
        // Build domain -> favicon index for O(1) lookup in renderVirtualRows
        this.faviconsByDomain.clear();
        for (const [url, data] of Object.entries(this.faviconCache)) {
          const domain = UrlUtils.getHostname(url);
          // Only store if we don't already have one for this domain (first one wins)
          if (domain && !this.faviconsByDomain.has(domain) && data.favicon) {
            this.faviconsByDomain.set(domain, data.favicon);
          }
        }
        resolve();
      });
    });
  }

  // Get sorted domains based on current sort mode and filter
  getSortedDomains() {
    let domains = Object.keys(this.historyData);

    // Filter out empty or whitespace-only domains
    domains = domains.filter(domain => domain && domain.trim().length > 0);

    // Apply search filter
    if (this.searchFilter) {
      const filterLower = this.searchFilter.toLowerCase();
      domains = domains.filter(domain => domain.toLowerCase().includes(filterLower));
    }

    // Apply sort - pre-compute sort keys to avoid O(n²) in comparator
    switch (this.sortMode) {
      case 'recent':
        // Most recent visit first - lastVisit is already stored, just reference it
        return domains.sort((a, b) => {
          return this.historyData[b].lastVisit - this.historyData[a].lastVisit;
        });

      case 'popular':
        // Most days with visits first - pre-compute day counts
        const dayCounts = new Map();
        for (const domain of domains) {
          dayCounts.set(domain, Object.keys(this.historyData[domain].days).length);
        }
        return domains.sort((a, b) => dayCounts.get(b) - dayCounts.get(a));

      case 'alphabetical':
        // A to Z
        return domains.sort((a, b) => a.localeCompare(b));

      default:
        return domains;
    }
  }

  // Get sorted domains for hour view
  sortDomainsForHourView() {
    let domains = Object.keys(this.hourlyData);

    // Filter out empty or whitespace-only domains
    domains = domains.filter(domain => domain && domain.trim().length > 0);

    // Apply search filter
    if (this.searchFilter) {
      const filterLower = this.searchFilter.toLowerCase();
      domains = domains.filter(domain => domain.toLowerCase().includes(filterLower));
    }

    // Apply sort - pre-compute sort keys to avoid O(n²) in comparator
    switch (this.sortMode) {
      case 'recent':
        // Most recent visit first - pre-compute max visit time per domain
        const recentTimes = new Map();
        for (const domain of domains) {
          let maxTime = 0;
          for (const hourData of Object.values(this.hourlyData[domain])) {
            for (const url of hourData.urls) {
              if (url.lastVisitTime > maxTime) {
                maxTime = url.lastVisitTime;
              }
            }
          }
          recentTimes.set(domain, maxTime);
        }
        return domains.sort((a, b) => recentTimes.get(b) - recentTimes.get(a));

      case 'popular':
        // Most total visits - pre-compute total counts per domain
        const totalCounts = new Map();
        for (const domain of domains) {
          let total = 0;
          for (const hourData of Object.values(this.hourlyData[domain])) {
            total += hourData.count;
          }
          totalCounts.set(domain, total);
        }
        return domains.sort((a, b) => totalCounts.get(b) - totalCounts.get(a));

      case 'alphabetical':
        // A to Z
        return domains.sort((a, b) => a.localeCompare(b));

      default:
        return domains;
    }
  }

  // Filter domains to only those present in expanded view
  filterDomainsToExpandedView() {
    if (!this.expandedUrls || this.expandedUrls.length === 0) {
      return;
    }

    // Store original domain list if not already stored
    if (!this.filteredMode) {
      this.originalSortedDomains = [...this.sortedDomains];
    }

    // Extract unique domains from expanded URLs
    const expandedDomains = new Set();
    this.expandedUrls.forEach(item => {
      if (item.domain) {
        expandedDomains.add(item.domain);
      }
    });

    // Filter sortedDomains to only those in expandedDomains
    this.sortedDomains = this.sortedDomains.filter(domain => expandedDomains.has(domain));

    // Mark as filtered
    this.filteredMode = true;

    // Update virtual grid with filtered domains
    this.setupVirtualGrid();
    this.updateVirtualGrid();
  }

  // Restore full domain list
  restoreAllDomains() {
    if (!this.filteredMode || !this.originalSortedDomains) {
      return;
    }

    // Restore original domain list
    this.sortedDomains = [...this.originalSortedDomains];
    this.originalSortedDomains = null;
    this.filteredMode = false;

    // Update virtual grid with full domain list
    this.setupVirtualGrid();
    this.updateVirtualGrid();
  }

  getViewName() {
    switch (this.expandedViewType) {
      case 'full':
      case 'recent':
        return 'Full History';
      case 'bookmarks':
        return 'Bookmarks';
      case 'active':
        return 'Active Tabs';
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

  formatDuration(durationMs) {
    return DateUtils.formatDuration(durationMs);
  }

  setupSortDropdown() {
    const sortDropdown = document.getElementById('sortMode');

    sortDropdown.addEventListener('change', (e) => {
      this.sortMode = e.target.value;

      // Check if expanded view is open and what type
      const expandedView = document.getElementById('expandedView');
      const wasOpen = expandedView.style.display === 'block';
      const viewType = this.expandedViewType;

      this.sortedDomains = this.getSortedDomains();

      // Reset virtual state to force re-render
      this.virtualState = {
        startRow: -1,
        endRow: -1,
        startCol: -1,
        endCol: -1,
        viewportHeight: 0,
        viewportWidth: 0
      };

      // Rebuild the virtual grid
      this.setupVirtualGrid();

      // Refresh the expanded view if it was open (without closing it first)
      if (wasOpen) {
        if (viewType === 'full' || viewType === 'recent') {
          this.showFullHistory();
        } else if (viewType === 'closed') {
          this.showRecentlyClosed();
        } else if (viewType === 'active') {
          this.showActiveTabs();
        } else if (viewType === 'bookmarks') {
          this.showBookmarks();
        } else if (viewType === 'day' && this.currentDate) {
          this.showDayExpandedView(this.currentDate);
        } else if (viewType === 'hour' && this.currentHour) {
          this.showHourExpandedView(this.currentHour);
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
        } else if (viewType === 'active') {
          this.showActiveTabs();
        } else if (viewType === 'closed') {
          this.showRecentlyClosed();
        }
        // Note: We don't re-open 'cell' or 'domain' views since filtering changes which domains are visible
      }
    });
  }

  // Refresh grid with current sort and filter
  refreshGrid() {
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

    // Listen for storage changes (recently closed tabs and favicon cache)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        // Reload favicon cache when it's updated
        if (changes.faviconCache) {
          this.faviconCache = changes.faviconCache.newValue || {};
          // Rebuild domain index
          this.faviconsByDomain.clear();
          for (const [url, data] of Object.entries(this.faviconCache)) {
            const domain = UrlUtils.getHostname(url);
            if (domain && !this.faviconsByDomain.has(domain) && data.favicon) {
              this.faviconsByDomain.set(domain, data.favicon);
            }
          }
        }

        // Refresh closed tabs view if currently viewing
        if (changes.closedTabs && this.expandedViewType === 'closed') {
          this.showRecentlyClosed();
        }

        // Reload URL time data cache when it's updated (for cell rendering)
        if (changes.urlTimeData) {
          this.loadUrlTimeDataForCells().then(() => {
            // Clear the URL time cache for display as well
            this.urlTimeCache = {};
          });
        }
      }
    });
  }

  // Handle a new visit from chrome.history.onVisited
  handleNewVisit(historyItem) {
    try {
      const domain = UrlUtils.extractDomain(historyItem.url);

      // Skip if domain is empty or whitespace
      if (!domain || domain.trim().length === 0) {
        return;
      }

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
        urlData.favIconUrl = historyItem.favIconUrl;  // Update favicon
      } else {
        // New URL
        this.historyData[domain].days[visitDate].urls.push({
          url: historyItem.url,
          title: historyItem.title,
          lastVisit: historyItem.lastVisitTime,
          visitCount: 1,
          favIconUrl: historyItem.favIconUrl
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
      } else if (this.expandedViewType === 'day' && this.currentDate) {
        // Refresh day view if the new visit is on the current date
        if (this.currentDate === visitDate) {
          this.showDayExpandedView(this.currentDate);
        }
      } else if (this.expandedViewType === 'hour' && this.currentHour) {
        // Refresh hour view if the new visit is in the current hour
        const visitHour = `${visitDate}T${String(new Date(historyItem.lastVisitTime).getHours()).padStart(2, '0')}`;
        if (this.currentHour === visitHour) {
          this.showHourExpandedView(this.currentHour);
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
      // Toggle: if full history is already open, close it
      if (this.expandedViewType === 'full') {
        this.closeExpandedView();
      } else {
        this.showFullHistory();
      }
    });

    document.getElementById('bookmarksBtn').addEventListener('click', () => {
      // Toggle: if bookmarks is already open, close it
      if (this.expandedViewType === 'bookmarks') {
        this.closeExpandedView();
      } else {
        this.showBookmarks();
      }
    });

    document.getElementById('activeTabsBtn').addEventListener('click', () => {
      // Toggle: if active tabs is already open, close it
      if (this.expandedViewType === 'active') {
        this.closeExpandedView();
      } else {
        this.showActiveTabs();
      }
    });

    document.getElementById('recentlyClosedBtn').addEventListener('click', () => {
      // Toggle: if recently closed is already open, close it
      if (this.expandedViewType === 'closed') {
        this.closeExpandedView();
      } else {
        this.showRecentlyClosed();
      }
    });
  }

  // Set active state for bottom menu buttons
  setActiveMenuButton(activeButtonId) {
    // Remove active class from all menu buttons
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(btn => btn.classList.remove('active'));

    // Add active class to the specified button
    if (activeButtonId) {
      const activeButton = document.getElementById(activeButtonId);
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }
  }

  // Scroll to show tomorrow on load
  scrollToToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const dateHeader = document.getElementById('dateHeader');

    // Scroll to show "now" near the right edge of the viewport
    const nowX = this.timeToX(Date.now()) + 8;
    const scrollLeft = Math.max(0, nowX - cellGridWrapper.clientWidth + 50);

    cellGridWrapper.scrollLeft = scrollLeft;
    dateHeader.scrollLeft = scrollLeft;
  }

  scrollToCurrentHour() {
    const currentHourStr = DateUtils.getCurrentHourISO();

    const currentHourIndex = this.hours.indexOf(currentHourStr);

    if (currentHourIndex !== -1) {
      const cellGridWrapper = document.getElementById('cellGridWrapper');
      const dateHeader = document.getElementById('dateHeader');

      // Calculate scroll position to show current hour with some context
      // Show current hour plus a few hours ahead
      const scrollLeft = (currentHourIndex + 4) * this.colWidth - cellGridWrapper.clientWidth;

      // Ensure we don't scroll past the end or before the beginning
      const maxScroll = Math.max(0, scrollLeft);

      cellGridWrapper.scrollLeft = maxScroll;
      dateHeader.scrollLeft = maxScroll;
    }
  }

  scrollToDateInHourView(dateStr) {
    // Scroll to noon (12pm) of the specified date to center the day
    const noonHourStr = `${dateStr}T12`;
    const noonHourIndex = this.hours.indexOf(noonHourStr);

    if (noonHourIndex !== -1) {
      const cellGridWrapper = document.getElementById('cellGridWrapper');
      const dateHeader = document.getElementById('dateHeader');

      // Center the noon hour in the viewport
      const scrollLeft = noonHourIndex * this.colWidth - (cellGridWrapper.clientWidth / 2);

      // Ensure we don't scroll past the end or before the beginning
      const maxScroll = Math.max(0, scrollLeft);

      cellGridWrapper.scrollLeft = maxScroll;
      dateHeader.scrollLeft = maxScroll;
    }
  }

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
      // Update padding if expanded view is visible
      if (expandedView.style.display === 'block') {
        this.updateExpandedViewPadding();
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
        this.updateExpandedViewPadding();
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

        // Trigger virtual grid update after resize
        requestAnimationFrame(() => {
          this.updateVirtualGrid();
        });
      }
    });
  }

  setupViewToggle() {
    // Legacy — replaced by zoom slider, kept as no-op for compatibility
  }

  // Compute pixelsPerHour from zoom level (0-100)
  // 0 = week view (~0.125 px/hr = 21px/week), 100 = hourly (~21 px/hr)
  updatePixelsPerHour() {
    // Exponential scale: week (0) -> hourly (100)
    // At 0: ~0.125 px/hr (7 days fit in ~21px * dates.length)
    // At 100: ~21 px/hr (each hour gets a full column width)
    const minPxPerHr = 0.125; // week scale
    const maxPxPerHr = 21;    // hourly scale
    const t = this.zoomLevel / 100;
    this.pixelsPerHour = minPxPerHr * Math.pow(maxPxPerHr / minPxPerHr, t);
  }

  // Compute timeline start/end from history data
  computeTimeline() {
    let earliest = Date.now();
    let latest = Date.now();

    // From history dates
    if (this.dates && this.dates.length > 0) {
      const first = new Date(this.dates[0] + 'T00:00:00').getTime();
      const last = new Date(this.dates[this.dates.length - 1] + 'T23:59:59').getTime();
      if (first < earliest) earliest = first;
      if (last > latest) latest = last;
    }

    // Extend to end of today + 1 hour buffer
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (endOfToday.getTime() > latest) latest = endOfToday.getTime();

    this.timelineStartMs = earliest;
    this.timelineEndMs = latest;
  }

  // Get total timeline width in pixels at current zoom
  getTimelineWidth() {
    const hours = (this.timelineEndMs - this.timelineStartMs) / (1000 * 60 * 60);
    return Math.ceil(hours * this.pixelsPerHour);
  }

  // Convert timestamp to x pixel position
  timeToX(timestampMs) {
    const hours = (timestampMs - this.timelineStartMs) / (1000 * 60 * 60);
    return hours * this.pixelsPerHour;
  }

  // Convert x pixel position to timestamp
  xToTime(x) {
    const hours = x / this.pixelsPerHour;
    return this.timelineStartMs + hours * 1000 * 60 * 60;
  }

  setupZoomSlider() {
    const slider = document.getElementById('zoomSlider');
    if (!slider) return;
    slider.value = this.zoomLevel;

    slider.addEventListener('input', () => {
      const oldPxPerHr = this.pixelsPerHour;
      this.zoomLevel = parseInt(slider.value);
      this.updatePixelsPerHour();
      localStorage.setItem('bulletHistoryZoomLevel', this.zoomLevel);

      // Maintain scroll position (keep center of viewport at same time)
      const cellGridWrapper = document.getElementById('cellGridWrapper');
      const centerX = cellGridWrapper.scrollLeft + cellGridWrapper.clientWidth / 2;
      const centerTime = this.xToTime(centerX / oldPxPerHr * oldPxPerHr);
      // Actually just use the old center position
      const ratio = this.pixelsPerHour / oldPxPerHr;
      const newScrollLeft = centerX * ratio - cellGridWrapper.clientWidth / 2;

      this.renderDateHeader();
      this.setupVirtualGrid();

      requestAnimationFrame(() => {
        cellGridWrapper.scrollLeft = Math.max(0, newScrollLeft);
        this.updateVirtualGrid(true);
      });
    });
  }

  // Load tab session data from storage
  async loadTabSessions() {
    try {
      // Get all tabSessions_ keys
      const allStorage = await chrome.storage.local.get(null);
      this.tabSessions = {};
      for (const key of Object.keys(allStorage)) {
        if (key.startsWith('tabSessions_')) {
          const dateStr = key.replace('tabSessions_', '');
          this.tabSessions[dateStr] = allStorage[key];
        }
      }

      // Get live sessions from background
      try {
        this.liveSessions = await chrome.runtime.sendMessage({ type: 'getLiveSessions' });
      } catch {
        this.liveSessions = {};
      }
    } catch (e) {
      console.warn('Failed to load tab sessions:', e);
    }
  }

  // Get all sessions for a domain, merging stored + live
  getSessionsForDomain(domain) {
    const sessions = [];
    // Stored sessions
    for (const dateStr of Object.keys(this.tabSessions)) {
      const daySessions = this.tabSessions[dateStr];
      if (daySessions) {
        for (const s of daySessions) {
          if (s.domain === domain) sessions.push(s);
        }
      }
    }
    // Live sessions (currently open)
    for (const dateStr of Object.keys(this.liveSessions || {})) {
      const liveSessions = this.liveSessions[dateStr];
      if (liveSessions) {
        for (const s of liveSessions) {
          if (s.domain === domain) {
            sessions.push({ ...s, closedAt: Date.now() }); // Treat as open until now
          }
        }
      }
    }
    return sessions;
  }

  // Build line segments for a domain from all available data sources
  // Returns array of {startMs, endMs, concurrentTabs}
  buildDomainLineSegments(domain) {
    // Start with historical data (time tracking + visit timestamps)
    const historicalSegments = this.buildFallbackLineSegments(domain);

    // Layer on tab session data (precise open/close times)
    const sessions = this.getSessionsForDomain(domain);
    if (sessions.length === 0) return historicalSegments;

    // Build session segments via sweep line
    const events = [];
    for (const s of sessions) {
      const openAt = s.openedAt;
      const closeAt = s.closedAt || Date.now();
      events.push({ time: openAt, delta: 1 });
      events.push({ time: closeAt, delta: -1 });
    }
    events.sort((a, b) => a.time - b.time || a.delta - b.delta);

    const sessionSegments = [];
    let concurrency = 0;
    let segStart = 0;

    for (const ev of events) {
      if (concurrency > 0 && ev.time > segStart) {
        sessionSegments.push({ startMs: segStart, endMs: ev.time, concurrentTabs: concurrency });
      }
      concurrency += ev.delta;
      segStart = ev.time;
    }

    // Merge session segments with historical: sessions take priority where they exist
    // Build a set of hours covered by sessions to avoid double-drawing
    const sessionCoveredHours = new Set();
    for (const seg of sessionSegments) {
      const startHour = Math.floor(seg.startMs / 3600000);
      const endHour = Math.ceil(seg.endMs / 3600000);
      for (let h = startHour; h < endHour; h++) {
        sessionCoveredHours.add(h);
      }
    }

    // Keep historical segments that don't overlap with session data
    const filtered = historicalSegments.filter(seg => {
      const segHour = Math.floor(seg.startMs / 3600000);
      return !sessionCoveredHours.has(segHour);
    });

    // Combine and sort
    const combined = [...filtered, ...sessionSegments];
    combined.sort((a, b) => a.startMs - b.startMs);

    // Merge adjacent segments with same concurrency
    const merged = [];
    for (const seg of combined) {
      const last = merged[merged.length - 1];
      if (last && last.concurrentTabs === seg.concurrentTabs && last.endMs >= seg.startMs) {
        last.endMs = Math.max(last.endMs, seg.endMs);
      } else {
        merged.push({ ...seg });
      }
    }
    return merged;
  }

  // Build line segments from historical data (time tracking + visit timestamps)
  buildFallbackLineSegments(domain) {
    const segments = [];
    const domainData = this.historyData[domain];
    if (!domainData) return segments;

    const timeData = this.urlTimeDataByDomain?.[domain];

    for (const dateStr of Object.keys(domainData.days)) {
      const dayData = domainData.days[dateStr];
      if (!dayData || dayData.count === 0) continue;

      const dayTimeData = timeData?.[dateStr];

      if (dayTimeData && dayTimeData.hourToUrls && Object.keys(dayTimeData.hourToUrls).length > 0) {
        // Best path: we know exactly which hours had activity and how many URLs
        for (const [hour, urlSet] of Object.entries(dayTimeData.hourToUrls)) {
          const h = parseInt(hour);
          const startMs = new Date(dateStr + 'T00:00:00').getTime() + h * 3600000;
          const endMs = startMs + 3600000;
          segments.push({ startMs, endMs, concurrentTabs: urlSet.size });
        }
      } else if (dayData.urls && dayData.urls.length > 0) {
        // Fallback: use individual visit timestamps to place short segments
        const visitsByHour = {};
        for (const urlEntry of dayData.urls) {
          if (!urlEntry.lastVisit) continue;
          const visitDate = new Date(urlEntry.lastVisit);
          const h = visitDate.getHours();
          if (!visitsByHour[h]) visitsByHour[h] = 0;
          visitsByHour[h]++;
        }

        if (Object.keys(visitsByHour).length > 0) {
          for (const [hour, count] of Object.entries(visitsByHour)) {
            const h = parseInt(hour);
            const startMs = new Date(dateStr + 'T00:00:00').getTime() + h * 3600000;
            const endMs = startMs + 3600000;
            segments.push({ startMs, endMs, concurrentTabs: Math.min(count, 5) });
          }
        } else {
          // Last resort: we have visit count but no timestamps — place a dot at noon
          const noon = new Date(dateStr + 'T12:00:00').getTime();
          segments.push({ startMs: noon, endMs: noon + 3600000, concurrentTabs: 1 });
        }
      }
    }

    // Merge adjacent same-concurrency segments
    segments.sort((a, b) => a.startMs - b.startMs);
    const merged = [];
    for (const seg of segments) {
      const last = merged[merged.length - 1];
      if (last && last.concurrentTabs === seg.concurrentTabs && last.endMs >= seg.startMs) {
        last.endMs = Math.max(last.endMs, seg.endMs);
      } else {
        merged.push({ ...seg });
      }
    }
    return merged;
  }

  async organizeHistoryByHour() {
    const hourlyData = {};

    // Go through each domain in historyData
    for (const domain in this.historyData) {
      const domainData = this.historyData[domain];

      // Go through each day
      for (const dateStr in domainData.days) {
        const dayData = domainData.days[dateStr];

        // For each URL visited on this day
        if (dayData.urls && dayData.urls.length > 0) {
          // Initialize domain once per domain
          if (!hourlyData[domain]) {
            hourlyData[domain] = {};
          }

          for (const urlData of dayData.urls) {
            // Extract hour from timestamp without creating Date object for each URL
            // Use a single Date object and reuse it
            const visitDate = new Date(urlData.lastVisit);
            const hour = String(visitDate.getHours()).padStart(2, '0');
            // Use dateStr from the outer loop (already have it) combined with extracted hour
            const hourStr = `${dateStr}T${hour}`;

            // Initialize hour if needed
            if (!hourlyData[domain][hourStr]) {
              hourlyData[domain][hourStr] = { count: 0, urls: [] };
            }

            // Add visit to this hour
            hourlyData[domain][hourStr].count++;
            hourlyData[domain][hourStr].urls.push(urlData);
          }
        }
      }
    }

    console.log('Hourly data organized:', Object.keys(hourlyData).length, 'domains');

    this.hourlyData = hourlyData;
  }

  formatHourLabel(hour) {
    return DateUtils.formatHourLabel(hour);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BulletHistory();
});
