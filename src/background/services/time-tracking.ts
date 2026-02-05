/**
 * Time tracking service
 * Tracks active and open time for URLs
 */

import { StorageService } from './storage';
import type { TimeDataStore, UrlTimeData } from '@shared/types';
import { hashUrl } from '@shared/utils/url-utils';

interface PendingTimeUpdate {
  activeTime: number;
  openTime: number;
}

const TIME_DATA_KEY = 'urlTimeData';

export class TimeTracker {
  private storage: StorageService;
  private pendingUpdates: Map<string, PendingTimeUpdate> = new Map();
  private lastTickTime: number = Date.now();
  private activeTabUrl: string | null = null;
  private openTabs: Map<number, string> = new Map(); // tabId -> url

  constructor(storage: StorageService) {
    this.storage = storage;
    this.setupTabListeners();
    this.startTicking();
  }

  /**
   * Set up Chrome tab event listeners
   */
  private setupTabListeners(): void {
    // Track tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      this.onTabActivated(tab);
    });

    // Track tab updates (URL changes)
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        this.onTabActivated(tab);
      }
    });

    // Track tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      const url = this.openTabs.get(tabId);
      if (url) {
        this.finalizeOpenTime(url);
        this.openTabs.delete(tabId);
      }
    });

    // Initialize with current tabs
    this.initializeOpenTabs();
  }

  /**
   * Initialize tracking for currently open tabs
   */
  private async initializeOpenTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && this.isTrackableUrl(tab.url)) {
        this.openTabs.set(tab.id, tab.url);
      }
      if (tab.active && tab.url) {
        this.activeTabUrl = tab.url;
      }
    }
  }

  /**
   * Handle tab activation
   */
  private onTabActivated(tab: chrome.tabs.Tab): void {
    // Finalize time for previous active tab
    if (this.activeTabUrl) {
      this.finalizeActiveTime(this.activeTabUrl);
    }

    // Set new active tab
    if (tab.url && this.isTrackableUrl(tab.url)) {
      this.activeTabUrl = tab.url;
      if (tab.id) {
        this.openTabs.set(tab.id, tab.url);
      }
    } else {
      this.activeTabUrl = null;
    }

    this.lastTickTime = Date.now();
  }

  /**
   * Check if URL should be tracked
   */
  private isTrackableUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Start the time tracking tick
   */
  private startTicking(): void {
    // Use Chrome alarms for accurate timing in service worker
    chrome.alarms.create('timeTick', { periodInMinutes: 1 / 60 }); // Every second

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'timeTick') {
        this.tick();
      }
    });
  }

  /**
   * Process a tick - accumulate time for active and open tabs
   */
  private tick(): void {
    const now = Date.now();
    const elapsed = Math.floor((now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    // Skip if too much time has passed (computer was asleep)
    if (elapsed > 90) {
      return;
    }

    // Add active time
    if (this.activeTabUrl) {
      this.addTime(this.activeTabUrl, elapsed, 0);
    }

    // Add open time for all open tabs
    for (const url of this.openTabs.values()) {
      if (url !== this.activeTabUrl) {
        this.addTime(url, 0, elapsed);
      }
    }
  }

  /**
   * Add time to a URL (accumulates in memory)
   */
  private addTime(url: string, activeSeconds: number, openSeconds: number): void {
    const hash = hashUrl(url);
    const existing = this.pendingUpdates.get(hash) || { activeTime: 0, openTime: 0 };
    this.pendingUpdates.set(hash, {
      activeTime: existing.activeTime + activeSeconds,
      openTime: existing.openTime + openSeconds,
    });
  }

  /**
   * Finalize active time for a URL
   */
  private finalizeActiveTime(url: string): void {
    const now = Date.now();
    const elapsed = Math.floor((now - this.lastTickTime) / 1000);
    if (elapsed > 0 && elapsed < 90) {
      this.addTime(url, elapsed, 0);
    }
  }

  /**
   * Finalize open time for a URL (tab closed)
   */
  private finalizeOpenTime(url: string): void {
    const now = Date.now();
    const elapsed = Math.floor((now - this.lastTickTime) / 1000);
    if (elapsed > 0 && elapsed < 90) {
      this.addTime(url, 0, elapsed);
    }
  }

  /**
   * Flush pending updates to storage
   */
  async flush(): Promise<void> {
    if (this.pendingUpdates.size === 0) {
      return;
    }

    // Get existing time data
    const result = await this.storage.get<{ [TIME_DATA_KEY]: TimeDataStore }>([TIME_DATA_KEY]);
    const timeData: TimeDataStore = result[TIME_DATA_KEY] || {};

    // Merge pending updates
    const now = Date.now();
    for (const [hash, update] of this.pendingUpdates) {
      const existing: UrlTimeData = timeData[hash] || {
        activeTime: 0,
        openTime: 0,
        lastUpdated: now,
      };
      timeData[hash] = {
        activeTime: existing.activeTime + update.activeTime,
        openTime: existing.openTime + update.openTime,
        lastUpdated: now,
      };
    }

    // Write and clear
    await this.storage.setImmediate(TIME_DATA_KEY, timeData);
    this.pendingUpdates.clear();
  }

  /**
   * Get all time data
   */
  async getTimeData(): Promise<TimeDataStore> {
    const result = await this.storage.get<{ [TIME_DATA_KEY]: TimeDataStore }>([TIME_DATA_KEY]);
    return result[TIME_DATA_KEY] || {};
  }
}
