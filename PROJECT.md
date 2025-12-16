# Bullet History - Project Manifest

## Vision
A visual "bullet journal" for browsing history that shows browsing patterns across time using a calendar-style grid. Each domain (TLD) gets a row, each day gets a column, with color saturation indicating visit frequency.

## Core Layout

```
                    [DECEMBER 2025        ]
                    [1  2  3  4  5  6  7 ...]  ← Date header (scrolls horizontally)

google.com    [🗑]  [█][█][░][█][█]...         ← TLD row + cells
github.com    [🗑]  [█][░][█][█][░]...
reddit.com    [🗑]  [░][█][█][░][█]...
    ↑          ↑          ↑
TLD list    Trash    Day cells (color intensity = visit count)
(fixed)     icon     (scrolls horizontally)
```

## Key Features

### 1. Grid Visualization
- **Rows**: One per TLD (Top-Level Domain)
  - Sorted by most recently visited (top) to least recent (bottom)
  - Text: ~12px font, TLD displayed
  - Updates live as user browses

- **Columns**: One per day
  - Most recent day on right edge
  - Past dates extend left
  - Minimum 2 weeks visible
  - History depth: as far back as Chrome history goes

- **Cells**:
  - Square, fixed width
  - Vertically centered with TLD text
  - Color: Unique pastel per TLD (auto-generated, persisted)
  - Saturation: More visits = more saturated
  - Empty cells: Show outline only (maintains grid alignment)
  - **Hover effect**: Display tooltip showing visit count (e.g., "23 visits" or "23 pages")

### 2. Date Header
- Top row shows month name
- Second row shows day numbers
- Scrolls horizontally with grid
- Always starts showing "today" on initial load

### 3. Scrolling Behavior
- **Horizontal**: Date header + cells scroll together, TLD column stays fixed
- **Vertical**: TLD column + cells scroll together, date header stays fixed
- **Initial position**: Today visible on right edge
- **No auto-reset**: If user scrolls to past, stay there (don't jump back to today)

### 4. Interactive Features

#### Cell Click - Expand URLs
- Click any cell to expand that row
- Shows all URLs visited on that day for that domain
- URLs appear in new row between clicked row and row below
- **Display format**:
  - Chronological order (oldest to newest)
  - Each URL shows timestamp
  - Show visit count per URL (e.g., "visited 3 times")
  - Actions per URL:
    - Delete individual URL from history
    - Add to bookmarks

#### Trash Icon - Delete Domain
- Icon appears next to each TLD
- Click = immediately delete ALL data for that domain:
  - Browse history
  - Cache
  - Cookies
  - localStorage
  - IndexedDB
- No confirmation dialog
- "Virgin experience" - as if never visited

### 5. Live Updates
- As user browses, grid updates in real-time
- New visits increase cell saturation
- TLD list re-sorts if recency changes
- Chrome history listener keeps data fresh

## Technical Architecture

### Chrome APIs Required
- `chrome.history` - read/search/delete history
- `chrome.browsingData` - clear cache/cookies/storage
- `chrome.storage.local` - persist TLD color mappings
- `chrome.bookmarks` - create bookmarks from expanded URLs

### Permissions Needed
```json
"permissions": [
  "history",
  "browsingData",
  "storage",
  "bookmarks"
]
```

### Performance Considerations
- **Large histories**: May need virtualization/windowing for users with years of history
- **Memory**: Load data in chunks, render only visible rows/columns
- **Color persistence**: Store TLD → color mapping in chrome.storage.local
- **Live updates**: chrome.history.onVisited listener

### Data Model
```javascript
{
  // History data structure
  domains: {
    'google.com': {
      lastVisit: timestamp,
      days: {
        '2025-12-15': {visitCount: 45, urls: [...]},
        '2025-12-14': {visitCount: 32, urls: [...]}
      }
    }
  },

  // Persisted color mapping
  colors: {
    'google.com': '#FFB3BA',  // pastel colors
    'github.com': '#BAE1FF'
  }
}
```

## Statistics Dashboard

Display key metrics (location TBD - could be header, sidebar, or separate view):
- **Number of unique URLs** (all-time or filtered by date range)
- **URLs visited today** (or selected day)
- **Total TLDs visited** (all-time or filtered)

Future expansion possibilities:
- Most visited domains
- Time spent patterns
- Streak tracking

## Decisions Made

1. **Expanded URL display**: Chronological with timestamps, visit counts per URL, delete/bookmark actions
2. **Time zones**: Use Chrome's native history timestamps (no conversion)
3. **Statistics**: Track unique URLs, daily URL counts, total TLD counts
4. **Bookmarks**: Add to root bookmarks folder (no prompt)
5. **Cell hover**: Display tooltip with visit count for that day

## Future Considerations

1. **Search/filter**: Add ability to search for specific domains or dates?
2. **Export**: Allow exporting history data?
3. **Time tracking**: Estimate time spent on sites?
4. **Categories/tags**: Group domains by category?

## Implementation Phases

### Phase 1: Core Grid (MVP)
- [ ] Set up side panel UI
- [ ] Fetch and parse Chrome history
- [ ] Build grid layout (fixed TLD column + scrolling cells)
- [ ] Generate and persist pastel colors per TLD
- [ ] Calculate visit counts per day per domain
- [ ] Render cells with saturation based on visits
- [ ] Date header with month/day
- [ ] Dual-axis scrolling (horizontal/vertical independent)

### Phase 2: Interactivity
- [ ] Cell click → expand row with URLs (chronological, with timestamps & visit counts)
- [ ] Per-URL actions: delete individual URL, add to bookmarks
- [ ] Trash icon → delete domain data
- [ ] Statistics display (unique URLs, daily counts, total TLDs)
- [ ] Live updates via chrome.history listener
- [ ] Auto-sort TLDs by recency

### Phase 3: Performance & Polish
- [ ] Virtualization for large histories
- [ ] Smooth animations
- [ ] Loading states
- [ ] Error handling

### Phase 4: Enhancements (Future)
- [ ] Search/filter functionality
- [ ] Statistics dashboard
- [ ] Export data
- [ ] Full page view option
- [ ] Custom color themes

## Design Notes
- Clean, minimal interface
- Pastel color palette for easy viewing
- Grid should feel like a visual journal
- Focus on patterns over individual URLs
