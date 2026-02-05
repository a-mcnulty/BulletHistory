import { memo, useMemo } from 'react';
import { Cell } from './Cell';
import type { DomainData } from '@shared/types';
import { getGoogleFaviconUrl } from '@shared/utils/url-utils';

interface DomainRowProps {
  domain: string;
  domainData: DomainData;
  dates: string[];
  color: string;
  rowIndex: number;
  startCol: number;
  endCol: number;
  todayStr: string;
  rowHeight: number;
  totalCols: number;
  onCellClick?: (domain: string, dateStr: string) => void;
  onDomainClick?: (domain: string) => void;
}

/**
 * A single row in the grid (TLD label + cells)
 */
export const DomainRow = memo(function DomainRow({
  domain,
  domainData,
  dates,
  color,
  rowIndex,
  startCol,
  endCol,
  todayStr,
  rowHeight,
  totalCols,
  onCellClick,
  onDomainClick,
}: DomainRowProps) {
  // Pre-compute max count for this domain
  const maxCount = useMemo(() => {
    let max = 0;
    for (const dateStr of Object.keys(domainData.days)) {
      const count = domainData.days[dateStr].count;
      if (count > max) max = count;
    }
    return max || 1;
  }, [domainData]);

  const handleDomainClick = () => {
    if (onDomainClick) {
      onDomainClick(domain);
    }
  };

  const todayIndex = dates.indexOf(todayStr);

  return (
    <>
      {/* TLD Label Row */}
      <div
        className="tld-row"
        data-row-index={rowIndex}
        style={{
          position: 'absolute',
          top: rowIndex * rowHeight + 8,
          width: '100%',
        }}
        onClick={handleDomainClick}
      >
        <img
          className="tld-favicon"
          src={getGoogleFaviconUrl(domain)}
          alt=""
          width={16}
          height={16}
          onError={(e) => {
            // Hide broken favicon
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="tld-name">{domain}</span>
      </div>

      {/* Cell Row */}
      <div
        className={`cell-row ${todayIndex !== -1 ? 'has-today-col' : ''}`}
        data-row-index={rowIndex}
        style={{
          position: 'absolute',
          top: rowIndex * rowHeight + 8,
          left: 0,
          width: totalCols * 21 + 13,
          ['--today-col-left' as string]: todayIndex !== -1 ? `${todayIndex * 21 + 8 - 1}px` : undefined,
        }}
      >
        {/* Render visible cells */}
        {Array.from({ length: endCol - startCol }, (_, i) => {
          const colIndex = startCol + i;
          const dateStr = dates[colIndex];
          if (!dateStr) return null;

          const dayData = domainData.days[dateStr];
          const count = dayData?.count || 0;

          return (
            <Cell
              key={dateStr}
              domain={domain}
              dateStr={dateStr}
              count={count}
              maxCount={maxCount}
              baseColor={color}
              colIndex={colIndex}
              rowIndex={rowIndex}
              isToday={dateStr === todayStr}
              onClick={onCellClick}
            />
          );
        })}
      </div>
    </>
  );
});
