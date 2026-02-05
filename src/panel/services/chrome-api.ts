/**
 * Chrome API wrapper for testable history and tab operations
 */

import type { HistoryData, TimeDataStore, FaviconCache, TabData } from '@shared/types';

/**
 * Chrome History API wrapper
 */
export interface ChromeHistoryService {
  search(query: chrome.history.HistoryQuery): Promise<chrome.history.HistoryItem[]>;
  getVisits(details: chrome.history.Url): Promise<chrome.history.VisitItem[]>;
  deleteUrl(details: chrome.history.Url): Promise<void>;
  deleteRange(range: chrome.history.Range): Promise<void>;
}

/**
 * Bookmark creation details
 */
export interface BookmarkCreateDetails {
  parentId?: string;
  index?: number;
  title?: string;
  url?: string;
}

/**
 * Chrome Bookmarks API wrapper
 */
export interface ChromeBookmarksService {
  getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  search(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>;
  create(bookmark: BookmarkCreateDetails): Promise<chrome.bookmarks.BookmarkTreeNode>;
  remove(id: string): Promise<void>;
  move(id: string, destination: { parentId?: string; index?: number }): Promise<chrome.bookmarks.BookmarkTreeNode>;
}

/**
 * Chrome Sessions API wrapper
 */
export interface ChromeSessionsService {
  getRecentlyClosed(filter?: chrome.sessions.Filter): Promise<chrome.sessions.Session[]>;
  restore(sessionId?: string): Promise<chrome.sessions.Session>;
}

/**
 * Background service communication
 */
export interface BackgroundService {
  getTimeData(): Promise<TimeDataStore>;
  getOpenTabs(): Promise<{ tabs: TabData[]; lastUpdated: number }>;
  getFaviconCache(): Promise<FaviconCache>;
}

/**
 * Real implementation using Chrome APIs
 */
export const chromeHistoryService: ChromeHistoryService = {
  search: (query) => chrome.history.search(query),
  getVisits: (details) => chrome.history.getVisits(details),
  deleteUrl: (details) => chrome.history.deleteUrl(details),
  deleteRange: (range) => chrome.history.deleteRange(range),
};

export const chromeBookmarksService: ChromeBookmarksService = {
  getTree: () => chrome.bookmarks.getTree(),
  search: (query) => chrome.bookmarks.search(query),
  create: (bookmark) => chrome.bookmarks.create(bookmark),
  remove: (id) => chrome.bookmarks.remove(id),
  move: (id, destination) => chrome.bookmarks.move(id, destination),
};

export const chromeSessionsService: ChromeSessionsService = {
  getRecentlyClosed: (filter) => chrome.sessions.getRecentlyClosed(filter),
  restore: (sessionId) => chrome.sessions.restore(sessionId),
};

export const backgroundService: BackgroundService = {
  getTimeData: () =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TIME_DATA' }, resolve);
    }),
  getOpenTabs: () =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_OPEN_TABS' }, resolve);
    }),
  getFaviconCache: () =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_FAVICON_CACHE' }, resolve);
    }),
};

/**
 * Parse Chrome history items into domain-based structure
 */
export async function parseHistoryItems(
  items: chrome.history.HistoryItem[]
): Promise<HistoryData> {
  const historyData: HistoryData = {};

  for (const item of items) {
    if (!item.url || !item.lastVisitTime) continue;

    try {
      const url = new URL(item.url);
      const domain = url.hostname.replace(/^www\./, '');
      const dateStr = new Date(item.lastVisitTime).toISOString().split('T')[0];

      if (!historyData[domain]) {
        historyData[domain] = {
          lastVisit: item.lastVisitTime,
          days: {},
        };
      }

      if (!historyData[domain].days[dateStr]) {
        historyData[domain].days[dateStr] = {
          count: 0,
          urls: [],
        };
      }

      historyData[domain].days[dateStr].count++;
      historyData[domain].days[dateStr].urls.push({
        url: item.url,
        title: item.title || url.pathname,
        lastVisit: item.lastVisitTime,
        visitCount: item.visitCount || 1,
      });

      if (item.lastVisitTime > historyData[domain].lastVisit) {
        historyData[domain].lastVisit = item.lastVisitTime;
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return historyData;
}
