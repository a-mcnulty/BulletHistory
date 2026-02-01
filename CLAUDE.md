# BulletHistory — File Guide

## Architecture

The main panel UI is a single `BulletHistory` class defined in `panel.js`. Methods are split across 6 files using `BulletHistory.prototype` assignment. All files are loaded via `<script>` tags in `panel.html` — no build system.

## File Map

### panel.js — Core class (~1,400 lines)
Class definition, constructor, `init()`, and foundational methods.
- **Data loading:** `fetchHistory`, `generateFakeHistory`, `parseHistory`
- **Date/hour generation:** `generateDates`, `generateHours`
- **Colors:** `generatePastelColor`, `loadColors`, `saveColors`, `loadFaviconCache`
- **Sorting/filtering:** `getSortedDomains`, `sortDomainsForHourView`, `filterDomainsToExpandedView`, `restoreAllDomains`
- **Format helpers:** `formatDate`, `formatDateHeader`, `formatDuration`, `formatHourLabel`, `getViewName`
- **UI setup:** `setupSortDropdown`, `setupSearchInput`, `setupBottomMenu`, `setActiveMenuButton`, `setupZoomControls`, `setupResizeHandle`, `setupDateChangeDetection`, `setupExpandedViewZoomHandler`
- **Navigation:** `refreshGrid`, `setupLiveUpdates`, `handleNewVisit`, `scrollToToday`, `scrollToCurrentHour`, `scrollToDateInHourView`
- **View switching:** `setupViewToggle`, `switchView`, `switchToHourViewForDate`, `organizeHistoryByHour`
- **Bootstrap:** `DOMContentLoaded` listener at end of file
- **Performance caches (constructor):**
  - `faviconsByDomain` — Map for O(1) favicon lookup by domain
  - `hoveredElements` — Set tracking elements with hover classes (avoids querySelectorAll on clear)
  - `columnCells` — Map<colIndex, Set<element>> for fast column highlighting
  - `maxCountCache` — Map<domain, maxCount> pre-computed per render
  - `calendarScrollHandlers` — Array of {element, handler} for cleanup

### panel-grid.js — Cell grid rendering & virtualization (~1,240 lines)
Everything related to the contribution-graph-style grid.
- **Headers:** `renderDateHeader`, `renderHourHeader`
- **Colors:** `getGitHubStyleColor`
- **Virtual grid:** `setupVirtualGrid`, `updateVirtualGrid`, `renderVirtualRows`
- **Interaction:** `setupScrollSync`, `setupTooltips`, `setupRowHover`, `setupColumnHeaderHover`, `setupCellClick`

### panel-expanded.js — Expanded/detail views (~2,700 lines)
The largest file. Handles the bottom panel that shows URL lists when you click a cell, domain, day, or hour.
- **View openers:** `showFullHistory`, `showDomainView`, `showExpandedView`, `showDayExpandedView`, `showDomainHourView`, `showHourExpandedView`
- **URL list rendering:** `renderUrlList`, `renderVisibleUrlItems`, `buildVirtualRows`, `populateUrlItem`, `createUrlItem`
- **URL preview:** `attachUrlPreview`, `showUrlPreview`, `positionUrlPreview`, `fetchOpenGraphData`, `getMetaContent`
- **Expanded view UI:** `closeExpandedView`, `showExpandedViewAnimated`, `updateExpandedViewPadding`, `updateVirtualScrollHeight`
- **Navigation:** `navigateDay`, `navigateDomainHour`, `updateNavButtons`
- **Delete:** `deleteUrlWithAnimation`, `deleteUrl`, `deleteDomainWithAnimation`, `deleteDomainData`, `deleteDomain`
- **Bookmarks:** `checkBookmarkStatus`, `toggleBookmark`, `setupBookmarkDrag`, `setupFolderDropTarget`, `setupUrlItemDropTarget`, `findFolderHeader`, `setupUrlListDropTarget`

