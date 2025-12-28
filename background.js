// Background service worker - handles extension icon clicks

// Enable native toggle behavior for the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Track recently closed tabs
const MAX_CLOSED_TABS = 50;
const activeTabs = new Map();

// Track when tabs are created
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    activeTabs.set(tab.id, {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl
    });
  }
});

// Track when tabs are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Store tab info whenever it updates
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    activeTabs.set(tabId, {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
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

  // Clean up the active tabs map
  activeTabs.delete(tabId);
});

// Initialize: Load existing tabs into the map
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && tab.url !== 'about:blank') {
      activeTabs.set(tab.id, {
        url: tab.url,
        title: tab.title || tab.url,
        favIconUrl: tab.favIconUrl
      });
    }
  });
});

// ===== CALENDAR SYNC =====

// Calendar sync alarm name
const CALENDAR_SYNC_ALARM = 'calendarSync';

// Create alarm for periodic calendar sync (every 15 minutes)
chrome.alarms.create(CALENDAR_SYNC_ALARM, {
  periodInMinutes: 15
});

// Handle alarm - sync calendar events
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CALENDAR_SYNC_ALARM) {
    await syncCalendarEvents();
  }
});

/**
 * Sync calendar events for the current date range
 */
async function syncCalendarEvents() {
  try {
    // Check if user is authenticated
    const result = await chrome.storage.local.get(['calendarAuth']);
    const authState = result.calendarAuth;

    if (!authState || !authState.enabled) {
      console.log('Calendar sync skipped: not authenticated');
      return;
    }

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

      // Get start date
      let startDateStr;
      if (isAllDay) {
        startDateStr = event.start.date;
      } else {
        startDateStr = new Date(event.start.dateTime).toISOString().split('T')[0];
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
  } catch (error) {
    console.error('Calendar sync failed:', error);
  }
}
