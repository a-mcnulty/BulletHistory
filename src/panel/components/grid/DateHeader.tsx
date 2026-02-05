import { memo, useMemo } from 'react';
import { formatDateISO } from '@shared/utils/date-utils';

interface DateHeaderProps {
  dates: string[];
  todayStr: string;
  hoveredColIndex?: number | null;
  onDateClick?: (dateStr: string) => void;
  onColHover?: (colIndex: number | null) => void;
}

interface MonthSpan {
  label: string;
  width: number;
}

/**
 * Date header showing months, weekdays, and day numbers
 */
export const DateHeader = memo(function DateHeader({
  dates,
  todayStr,
  hoveredColIndex,
  onDateClick,
  onColHover,
}: DateHeaderProps) {
  // Calculate month spans
  const monthSpans = useMemo(() => {
    const spans: MonthSpan[] = [];
    let currentMonth = '';
    let monthSpan = 0;

    dates.forEach((dateStr, index) => {
      const date = new Date(dateStr + 'T00:00:00');
      const monthName = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      const monthYearKey = `${monthName} ${year}`;

      if (monthYearKey !== currentMonth) {
        if (monthSpan > 0) {
          spans.push({
            label: currentMonth,
            width: monthSpan * 21 - 3,
          });
        }
        currentMonth = monthYearKey;
        monthSpan = 1;
      } else {
        monthSpan++;
      }

      // Last month
      if (index === dates.length - 1) {
        spans.push({
          label: currentMonth,
          width: monthSpan * 21 - 3,
        });
      }
    });

    return spans;
  }, [dates]);

  return (
    <div className="date-header-inner">
      {/* Month row */}
      <div className="month-row">
        {monthSpans.map((span, i) => (
          <div
            key={i}
            className="month-cell"
            style={{
              width: span.width,
              minWidth: span.width,
            }}
          >
            {span.label}
          </div>
        ))}
      </div>

      {/* Calendar events row (placeholder) */}
      <div className="calendar-events-row">
        {dates.map((dateStr) => (
          <div
            key={dateStr}
            className={`calendar-event-column ${dateStr === todayStr ? 'col-today' : ''}`}
            data-date={dateStr}
            style={{ height: 0, padding: 0 }}
          />
        ))}
      </div>

      {/* Weekday row */}
      <div className="weekday-row">
        {dates.map((dateStr, index) => {
          const date = new Date(dateStr + 'T00:00:00');
          const weekdayName = date.toLocaleString('en-US', { weekday: 'short' }).charAt(0);

          return (
            <div
              key={dateStr}
              className={`weekday-cell ${dateStr === todayStr ? 'col-today' : ''} ${hoveredColIndex === index ? 'col-hover' : ''}`}
              data-col-index={index}
              data-date={dateStr}
              onClick={() => onDateClick?.(dateStr)}
              onMouseEnter={() => onColHover?.(index)}
              onMouseLeave={() => onColHover?.(null)}
              style={{ cursor: 'pointer' }}
            >
              {weekdayName}
            </div>
          );
        })}
      </div>

      {/* Day row */}
      <div className="day-row">
        {dates.map((dateStr, index) => {
          const date = new Date(dateStr + 'T00:00:00');
          const dayNum = date.getDate();

          return (
            <div
              key={dateStr}
              className={`day-cell ${dateStr === todayStr ? 'col-today' : ''} ${hoveredColIndex === index ? 'col-hover' : ''}`}
              data-col-index={index}
              data-date={dateStr}
              onClick={() => onDateClick?.(dateStr)}
              onMouseEnter={() => onColHover?.(index)}
              onMouseLeave={() => onColHover?.(null)}
              style={{ cursor: 'pointer' }}
            >
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Helper to get today's date string
export function getTodayStr(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return formatDateISO(today);
}
