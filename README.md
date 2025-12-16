# Bullet History - Chrome Extension

A visual bullet journal for your browsing history.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `/Users/ammc/Bullet History` folder
5. The extension will appear in your extensions list

## Usage

1. Click the Bullet History extension icon in your toolbar
2. Click "Open side panel" (or it may open automatically)
3. The side panel will display your browsing history as a visual grid:
   - Each row = a domain (TLD)
   - Each column = a day
   - Color intensity = visit frequency
   - Hover over cells to see visit counts

## Features (Phase 1 - MVP)

- ✅ Visual grid showing 14 days of history
- ✅ Domains sorted by most recently visited
- ✅ Unique pastel colors per domain
- ✅ Color saturation based on visit frequency
- ✅ Dual-axis scrolling (horizontal for dates, vertical for domains)
- ✅ Hover tooltips showing visit counts
- ✅ Date header with month and day numbers

## Next Steps (Phase 2)

- Click cells to expand and see individual URLs
- Delete individual URLs or add to bookmarks
- Trash icon to delete all domain data
- Statistics dashboard
- Live updates as you browse

## Files

- `manifest.json` - Extension configuration
- `panel.html` - Side panel HTML structure
- `panel.css` - Styling and layout
- `panel.js` - Core logic and rendering
- `PROJECT.md` - Full project specification
