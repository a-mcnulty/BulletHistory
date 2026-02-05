import { useRef, useCallback, useState } from 'react';
import { useHistoryStore } from '../../store';
import { formatHourLabel, formatDateForDisplay } from '@shared/utils/date-utils';

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
  } = useHistoryStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const tldColumnRef = useRef<HTMLDivElement>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  const totalRows = filteredDomains.length;
  const totalHeight = totalRows * ROW_HEIGHT + 11;
  const totalWidth = HOUR_COUNT * COL_WIDTH + 13;

  // Generate hour columns (0-23)
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => {
    const hourStr = `${dateStr}T${i.toString().padStart(2, '0')}`;
    return { index: i, key: hourStr, label: formatHourLabel(i) };
  });

  const syncScroll = useCallback(() => {
    const container = containerRef.current;
    const tldColumn = tldColumnRef.current;
    if (container && tldColumn) {
      tldColumn.scrollTop = container.scrollTop;
    }
  }, []);

  const handleCellClick = useCallback((domain: string, hourKey: string) => {
    openExpandedView('hour', { domain, hour: hourKey });
  }, [openExpandedView]);

  const handleDomainClick = useCallback((domain: string) => {
    openExpandedView('domain', { domain, date: dateStr });
  }, [openExpandedView, dateStr]);

  if (totalRows === 0) {
    return (
      <div className="grid-container">
        <div className="header-section">
          <div className="header-spacer">
            <button className="back-btn" onClick={onBackToDay}>
              &larr; Back
            </button>
            <span className="hour-view-date">{formatDateForDisplay(dateStr)}</span>
          </div>
          <div className="hour-header">
            <div className="hour-header-inner">
              <div className="hour-row">
                {hours.map((h) => (
                  <div key={h.key} className="hour-cell">
                    {h.label}
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
    <div className="grid-container">
      {/* Header Section */}
      <div className="header-section">
        <div className="header-spacer hour-view-header">
          <button className="back-btn" onClick={onBackToDay}>
            &larr; Back
          </button>
          <span className="hour-view-date">{formatDateForDisplay(dateStr)}</span>
        </div>
        <div className="hour-header">
          <div className="hour-header-inner">
            <div className="hour-row">
              {hours.map((h) => (
                <div key={h.key} className="hour-cell">
                  {h.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="main-section">
        {/* TLD Column */}
        <div className="tld-column" ref={tldColumnRef}>
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
            </div>
          ))}
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

              return (
                <div
                  key={domain}
                  className={`cell-row ${hoveredRowIndex === rowIndex ? 'row-hover' : ''}`}
                  style={{
                    position: 'absolute',
                    top: rowIndex * ROW_HEIGHT + 8,
                    left: 0,
                    width: totalWidth,
                  }}
                  onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                  onMouseLeave={() => setHoveredRowIndex(null)}
                >
                  {hours.map((hour) => {
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
                        className={`cell ${count === 0 ? 'empty' : ''}`}
                        style={{
                          position: 'absolute',
                          left: hour.index * COL_WIDTH + 8,
                          backgroundColor,
                        }}
                        onClick={() => count > 0 && handleCellClick(domain, hour.key)}
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
