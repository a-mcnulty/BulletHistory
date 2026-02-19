import { describe, it, expect } from 'vitest';
import {
  formatDateISO,
  formatHourISO,
  parseHourString,
  formatHourLabel,
  formatDuration,
  formatSecondsDisplay,
  formatTimestamp12Hour,
  getOrdinalSuffix
} from '../utils/date-utils.js';

describe('formatDateISO', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('zero-pads single-digit months and days', () => {
    expect(formatDateISO(new Date(2025, 2, 9))).toBe('2025-03-09');
  });
});

describe('formatHourISO', () => {
  it('formats a date as YYYY-MM-DDTHH', () => {
    const date = new Date(2026, 1, 18, 14, 30);
    expect(formatHourISO(date)).toBe('2026-02-18T14');
  });

  it('zero-pads midnight', () => {
    const date = new Date(2026, 0, 1, 0, 0);
    expect(formatHourISO(date)).toBe('2026-01-01T00');
  });
});

describe('parseHourString', () => {
  it('splits hour string into dateStr and hour number', () => {
    expect(parseHourString('2026-02-18T14')).toEqual({ dateStr: '2026-02-18', hour: 14 });
  });

  it('handles midnight', () => {
    expect(parseHourString('2026-01-01T00')).toEqual({ dateStr: '2026-01-01', hour: 0 });
  });
});

describe('formatHourLabel', () => {
  it('formats midnight as 12a', () => {
    expect(formatHourLabel(0)).toBe('12a');
  });

  it('formats noon as 12p', () => {
    expect(formatHourLabel(12)).toBe('12p');
  });

  it('formats afternoon hours', () => {
    expect(formatHourLabel(14)).toBe('2p');
    expect(formatHourLabel(23)).toBe('11p');
  });

  it('formats morning hours', () => {
    expect(formatHourLabel(1)).toBe('1a');
    expect(formatHourLabel(11)).toBe('11a');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30000)).toBe('30s');
  });

  it('formats minutes', () => {
    expect(formatDuration(300000)).toBe('5m');
  });

  it('formats hours', () => {
    expect(formatDuration(7200000)).toBe('2h');
  });

  it('formats days', () => {
    expect(formatDuration(172800000)).toBe('2d');
  });
});

describe('formatSecondsDisplay', () => {
  it('formats seconds only', () => {
    expect(formatSecondsDisplay(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatSecondsDisplay(90)).toBe('1m 30s');
  });

  it('formats minutes only when no remainder', () => {
    expect(formatSecondsDisplay(120)).toBe('2m');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatSecondsDisplay(4830)).toBe('1h 20m 30s');
  });

  it('formats hours and minutes without seconds', () => {
    expect(formatSecondsDisplay(4800)).toBe('1h 20m');
  });

  it('formats hours only', () => {
    expect(formatSecondsDisplay(3600)).toBe('1h');
  });

  it('formats days, hours, and minutes', () => {
    expect(formatSecondsDisplay(90060)).toBe('1d 1h 1m');
  });

  it('formats days only', () => {
    expect(formatSecondsDisplay(86400)).toBe('1d');
  });
});

describe('formatTimestamp12Hour', () => {
  it('formats AM time', () => {
    const ts = new Date(2026, 1, 18, 6, 49).getTime();
    expect(formatTimestamp12Hour(ts)).toBe('6:49am');
  });

  it('formats PM time', () => {
    const ts = new Date(2026, 1, 18, 14, 5).getTime();
    expect(formatTimestamp12Hour(ts)).toBe('2:05pm');
  });

  it('formats midnight as 12:00am', () => {
    const ts = new Date(2026, 1, 18, 0, 0).getTime();
    expect(formatTimestamp12Hour(ts)).toBe('12:00am');
  });

  it('formats noon as 12:00pm', () => {
    const ts = new Date(2026, 1, 18, 12, 0).getTime();
    expect(formatTimestamp12Hour(ts)).toBe('12:00pm');
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

  it('returns th for teens', () => {
    expect(getOrdinalSuffix(11)).toBe('th');
    expect(getOrdinalSuffix(12)).toBe('th');
    expect(getOrdinalSuffix(13)).toBe('th');
  });

  it('returns th for other numbers', () => {
    expect(getOrdinalSuffix(4)).toBe('th');
    expect(getOrdinalSuffix(15)).toBe('th');
    expect(getOrdinalSuffix(30)).toBe('th');
  });
});
