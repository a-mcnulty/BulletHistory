// Bullet History - Main Panel Script

class BulletHistory {
  constructor() {
    this.historyData = {}; // { domain: { lastVisit, days: { date: { count, urls } } } }
    this.colors = {}; // { domain: color }
    this.dateRange = 30; // Show 30 days by default (to capture more history)
    this.dates = [];

    this.init();
  }

  async init() {
    await this.loadColors();
    await this.fetchHistory();
    this.generateDates();
    this.renderDateHeader();
    this.renderGrid();
    this.setupScrollSync();
    this.setupTooltips();
    this.setupRowHover();
  }

  // Generate date range (today - N days ago)
  generateDates() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.dates = [];
    for (let i = this.dateRange - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      this.dates.push(this.formatDate(date));
    }

    console.log('Generated dates:', this.dates);
    console.log('Today is:', this.formatDate(new Date()));
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1);
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fetch Chrome history
  async fetchHistory() {
    return new Promise((resolve) => {
      const endTime = Date.now();
      const startTime = endTime - (this.dateRange * 24 * 60 * 60 * 1000);

      chrome.history.search({
        text: '',
        startTime: startTime,
        maxResults: 10000
      }, (results) => {
        this.parseHistory(results);
        resolve();
      });
    });
  }

  // Parse history into domain/day structure
  parseHistory(results) {
    this.historyData = {};

    console.log(`Parsing ${results.length} history items`);

    for (const item of results) {
      try {
        const url = new URL(item.url);
        const domain = url.hostname.replace('www.', '');

        // Create date from timestamp and normalize to local midnight
        const visitDateObj = new Date(item.lastVisitTime);
        visitDateObj.setHours(0, 0, 0, 0);
        const visitDate = this.formatDate(visitDateObj);

        if (!this.historyData[domain]) {
          this.historyData[domain] = {
            lastVisit: item.lastVisitTime,
            days: {}
          };
        }

        if (!this.historyData[domain].days[visitDate]) {
          this.historyData[domain].days[visitDate] = {
            count: 0,
            urls: []
          };
        }

        // Update last visit if more recent
        if (item.lastVisitTime > this.historyData[domain].lastVisit) {
          this.historyData[domain].lastVisit = item.lastVisitTime;
        }

        this.historyData[domain].days[visitDate].count += item.visitCount || 1;
        this.historyData[domain].days[visitDate].urls.push({
          url: item.url,
          title: item.title,
          lastVisit: item.lastVisitTime,
          visitCount: item.visitCount || 1
        });

      } catch (e) {
        // Skip invalid URLs
        console.warn('Invalid URL:', item.url);
      }
    }

    // Generate colors for new domains
    for (const domain in this.historyData) {
      if (!this.colors[domain]) {
        this.colors[domain] = this.generatePastelColor();
      }
    }

    // Debug: show unique dates in history data
    const allDates = new Set();
    for (const domain in this.historyData) {
      for (const date in this.historyData[domain].days) {
        allDates.add(date);
      }
    }
    console.log('Dates with history data:', Array.from(allDates).sort());

    this.saveColors();
  }

  // Generate a random pastel color
  generatePastelColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 20); // 60-80%
    const lightness = 80 + Math.floor(Math.random() * 10);  // 80-90%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // Load colors from storage
  async loadColors() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['domainColors'], (result) => {
        this.colors = result.domainColors || {};
        resolve();
      });
    });
  }

  // Save colors to storage
  saveColors() {
    chrome.storage.local.set({ domainColors: this.colors });
  }

  // Get sorted domains (most recent first)
  getSortedDomains() {
    return Object.keys(this.historyData).sort((a, b) => {
      return this.historyData[b].lastVisit - this.historyData[a].lastVisit;
    });
  }

  // Render date header
  renderDateHeader() {
    const monthRow = document.getElementById('monthRow');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    monthRow.innerHTML = '';
    weekdayRow.innerHTML = '';
    dayRow.innerHTML = '';

    let currentMonth = '';
    let monthSpan = 0;

    this.dates.forEach((dateStr, index) => {
      const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      const monthYearKey = `${monthName} ${year}`;
      const dayNum = date.getDate();
      const weekdayName = date.toLocaleString('en-US', { weekday: 'short' }).charAt(0);

      // Debug first few dates
      if (index < 3 || index > this.dates.length - 3) {
        console.log(`Date ${index}: ${dateStr} -> day ${dayNum}, ${weekdayName}`);
      }

      // Month header (only show when month changes)
      if (monthYearKey !== currentMonth) {
        if (monthSpan > 0) {
          // Create month cell for previous month
          const monthCell = document.createElement('div');
          monthCell.className = 'month-cell';
          monthCell.style.width = `${monthSpan * 21 - 3}px`; // 18px cell + 3px gap per day, minus last gap
          monthCell.style.minWidth = `${monthSpan * 21 - 3}px`;
          monthCell.textContent = currentMonth;
          monthRow.appendChild(monthCell);
        }
        currentMonth = monthYearKey;
        monthSpan = 1;
      } else {
        monthSpan++;
      }

      // Weekday letter
      const weekdayCell = document.createElement('div');
      weekdayCell.className = 'weekday-cell';
      weekdayCell.textContent = weekdayName;
      weekdayCell.dataset.colIndex = index;
      weekdayRow.appendChild(weekdayCell);

      // Day number
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      dayCell.textContent = dayNum;
      dayCell.dataset.colIndex = index;
      dayRow.appendChild(dayCell);

      // Last month cell
      if (index === this.dates.length - 1) {
        const monthCell = document.createElement('div');
        monthCell.className = 'month-cell';
        monthCell.style.width = `${monthSpan * 21 - 3}px`; // 18px cell + 3px gap per day, minus last gap
        monthCell.style.minWidth = `${monthSpan * 21 - 3}px`;
        monthCell.textContent = currentMonth;
        monthRow.appendChild(monthCell);
      }
    });
  }

  // Calculate cell saturation based on visit count
  getCellSaturation(count, maxCount) {
    if (count === 0) return 0;
    const minSaturation = 20;
    const maxSaturation = 90;
    const normalized = Math.min(count / maxCount, 1);
    return minSaturation + (normalized * (maxSaturation - minSaturation));
  }

  // Render the grid
  renderGrid() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');

    tldColumn.innerHTML = '';
    cellGrid.innerHTML = '';

    const domains = this.getSortedDomains();

    // Find max visit count for saturation calculation
    let maxCount = 0;
    domains.forEach(domain => {
      Object.values(this.historyData[domain].days).forEach(day => {
        maxCount = Math.max(maxCount, day.count);
      });
    });

    domains.forEach((domain, index) => {
      // TLD label
      const tldRow = document.createElement('div');
      tldRow.className = 'tld-row';
      tldRow.textContent = domain;
      tldRow.dataset.rowIndex = index;
      tldColumn.appendChild(tldRow);

      // Cell row
      const cellRow = document.createElement('div');
      cellRow.className = 'cell-row';
      cellRow.dataset.rowIndex = index;

      this.dates.forEach((dateStr, colIndex) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.domain = domain;
        cell.dataset.date = dateStr;
        cell.dataset.colIndex = colIndex;
        cell.dataset.rowIndex = index;

        const dayData = this.historyData[domain].days[dateStr];

        if (dayData && dayData.count > 0) {
          const baseColor = this.colors[domain];
          const saturation = this.getCellSaturation(dayData.count, maxCount);

          // Parse HSL and adjust saturation
          const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
          if (hslMatch) {
            const [, h, , l] = hslMatch;
            cell.style.backgroundColor = `hsl(${h}, ${saturation}%, ${l}%)`;
          } else {
            cell.style.backgroundColor = baseColor;
          }

          cell.dataset.count = dayData.count;
        } else {
          cell.classList.add('empty');
          cell.dataset.count = 0;
        }

        cellRow.appendChild(cell);
      });

      cellGrid.appendChild(cellRow);
    });
  }

  // Sync scrolling between date header and cell grid
  setupScrollSync() {
    const dateHeader = document.getElementById('dateHeader');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const tldColumn = document.getElementById('tldColumn');

    // Sync horizontal scroll
    cellGridWrapper.addEventListener('scroll', () => {
      dateHeader.scrollLeft = cellGridWrapper.scrollLeft;
    });

    // Sync vertical scroll
    cellGridWrapper.addEventListener('scroll', () => {
      tldColumn.scrollTop = cellGridWrapper.scrollTop;
    });

    // Scroll to show today (right edge)
    cellGridWrapper.scrollLeft = cellGridWrapper.scrollWidth;
  }

  // Setup hover tooltips
  setupTooltips() {
    const tooltip = document.getElementById('tooltip');
    const cellGrid = document.getElementById('cellGrid');

    cellGrid.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('cell')) {
        const count = parseInt(e.target.dataset.count) || 0;
        const domain = e.target.dataset.domain;
        const date = e.target.dataset.date;

        if (count > 0) {
          tooltip.textContent = `${count} visit${count !== 1 ? 's' : ''}`;
          tooltip.classList.add('visible');

          // Position tooltip near cursor
          const rect = e.target.getBoundingClientRect();
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - 30}px`;
          tooltip.style.transform = 'translateX(-50%)';
        }
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('cell')) {
        tooltip.classList.remove('visible');
      }
    });
  }

  // Setup row hover highlighting
  setupRowHover() {
    const tldColumn = document.getElementById('tldColumn');
    const cellGrid = document.getElementById('cellGrid');
    const weekdayRow = document.getElementById('weekdayRow');
    const dayRow = document.getElementById('dayRow');

    // Hover over TLD row
    tldColumn.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Highlight the TLD row
        e.target.classList.add('row-hover');
        // Highlight the corresponding cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
        }
      }
    });

    tldColumn.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('tld-row')) {
        const rowIndex = e.target.dataset.rowIndex;
        // Remove highlight from TLD row
        e.target.classList.remove('row-hover');
        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
        }
      }
    });

    // Hover over cell
    cellGrid.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('cell')) {
        const rowIndex = e.target.dataset.rowIndex;
        const colIndex = e.target.dataset.colIndex;

        // Highlight the TLD row
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.add('row-hover');
        }

        // Highlight the cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.add('row-hover');
        }

        // Highlight the weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.add('col-hover');
        }

        // Highlight the day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.add('col-hover');
        }

        // Highlight all cells in the column
        const columnCells = cellGrid.querySelectorAll(`.cell[data-col-index="${colIndex}"]`);
        columnCells.forEach(cell => cell.classList.add('col-hover'));
      }
    });

    cellGrid.addEventListener('mouseout', (e) => {
      if (e.target.classList.contains('cell')) {
        const rowIndex = e.target.dataset.rowIndex;
        const colIndex = e.target.dataset.colIndex;

        // Remove highlight from TLD row
        const tldRow = tldColumn.querySelector(`.tld-row[data-row-index="${rowIndex}"]`);
        if (tldRow) {
          tldRow.classList.remove('row-hover');
        }

        // Remove highlight from cell row
        const cellRow = cellGrid.querySelector(`.cell-row[data-row-index="${rowIndex}"]`);
        if (cellRow) {
          cellRow.classList.remove('row-hover');
        }

        // Remove highlight from weekday cell
        const weekdayCell = weekdayRow.querySelector(`.weekday-cell[data-col-index="${colIndex}"]`);
        if (weekdayCell) {
          weekdayCell.classList.remove('col-hover');
        }

        // Remove highlight from day cell
        const dayCell = dayRow.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.classList.remove('col-hover');
        }

        // Remove highlight from column cells
        const columnCells = cellGrid.querySelectorAll(`.cell[data-col-index="${colIndex}"]`);
        columnCells.forEach(cell => cell.classList.remove('col-hover'));
      }
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BulletHistory();
});
