// Background service worker - handles extension icon clicks

// Enable native toggle behavior for the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Track recently closed tabs
const MAX_CLOSED_TABS = 50;
const activeTabs = new Map();

// ===== URL TIME TRACKING =====
const MAX_DATA_AGE_DAYS = 90;
let currentActiveTabId = null;
let currentActiveUrl = null;
let lastActiveTimestamp = null;
let windowFocused = true;
const backgroundTabsStartTime = {};  // { tabId: timestamp }

// djb2 hash function, returns 8-char hex string
function hashUrl(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
  }
  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shouldSkipUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url === 'about:blank' ||
         url.startsWith('about:');
}

async function addTimeToUrl(url, timeType, seconds) {
  if (shouldSkipUrl(url) || seconds <= 0) return;

  const urlHash = hashUrl(url);
  const dateStr = getTodayDateString();
  const key = `${urlHash}:${dateStr}`;

  try {
    const result = await chrome.storage.local.get(['urlTimeData']);
    const urlTimeData = result.urlTimeData || {};

    if (!urlTimeData[key]) {
      urlTimeData[key] = {
        url: url,
        a: 0,  // activeSeconds
        b: 0   // backgroundSeconds
      };
    }

    if (timeType === 'active') {
      urlTimeData[key].a += seconds;
    } else {
      urlTimeData[key].b += seconds;
    }

    await chrome.storage.local.set({ urlTimeData });
  } catch (e) {
    console.warn('Failed to add time to URL:', e);
  }
}

async function finalizeActiveTabTime() {
  if (!currentActiveUrl || !lastActiveTimestamp || !windowFocused) return;

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastActiveTimestamp) / 1000);

  if (elapsedSeconds > 0) {
    await addTimeToUrl(currentActiveUrl, 'active', elapsedSeconds);
  }

  lastActiveTimestamp = now;
}

async function finalizeBackgroundTime(tabId) {
  const startTime = backgroundTabsStartTime[tabId];
  if (!startTime) return;

  const tabInfo = activeTabs.get(tabId);
  if (!tabInfo || !tabInfo.url) {
    delete backgroundTabsStartTime[tabId];
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - startTime) / 1000);

  if (elapsedSeconds > 0) {
    await addTimeToUrl(tabInfo.url, 'background', elapsedSeconds);
  }

  delete backgroundTabsStartTime[tabId];
}

async function updateBackgroundTracking(newActiveTabId) {
  const now = Date.now();

  // Start background tracking for the previously active tab (if it's still open)
  if (currentActiveTabId !== null && currentActiveTabId !== newActiveTabId) {
    if (activeTabs.has(currentActiveTabId)) {
      backgroundTabsStartTime[currentActiveTabId] = now;
    }
  }

  // Stop background tracking for the new active tab
  if (newActiveTabId !== null && backgroundTabsStartTime[newActiveTabId]) {
    await finalizeBackgroundTime(newActiveTabId);
  }
}

async function startActiveTracking(tabId, url) {
  // Finalize previous active time
  await finalizeActiveTabTime();

  // Update background tracking
  await updateBackgroundTracking(tabId);

  // Start new active tracking
  currentActiveTabId = tabId;
  currentActiveUrl = url;
  lastActiveTimestamp = windowFocused ? Date.now() : null;
}

async function pruneOldTimeData() {
  try {
    const result = await chrome.storage.local.get(['urlTimeData']);
    const urlTimeData = result.urlTimeData || {};

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - MAX_DATA_AGE_DAYS);

    let pruned = false;
    for (const key of Object.keys(urlTimeData)) {
      // Key format: urlHash:YYYY-MM-DD
      const datePart = key.split(':')[1];
      if (datePart) {
        const entryDate = new Date(datePart);
        if (entryDate < cutoffDate) {
          delete urlTimeData[key];
          pruned = true;
        }
      }
    }

    if (pruned) {
      await chrome.storage.local.set({ urlTimeData });
      console.log('Pruned old URL time data');
    }
  } catch (e) {
    console.warn('Failed to prune URL time data:', e);
  }
}

// Favicon cache settings
const MAX_FAVICON_CACHE = 1000; // Maximum number of cached favicons

