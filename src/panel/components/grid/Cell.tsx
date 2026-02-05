import { memo, useMemo } from 'react';

interface CellProps {
  domain: string;
  dateStr: string;
  count: number;
  maxCount: number;
  baseColor: string;
  colIndex: number;
  rowIndex: number;
  isToday: boolean;
  onClick?: (domain: string, dateStr: string) => void;
}

/**
 * Get GitHub-style color based on visit count
 * Uses discrete levels like GitHub's contribution graph
 */
function getGitHubStyleColor(count: number, maxCount: number, baseColor: string): string {
  if (count === 0) return '#ebedf0'; // GitHub's empty cell color

  const normalized = count / maxCount;

  // Parse the base HSL color to get the hue
  const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  const hue = hslMatch ? hslMatch[1] : '140'; // Default to green

  // GitHub uses 4 distinct levels
  if (normalized <= 0.25) {
    return `hsl(${hue}, 42%, 86%)`;
  } else if (normalized <= 0.5) {
    return `hsl(${hue}, 50%, 76%)`;
  } else if (normalized <= 0.75) {
    return `hsl(${hue}, 54%, 66%)`;
  } else {
    return `hsl(${hue}, 58%, 60%)`;
  }
}

/**
 * Individual cell in the contribution grid
 */
export const Cell = memo(function Cell({
  domain,
  dateStr,
  count,
  maxCount,
  baseColor,
  colIndex,
  rowIndex,
  isToday,
  onClick,
}: CellProps) {
  const backgroundColor = useMemo(() => {
    if (count === 0) return undefined;
    return getGitHubStyleColor(count, maxCount, baseColor);
  }, [count, maxCount, baseColor]);

  const handleClick = () => {
    if (count > 0 && onClick) {
      onClick(domain, dateStr);
    }
  };

  return (
    <div
      className={`cell ${count === 0 ? 'empty' : ''} ${isToday ? 'col-today' : ''}`}
      data-domain={domain}
      data-date={dateStr}
      data-col-index={colIndex}
      data-row-index={rowIndex}
      data-count={count}
      style={{
        position: 'absolute',
        left: colIndex * 21 + 8,
        backgroundColor,
      }}
      onClick={handleClick}
      title={count > 0 ? `${count} visit${count !== 1 ? 's' : ''}` : undefined}
    />
  );
});
