/**
 * Storage service with debounced writes
 * Provides efficient Chrome storage operations with batching
 */

type StorageData = Record<string, unknown>;
type WriteCallback = () => void;

export class StorageService {
  private pendingWrites: Map<string, unknown> = new Map();
  private writeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 5000;
  private writeCallbacks: WriteCallback[] = [];

  /**
   * Get data from local storage
   */
  async get<T>(keys: string | string[]): Promise<T> {
    const result = await chrome.storage.local.get(keys);
    return result as T;
  }

  /**
   * Set data in local storage (debounced)
   */
  set(key: string, value: unknown): void {
    this.pendingWrites.set(key, value);
    this.scheduleWrite();
  }

  /**
   * Set multiple items (debounced)
   */
  setMultiple(items: StorageData): void {
    for (const [key, value] of Object.entries(items)) {
      this.pendingWrites.set(key, value);
    }
    this.scheduleWrite();
  }

  /**
   * Set data immediately (bypasses debounce)
   */
  async setImmediate(key: string, value: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  /**
   * Remove data from storage
   */
  async remove(keys: string | string[]): Promise<void> {
    await chrome.storage.local.remove(keys);
  }

  /**
   * Schedule a debounced write
   */
  private scheduleWrite(): void {
    if (this.writeTimeout) {
      return; // Already scheduled
    }

    this.writeTimeout = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /**
   * Flush all pending writes immediately
   */
  async flush(): Promise<void> {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }

    if (this.pendingWrites.size === 0) {
      return;
    }

    const items: StorageData = {};
    for (const [key, value] of this.pendingWrites) {
      items[key] = value;
    }
    this.pendingWrites.clear();

    await chrome.storage.local.set(items);

    // Notify callbacks
    for (const callback of this.writeCallbacks) {
      callback();
    }
  }

  /**
   * Register a callback for when writes complete
   */
  onWrite(callback: WriteCallback): () => void {
    this.writeCallbacks.push(callback);
    return () => {
      const index = this.writeCallbacks.indexOf(callback);
      if (index > -1) {
        this.writeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Check if there are pending writes
   */
  hasPendingWrites(): boolean {
    return this.pendingWrites.size > 0;
  }
}