// Helper function to cache favicon for a URL
async function cacheFavicon(url, favIconUrl) {
  if (!favIconUrl || favIconUrl.length === 0 || favIconUrl.startsWith('chrome://')) {
    return; // Don't cache invalid favicons
  }

  try {
    const result = await chrome.storage.local.get(['faviconCache']);
    const cache = result.faviconCache || {};

    // Add or update favicon in cache
    cache[url] = {
      favicon: favIconUrl,
      timestamp: Date.now()
    };

    // Limit cache size - remove oldest entries if needed
    const entries = Object.entries(cache);
    if (entries.length > MAX_FAVICON_CACHE) {
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // Keep only the most recent MAX_FAVICON_CACHE entries
      const trimmedCache = {};
      entries.slice(-MAX_FAVICON_CACHE).forEach(([url, data]) => {
        trimmedCache[url] = data;
      });
      await chrome.storage.local.set({ faviconCache: trimmedCache });
    } else {
      await chrome.storage.local.set({ faviconCache: cache });
    }
  } catch (e) {
    console.warn('Failed to cache favicon:', e);
  }
}

// Track when tabs are created
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    const tabInfo = {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl,
      openedAt: Date.now()
    };
    activeTabs.set(tab.id, tabInfo);

    // Cache favicon
    await cacheFavicon(tab.url, tab.favIconUrl);

    // Persist to storage
    const result = await chrome.storage.local.get(['openTabs']);
    const openTabs = result.openTabs || {};
    openTabs[tab.id] = tabInfo;
    await chrome.storage.local.set({ openTabs });

    // Notify panel of tab change
    chrome.runtime.sendMessage({
      type: 'tabsUpdated'
    }).catch(() => {
      // Panel might not be open, ignore error
    });
  }
});

// Track when tabs are updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Store tab info whenever it updates
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    const existing = activeTabs.get(tabId);
    const oldUrl = existing?.url;
    const tabInfo = {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl,
      openedAt: existing?.openedAt || Date.now() // Preserve original open time
    };
    activeTabs.set(tabId, tabInfo);

    // Handle URL change for time tracking (SPA navigation)
    if (changeInfo.url && oldUrl !== changeInfo.url) {
      if (tabId === currentActiveTabId) {
        // Active tab URL changed - finalize time for old URL, start tracking new URL
        await finalizeActiveTabTime();
        currentActiveUrl = changeInfo.url;
        lastActiveTimestamp = windowFocused ? Date.now() : null;
      } else if (backgroundTabsStartTime[tabId]) {
        // Background tab URL changed - finalize time for old URL, restart background tracking
        await finalizeBackgroundTime(tabId);
        backgroundTabsStartTime[tabId] = Date.now();
      }
    }

    // Cache favicon
    await cacheFavicon(tab.url, tab.favIconUrl);

    // Persist to storage
    const result = await chrome.storage.local.get(['openTabs']);
    const openTabs = result.openTabs || {};
    openTabs[tabId] = tabInfo;
    await chrome.storage.local.set({ openTabs });

    // Notify panel of tab change
    chrome.runtime.sendMessage({
      type: 'tabsUpdated'
    }).catch(() => {
      // Panel might not be open, ignore error
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Finalize time tracking for this tab before removing
  if (tabId === currentActiveTabId) {
    await finalizeActiveTabTime();
    currentActiveTabId = null;
    currentActiveUrl = null;
    lastActiveTimestamp = null;
  } else if (backgroundTabsStartTime[tabId]) {
    await finalizeBackgroundTime(tabId);
  }

  // Get the tab data we stored
  const tabData = activeTabs.get(tabId);

  if (!tabData) {
    return;
  }

  // Don't track when whole window is closing
  if (removeInfo.isWindowClosing) {
    activeTabs.delete(tabId);
    return;
  }

  // Get existing closed tabs list
  const result = await chrome.storage.local.get(['closedTabs']);
  const closedTabs = result.closedTabs || [];

  // Add new closed tab at the beginning
  closedTabs.unshift({
    url: tabData.url,
    title: tabData.title,
    favIconUrl: tabData.favIconUrl,
    closedAt: Date.now()
  });

  // Keep only the most recent MAX_CLOSED_TABS
  if (closedTabs.length > MAX_CLOSED_TABS) {
    closedTabs.length = MAX_CLOSED_TABS;
  }

  // Save back to storage
  await chrome.storage.local.set({ closedTabs });

  // Clean up the active tabs map and storage
  activeTabs.delete(tabId);

  // Remove from openTabs storage
  const openTabsResult = await chrome.storage.local.get(['openTabs']);
  const openTabs = openTabsResult.openTabs || {};
  delete openTabs[tabId];
  await chrome.storage.local.set({ openTabs });

  // Notify panel of tab change
  chrome.runtime.sendMessage({
    type: 'tabsUpdated'
  }).catch(() => {
    // Panel might not be open, ignore error
  });
});

