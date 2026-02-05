import { useRef, useCallback, useEffect, useState } from 'react';
import { useHistoryStore } from '../../store';
import { useVirtualGrid } from '../../hooks/useVirtualGrid';
import { DateHeader, getTodayStr } from './DateHeader';
import type { SortMode } from '@shared/types';

const BASE_ROW_HEIGHT = 21; // 18px cell + 3px gap
const BASE_COL_WIDTH = 21; // 18px cell + 3px gap

interface VirtualGridProps {
  onDateClick?: (dateStr: string) => void;
}

/**
 * Virtual scrolling grid showing browsing history
 * Renders only visible rows/columns for performance
 */
export function VirtualGrid({ onDateClick }: VirtualGridProps) {
  const {
    historyData,
    filteredDomains,
    dates,
    colors,
    sortMode,
    searchQuery,
    zoomLevel,
    openExpandedView,
    setSortMode,
    setSearchQuery,
    setZoomLevel,
    getFavicon,
  } = useHistoryStore();

  const dateHeaderRef = useRef<HTMLDivElement>(null);
  const tldColumnRef = useRef<HTMLDivElement>(null);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);

  // Compute sizes based on zoom level
  const ROW_HEIGHT = Math.round(BASE_ROW_HEIGHT * zoomLevel);
  const COL_WIDTH = Math.round(BASE_COL_WIDTH * zoomLevel);
  const CELL_SIZE = Math.round(18 * zoomLevel);

  const totalRows = filteredDomains.length;
  const totalCols = dates.length;

  const {
    virtualState,
    containerRef,
    totalHeight,
    totalWidth,
    handleScroll,
  } = useVirtualGrid({
    totalRows,
    totalCols,
    rowHeight: ROW_HEIGHT,
    colWidth: COL_WIDTH,
  });

  const todayStr = getTodayStr();

  // Sync scroll between grid and headers
  const syncScroll = useCallback(() => {
    const container = containerRef.current;
    const dateHeader = dateHeaderRef.current;
    const tldColumn = tldColumnRef.current;

    if (container && dateHeader) {
      dateHeader.scrollLeft = container.scrollLeft;
    }
    if (container && tldColumn) {
      tldColumn.scrollTop = container.scrollTop;
    }

    handleScroll();
  }, [handleScroll, containerRef]);

  // Scroll to today on initial load
  useEffect(() => {
    const container = containerRef.current;
    if (container && dates.length > 0) {
      // Scroll to right (today is at the end)
      container.scrollLeft = container.scrollWidth;
    }
  }, [dates.length, containerRef]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  const handleCellClick = useCallback((domain: string, dateStr: string) => {
    openExpandedView('cell', { domain, date: dateStr });
  }, [openExpandedView]);

  const handleDomainClick = useCallback((domain: string) => {
    openExpandedView('domain', { domain });
  }, [openExpandedView]);

  const handleDateClick = useCallback((dateStr: string) => {
    // Switch to hour view for this date
    if (onDateClick) {
      onDateClick(dateStr);
    } else {
      openExpandedView('day', { date: dateStr });
    }
  }, [openExpandedView, onDateClick]);

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortMode(e.target.value as SortMode);
  }, [setSortMode]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(Math.min(2, zoomLevel + 0.25));
  }, [zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(Math.max(0.5, zoomLevel - 0.25));
  }, [zoomLevel, setZoomLevel]);

  if (totalRows === 0 && !searchQuery) {
    return (
      <div className="grid-empty">
        <p>No browsing history found</p>
      </div>
    );
  }

  return (
    <div className="grid-container">
      {/* Header Section */}
      <div className="header-section">
        {/* Header spacer (sort/search controls) */}
        <div className="header-spacer">
          <input
            type="text"
            className="search-input"
            placeholder="Search domains..."
            value={localSearch}
            onChange={handleSearchChange}
          />
          <select
            className="sort-dropdown"
            value={sortMode}
            onChange={handleSortChange}
          >
            <option value="recent">Recent</option>
            <option value="count">Most Visited</option>
            <option value="domain">Alphabetical</option>
          </select>
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.5}
              title="Zoom out"
            >
              −
            </button>
            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button
              className="zoom-btn"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2}
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>

        {/* Date header */}
        <div className="date-header" ref={dateHeaderRef}>
          <DateHeader
            dates={dates}
            todayStr={todayStr}
            hoveredColIndex={hoveredColIndex}
            onDateClick={handleDateClick}
            onColHover={setHoveredColIndex}
          />
        </div>
      </div>

      {/* Main Section */}
      <div className="main-section">
        {/* TLD Column (domain names) */}
        <div className="tld-column" ref={tldColumnRef}>
          <div
            className="virtual-spacer"
            style={{ height: totalHeight, width: 1 }}
          />
          {totalRows === 0 && searchQuery ? (
            <div className="search-no-results">
              No domains match "{searchQuery}"
            </div>
          ) : (
            Array.from(
              { length: virtualState.endRow - virtualState.startRow },
              (_, i) => {
                const rowIndex = virtualState.startRow + i;
                const domain = filteredDomains[rowIndex];
                if (!domain) return null;

                return (
                  <div
                    key={domain}
                    className={`tld-row ${hoveredRowIndex === rowIndex ? 'row-hover' : ''}`}
                    data-row-index={rowIndex}
                    style={{
                      position: 'absolute',
                      top: rowIndex * ROW_HEIGHT + 8,
                      width: '100%',
                    }}
                    onClick={() => handleDomainClick(domain)}
                    onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                    onMouseLeave={() => setHoveredRowIndex(null)}
                  >
                    <img
                      className="tld-favicon"
                      src={getFavicon(domain)}
                      alt=""
                      width={16}
                      height={16}
                    />
                    <span className="tld-name">{domain}</span>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* Cell Grid */}
        <div
          className="cell-grid-wrapper"
          ref={containerRef}
          onScroll={syncScroll}
        >
          <div
            className="cell-grid"
            style={{
              position: 'relative',
              height: totalHeight,
              width: totalWidth,
            }}
          >
            {/* Render visible rows */}
            {Array.from(
              { length: virtualState.endRow - virtualState.startRow },
              (_, i) => {
                const rowIndex = virtualState.startRow + i;
                const domain = filteredDomains[rowIndex];
                if (!domain || !historyData[domain]) return null;

                const todayIndex = dates.indexOf(todayStr);

                return (
                  <div
                    key={domain}
                    className={`cell-row ${todayIndex !== -1 ? 'has-today-col' : ''} ${hoveredRowIndex === rowIndex ? 'row-hover' : ''}`}
                    data-row-index={rowIndex}
                    style={{
                      position: 'absolute',
                      top: rowIndex * ROW_HEIGHT + 8,
                      left: 0,
                      width: totalWidth,
                      ['--today-col-left' as string]:
                        todayIndex !== -1 ? `${todayIndex * COL_WIDTH + 8 - 1}px` : undefined,
                    }}
                    onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                    onMouseLeave={() => setHoveredRowIndex(null)}
                  >
                    {/* Render visible cells in this row */}
                    {Array.from(
                      { length: virtualState.endCol - virtualState.startCol },
                      (_, j) => {
                        const colIndex = virtualState.startCol + j;
                        const dateStr = dates[colIndex];
                        if (!dateStr) return null;

                        const dayData = historyData[domain].days[dateStr];
                        const count = dayData?.count || 0;
                        const color = colors[domain] || 'hsl(140, 65%, 75%)';

                        // Calculate max count for this domain
                        let maxCount = 1;
                        for (const d of Object.values(historyData[domain].days)) {
                          if (d.count > maxCount) maxCount = d.count;
                        }

                        // Get GitHub-style color
                        let backgroundColor: string | undefined;
                        if (count > 0) {
                          const normalized = count / maxCount;
                          const hslMatch = color.match(/hsl\((\d+),/);
                          const hue = hslMatch ? hslMatch[1] : '140';

                          if (normalized <= 0.25) {
                            backgroundColor = `hsl(${hue}, 42%, 86%)`;
                          } else if (normalized <= 0.5) {
                            backgroundColor = `hsl(${hue}, 50%, 76%)`;
                          } else if (normalized <= 0.75) {
                            backgroundColor = `hsl(${hue}, 54%, 66%)`;
                          } else {
                            backgroundColor = `hsl(${hue}, 58%, 60%)`;
                          }
                        }

                        return (
                          <div
                            key={dateStr}
                            className={`cell ${count === 0 ? 'empty' : ''} ${dateStr === todayStr ? 'col-today' : ''} ${hoveredColIndex === colIndex ? 'col-hover' : ''}`}
                            data-domain={domain}
                            data-date={dateStr}
                            data-col-index={colIndex}
                            data-row-index={rowIndex}
                            data-count={count}
                            style={{
                              position: 'absolute',
                              left: colIndex * COL_WIDTH + 8,
                              width: CELL_SIZE,
                              height: CELL_SIZE,
                              backgroundColor,
                            }}
                            onClick={() => count > 0 && handleCellClick(domain, dateStr)}
                            onMouseEnter={() => setHoveredColIndex(colIndex)}
                            onMouseLeave={() => setHoveredColIndex(null)}
                            title={count > 0 ? `${count} visit${count !== 1 ? 's' : ''}` : undefined}
                          />
                        );
                      }
                    )}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
