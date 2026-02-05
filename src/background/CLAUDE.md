# Background Service Worker

## Overview

The background service worker runs persistently and handles:
- Tab event tracking
- URL time tracking (active time, open time)
- Favicon caching
- Calendar sync

## Entry Point

`index.ts` initializes all services and sets up message handlers.

## Services

### StorageService (`services/storage.ts`)
Wraps Chrome storage with debounced writes.

- **Debounce:** 5 seconds (configurable)
- **Use `set()`:** For non-urgent writes (batched)
- **Use `setImmediate()`:** For critical writes (bypasses debounce)

```typescript
storage.set('key', value);           // Debounced
await storage.setImmediate('key', value);  // Immediate
await storage.flush();               // Force write all pending
```

### TimeTracker (`services/time-tracking.ts`)
Tracks time spent on URLs.

**Data tracked per URL:**
- `activeTime`: Seconds the URL was the active tab
- `openTime`: Seconds the URL was open but not active
- `lastUpdated`: Timestamp of last update

**Key patterns:**
- Time is accumulated in memory (`pendingUpdates` Map)
- Flushed to storage via alarm (every minute)
- Sleep detection: Skips updates if > 90 seconds elapsed

### TabManager (`services/tab-manager.ts`)
Tracks open tabs and provides data to the panel.

- Maintains `openTabsInMemory` Map
- Updates favicon cache on tab changes
- Provides `getOpenTabsData()` for panel requests

### FaviconCache (`services/favicon-cache.ts`)
Caches favicons by domain for 7 days.

- In-memory Map for fast lookups
- Persisted to storage on changes
- Filters out `chrome://` URLs

### CalendarSync (`services/calendar-sync.ts`)
Handles Google Calendar OAuth and API calls.

- Uses `chrome.identity.getAuthToken`
- Caches events with timestamps
- Respects user calendar settings

## Message Handlers

The background handles these message types from the panel:

| Type | Response |
|------|----------|
| `GET_TIME_DATA` | TimeDataStore object |
| `GET_OPEN_TABS` | { tabs: TabData[], lastUpdated } |
| `GET_FAVICON_CACHE` | FaviconCache object |

## Performance Notes

1. **All time tracking is synchronous** — `addTime()` writes to memory only
2. **Storage writes are batched** — multiple updates become one write
3. **Alarms for timing** — more reliable than setInterval in service workers
