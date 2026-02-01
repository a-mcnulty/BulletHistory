// panel-time.js — URL time tracking data

BulletHistory.prototype.hashUrl = function(url) {
    return UrlUtils.hashUrl(url);
};

// Get cached time data for a URL (synchronous)
BulletHistory.prototype.getCachedUrlTimeData = function(url) {
    return this.urlTimeCache[url] || null;
};

// Load time tracking data for a URL (aggregates all days)
BulletHistory.prototype.loadUrlTimeData = async function(url) {
    // Return cached data if available
    if (this.urlTimeCache[url] !== undefined) {
      return this.urlTimeCache[url];
    }

    try {
      const result = await chrome.storage.local.get(['urlTimeData']);
      const urlTimeData = result.urlTimeData || {};
      const urlHash = this.hashUrl(url);

      // Get today's date string
      const todayStr = DateUtils.getTodayISO();
      const todayKey = `${urlHash}:${todayStr}`;

      let totalActive = 0;
      let totalOpen = 0;
      let activeToday = 0;
      let openToday = 0;

      // Sum up all days for this URL
      for (const key of Object.keys(urlTimeData)) {
        if (key.startsWith(urlHash + ':')) {
          const entry = urlTimeData[key];
          const entryActive = entry.a || 0;
          let entryOpen = 0;

          // Backwards compatibility: use 'o' if exists, else calculate from a + b for old entries
          if (entry.o !== undefined) {
            entryOpen = entry.o;
          } else if (entry.b !== undefined) {
            // Old format: open = active + background
            entryOpen = entryActive + entry.b;
          }

          totalActive += entryActive;
          totalOpen += entryOpen;

          // Check if this is today's entry
          if (key === todayKey) {
            activeToday = entryActive;
            openToday = entryOpen;
          }
        }
      }

      if (totalActive === 0 && totalOpen === 0) {
        this.urlTimeCache[url] = null;
        return null;
      }

      const timeData = {
        activeSeconds: totalActive,
        openSeconds: totalOpen,
        activeTodaySeconds: activeToday,
        openTodaySeconds: openToday
      };

      // Cache the result
      this.urlTimeCache[url] = timeData;
      return timeData;
    } catch (e) {
      console.warn('Failed to load URL time data:', e);
      return null;
    }
};

// Format time tracking for display (returns { display, tooltip })
BulletHistory.prototype.formatTimeTracking = function(timeData) {
    if (!timeData) return null;

    const activeSeconds = timeData.activeSeconds;
    const openSeconds = timeData.openSeconds;

    // Format open time for display (total time tab was open)
    let display;
    if (openSeconds >= 3600) {
      display = `${Math.floor(openSeconds / 3600)}h`;
    } else if (openSeconds >= 60) {
      display = `${Math.floor(openSeconds / 60)}m`;
    } else {
      display = `${openSeconds}s`;
    }

    // Format detailed breakdown for tooltip
    const formatTime = (seconds) => {
      if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      } else if (seconds >= 60) {
        return `${Math.floor(seconds / 60)}m`;
      } else {
        return `${seconds}s`;
      }
    };

    const tooltip = `Active: ${formatTime(activeSeconds)}, Open: ${formatTime(openSeconds)}`;

    return { display, tooltip };
};

// Load all URL time data organized by domain for cell rendering
// Also populates urlTimeCache for individual URL time display
BulletHistory.prototype.loadUrlTimeDataForCells = async function() {
    try {
      // Request background to save current time data before reading
      await chrome.runtime.sendMessage({ type: 'saveCurrentTimeData' }).catch(() => {
        // Background might not respond, continue anyway
      });

      const result = await chrome.storage.local.get(['urlTimeData', 'urlHashes']);
      const urlTimeData = result.urlTimeData || {};
      const urlHashes = result.urlHashes || {};

      this.urlTimeDataByDomain = {};

      // Get today's date string for today-specific aggregation
      const todayStr = DateUtils.getTodayISO();

      // Also aggregate time data per-URL for the urlTimeCache
      const urlTimeAggregates = {}; // { url: { activeSeconds, openSeconds, activeTodaySeconds, openTodaySeconds } }

      // Cache URL -> domain mapping to avoid repeated URL parsing
      const urlToDomain = new Map();

      for (const key of Object.keys(urlTimeData)) {
        const entry = urlTimeData[key];

        // Extract hash and date from key (format: urlHash:YYYY-MM-DD)
        const colonIdx = key.indexOf(':');
        if (colonIdx === -1) continue;
        const urlHash = key.substring(0, colonIdx);
        const dateStr = key.substring(colonIdx + 1);
        if (!dateStr) continue;

        // Look up URL from hash table, fall back to entry.url for old entries
        const url = urlHashes[urlHash] || entry.url;
        if (!url) continue;

        // Aggregate time data for this URL
        if (!urlTimeAggregates[url]) {
          urlTimeAggregates[url] = { activeSeconds: 0, openSeconds: 0, activeTodaySeconds: 0, openTodaySeconds: 0 };
        }

        const entryActive = entry.a || 0;
        let entryOpen = 0;
        // Handle both new format (o) and old format (b)
        if (entry.o !== undefined) {
          entryOpen = entry.o;
        } else if (entry.b !== undefined) {
          entryOpen = entryActive + entry.b;
        }

        urlTimeAggregates[url].activeSeconds += entryActive;
        urlTimeAggregates[url].openSeconds += entryOpen;

        // Track today's values separately
        if (dateStr === todayStr) {
          urlTimeAggregates[url].activeTodaySeconds += entryActive;
          urlTimeAggregates[url].openTodaySeconds += entryOpen;
        }

        // Get domain from URL (use cached mapping if available)
        let domain = urlToDomain.get(url);
        if (!domain) {
          domain = UrlUtils.getHostname(url);
          if (!domain) continue;
          urlToDomain.set(url, domain);
        }

        // Initialize domain structure
        if (!this.urlTimeDataByDomain[domain]) {
          this.urlTimeDataByDomain[domain] = {};
        }

        // Initialize date structure
        if (!this.urlTimeDataByDomain[domain][dateStr]) {
          this.urlTimeDataByDomain[domain][dateStr] = {
            urls: new Set(),
            hourToUrls: {}  // { hour: Set of URLs }
          };
        }

        // Add URL to this date
        this.urlTimeDataByDomain[domain][dateStr].urls.add(url);

        // Add URL to specific hours
        const hours = entry.h || [];
        for (const hour of hours) {
          if (!this.urlTimeDataByDomain[domain][dateStr].hourToUrls[hour]) {
            this.urlTimeDataByDomain[domain][dateStr].hourToUrls[hour] = new Set();
          }
          this.urlTimeDataByDomain[domain][dateStr].hourToUrls[hour].add(url);
        }
      }

      // Populate urlTimeCache with aggregated data
      this.urlTimeCache = {};
      for (const [url, data] of Object.entries(urlTimeAggregates)) {
        if (data.activeSeconds > 0 || data.openSeconds > 0) {
          this.urlTimeCache[url] = data;
        }
      }
    } catch (e) {
      console.warn('Failed to load URL time data for cells:', e);
    }
};

