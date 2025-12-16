# Bullet History - Chrome Extension

A visual bullet journal for your browsing history.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `BulletHistory` folder
5. The extension will appear in your extensions list

## Usage

1. Click the Bullet History extension icon in your toolbar
2. The side panel will open automatically
3. The side panel displays your browsing history as a visual grid:
   - Each row = a domain (TLD)
   - Each column = a day
   - Color intensity = visit frequency
   - Hover over cells to see visit counts
   - Hover over rows/columns to highlight them
   - Grid shows full history extent (earliest visit → today)

## Features (Current)

- ✅ Dynamic date range based on full browser history
- ✅ Visual grid with rounded cells and spacing
- ✅ Domains sorted by most recently visited
- ✅ Unique pastel colors per domain (persisted)
- ✅ Color saturation based on visit frequency
- ✅ Dual-axis scrolling (horizontal for dates, vertical for domains)
- ✅ Hover tooltips showing visit counts
- ✅ Date header with month, weekday, and day numbers
- ✅ Row and column highlighting on hover
- ✅ Bidirectional scroll sync between header and grid
- ✅ Virtualization for efficient rendering of large datasets
- ✅ Click cells to expand and see individual URLs
- ✅ Delete individual URLs or bookmark them
- ✅ Navigate between dates with arrow keys or horizontal scrolling
- ✅ Click domains to see all URLs grouped by date
- ✅ Delete all history for a domain
- ✅ Live updates as you browse

## Debug Mode (Fake Data for Testing)

If you want to test with a large dataset, you can enable fake data generation:

1. Open `panel.js` in a text editor
2. Find the constructor (around line 15-20)
3. Change `this.useFakeData = false;` to `this.useFakeData = true;`
4. Optionally adjust the test data size:
   - `this.fakeDomainCount = 100;` (number of domains)
   - `this.fakeDaysBack = 365;` (days of history)
5. Save the file and reload the extension in Chrome

**To turn debug mode OFF:**
- Change `this.useFakeData = true;` back to `this.useFakeData = false;`
- Save and reload

**Note:** Debug mode generates synthetic browsing data and ignores your real Chrome history. This is useful for testing performance with large datasets.

## Next Steps

- Statistics dashboard (total visits, most visited sites, activity trends)
- Additional filtering and search capabilities
- Export history data
- Custom color schemes

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `panel.html` - Side panel HTML structure
- `panel.css` - Styling and layout
- `panel.js` - Core logic and rendering
- `PROJECT.md` - Full project specification
