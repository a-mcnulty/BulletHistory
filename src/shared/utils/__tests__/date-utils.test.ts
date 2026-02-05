import {
  formatDateISO,
  getTodayISO,
  formatHourISO,
  getCurrentHourISO,
  parseHourString,
  formatDateForDisplay,
  formatHourLabel,
  formatDuration,
  formatSecondsDisplay,
  formatTimestamp12Hour,
  getOrdinalSuffix,
  getTodayStartMs,
} from '../date-utils';

describe('date-utils', () => {
  describe('formatDateISO', () => {
    it('formats date correctly', () => {
      const date = new Date(2025, 0, 15); // Jan 15, 2025
      expect(formatDateISO(date)).toBe('2025-01-15');
    });

    it('pads single digit month and day', () => {
      const date = new Date(2025, 0, 5); // Jan 5, 2025
      expect(formatDateISO(date)).toBe('2025-01-05');
    });

    it('handles December correctly', () => {
      const date = new Date(2025, 11, 31); // Dec 31, 2025
      expect(formatDateISO(date)).toBe('2025-12-31');
    });
  });

  describe('getTodayISO', () => {
    it('returns today in YYYY-MM-DD format', () => {
      const result = getTodayISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('matches formatDateISO for today', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(getTodayISO()).toBe(formatDateISO(today));
    });
  });

  describe('formatHourISO', () => {
    it('formats hour correctly', () => {
      const date = new Date(2025, 0, 15, 14, 30); // Jan 15, 2025 2:30 PM
      expect(formatHourISO(date)).toBe('2025-01-15T14');
    });

    it('pads single digit hour', () => {
      const date = new Date(2025, 0, 15, 9, 0); // Jan 15, 2025 9:00 AM
      expect(formatHourISO(date)).toBe('2025-01-15T09');
    });

    it('handles midnight correctly', () => {
      const date = new Date(2025, 0, 15, 0, 0);
      expect(formatHourISO(date)).toBe('2025-01-15T00');
    });
  });

  describe('getCurrentHourISO', () => {
    it('returns current hour in YYYY-MM-DDTHH format', () => {
      const result = getCurrentHourISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
    });
  });

  describe('parseHourString', () => {
    it('parses hour string correctly', () => {
      const result = parseHourString('2025-01-15T14');
      expect(result).toEqual({
        dateStr: '2025-01-15',
        hour: 14,
      });
    });

    it('handles midnight', () => {
      const result = parseHourString('2025-01-15T00');
      expect(result).toEqual({
        dateStr: '2025-01-15',
        hour: 0,
      });
    });
  });

  describe('formatDateForDisplay', () => {
    it('returns "Today" for today', () => {
      const todayStr = getTodayISO();
      expect(formatDateForDisplay(todayStr)).toBe('Today');
    });

    it('returns "Yesterday" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateISO(yesterday);
      expect(formatDateForDisplay(yesterdayStr)).toBe('Yesterday');
    });

    it('returns formatted date for other dates', () => {
      // Use a fixed date far in the past
      const result = formatDateForDisplay('2020-12-25');
      expect(result).toContain('2020');
      expect(result).toContain('Dec');
      expect(result).toContain('25');
    });
  });

  describe('formatHourLabel', () => {
    it('formats midnight as 12a', () => {
      expect(formatHourLabel(0)).toBe('12a');
    });

    it('formats morning hours correctly', () => {
      expect(formatHourLabel(1)).toBe('1a');
      expect(formatHourLabel(11)).toBe('11a');
    });

    it('formats noon as 12p', () => {
      expect(formatHourLabel(12)).toBe('12p');
    });

    it('formats afternoon hours correctly', () => {
      expect(formatHourLabel(13)).toBe('1p');
      expect(formatHourLabel(23)).toBe('11p');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('formats minutes', () => {
      expect(formatDuration(60000)).toBe('1m');
      expect(formatDuration(300000)).toBe('5m');
    });

    it('formats hours', () => {
      expect(formatDuration(3600000)).toBe('1h');
      expect(formatDuration(7200000)).toBe('2h');
    });

    it('formats days', () => {
      expect(formatDuration(86400000)).toBe('1d');
      expect(formatDuration(172800000)).toBe('2d');
    });

    it('uses largest unit only', () => {
      expect(formatDuration(90000)).toBe('1m'); // 1.5 minutes -> 1m
      expect(formatDuration(3660000)).toBe('1h'); // 1 hour 1 minute -> 1h
    });
  });

  describe('formatSecondsDisplay', () => {
    it('formats seconds', () => {
      expect(formatSecondsDisplay(30)).toBe('30s');
    });

    it('formats minutes', () => {
      expect(formatSecondsDisplay(120)).toBe('2m');
    });

    it('formats hours with minutes', () => {
      expect(formatSecondsDisplay(3660)).toBe('1h 1m');
      expect(formatSecondsDisplay(3600)).toBe('1h');
    });

    it('formats days with hours', () => {
      expect(formatSecondsDisplay(90000)).toBe('1d 1h');
      expect(formatSecondsDisplay(86400)).toBe('1d');
    });
  });

  describe('formatTimestamp12Hour', () => {
    it('formats AM times correctly', () => {
      const timestamp = new Date(2025, 0, 15, 6, 49).getTime();
      expect(formatTimestamp12Hour(timestamp)).toBe('6:49am');
    });

    it('formats PM times correctly', () => {
      const timestamp = new Date(2025, 0, 15, 18, 30).getTime();
      expect(formatTimestamp12Hour(timestamp)).toBe('6:30pm');
    });

    it('formats noon correctly', () => {
      const timestamp = new Date(2025, 0, 15, 12, 0).getTime();
      expect(formatTimestamp12Hour(timestamp)).toBe('12:00pm');
    });

    it('formats midnight correctly', () => {
      const timestamp = new Date(2025, 0, 15, 0, 5).getTime();
      expect(formatTimestamp12Hour(timestamp)).toBe('12:05am');
    });

    it('pads minutes with zero', () => {
      const timestamp = new Date(2025, 0, 15, 9, 5).getTime();
      expect(formatTimestamp12Hour(timestamp)).toBe('9:05am');
    });
  });

  describe('getOrdinalSuffix', () => {
    it('returns st for 1, 21, 31', () => {
      expect(getOrdinalSuffix(1)).toBe('st');
      expect(getOrdinalSuffix(21)).toBe('st');
      expect(getOrdinalSuffix(31)).toBe('st');
    });

    it('returns nd for 2, 22', () => {
      expect(getOrdinalSuffix(2)).toBe('nd');
      expect(getOrdinalSuffix(22)).toBe('nd');
    });

    it('returns rd for 3, 23', () => {
      expect(getOrdinalSuffix(3)).toBe('rd');
      expect(getOrdinalSuffix(23)).toBe('rd');
    });

    it('returns th for 4-20', () => {
      for (let i = 4; i <= 20; i++) {
        expect(getOrdinalSuffix(i)).toBe('th');
      }
    });

    it('returns th for 11, 12, 13 (special cases)', () => {
      expect(getOrdinalSuffix(11)).toBe('th');
      expect(getOrdinalSuffix(12)).toBe('th');
      expect(getOrdinalSuffix(13)).toBe('th');
    });
  });

  describe('getTodayStartMs', () => {
    it('returns timestamp at midnight', () => {
      const result = getTodayStartMs();
      const date = new Date(result);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
      expect(date.getMilliseconds()).toBe(0);
    });

    it('returns a timestamp from today', () => {
      const result = getTodayStartMs();
      const today = new Date();
      const resultDate = new Date(result);
      expect(resultDate.getFullYear()).toBe(today.getFullYear());
      expect(resultDate.getMonth()).toBe(today.getMonth());
      expect(resultDate.getDate()).toBe(today.getDate());
    });
  });
});
