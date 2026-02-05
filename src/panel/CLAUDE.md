# Panel UI (React)

## Overview

The panel is the main user interface, displayed in Chrome's side panel. Built with React and Zustand for state management.

## Entry Point

`index.tsx` mounts the React app to `#root` in `index.html`.

## State Management (Zustand)

State is split into slices in `store/`:

### HistorySlice (`store/history-slice.ts`)
```typescript
interface HistorySlice {
  historyData: HistoryData;        // Domain → days → URLs
  hourlyData: HourlyHistoryData;   // For hour view
  sortedDomains: string[];         // Current sort order
  sortMode: SortMode;              // 'recent' | 'count' | 'domain' | 'time'
  isLoading: boolean;
  error: string | null;

  fetchHistory(): Promise<void>;   // Load from Chrome API
  setSortMode(mode): void;         // Re-sorts domains
}
```

### ViewSlice (`store/view-slice.ts`)
```typescript
interface ViewSlice {
  viewMode: ViewMode;              // 'day' | 'hour'
  currentDate: string;             // YYYY-MM-DD
  currentHour: string | null;      // YYYY-MM-DDTHH
  searchQuery: string;
  isExpandedViewOpen: boolean;
  expandedViewType: 'day' | 'hour' | 'domain' | 'full' | null;
  expandedViewData: { domain?, date?, hour? } | null;
  zoomLevel: number;

  setViewMode(mode): void;
  openExpandedView(type, data): void;
  closeExpandedView(): void;
}
```

## Component Structure (planned)

```
components/
├── grid/
│   ├── VirtualGrid.tsx      # Main grid with virtualization
│   ├── DateHeader.tsx       # Column headers (dates/hours)
│   ├── Cell.tsx             # Individual grid cell
│   └── DomainRow.tsx        # Row with favicon + cells
├── expanded/
│   ├── ExpandedView.tsx     # Container for detail views
│   ├── UrlList.tsx          # Virtual list of URLs
│   └── UrlItem.tsx          # Single URL row
├── calendar/
│   └── CalendarSection.tsx  # Calendar events display
└── tabs/
    ├── ActiveTabs.tsx       # Open tabs view
    ├── Bookmarks.tsx        # Bookmarks view
    └── RecentlyClosed.tsx   # Closed tabs view
```

## Services

### chrome-api.ts
Wrappers around Chrome APIs for testability:
- `chromeHistoryService` — history.search, getVisits, delete
- `chromeBookmarksService` — bookmarks CRUD
- `chromeSessionsService` — recently closed tabs
- `backgroundService` — message panel ↔ background

### calendar-api.ts
Google Calendar integration:
- Authentication flow
- Event fetching and filtering
- Settings management

## Performance Patterns

From the original codebase, these patterns must be preserved:

1. **Virtual Grid Rendering**
   - Only render visible rows
   - Track column cells in Map for fast highlighting
   - Pre-compute `maxCountCache` per render

2. **Hover State Tracking**
   - Store hovered elements in Set
   - Clear only tracked elements (not querySelectorAll)

3. **Sort Key Pre-computation**
   - Build sort key Map before `.sort()`
   - Comparator does O(1) lookups

4. **Lazy Loading**
   - Load visit times on hover, not on render
   - Use IntersectionObserver for URL lists