// Track tab activation for time tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url) {
      await startActiveTracking(tabId, tab.url);
    }
  } catch (e) {
    // Tab might not exist anymore
    console.warn('Failed to get tab for time tracking:', e);
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - all tabs are now "background"
    await finalizeActiveTabTime();
    windowFocused = false;
    lastActiveTimestamp = null;

    // Start background tracking for the previously active tab
    if (currentActiveTabId !== null && activeTabs.has(currentActiveTabId)) {
      backgroundTabsStartTime[currentActiveTabId] = Date.now();
    }
  } else {
    // Browser gained focus
    const wasFocused = windowFocused;
    windowFocused = true;

    // Stop background tracking and resume active tracking for current tab
    if (currentActiveTabId !== null) {
      if (backgroundTabsStartTime[currentActiveTabId]) {
        await finalizeBackgroundTime(currentActiveTabId);
      }
      lastActiveTimestamp = Date.now();
    }

    // If we didn't have focus before, find the active tab in this window
    if (!wasFocused) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, windowId: windowId });
        if (activeTab && activeTab.url) {
          await startActiveTracking(activeTab.id, activeTab.url);
        }
      } catch (e) {
        console.warn('Failed to get active tab on focus:', e);
      }
    }
  }
});

// Initialize: Load existing tabs into the map
chrome.storage.local.get(['openTabs'], (result) => {
  const storedTabs = result.openTabs || {};

  chrome.tabs.query({}, async (tabs) => {
    const openTabs = {};
    let activeTab = null;

    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && tab.url !== 'about:blank') {
        const tabInfo = {
          url: tab.url,
          title: tab.title || tab.url,
          favIconUrl: tab.favIconUrl,
          openedAt: storedTabs[tab.id]?.openedAt || Date.now() // Use stored time or current time
        };
        activeTabs.set(tab.id, tabInfo);
        openTabs[tab.id] = tabInfo;

        // Track the active tab
        if (tab.active) {
          activeTab = tab;
        }
      }
    });

    // Save updated openTabs to storage
    await chrome.storage.local.set({ openTabs });

    // Initialize time tracking
    if (activeTab && activeTab.url && !shouldSkipUrl(activeTab.url)) {
      currentActiveTabId = activeTab.id;
      currentActiveUrl = activeTab.url;
      lastActiveTimestamp = Date.now();

      // Start background tracking for all other open tabs
      const now = Date.now();
      for (const [tabId, tabInfo] of activeTabs) {
        if (tabId !== activeTab.id && !shouldSkipUrl(tabInfo.url)) {
          backgroundTabsStartTime[tabId] = now;
        }
      }
    }

    // Run initial prune
    await pruneOldTimeData();
  });
});

// ===== ALARMS =====

// Alarm names
const CALENDAR_SYNC_ALARM = 'calendarSync';
const URL_TIME_SAVE_ALARM = 'urlTimeSave';
const URL_TIME_PRUNE_ALARM = 'urlTimePrune';

// Create alarms
chrome.alarms.create(CALENDAR_SYNC_ALARM, {
  periodInMinutes: 15
});

// URL time tracking alarms
chrome.alarms.create(URL_TIME_SAVE_ALARM, {
  periodInMinutes: 1  // Save every minute for crash protection
});

chrome.alarms.create(URL_TIME_PRUNE_ALARM, {
  periodInMinutes: 360  // Prune every 6 hours
});

