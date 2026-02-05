# Shared Code

## Overview

Contains code shared between background and panel:
- TypeScript type definitions
- Utility functions

## Types (`types/`)

### history.ts
Core data structures for browsing history:
- `UrlData` — Individual URL visit
- `DomainData` — Domain with days of visits
- `HistoryData` — Complete history (domain → data)
- `HourlyHistoryData` — Hour-organized history
- `TimeDataStore` — URL time tracking data

### calendar.ts
Google Calendar types:
- `CalendarEvent` — Raw API event
- `CalendarListEntry` — Calendar metadata
- `CalendarAuthState` — Auth status
- `DisplayCalendarEvent` — Processed for display

### index.ts
Re-exports all types plus:
- `TabData` — Open tab information
- `ClosedTabData` — Recently closed tab
- `BookmarkData` — Bookmark tree node
- `RuntimeMessage` — Background ↔ panel messaging

## Utilities (`utils/`)

### date-utils.ts
Date formatting and manipulation:

| Function | Description | Example Output |
|----------|-------------|----------------|
| `formatDateISO(date)` | Date → YYYY-MM-DD | `2025-01-15` |
| `getTodayISO()` | Today as YYYY-MM-DD | `2025-01-15` |
| `formatHourISO(date)` | Date → YYYY-MM-DDTHH | `2025-01-15T14` |
| `parseHourString(str)` | Parse hour string | `{dateStr, hour}` |
| `formatDateForDisplay(str)` | Human readable | `Today`, `Yesterday`, `Monday, Jan 15, 2025` |
| `formatHourLabel(hour)` | 12-hour label | `12a`, `1p`, `11p` |
| `formatDuration(ms)` | Short duration | `5m`, `2h`, `3d` |
| `formatSecondsDisplay(s)` | Detailed duration | `2h 30m` |
| `formatTimestamp12Hour(ts)` | Time of day | `6:49pm` |
| `getOrdinalSuffix(day)` | Day suffix | `st`, `nd`, `rd`, `th` |
| `getTodayStartMs()` | Midnight timestamp | `1705305600000` |

### url-utils.ts
URL parsing and manipulation:

| Function | Description |
|----------|-------------|
| `extractDomain(url, options)` | Get domain, optionally strip www |
| `isValidUrl(url)` | Check if valid URL |
| `getHostname(url)` | Get hostname (preserves www) |
| `getOrigin(url)` | Get protocol + hostname |
| `hasValidProtocol(url)` | Check for http/https |
| `getFaviconFallbackUrls(url)` | Favicon URL fallback chain |
| `getGoogleFaviconUrl(domain, size)` | Google favicon service URL |
| `isValidFaviconUrl(url)` | Check if usable favicon |
| `hashUrl(url)` | djb2 hash to 8-char hex |

## Usage

Import from package paths:
```typescript
import { formatDateISO, extractDomain } from '@shared/utils';
import type { HistoryData, TabData } from '@shared/types';
```

Or specific files:
```typescript
import { formatDuration } from '@shared/utils/date-utils';
```
