/**
 * Favicon cache service
 * Caches favicons for domains to avoid repeated lookups
 */

import { StorageService } from './storage';
import type { FaviconCache as FaviconCacheType, FaviconCacheEntry } from '@shared/types';
import { extractDomain } from '@shared/utils/url-utils';

const FAVICON_CACHE_KEY = 'faviconCache';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class FaviconCache {
  private storage: StorageService;
  private cache: Map<string, FaviconCacheEntry> = new Map();
  private initialized = false;

  constructor(storage: StorageService) {
    this.storage = storage;
    this.initialize();
  }

  /**
   * Load cache from storage
   */
  private async initialize(): Promise<void> {
    try {
      const result = await this.storage.get<{ [FAVICON_CACHE_KEY]: FaviconCacheType }>([
        FAVICON_CACHE_KEY,
      ]);
      const stored = result[FAVICON_CACHE_KEY];

      if (stored) {
        const now = Date.now();
        // Filter out expired entries
        for (const [domain, entry] of Object.entries(stored)) {
          if (now - entry.timestamp < CACHE_DURATION_MS) {
            this.cache.set(domain, entry);
          }
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize favicon cache:', error);
      this.initialized = true;
    }
  }

  /**
   * Wait for initialization to complete
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    // Simple polling wait
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (this.initialized) return;
    }
  }

  /**
   * Cache favicon from a tab
   */
  async cacheFromTab(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url || !tab.favIconUrl) return;

    const domain = extractDomain(tab.url);
    if (!domain) return;

    // Skip chrome:// favicons
    if (tab.favIconUrl.startsWith('chrome://')) return;

    await this.set(domain, tab.favIconUrl);
  }

  /**
   * Set a favicon URL for a domain
   */
  async set(domain: string, faviconUrl: string): Promise<void> {
    await this.ensureInitialized();

    const entry: FaviconCacheEntry = {
      url: faviconUrl,
      timestamp: Date.now(),
    };

    this.cache.set(domain, entry);
    this.persistCache();
  }

  /**
   * Get favicon URL for a domain
   */
  async get(domain: string): Promise<string | null> {
    await this.ensureInitialized();

    const entry = this.cache.get(domain);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_DURATION_MS) {
      this.cache.delete(domain);
      return null;
    }

    return entry.url;
  }

  /**
   * Get the entire cache
   */
  async getCache(): Promise<FaviconCacheType> {
    await this.ensureInitialized();

    const result: FaviconCacheType = {};
    for (const [domain, entry] of this.cache) {
      result[domain] = entry;
    }
    return result;
  }

  /**
   * Persist cache to storage
   */
  private persistCache(): void {
    const data: FaviconCacheType = {};
    for (const [domain, entry] of this.cache) {
      data[domain] = entry;
    }
    this.storage.set(FAVICON_CACHE_KEY, data);
  }

  /**
   * Clear expired entries
   */
  async cleanup(): Promise<void> {
    await this.ensureInitialized();

    const now = Date.now();
    for (const [domain, entry] of this.cache) {
      if (now - entry.timestamp > CACHE_DURATION_MS) {
        this.cache.delete(domain);
      }
    }
    this.persistCache();
  }
}
