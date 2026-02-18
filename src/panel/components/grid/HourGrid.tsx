import { useRef, useCallback, useState, useMemo } from 'react';
import { useHistoryStore } from '../../store';
import { formatDateForDisplay, getOrdinalSuffix, getCurrentHourISO } from '@shared/utils/date-utils';

const ROW_HEIGHT = 21;
const COL_WIDTH = 21;
const HOUR_COUNT = 24;

interface HourGridProps {
  dateStr: string;
  onBackToDay: () => void;
}

/**
 * Hour view grid showing browsing history for a specific day
 * Columns are hours (0-23), rows are domains
 */
export function HourGrid({ dateStr, onBackToDay }: HourGridProps) {
  const {
    hourlyData,
    filteredDomains,
    colors,
    openExpandedView,
    getFavicon,
    deleteHistory,
  } = useHistoryStore();

  const headerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tldColumnRef = useRef<HTMLDivElement>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredColIndex, setHoveredColIndex] = useState<number | null>(null);
  const [tldWidth, setTldWidth] = useState(150);
  const [isResizingTld, setIsResizingTld] = useState(false);

  const totalRows = filteredDomains.length;
  const totalHeight = totalRows * ROW_HEIGHT + 11;
  const totalWidth = HOUR_COUNT * COL_WIDTH + 13;

  // Get current hour for highlighting
  const currentHourStr = getCurrentHourISO();

  // Generate hour columns (0-23)
  const hours = useMemo(() => Array.from({ length: HOUR_COUNT }, (_, i) => {
    const hourStr = `${dateStr}T${i.toString().padStart(2, '0')}`;
    const hour12 = i === 0 ? 12 : (i > 12 ? i - 12 : i);
    const ampm = i >= 12 ? 'PM' : 'AM';
    return { index: i, key: hourStr, hour12, ampm, isCurrentHour: hourStr === currentHourStr };
  }), [dateStr, currentHourStr]);

  // Get date info for day banner
  const dateInfo = useMemo(() => {
    const date = new Date(dateStr + 'T00:00:00');
    const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNum = date.getDate();
    const weekdayDay = `${weekday} ${dayNum}${getOrdinalSuffix(dayNum)}`;
    return { monthYear, weekdayDay };
  }, [dateStr]);

  const syncScroll = useCallback(() => {
    const container = containerRef.current;
    const tldColumn = tldColumnRef.current;
    const header = headerRef.current;
    if (container && tldColumn) {
      tldColumn.scrollTop = container.scrollTop;
    }
    if (container && header) {
      header.scrollLeft = container.scrollLeft;
    }
  }, []);

  const handleCellClick = useCallback((domain: string, hourKey: string) => {
    openExpandedView('hour', { domain, hour: hourKey });
  }, [openExpandedView]);

  const handleDomainClick = useCallback((domain: string) => {
    openExpandedView('domain', { domain, date: dateStr });
  }, [openExpandedView, dateStr]);

  const handleHourClick = useCallback((hourKey: string) => {
    openExpandedView('hour', { hour: hourKey, date: dateStr });
  }, [openExpandedView, dateStr]);

  const handleDeleteDomain = useCallback((e: React.MouseEvent, domain: string) => {
    e.stopPropagation();
    if (deleteHistory) {
      deleteHistory(domain);
    }
  }, [deleteHistory]);

  // Find current hour column index
  const currentHourIndex = hours.findIndex(h => h.isCurrentHour);

  if (totalRows === 0) {
    return (
      <div className="grid-container hour-view">
        <div className="header-section">
          <div className="header-spacer" style={{ width: tldWidth }}>
            <button className="back-btn" onClick={onBackToDay}>
              ← Back to Day View
            </button>
          </div>
          <div className="date-header" ref={headerRef}>
            <div className="date-header-inner">
              {/* Day banner row */}
              <div className="weekday-row">
                <div
                  className="weekday-cell hour-view-day-banner"
                  style={{ width: HOUR_COUNT * COL_WIDTH - 3, minWidth: HOUR_COUNT * COL_WIDTH - 3 }}
                >
                  <div className="hour-view-month-year" onClick={onBackToDay}>
                    {dateInfo.monthYear}
                  </div>
                  <div className="hour-view-weekday-day">
                    {dateInfo.weekdayDay}
                  </div>
                </div>
              </div>
              {/* Hour row */}
              <div className="day-row">
                {hours.map((h) => (
                  <div
                    key={h.key}
                    className={`day-cell hour-cell ${h.isCurrentHour ? 'col-today' : ''}`}
                  >
                    <div className="hour-ampm">{h.ampm}</div>
                    <div className="hour-num">{h.hour12}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid-empty">
          <p>No browsing history for this day</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid-container hour-view ${isResizingTld ? 'resizing' : ''}`}>
      {/* Header Section */}
      <div className="header-section">
        <div className="header-spacer" style={{ width: tldWidth }}>
          <button className="back-btn" onClick={onBackToDay}>
            ← Back to Day View
          </button>
        </div>
        <div className="date-header" ref={headerRef}>
          <div className="date-header-inner">
            {/* Day banner row */}
            <div className="weekday-row">
              <div
                className="weekday-cell hour-view-day-banner"
                style={{ width: HOUR_COUNT * COL_WIDTH - 3, minWidth: HOUR_COUNT * COL_WIDTH - 3 }}
              >
                <div className="hour-view-month-year" onClick={onBackToDay}>
                  {dateInfo.monthYear}
                </div>
                <div className="hour-view-weekday-day">
                  {dateInfo.weekdayDay}
                </div>
              </div>
            </div>
            {/* Hour row */}
            <div className="day-row">
              {hours.map((h, index) => (
                <div
                  key={h.key}
                  className={`day-cell hour-cell ${h.isCurrentHour ? 'col-today' : ''} ${hoveredColIndex === index ? 'col-hover' : ''}`}
                  data-col-index={index}
                  onClick={() => handleHourClick(h.key)}
                  onMouseEnter={() => setHoveredColIndex(index)}
                  onMouseLeave={() => setHoveredColIndex(null)}
                >
                  <div className="hour-ampm">{h.ampm}</div>
                  <div className="hour-num">{h.hour12}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="main-section">
        {/* TLD Column */}
        <div className="tld-column" ref={tldColumnRef} style={{ width: tldWidth }}>
          <div
            className="virtual-spacer"
            style={{ height: totalHeight, width: 1 }}
          />
          {filteredDomains.map((domain, rowIndex) => (
            <div
              key={domain}
              className={`tld-row ${hoveredRowIndex === rowIndex ? 'row-hover' : ''}`}
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
              <button
                className="tld-delete-btn"
                title="Delete all history for this domain"
                onClick={(e) => handleDeleteDomain(e, domain)}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        {/* TLD Resize Handle */}
        <div
          className="tld-resize-handle"
          style={{ left: tldWidth }}
          onMouseDown={() => setIsResizingTld(true)}
        />

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
            {filteredDomains.map((domain, rowIndex) => {
              const domainHourly = hourlyData[domain];
              if (!domainHourly) return null;

              // Calculate max count for this domain
              let maxCount = 1;
              for (const hourUrls of Object.values(domainHourly.hours)) {
                if (hourUrls.length > maxCount) maxCount = hourUrls.length;
              }

              const color = colors[domain] || 'hsl(140, 65%, 75%)';
              const hslMatch = color.match(/hsl\((\d+),/);
              const hue = hslMatch ? hslMatch[1] : '140';

              const isFirstRow = rowIndex === 0;

              return (
                <div
                  key={domain}
                  className={`cell-row ${currentHourIndex !== -1 ? 'has-today-col' : ''} ${isFirstRow && currentHourIndex !== -1 ? 'first-row-today' : ''} ${hoveredRowIndex === rowIndex ? 'row-hover' : ''}`}
                  style={{
                    position: 'absolute',
                    top: rowIndex * ROW_HEIGHT + 8,
                    left: 0,
                    width: totalWidth,
                    ['--today-col-left' as string]:
                      currentHourIndex !== -1 ? `${currentHourIndex * COL_WIDTH + 8 - 1}px` : undefined,
                  }}
                  onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                  onMouseLeave={() => setHoveredRowIndex(null)}
                >
                  {hours.map((hour, colIndex) => {
                    const hourUrls = domainHourly.hours[hour.key];
                    const count = hourUrls?.length || 0;

                    let backgroundColor: string | undefined;
                    if (count > 0) {
                      const normalized = count / maxCount;
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
                        key={hour.key}
                        className={`cell ${count === 0 ? 'empty' : ''} ${hour.isCurrentHour ? 'col-today' : ''} ${hoveredColIndex === colIndex ? 'col-hover' : ''}`}
                        data-col-index={colIndex}
                        style={{
                          position: 'absolute',
                          left: hour.index * COL_WIDTH + 8,
                          backgroundColor,
                        }}
                        onClick={() => count > 0 && handleCellClick(domain, hour.key)}
                        onMouseEnter={() => setHoveredColIndex(colIndex)}
                        onMouseLeave={() => setHoveredColIndex(null)}
                        title={count > 0 ? `${count} visit${count !== 1 ? 's' : ''}` : undefined}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