// Refresh URL time cache - requests background to save current data and reloads
// Call this before rendering views that need fresh time data
BulletHistory.prototype.refreshUrlTimeCache = async function() {
    // Also refresh open tabs data so we can use openedAt for currently open tabs
    await this.loadOpenTabsData();
    await this.loadUrlTimeDataForCells();
};

// Load open tabs data to get openedAt timestamps for currently open tabs
BulletHistory.prototype.loadOpenTabsData = async function() {
    try {
      const result = await chrome.storage.local.get(['openTabs']);
      const openTabs = result.openTabs || {};
      this.openTabsByUrl = {};
      for (const [tabId, tabData] of Object.entries(openTabs)) {
        if (tabData.url && tabData.openedAt) {
          this.openTabsByUrl[tabData.url] = tabData.openedAt;
        }
      }
    } catch (e) {
      console.warn('Failed to load open tabs data:', e);
    }
};

// Get URLs from time tracking data for a domain + date (or hour)
// Returns array of URL strings that have time data for the specified time slot
BulletHistory.prototype.getUrlsFromTimeData = function(domain, timeSlot, isHourView) {
    const domainTimeData = this.urlTimeDataByDomain[domain];
    if (!domainTimeData) return [];

    if (isHourView) {
      // timeSlot format: 'YYYY-MM-DDTHH' (e.g., '2025-01-22T14')
      const [dateStr, hourStr] = timeSlot.split('T');
      const hour = parseInt(hourStr, 10);

      if (domainTimeData[dateStr] && domainTimeData[dateStr].hourToUrls[hour]) {
        return Array.from(domainTimeData[dateStr].hourToUrls[hour]);
      }
      return [];
    } else {
      // Day view: timeSlot is dateStr (e.g., '2025-01-22')
      if (domainTimeData[timeSlot] && domainTimeData[timeSlot].urls) {
        return Array.from(domainTimeData[timeSlot].urls);
      }
      return [];
    }
};

// Get unique URL count for a cell (domain + time slot)
// Returns count based on time data, or falls back to visit-based count
BulletHistory.prototype.getUniqueUrlCountForCell = function(domain, timeSlot, isHourView) {
    const domainTimeData = this.urlTimeDataByDomain[domain];

    if (isHourView) {
      // timeSlot format: 'YYYY-MM-DDTHH' (e.g., '2025-01-22T14')
      const [dateStr, hourStr] = timeSlot.split('T');
      const hour = parseInt(hourStr, 10);

      if (domainTimeData && domainTimeData[dateStr] && domainTimeData[dateStr].hourToUrls[hour]) {
        return domainTimeData[dateStr].hourToUrls[hour].size;
      }

      // Fallback: use existing hourlyData
      const hourData = this.hourlyData[domain]?.[timeSlot];
      if (hourData && hourData.urls) {
        return hourData.urls.length;
      }
      return 0;
    } else {
      // Day view: timeSlot is dateStr (e.g., '2025-01-22')
      if (domainTimeData && domainTimeData[timeSlot]) {
        return domainTimeData[timeSlot].urls.size;
      }

      // Fallback: use existing historyData
      const dayData = this.historyData[domain]?.days[timeSlot];
      if (dayData && dayData.urls) {
        return dayData.urls.length;
      }
      return 0;
    }
};