// Run initial sync on extension load
syncCalendarEvents();

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CALENDAR_SYNC_ALARM) {
    await syncCalendarEvents();
  } else if (alarm.name === URL_TIME_SAVE_ALARM) {
    // Periodic save of active and background time
    await finalizeActiveTabTime();
    // Finalize all background tabs and restart their tracking
    const now = Date.now();
    for (const tabId of Object.keys(backgroundTabsStartTime)) {
      const numTabId = parseInt(tabId);
      await finalizeBackgroundTime(numTabId);
      // Restart background tracking if tab is still open
      if (activeTabs.has(numTabId) && numTabId !== currentActiveTabId) {
        backgroundTabsStartTime[numTabId] = now;
      }
    }
  } else if (alarm.name === URL_TIME_PRUNE_ALARM) {
    await pruneOldTimeData();
  }
});

/**
 * Sync calendar events for the current date range
 */
async function syncCalendarEvents() {
  console.log('Starting calendar sync...');
  try {
    // Check if user is authenticated
    const result = await chrome.storage.local.get(['calendarAuth']);
    const authState = result.calendarAuth;

    if (!authState || !authState.enabled) {
      console.log('Calendar sync skipped: not authenticated');
      return;
    }
    console.log('Auth state:', authState);

    // Get auth token (non-interactive)
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(token);
        }
      });
    });

    if (!token) {
      console.log('Calendar sync skipped: no valid token');
      return;
    }

    // Load calendar data
    const calendarDataResult = await chrome.storage.local.get(['calendarData']);
    const calendarData = calendarDataResult.calendarData || {
      events: {},
      calendars: {},
      lastSync: null,
      syncToken: null
    };

    // Get enabled calendars
    const enabledCalendars = Object.values(calendarData.calendars)
      .filter(cal => cal.enabled)
      .map(cal => cal.id);

    if (enabledCalendars.length === 0) {
      console.log('Calendar sync skipped: no enabled calendars');
      return;
    }

    // Determine date range (today ± 30 days)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    endDate.setHours(23, 59, 59, 999);

    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    // Fetch events from all enabled calendars
    const allEvents = [];
    for (const calendarId of enabledCalendars) {
      try {
        const calendar = calendarData.calendars[calendarId];
        const params = new URLSearchParams({
          timeMin: timeMin,
          timeMax: timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '2500'
        });

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.items) {
            data.items.forEach(event => {
              allEvents.push({
                ...event,
                calendarId: calendarId,
                calendarName: calendar?.name || calendarId,
                backgroundColor: calendar?.backgroundColor || '#039BE5'
              });
            });
          }
        } else {
          console.warn(`Failed to fetch events for calendar ${calendarId}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`Error fetching events for calendar ${calendarId}:`, error);
      }
    }

    // Organize events by date
    const eventsByDate = {};
    allEvents.forEach(event => {
      // Determine if all-day event
      const isAllDay = !event.start.dateTime;

      // Get start date in local timezone (not UTC)
      let startDateStr;
      if (isAllDay) {
        startDateStr = event.start.date;
      } else {
        const startDate = new Date(event.start.dateTime);
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        startDateStr = `${year}-${month}-${day}`;
      }

      // Initialize date array if needed
      if (!eventsByDate[startDateStr]) {
        eventsByDate[startDateStr] = [];
      }

      // Add processed event
      eventsByDate[startDateStr].push({
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        htmlLink: event.htmlLink,
        colorId: event.colorId,
        backgroundColor: event.backgroundColor,
        calendarId: event.calendarId,
        calendarName: event.calendarName,
        isAllDay: isAllDay,
        attendees: event.attendees
      });
    });

    // Update calendar data
    calendarData.events = eventsByDate;
    calendarData.lastSync = Date.now();

    // Save to storage
    await chrome.storage.local.set({
      calendarData: calendarData,
      calendarCacheTimestamp: Date.now()
    });

    console.log(`Calendar sync completed: ${allEvents.length} events from ${enabledCalendars.length} calendars`);

    // Notify panel that calendar data has been updated
    chrome.runtime.sendMessage({
      type: 'calendarDataUpdated',
      eventCount: allEvents.length
    }).catch(() => {
      // Panel might not be open, ignore error
    });
  } catch (error) {
    console.error('Calendar sync failed:', error);
  }
}