### panel-time.js — URL time tracking data (~300 lines)
Reads time-tracking data from storage (written by background.js) and provides it to the grid and expanded views.
- **Hash/cache:** `hashUrl`, `getCachedUrlTimeData`
- **Loading:** `loadUrlTimeData`, `loadUrlTimeDataForCells`, `refreshUrlTimeCache`, `loadOpenTabsData`
- **Queries:** `getUrlsFromTimeData`, `getUniqueUrlCountForCell`
- **Formatting:** `formatTimeTracking`

### panel-tabs.js — Active tabs, closed tabs, bookmarks, recent views (~540 lines)
Bottom menu views that show lists of tabs/bookmarks (not the grid).
- `showRecentHistory`, `showBookmarks`, `showRecentlyClosed`, `showActiveTabs`
- `createClosedTabItem`

### panel-calendar.js — Calendar integration UI (~750 lines)
Google Calendar integration for showing events in the grid header and expanded views.
- **Setup:** `initializeCalendar`, `setupCalendarUI`, `openCalendarSettings`, `updateCalendarAuthUI`
- **Rendering:** `renderCalendarList`, `renderCalendarEventsForDate`, `renderCalendarEventsForHour`, `createCalendarEventItem`, `formatTimeRange`
- **Grid header dots:** `renderCalendarEventColumn`, `renderCalendarEventColumnForHour`, `renderCalendarEventDots`
- **Refresh:** `refreshCalendarUI`

### Other key files
- **panel.html** — Main UI markup + script load order
- **panel.css** — All styles
- **calendar.js** — `GoogleCalendar` class (API client, auth, event fetching) — loaded before panel.js
- **background.js** — Service worker: time tracking, tab monitoring, favicon caching, closed tab tracking
  - Uses in-memory caching with debounced writes:
    - `openTabsInMemory` — tab data cached in memory, written every 5s via `scheduleOpenTabsWrite()`
    - `pendingTimeUpdates` — time deltas accumulated in memory, flushed via `flushTimeData()`
  - Time tracking functions (`addTimeToUrl`, `finalizeActiveTabTime`, `finalizeOpenTime`) are **synchronous** — they accumulate in memory, storage writes happen on alarm or explicit flush

### utils/date-utils.js — Date/time utilities (~160 lines)
Shared date formatting and manipulation functions exposed via `window.DateUtils`.
- `formatDateISO(date)` — Format Date to 'YYYY-MM-DD'
- `getTodayISO()` — Get today as 'YYYY-MM-DD'
- `formatHourISO(date)` — Format Date to 'YYYY-MM-DDTHH'
- `getCurrentHourISO()` — Get current hour as 'YYYY-MM-DDTHH'
- `parseHourString(hourStr)` — Parse 'YYYY-MM-DDTHH' to {dateStr, hour}
- `formatDateForDisplay(dateStr)` — Format for UI ('Today', 'Yesterday', or full date)
- `formatHourLabel(hour)` — Format hour as '12a', '1p', etc.
- `formatDuration(durationMs)` — Format milliseconds to '5m', '2h', etc.
- `formatSecondsDisplay(seconds)` — Format seconds to '5m', '2h 30m', etc.
- `formatTimestamp12Hour(timestamp)` — Format to '6:49pm'
- `getOrdinalSuffix(day)` — Get 'st', 'nd', 'rd', 'th'
- `getTodayStartMs()` — Get midnight timestamp

### utils/url-utils.js — URL/domain utilities (~130 lines)
Shared URL manipulation functions exposed via `window.UrlUtils`.
- `extractDomain(url, {stripWww})` — Extract domain from URL
- `isValidUrl(url)` — Check if string is valid URL
- `getHostname(url)` — Get hostname preserving www
- `getOrigin(url)` — Get protocol + hostname
- `hasValidProtocol(url)` — Check for http/https
- `getFaviconFallbackUrls(url)` — Generate favicon fallback chain
- `getGoogleFaviconUrl(domain, size)` — Get Google favicon service URL
- `isValidFaviconUrl(faviconUrl)` — Check if favicon URL is usable
- `hashUrl(url)` — djb2 hash for storage keys

