// Background service worker - handles extension icon clicks

// Enable native toggle behavior for the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Track recently closed tabs
const MAX_CLOSED_TABS = 50;
const activeTabs = new Map();

// In-memory openTabs cache with debounced storage writes
let openTabsInMemory = {};
let openTabsDirty = false;
let openTabsWriteTimer = null;
const OPEN_TABS_WRITE_DELAY = 5000; // 5 seconds

// Debounced write function for openTabs
function scheduleOpenTabsWrite() {
  openTabsDirty = true;
  if (openTabsWriteTimer) return; // Already scheduled
  openTabsWriteTimer = setTimeout(async () => {
    openTabsWriteTimer = null;
    if (openTabsDirty) {
      openTabsDirty = false;
      await chrome.storage.local.set({ openTabs: openTabsInMemory });
    }
  }, OPEN_TABS_WRITE_DELAY);
}

// Immediate write for critical operations (like tab close)
async function flushOpenTabs() {
  if (openTabsWriteTimer) {
    clearTimeout(openTabsWriteTimer);
    openTabsWriteTimer = null;
  }
  openTabsDirty = false;
  await chrome.storage.local.set({ openTabs: openTabsInMemory });
}

// ===== URL TIME TRACKING =====
const MAX_DATA_AGE_DAYS = 90;
let currentActiveTabId = null;
let currentActiveUrl = null;
let lastActiveTimestamp = null;
let windowFocused = true;
const openTabsStartTime = {};  // { tabId: timestamp } - tracks open time for ALL tabs
let timeTrackingInitialized = false;
let initPromiseResolve = null;
const initPromise = new Promise(resolve => { initPromiseResolve = resolve; });

// In-memory time data accumulator for batched writes
// Structure: { "urlHash:dateStr": { a: activeSeconds, o: openSeconds, h: Set<hour> } }
const pendingTimeUpdates = {};
let pendingUrlHashes = {}; // New URL hash mappings to add

// Sleep detection: track last alarm time to detect system sleep
let lastAlarmTime = Date.now();
const MAX_EXPECTED_ALARM_GAP_MS = 90000; // 90 seconds (alarm is every 60s, allow 30s buffer)

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

function getCurrentHour() {
  return new Date().getHours();
}

// Accumulate time in memory (no I/O) - will be flushed periodically
function addTimeToUrl(url, timeType, seconds) {
  if (shouldSkipUrl(url) || seconds <= 0) return;

  const urlHash = hashUrl(url);
  const dateStr = getTodayDateString();
  const key = `${urlHash}:${dateStr}`;
  const currentHour = getCurrentHour();

  // Store URL hash mapping
  if (!pendingUrlHashes[urlHash]) {
    pendingUrlHashes[urlHash] = url;
  }

  // Initialize pending update if needed
  if (!pendingTimeUpdates[key]) {
    pendingTimeUpdates[key] = { a: 0, o: 0, h: new Set() };
  }

  // Accumulate time
  if (timeType === 'active') {
    pendingTimeUpdates[key].a += seconds;
  } else if (timeType === 'open') {
    pendingTimeUpdates[key].o += seconds;
  }

  // Track hour
  pendingTimeUpdates[key].h.add(currentHour);
}

// Flush accumulated time data to storage
async function flushTimeData() {
  // Check if there's anything to flush
  const updateKeys = Object.keys(pendingTimeUpdates);
  const hashKeys = Object.keys(pendingUrlHashes);
  if (updateKeys.length === 0 && hashKeys.length === 0) return;

  try {
    const result = await chrome.storage.local.get(['urlTimeData', 'urlHashes']);
    const urlTimeData = result.urlTimeData || {};
    const urlHashes = result.urlHashes || {};

    // Merge pending URL hashes
    for (const [hash, url] of Object.entries(pendingUrlHashes)) {
      if (!urlHashes[hash]) {
        urlHashes[hash] = url;
      }
    }

    // Merge pending time updates
    for (const [key, update] of Object.entries(pendingTimeUpdates)) {
      if (!urlTimeData[key]) {
        urlTimeData[key] = { a: 0, o: 0, h: [] };
      }

      urlTimeData[key].a += update.a;
      urlTimeData[key].o += update.o;

      // Merge hours (convert Set to array and merge)
      const existingHours = new Set(urlTimeData[key].h || []);
      for (const hour of update.h) {
        existingHours.add(hour);
      }
      urlTimeData[key].h = Array.from(existingHours).sort((a, b) => a - b);
    }

    // Write merged data back to storage
    await chrome.storage.local.set({ urlTimeData, urlHashes });

    // Clear pending updates
    for (const key of updateKeys) {
      delete pendingTimeUpdates[key];
    }
    for (const key of hashKeys) {
      delete pendingUrlHashes[key];
    }
  } catch (e) {
    console.warn('Failed to flush time data:', e);
  }
}

