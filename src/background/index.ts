/**
 * Background service worker entry point
 * Handles tab tracking, time tracking, favicon caching, and calendar sync
 */

import { TabManager } from './services/tab-manager';
import { TimeTracker } from './services/time-tracking';
import { FaviconCache } from './services/favicon-cache';
import { StorageService } from './services/storage';

// Initialize services
const storage = new StorageService();
const faviconCache = new FaviconCache(storage);
const timeTracker = new TimeTracker(storage);
const tabManager = new TabManager(timeTracker, faviconCache);

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

    default:
      return false;
  }
});

// Log initialization
console.log('Bullet History background service worker initialized');

// Export for testing
export { storage, faviconCache, timeTracker, tabManager };