## Script load order (panel.html)
```
utils/date-utils.js → utils/url-utils.js → calendar.js → panel.js → panel-time.js → panel-grid.js → panel-expanded.js → panel-tabs.js → panel-calendar.js
```
Utility files load first (expose globals). `panel.js` must load before satellite files (defines the class). Satellite files add to `BulletHistory.prototype`. The `DOMContentLoaded` handler at the end of `panel.js` fires after all scripts load.

## Common tasks

| Task | Primary file(s) |
|------|-----------------|
| Fix grid rendering or cell colors | `panel-grid.js` |
| Fix expanded view / URL list | `panel-expanded.js` |
| Fix time tracking display | `panel-time.js` |
| Fix active tabs / bookmarks / closed tabs views | `panel-tabs.js` |
| Fix calendar events | `panel-calendar.js`, `calendar.js` |
| Fix sorting, filtering, or search | `panel.js` |
| Fix view switching (day/hour) | `panel.js` (`switchView`, `organizeHistoryByHour`) |
| Fix live updates from new visits | `panel.js` (`handleNewVisit`) |
| Fix data loading or parsing | `panel.js` (`fetchHistory`, `parseHistory`) |
| Add a new bottom menu view | `panel-tabs.js` + `panel.js` (`setupBottomMenu`) |
| Fix background time tracking | `background.js` |
| Fix favicon caching | `background.js` + `panel.js` (`loadFaviconCache`) |
| Fix hover/scroll performance | `panel-grid.js` (use `hoveredElements` Set, `columnCells` Map) |
| Fix sort performance | `panel.js` (pre-compute keys before sort, don't compute in comparator) |

## Performance Patterns

**IMPORTANT:** These patterns exist for performance reasons. Don't remove them without understanding the impact.

### Grid rendering
- **Pre-computed maxCount:** `renderVirtualRows()` computes `maxCountCache` once before the row loop, not per-row
- **Column cell tracking:** Cells are added to `columnCells` Map during render for O(1) column highlighting
- **Hover tracking:** Elements with hover classes are tracked in `hoveredElements` Set — `clearAllHoverStates()` only clears tracked elements instead of `querySelectorAll`

### Sorting
- **Pre-compute sort keys:** `getSortedDomains()` and `sortDomainsForHourView()` build a Map of sort keys BEFORE calling `.sort()`, then the comparator does O(1) Map lookups. Never call `Object.keys()` or iterate data inside a sort comparator.

### Background script I/O
- **Debounced tab writes:** `openTabsInMemory` is modified immediately, written to storage every 5s (or on tab close)
- **Batched time data:** `addTimeToUrl()` accumulates in `pendingTimeUpdates`, `flushTimeData()` does a single read-modify-write
- **Synchronous accumulation:** Time tracking functions don't await — they're called frequently and must not block

### Expanded views
- **Virtual scrolling:** All expanded views (`showDayExpandedView`, `showHourExpandedView`, `showDomainHourView`) use `renderUrlList()` with `IntersectionObserver` — never `appendChild` in a loop
- **Lazy API calls:** `createUrlItem()` loads visit times on hover (via `mouseenter` listener), not on create

### Favicon lookup
- **Indexed by domain:** `loadFaviconCache()` builds `faviconsByDomain` Map for O(1) lookup in `renderVirtualRows()`

### Calendar events
- **Handler cleanup:** `calendarScrollHandlers` array tracks scroll listeners added in `renderCalendarEventDots()` — cleaned up in `renderDateHeader()` before re-render

## Data Structure Conventions

**Use Map for:** Caches, indexes, frequently accessed lookups (e.g., `faviconsByDomain`, `columnCells`, `maxCountCache`)

**Use Object for:** Serializable data from storage, configuration (e.g., `historyData`, `hourlyData`, `urlTimeData`)

Rationale: Maps are faster for frequent add/delete/lookup operations. Objects serialize naturally with `JSON.stringify` for Chrome storage.
