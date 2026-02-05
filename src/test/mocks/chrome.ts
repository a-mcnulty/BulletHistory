/**
 * Chrome API mock for testing
 * Provides mocked versions of Chrome extension APIs
 */

type StorageData = Record<string, unknown>;

// In-memory storage for testing
const localStorageData: StorageData = {};
const syncStorageData: StorageData = {};

export const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: jest.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    lastError: null as chrome.runtime.LastError | null,
  },

  storage: {
    local: {
      get: jest.fn((keys: string | string[] | null) => {
        return new Promise<StorageData>((resolve) => {
          if (keys === null) {
            resolve({ ...localStorageData });
          } else if (typeof keys === 'string') {
            resolve({ [keys]: localStorageData[keys] });
          } else {
            const result: StorageData = {};
            for (const key of keys) {
              if (key in localStorageData) {
                result[key] = localStorageData[key];
              }
            }
            resolve(result);
          }
        });
      }),
      set: jest.fn((items: StorageData) => {
        return new Promise<void>((resolve) => {
          Object.assign(localStorageData, items);
          resolve();
        });
      }),
      remove: jest.fn((keys: string | string[]) => {
        return new Promise<void>((resolve) => {
          const keysArray = typeof keys === 'string' ? [keys] : keys;
          for (const key of keysArray) {
            delete localStorageData[key];
          }
          resolve();
        });
      }),
      clear: jest.fn(() => {
        return new Promise<void>((resolve) => {
          for (const key of Object.keys(localStorageData)) {
            delete localStorageData[key];
          }
          resolve();
        });
      }),
    },
    sync: {
      get: jest.fn((keys: string | string[] | null) => {
        return new Promise<StorageData>((resolve) => {
          if (keys === null) {
            resolve({ ...syncStorageData });
          } else if (typeof keys === 'string') {
            resolve({ [keys]: syncStorageData[keys] });
          } else {
            const result: StorageData = {};
            for (const key of keys) {
              if (key in syncStorageData) {
                result[key] = syncStorageData[key];
              }
            }
            resolve(result);
          }
        });
      }),
      set: jest.fn((items: StorageData) => {
        return new Promise<void>((resolve) => {
          Object.assign(syncStorageData, items);
          resolve();
        });
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  history: {
    search: jest.fn().mockResolvedValue([]),
    getVisits: jest.fn().mockResolvedValue([]),
    deleteUrl: jest.fn().mockResolvedValue(undefined),
    deleteRange: jest.fn().mockResolvedValue(undefined),
    onVisited: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  tabs: {
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  bookmarks: {
    getTree: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: '1' }),
    remove: jest.fn().mockResolvedValue(undefined),
    move: jest.fn().mockResolvedValue({}),
    getSubTree: jest.fn().mockResolvedValue([]),
  },

  sessions: {
    getRecentlyClosed: jest.fn().mockResolvedValue([]),
    restore: jest.fn().mockResolvedValue({}),
  },

  identity: {
    getAuthToken: jest.fn().mockResolvedValue('mock-auth-token'),
    removeCachedAuthToken: jest.fn().mockResolvedValue(undefined),
    launchWebAuthFlow: jest.fn().mockResolvedValue('https://example.com/callback'),
  },

  alarms: {
    create: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(true),
    clearAll: jest.fn().mockResolvedValue(true),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },

  sidePanel: {
    open: jest.fn().mockResolvedValue(undefined),
    setOptions: jest.fn().mockResolvedValue(undefined),
  },

  action: {
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// Helper to reset storage between tests
export function resetMockStorage() {
  for (const key of Object.keys(localStorageData)) {
    delete localStorageData[key];
  }
  for (const key of Object.keys(syncStorageData)) {
    delete syncStorageData[key];
  }
}

// Helper to seed storage with test data
export function seedMockStorage(data: StorageData, type: 'local' | 'sync' = 'local') {
  const storage = type === 'local' ? localStorageData : syncStorageData;
  Object.assign(storage, data);
}