function finalizeActiveTabTime() {
  if (!currentActiveUrl || !lastActiveTimestamp || !windowFocused) return;

  const now = Date.now();
  const elapsedMs = now - lastActiveTimestamp;

  // Skip if elapsed time suggests system was asleep (> 90 seconds since last update)
  // This can happen if tab switch occurs right after wake
  if (elapsedMs > MAX_EXPECTED_ALARM_GAP_MS) {
    console.log(`Skipping active time: ${Math.round(elapsedMs / 1000)}s elapsed (likely sleep)`);
    lastActiveTimestamp = now;
    return;
  }

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds > 0) {
    // Active time contributes to both 'a' (active) AND 'o' (open)
    addTimeToUrl(currentActiveUrl, 'active', elapsedSeconds);
    addTimeToUrl(currentActiveUrl, 'open', elapsedSeconds);
  }

  lastActiveTimestamp = now;
}

function finalizeOpenTime(tabId) {
  const startTime = openTabsStartTime[tabId];
  if (!startTime) return;

  const tabInfo = activeTabs.get(tabId);
  if (!tabInfo || !tabInfo.url) {
    delete openTabsStartTime[tabId];
    return;
  }

  const now = Date.now();
  const elapsedMs = now - startTime;

  // Skip if elapsed time suggests system was asleep (> 90 seconds since last update)
  if (elapsedMs > MAX_EXPECTED_ALARM_GAP_MS) {
    console.log(`Skipping open time for tab ${tabId}: ${Math.round(elapsedMs / 1000)}s elapsed (likely sleep)`);
    delete openTabsStartTime[tabId];
    return;
  }

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  if (elapsedSeconds > 0) {
    addTimeToUrl(tabInfo.url, 'open', elapsedSeconds);
  }

  delete openTabsStartTime[tabId];
}

function updateOpenTracking(newActiveTabId) {
  const now = Date.now();

  // Start open tracking for the previously active tab (if it's still open)
  if (currentActiveTabId !== null && currentActiveTabId !== newActiveTabId) {
    if (activeTabs.has(currentActiveTabId)) {
      openTabsStartTime[currentActiveTabId] = now;
    }
  }

  // Stop open tracking for the new active tab (its open time is tracked via active time)
  if (newActiveTabId !== null && openTabsStartTime[newActiveTabId]) {
    finalizeOpenTime(newActiveTabId);
  }
}

function startActiveTracking(tabId, url) {
  // Finalize previous active time (accumulates in memory)
  finalizeActiveTabTime();

  // Update open tracking
  updateOpenTracking(tabId);

  // Start new active tracking
  currentActiveTabId = tabId;
  currentActiveUrl = url;
  lastActiveTimestamp = windowFocused ? Date.now() : null;
}

