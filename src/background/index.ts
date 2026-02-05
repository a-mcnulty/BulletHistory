/**
 * Background service worker entry point
 * Handles tab tracking, time tracking, favicon caching, and calendar sync
 */

import { TabManager } from './services/tab-manager';
import { TimeTracker } from './services/time-tracking';
import { FaviconCache } from './services/favicon-cache';
import { StorageService } from './services/storage';
import { CalendarSync } from './services/calendar-sync';

// Initialize services
const storage = new StorageService();
const faviconCache = new FaviconCache(storage);
const timeTracker = new TimeTracker(storage);
const tabManager = new TabManager(timeTracker, faviconCache);
const calendarSync = new CalendarSync();

// Set up Chrome action click handler
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Set up alarm for periodic time data flush
chrome.alarms.create('flushTimeData', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flushTimeData') {
    timeTracker.flush();
  }
});

// Handle messages from panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_TIME_DATA':
      timeTracker.getTimeData().then(sendResponse);
      return true;

    case 'GET_OPEN_TABS':
      tabManager.getOpenTabsData().then(sendResponse);
      return true;

    case 'GET_FAVICON_CACHE':
      faviconCache.getCache().then(sendResponse);
      return true;

    // Calendar operations
    case 'CALENDAR_CHECK_AUTH':
      calendarSync.checkAuth().then(sendResponse);
      return true;

    case 'CALENDAR_AUTHENTICATE':
      calendarSync.authenticate().then(sendResponse);
      return true;

    case 'CALENDAR_SIGN_OUT':
      calendarSync.signOut().then(() => sendResponse({ success: true }));
      return true;

    case 'CALENDAR_GET_LIST':
      calendarSync.getCalendarList().then(sendResponse);
      return true;

    case 'CALENDAR_GET_EVENTS':
      calendarSync.getEvents(message.startDate, message.endDate).then(sendResponse);
      return true;

    case 'CALENDAR_GET_SETTINGS':
      calendarSync.getSettings().then(sendResponse);
      return true;

    case 'CALENDAR_SAVE_SETTINGS':
      calendarSync.saveSettings(message.settings).then(() => sendResponse({ success: true }));
      return true;

    default:
      return false;
  }
});

// Listen for new history visits and notify panel
chrome.history.onVisited.addListener(() => {
  // Notify all tabs/panels that history was updated
  chrome.runtime.sendMessage({ type: 'HISTORY_UPDATED' }).catch(() => {
    // Ignore errors if no listeners (panel not open)
  });
});

// Log initialization
console.log('Bullet History background service worker initialized');

// Export for testing
export { storage, faviconCache, timeTracker, tabManager };
