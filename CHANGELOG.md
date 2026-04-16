# Changelog

All notable changes to Bullet History will be documented in this file.

## [1.2.1] - 2026-04-14

### Changed
- **Full refresh button** — Refresh button now reloads all data (history, favicons, tabs, time tracking, calendar) instead of only time data
- **Bottom menu buttons** — Restyled with colored left-border accents, stronger active states with tinted backgrounds, icons hidden, "All" renamed to "History"

### Fixed
- **Single-tab windows disappearing** — Fixed same-reference array mutation bug in `applyTabGroupCohesion` that emptied windows with one tab
- **Missing tabs after reload** — Backfill from `chrome.tabs.query()` for tabs not yet written to storage
- **chrome:// URLs now visible** — Removed filtering of chrome:// pages from background script and Active Tabs view
- **Ungroup not refreshing UI** — Added delay before refresh to allow Chrome state to settle
- **Removed debug logging** — Cleaned up console.log statements from Active Tabs

## [1.2.0] - 2026-04-13

### Added
- **Nested bracket hierarchy** — Visual bracket lines (`|`, `| |`, `| | |`) in expanded views showing date > tab group > url item nesting with colored borders drawn via CSS linear-gradient
- **Bracket color theming** — Random color assignment from a 12-color palette for date brackets, with lighter variations for child levels
- **Expand/collapse per url-item** — Chevron toggle button with hover-to-preview (expand on hover, collapse on mouse leave) and click-to-pin (stay expanded)
- **Open Graph metadata** — Expanded url-items lazily fetch and display OG metadata (og:title, og:description, og:site_name, og:type, og:image, twitter:title, twitter:description, meta description) with animated loading indicator
- **Two-column metadata tables** — Visit info and time tracking displayed in aligned grid tables with shared column widths
- **Action buttons in expanded view** — Delete, Favorite, Close, Manage, Ungroup, Add to Group, New Group buttons with colored left-border styling, shown only when expanded
- **Tab group drag/drop** — Drag url-items to reorder or assign to tab groups in Active Tabs view
- **Tab group header rows** — Separate header rows for tab groups with colored indicators
- **X button on url-items** — Context-aware delete/close/unbookmark button (history delete, tab close, or bookmark remove depending on view)
- **Expand All toggle** — Button in expanded view header to expand/collapse all url-items at once
- **URL item tests** — Comprehensive test suite for X button, expand button, tab group display, and drag/drop behavior
- **Host permissions for OG fetching** — Added `http://*/*` and `https://*/*` to enable cross-origin metadata fetching

### Changed
- **Expanded url-item layout** — Title wraps fully when expanded; left-side elements (timestamp, time, buttons) stay top-aligned; expand button moved to far left
- **Button styling** — Minimal design with white background, light border, and colored left accent border per action type
- **Time labels** — Changed "Active Time" / "Open Time" to "Tab Active" / "Tab Open" for clarity
- **Metadata labels** — Shortened to single words (Day, Time, Visits) without colons
- **Timestamp styling** — Smaller font size (9px), open time closer to timestamp
- **Border radius removed** — All hierarchy elements use sharp corners
- **Expand animation** — Smooth height transition on expand/collapse with scrollHeight measurement

### Removed
- **Ungroup button** — Removed standalone ungroup button from url-items (ungroup action still available in expanded action buttons)

### Fixed
- **Bracket line rendering** — Switched from pseudo-elements/box-shadow to background linear-gradient to avoid clipping by overflow containers
- **Hover state preservation** — All background hover states use `background-color` instead of `background` shorthand to preserve gradient bracket lines
- **Virtual scroll compatibility** — Mouseleave handlers attached to actual DOM placeholder elements rather than discarded wrapper elements
- **Background script** — Improved time tracking with debounced writes and batched updates

## [1.1.2] - 2026-04-02

### Added
- Extract time tracking utilities to shared module
- Add unit tests for date utilities
- Add packaging script

### Fixed
- Fix unit tests
- Fix on-hover for url description

## [1.1.1] - 2026-03-28

### Added
- Additional unit tests

### Fixed
- Refine time tracking and time display