async function pruneOldTimeData() {
  try {
    const result = await chrome.storage.local.get(['urlTimeData', 'urlHashes']);
    const urlTimeData = result.urlTimeData || {};
    const urlHashes = result.urlHashes || {};

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

    // Clean up orphaned urlHashes (hashes with no remaining time data)
    const usedHashes = new Set(Object.keys(urlTimeData).map(key => key.split(':')[0]));
    for (const hash of Object.keys(urlHashes)) {
      if (!usedHashes.has(hash)) {
        delete urlHashes[hash];
        pruned = true;
      }
    }

    if (pruned) {
      await chrome.storage.local.set({ urlTimeData, urlHashes });
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

    // Update in-memory storage (debounced write to disk)
    openTabsInMemory[tab.id] = tabInfo;
    scheduleOpenTabsWrite();

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
        finalizeActiveTabTime();
        currentActiveUrl = changeInfo.url;
        lastActiveTimestamp = windowFocused ? Date.now() : null;
      } else if (openTabsStartTime[tabId]) {
        // Background tab URL changed - finalize open time for old URL, restart open tracking
        finalizeOpenTime(tabId);
        openTabsStartTime[tabId] = Date.now();
      }
    }

    // Cache favicon (only when favicon actually changes to reduce writes)
    if (changeInfo.favIconUrl) {
      await cacheFavicon(tab.url, tab.favIconUrl);
    }

    // Update in-memory storage (debounced write to disk)
    openTabsInMemory[tabId] = tabInfo;
    scheduleOpenTabsWrite();

    // Notify panel of tab change
    chrome.runtime.sendMessage({
      type: 'tabsUpdated'
    }).catch(() => {
      // Panel might not be open, ignore error
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Finalize time tracking for this tab before removing (accumulates in memory)
  if (tabId === currentActiveTabId) {
    finalizeActiveTabTime();
    currentActiveTabId = null;
    currentActiveUrl = null;
    lastActiveTimestamp = null;
  } else if (openTabsStartTime[tabId]) {
    finalizeOpenTime(tabId);
  }

  // Get the tab data we stored
  const tabData = activeTabs.get(tabId);

  if (!tabData) {
    return;
  }

  // Clean up from in-memory storage
  activeTabs.delete(tabId);
  delete openTabsInMemory[tabId];

  // Don't track when whole window is closing
  if (removeInfo.isWindowClosing) {
    // Still flush openTabs to persist the removal
    await flushOpenTabs();
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

  // Save closedTabs and flush openTabs in a single batch write
  await chrome.storage.local.set({
    closedTabs,
    openTabs: openTabsInMemory
  });
  openTabsDirty = false;
  if (openTabsWriteTimer) {
    clearTimeout(openTabsWriteTimer);
    openTabsWriteTimer = null;
  }

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
      startActiveTracking(tabId, tab.url);
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
    finalizeActiveTabTime();
    windowFocused = false;
    lastActiveTimestamp = null;

    // Start open tracking for the previously active tab (it's now background)
    if (currentActiveTabId !== null && activeTabs.has(currentActiveTabId)) {
      openTabsStartTime[currentActiveTabId] = Date.now();
    }
  } else {
    // Browser gained focus
    const wasFocused = windowFocused;
    windowFocused = true;

    // Stop open tracking and resume active tracking for current tab
    if (currentActiveTabId !== null) {
      if (openTabsStartTime[currentActiveTabId]) {
        finalizeOpenTime(currentActiveTabId);
      }
      lastActiveTimestamp = Date.now();
    }

    // If we didn't have focus before, find the active tab in this window
    if (!wasFocused) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, windowId: windowId });
        if (activeTab && activeTab.url) {
          startActiveTracking(activeTab.id, activeTab.url);
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
        openTabsInMemory[tab.id] = tabInfo;

        // Track the active tab
        if (tab.active) {
          activeTab = tab;
        }
      }
    });

    // Save updated openTabs to storage
    await chrome.storage.local.set({ openTabs: openTabsInMemory });

    // Initialize time tracking
    if (activeTab && activeTab.url && !shouldSkipUrl(activeTab.url)) {
      currentActiveTabId = activeTab.id;
      currentActiveUrl = activeTab.url;
      lastActiveTimestamp = Date.now();

      // Start open tracking for all other open tabs (background tabs)
      const now = Date.now();
      for (const [tabId, tabInfo] of activeTabs) {
        if (tabId !== activeTab.id && !shouldSkipUrl(tabInfo.url)) {
          openTabsStartTime[tabId] = now;
        }
      }
    }

    // Run initial prune
    await pruneOldTimeData();

    // Mark initialization as complete
    timeTrackingInitialized = true;
    if (initPromiseResolve) initPromiseResolve();
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
    const now = Date.now();
    const timeSinceLastAlarm = now - lastAlarmTime;

    // Check for sleep: if more time passed than expected, system was likely asleep
    if (timeSinceLastAlarm > MAX_EXPECTED_ALARM_GAP_MS) {
      console.log(`Sleep detected: ${Math.round(timeSinceLastAlarm / 1000)}s gap. Resetting timestamps without adding sleep time.`);

      // Reset timestamps to now WITHOUT finalizing (don't count sleep as open time)
      lastActiveTimestamp = windowFocused ? now : null;
      for (const tabId of Object.keys(openTabsStartTime)) {
        openTabsStartTime[tabId] = now;
      }
      lastAlarmTime = now;

      // Still flush any pending data from before sleep
      await flushTimeData();
      return;
    }

    lastAlarmTime = now;

    // Normal case: finalize and save time
    finalizeActiveTabTime(); // Accumulates in memory (synchronous)
    // Finalize all background tabs' open time and restart their tracking
    for (const tabId of Object.keys(openTabsStartTime)) {
      const numTabId = parseInt(tabId);
      finalizeOpenTime(numTabId); // Accumulates in memory (synchronous)
      // Restart open tracking if tab is still open (and not the active tab)
      if (activeTabs.has(numTabId) && numTabId !== currentActiveTabId) {
        openTabsStartTime[numTabId] = now;
      }
    }
    // Flush accumulated time data to storage (single I/O operation)
    await flushTimeData();
  } else if (alarm.name === URL_TIME_PRUNE_ALARM) {
    await pruneOldTimeData();
  }
});

// Handle messages from panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveCurrentTimeData') {
    // Finalize and save all current time tracking data
    (async () => {
      try {
        // Wait for initialization to complete if needed
        if (!timeTrackingInitialized) {
          await initPromise;
        }

        // Accumulate active tab time
        finalizeActiveTabTime();

        // Finalize all background tabs' open time and restart their tracking
        const now = Date.now();
        for (const tabId of Object.keys(openTabsStartTime)) {
          const numTabId = parseInt(tabId);
          finalizeOpenTime(numTabId);
          // Restart open tracking if tab is still open (and not the active tab)
          if (activeTabs.has(numTabId) && numTabId !== currentActiveTabId) {
            openTabsStartTime[numTabId] = now;
          }
        }

        // Flush to storage
        await flushTimeData();

        sendResponse({ success: true });
      } catch (e) {
        console.warn('Failed to save time data:', e);
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Keep channel open for async response
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
