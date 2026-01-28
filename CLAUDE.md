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

## Script load order (panel.html)
```
calendar.js → panel.js → panel-time.js → panel-grid.js → panel-expanded.js → panel-tabs.js → panel-calendar.js
```
`panel.js` must load first (defines the class). Satellite files add to `BulletHistory.prototype`. The `DOMContentLoaded` handler at the end of `panel.js` fires after all scripts load.

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
