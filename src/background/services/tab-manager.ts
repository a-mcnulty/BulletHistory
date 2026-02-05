/**
 * Tab manager service
 * Handles tab events and provides tab data to the panel
 */

import { TimeTracker } from './time-tracking';
import { FaviconCache } from './favicon-cache';
import type { TabData } from '@shared/types';

interface OpenTabsData {
  tabs: TabData[];
  lastUpdated: number;
}

export class TabManager {
  private _timeTracker: TimeTracker;
  private faviconCache: FaviconCache;
  private openTabsInMemory: Map<number, TabData> = new Map();

  constructor(timeTracker: TimeTracker, faviconCache: FaviconCache) {
    this._timeTracker = timeTracker;
    this.faviconCache = faviconCache;
    this.setupListeners();
    this.initializeTabs();
  }

  /**
   * Set up Chrome tab event listeners
   */
  private setupListeners(): void {
    // Track new tabs
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.id) {
        this.updateTabData(tab);
      }
    });

    // Track tab updates
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (tab.id && (changeInfo.url || changeInfo.title || changeInfo.favIconUrl)) {
        this.updateTabData(tab);
      }
    });

    // Track tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      // Update active state for all tabs in the window
      const tabs = await chrome.tabs.query({ windowId: activeInfo.windowId });
      for (const tab of tabs) {
        if (tab.id) {
          this.updateTabData(tab);
        }
      }
    });

    // Track tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.openTabsInMemory.delete(tabId);
    });
  }

  /**
   * Initialize with all currently open tabs
   */
  private async initializeTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        this.updateTabData(tab);
      }
    }
  }

  /**
   * Update tab data in memory
   */
  private updateTabData(tab: chrome.tabs.Tab): void {
    if (!tab.id || !tab.url) return;

    // Cache favicon
    if (tab.favIconUrl) {
      this.faviconCache.cacheFromTab(tab);
    }

    this.openTabsInMemory.set(tab.id, {
      id: tab.id,
      windowId: tab.windowId ?? 0,
      url: tab.url,
      title: tab.title ?? '',
      favIconUrl: tab.favIconUrl,
      active: tab.active ?? false,
      pinned: tab.pinned ?? false,
      lastAccessed: tab.lastAccessed,
    });
  }

  /**
   * Get all open tabs data
   */
  async getOpenTabsData(): Promise<OpenTabsData> {
    // Refresh from Chrome API to ensure accuracy
    const tabs = await chrome.tabs.query({});
    const tabData: TabData[] = [];

    for (const tab of tabs) {
      if (tab.id && tab.url) {
        tabData.push({
          id: tab.id,
          windowId: tab.windowId ?? 0,
          url: tab.url,
          title: tab.title ?? '',
          favIconUrl: tab.favIconUrl,
          active: tab.active ?? false,
          pinned: tab.pinned ?? false,
          lastAccessed: tab.lastAccessed,
        });
      }
    }

    return {
      tabs: tabData,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get tabs for a specific domain
   */
  async getTabsForDomain(domain: string): Promise<TabData[]> {
    const data = await this.getOpenTabsData();
    return data.tabs.filter((tab) => {
      try {
        const url = new URL(tab.url);
        return url.hostname.replace(/^www\./, '') === domain;
      } catch {
        return false;
      }
    });
  }
}
