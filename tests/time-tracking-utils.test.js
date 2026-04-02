import { describe, it, expect } from 'vitest';
import {
  shouldSkipUrl,
  hashUrlForTime,
  accumulateTime,
  calculateElapsedSeconds,
  isSleepGap,
  mergeTimeData,
  pruneOldEntries,
  readTimeEntry,
  aggregateUrlTime
} from '../utils/time-tracking-utils.js';

// ===== shouldSkipUrl =====
// We only want to track time on real websites. Chrome's own internal pages
// (like settings or the new tab page) shouldn't count. This function is the
// bouncer that decides "is this a real website we should care about?"

describe('shouldSkipUrl', () => {
  it('skips null/undefined/empty', () => {
    expect(shouldSkipUrl(null)).toBe(true);
    expect(shouldSkipUrl(undefined)).toBe(true);
    expect(shouldSkipUrl('')).toBe(true);
  });

  it('skips chrome:// URLs', () => {
    expect(shouldSkipUrl('chrome://settings')).toBe(true);
    expect(shouldSkipUrl('chrome://newtab')).toBe(true);
  });

  it('skips chrome-extension:// URLs', () => {
    expect(shouldSkipUrl('chrome-extension://abc123/popup.html')).toBe(true);
  });

  it('skips about: URLs', () => {
    expect(shouldSkipUrl('about:blank')).toBe(true);
    expect(shouldSkipUrl('about:srcdoc')).toBe(true);
  });

  it('allows http/https URLs', () => {
    expect(shouldSkipUrl('https://example.com')).toBe(false);
    expect(shouldSkipUrl('http://localhost:3000')).toBe(false);
  });
});

// ===== hashUrlForTime =====
// URLs can be really long. Instead of using the full URL as a storage key
// (which wastes space), we squish it down into a short 8-character code.
// Think of it like a nickname — "https://www.example.com/really/long/path"
// becomes something like "a1b2c3d4". Same URL always gets the same nickname.

describe('hashUrlForTime', () => {
  it('returns 8-character hex string', () => {
    const hash = hashUrlForTime('https://example.com');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns consistent hashes', () => {
    const url = 'https://example.com/page';
    expect(hashUrlForTime(url)).toBe(hashUrlForTime(url));
  });

  it('returns different hashes for different URLs', () => {
    expect(hashUrlForTime('https://a.com')).not.toBe(hashUrlForTime('https://b.com'));
  });
});

// ===== calculateElapsedSeconds =====
// Given two timestamps (a "start" and an "end"), how many whole seconds passed?
// Like looking at a stopwatch — you pressed start, then you pressed stop,
// how many seconds was that? If something weird happens (no start time,
// or end is before start), just say 0.

describe('calculateElapsedSeconds', () => {
  it('calculates whole seconds between timestamps', () => {
    expect(calculateElapsedSeconds(1000, 61000)).toBe(60);
  });

  it('floors partial seconds', () => {
    expect(calculateElapsedSeconds(1000, 2500)).toBe(1);
    expect(calculateElapsedSeconds(1000, 1999)).toBe(0);
  });

  it('returns 0 for null start', () => {
    expect(calculateElapsedSeconds(null, 5000)).toBe(0);
  });

  it('returns 0 for null end', () => {
    expect(calculateElapsedSeconds(5000, null)).toBe(0);
  });

  it('returns 0 for negative elapsed time', () => {
    expect(calculateElapsedSeconds(5000, 1000)).toBe(0);
  });

  it('returns 0 for equal timestamps', () => {
    expect(calculateElapsedSeconds(5000, 5000)).toBe(0);
  });
});

// ===== accumulateTime =====
// This is the core "tally counter" for time tracking. Every ~60 seconds,
// the background script says "you spent 60 more seconds on this website"
// and this function adds it to a running total kept in memory.
//
// There are two kinds of time:
//   - "active" = you were actually looking at this tab (it was in the foreground)
//   - "open"   = this tab existed at all (even if you were looking at another tab)
//
// The active tab gets BOTH active + open time added (because if you're looking
// at it, it's also open). Background tabs only get open time.
//
// It also remembers WHICH hours of the day you used the site (like "2pm, 3pm")
// so the hour-view grid can show activity in the right columns.

describe('accumulateTime', () => {
  it('accumulates active time for a new URL', () => {
    const pending = {};
    const hashes = {};
    accumulateTime(pending, hashes, 'https://example.com', 'active', 30, '2026-03-01', 14);

    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    expect(pending[key].a).toBe(30);
    expect(pending[key].o).toBe(0);
    expect(pending[key].h.has(14)).toBe(true);
    expect(hashes[hash]).toBe('https://example.com');
  });

  it('accumulates open time for a new URL', () => {
    const pending = {};
    const hashes = {};
    accumulateTime(pending, hashes, 'https://example.com', 'open', 45, '2026-03-01', 10);

    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    expect(pending[key].a).toBe(0);
    expect(pending[key].o).toBe(45);
  });

  it('accumulates both active and open for same URL (like finalizeActiveTabTime does)', () => {
    const pending = {};
    const hashes = {};
    const url = 'https://example.com';

    // This is what finalizeActiveTabTime does: adds same seconds to both
    accumulateTime(pending, hashes, url, 'active', 60, '2026-03-01', 14);
    accumulateTime(pending, hashes, url, 'open', 60, '2026-03-01', 14);

    const hash = hashUrlForTime(url);
    const key = `${hash}:2026-03-01`;

    expect(pending[key].a).toBe(60);
    expect(pending[key].o).toBe(60);
  });

  it('accumulates across multiple calls', () => {
    const pending = {};
    const hashes = {};
    const url = 'https://example.com';
    const hash = hashUrlForTime(url);
    const key = `${hash}:2026-03-01`;

    // Simulate 3 alarm cycles of 60s each
    for (let i = 0; i < 3; i++) {
      accumulateTime(pending, hashes, url, 'active', 60, '2026-03-01', 14);
      accumulateTime(pending, hashes, url, 'open', 60, '2026-03-01', 14);
    }

    expect(pending[key].a).toBe(180);
    expect(pending[key].o).toBe(180);
  });

  it('tracks multiple hours', () => {
    const pending = {};
    const hashes = {};
    const url = 'https://example.com';

    accumulateTime(pending, hashes, url, 'active', 30, '2026-03-01', 14);
    accumulateTime(pending, hashes, url, 'active', 30, '2026-03-01', 15);

    const hash = hashUrlForTime(url);
    const key = `${hash}:2026-03-01`;

    expect(pending[key].h.has(14)).toBe(true);
    expect(pending[key].h.has(15)).toBe(true);
    expect(pending[key].h.size).toBe(2);
  });

  it('skips chrome:// URLs', () => {
    const pending = {};
    const hashes = {};
    accumulateTime(pending, hashes, 'chrome://settings', 'active', 60, '2026-03-01', 14);
    expect(Object.keys(pending)).toHaveLength(0);
  });

  it('skips zero or negative seconds', () => {
    const pending = {};
    const hashes = {};
    accumulateTime(pending, hashes, 'https://example.com', 'active', 0, '2026-03-01', 14);
    accumulateTime(pending, hashes, 'https://example.com', 'active', -5, '2026-03-01', 14);
    expect(Object.keys(pending)).toHaveLength(0);
  });

  it('handles multiple URLs independently', () => {
    const pending = {};
    const hashes = {};

    accumulateTime(pending, hashes, 'https://a.com', 'active', 30, '2026-03-01', 14);
    accumulateTime(pending, hashes, 'https://b.com', 'active', 45, '2026-03-01', 14);

    const hashA = hashUrlForTime('https://a.com');
    const hashB = hashUrlForTime('https://b.com');

    expect(pending[`${hashA}:2026-03-01`].a).toBe(30);
    expect(pending[`${hashB}:2026-03-01`].a).toBe(45);
  });

  it('handles same URL on different dates', () => {
    const pending = {};
    const hashes = {};
    const url = 'https://example.com';
    const hash = hashUrlForTime(url);

    accumulateTime(pending, hashes, url, 'active', 30, '2026-03-01', 14);
    accumulateTime(pending, hashes, url, 'active', 45, '2026-03-02', 10);

    expect(pending[`${hash}:2026-03-01`].a).toBe(30);
    expect(pending[`${hash}:2026-03-02`].a).toBe(45);
  });
});

// ===== isSleepGap =====
// The alarm fires every 60 seconds. If we notice that WAY more time passed
// than expected (like 10 minutes instead of 1 minute), the computer was
// probably asleep. We don't want to count sleeping time as "browsing time",
// so we detect the gap and throw away that chunk.
// The threshold is 5 minutes — anything longer than that = "you were asleep."

describe('isSleepGap', () => {
  const MAX_GAP = 300000; // 5 minutes

  it('returns false for normal alarm interval (~60s)', () => {
    const last = 1000000;
    expect(isSleepGap(last, last + 60000, MAX_GAP)).toBe(false);
  });

  it('returns false for delayed alarm under threshold', () => {
    const last = 1000000;
    expect(isSleepGap(last, last + 299999, MAX_GAP)).toBe(false);
  });

  it('returns false at exactly the threshold', () => {
    const last = 1000000;
    expect(isSleepGap(last, last + MAX_GAP, MAX_GAP)).toBe(false);
  });

  it('returns true just over threshold', () => {
    const last = 1000000;
    expect(isSleepGap(last, last + MAX_GAP + 1, MAX_GAP)).toBe(true);
  });

  it('returns true for long sleep (10 minutes)', () => {
    const last = 1000000;
    expect(isSleepGap(last, last + 600000, MAX_GAP)).toBe(true);
  });
});

// ===== mergeTimeData =====
// Time is tracked in two places:
//   1. In memory (fast, but lost if the browser closes or the service worker restarts)
//   2. In Chrome storage (slow, but permanent)
//
// Every 60 seconds we "merge" — take whatever we've been counting in memory
// and add it to what's already saved in storage. Like emptying coins from
// your pocket into your piggy bank. After merging, the piggy bank (storage)
// has the full total and your pocket (memory) starts fresh.
//
// These tests make sure the adding-up works correctly: that old + new = right total,
// that hours don't get duplicated, and that the original data isn't accidentally changed.

describe('mergeTimeData', () => {
  it('merges pending into empty storage', () => {
    const pending = {};
    const hashes = {};
    accumulateTime(pending, hashes, 'https://example.com', 'active', 60, '2026-03-01', 14);
    accumulateTime(pending, hashes, 'https://example.com', 'open', 60, '2026-03-01', 14);

    const result = mergeTimeData({}, {}, pending, hashes);
    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    expect(result.urlTimeData[key].a).toBe(60);
    expect(result.urlTimeData[key].o).toBe(60);
    expect(result.urlTimeData[key].h).toEqual([14]);
    expect(result.urlHashes[hash]).toBe('https://example.com');
  });

  it('adds pending seconds to existing data', () => {
    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    const existingTimeData = {
      [key]: { a: 100, o: 200, h: [10, 11] }
    };
    const existingHashes = { [hash]: 'https://example.com' };

    const pending = {};
    const pendingH = {};
    accumulateTime(pending, pendingH, 'https://example.com', 'active', 60, '2026-03-01', 14);
    accumulateTime(pending, pendingH, 'https://example.com', 'open', 60, '2026-03-01', 14);

    const result = mergeTimeData(existingTimeData, existingHashes, pending, pendingH);

    expect(result.urlTimeData[key].a).toBe(160);
    expect(result.urlTimeData[key].o).toBe(260);
    expect(result.urlTimeData[key].h).toEqual([10, 11, 14]);
  });

  it('deduplicates hours when merging', () => {
    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    const existingTimeData = {
      [key]: { a: 100, o: 100, h: [14, 15] }
    };

    const pending = {};
    const pendingH = {};
    // Accumulate in hour 14 again (already exists) and hour 16 (new)
    accumulateTime(pending, pendingH, 'https://example.com', 'active', 60, '2026-03-01', 14);
    accumulateTime(pending, pendingH, 'https://example.com', 'active', 30, '2026-03-01', 16);

    const result = mergeTimeData(existingTimeData, {}, pending, pendingH);

    expect(result.urlTimeData[key].h).toEqual([14, 15, 16]);
  });

  it('does not mutate inputs', () => {
    const hash = hashUrlForTime('https://example.com');
    const key = `${hash}:2026-03-01`;

    const existingTimeData = { [key]: { a: 100, o: 100, h: [10] } };
    const existingHashes = { [hash]: 'https://example.com' };

    const pending = {};
    const pendingH = {};
    accumulateTime(pending, pendingH, 'https://example.com', 'active', 60, '2026-03-01', 14);

    mergeTimeData(existingTimeData, existingHashes, pending, pendingH);

    // Original should be unchanged
    expect(existingTimeData[key].a).toBe(100);
  });

  it('preserves existing hashes and does not overwrite', () => {
    const hash = hashUrlForTime('https://example.com');

    const existingHashes = { [hash]: 'https://example.com/original' };
    const pendingH = { [hash]: 'https://example.com/different' };

    const result = mergeTimeData({}, existingHashes, {}, pendingH);

    // Should keep original, not overwrite
    expect(result.urlHashes[hash]).toBe('https://example.com/original');
  });

  it('simulates multiple flush cycles accumulating correctly', () => {
    const url = 'https://example.com';
    const hash = hashUrlForTime(url);
    const key = `${hash}:2026-03-01`;

    let storageTimeData = {};
    let storageHashes = {};

    // Simulate 5 alarm cycles, each accumulating 60s active + 60s open
    for (let cycle = 0; cycle < 5; cycle++) {
      const pending = {};
      const pendingH = {};
      accumulateTime(pending, pendingH, url, 'active', 60, '2026-03-01', 14);
      accumulateTime(pending, pendingH, url, 'open', 60, '2026-03-01', 14);

      const merged = mergeTimeData(storageTimeData, storageHashes, pending, pendingH);
      storageTimeData = merged.urlTimeData;
      storageHashes = merged.urlHashes;
    }

    // 5 cycles * 60s = 300s total
    expect(storageTimeData[key].a).toBe(300);
    expect(storageTimeData[key].o).toBe(300);
  });
});

// ===== pruneOldEntries =====
// Storage can't grow forever. Every 6 hours we clean out time data older
// than 90 days — like throwing away old receipts. If ALL of a URL's data
// gets thrown away, we also remove its hash-to-URL mapping (no point keeping
// a nickname for a URL we have no data about anymore).

describe('pruneOldEntries', () => {
  it('removes entries older than maxAgeDays', () => {
    const hash = hashUrlForTime('https://example.com');
    const urlTimeData = {
      [`${hash}:2025-01-01`]: { a: 100, o: 100, h: [10] },
      [`${hash}:2026-02-28`]: { a: 50, o: 50, h: [14] }
    };
    const urlHashes = { [hash]: 'https://example.com' };

    const result = pruneOldEntries(urlTimeData, urlHashes, 90, new Date('2026-03-01'));

    // Old entry removed, recent entry kept
    expect(result.urlTimeData[`${hash}:2025-01-01`]).toBeUndefined();
    expect(result.urlTimeData[`${hash}:2026-02-28`]).toBeDefined();
    expect(result.pruned).toBe(true);
  });

  it('removes orphaned hashes after pruning all entries', () => {
    const hash = hashUrlForTime('https://old.com');
    const urlTimeData = {
      [`${hash}:2024-06-01`]: { a: 100, o: 100, h: [10] }
    };
    const urlHashes = { [hash]: 'https://old.com' };

    const result = pruneOldEntries(urlTimeData, urlHashes, 90, new Date('2026-03-01'));

    expect(Object.keys(result.urlTimeData)).toHaveLength(0);
    expect(Object.keys(result.urlHashes)).toHaveLength(0);
    expect(result.pruned).toBe(true);
  });

  it('keeps all entries when none are expired', () => {
    const hash = hashUrlForTime('https://example.com');
    const urlTimeData = {
      [`${hash}:2026-02-01`]: { a: 100, o: 100, h: [10] },
      [`${hash}:2026-03-01`]: { a: 50, o: 50, h: [14] }
    };
    const urlHashes = { [hash]: 'https://example.com' };

    const result = pruneOldEntries(urlTimeData, urlHashes, 90, new Date('2026-03-01'));

    expect(Object.keys(result.urlTimeData)).toHaveLength(2);
    expect(result.pruned).toBe(false);
  });

  it('does not mutate inputs', () => {
    const hash = hashUrlForTime('https://example.com');
    const urlTimeData = {
      [`${hash}:2024-01-01`]: { a: 100, o: 100, h: [10] }
    };
    const urlHashes = { [hash]: 'https://example.com' };

    pruneOldEntries(urlTimeData, urlHashes, 90, new Date('2026-03-01'));

    // Original should be unchanged
    expect(urlTimeData[`${hash}:2024-01-01`]).toBeDefined();
    expect(urlHashes[hash]).toBeDefined();
  });
});

// ===== readTimeEntry =====
// The data format changed over time. Old versions stored background time as "b"
// (and you had to add active + background to get total open time). New versions
// just store open time directly as "o". This function reads either format and
// gives you back a simple { active, open } no matter which version the data is.
// Think of it like being able to read both old and new handwriting styles.

describe('readTimeEntry', () => {
  it('reads new format (o field)', () => {
    const result = readTimeEntry({ a: 100, o: 200, h: [10] });
    expect(result.active).toBe(100);
    expect(result.open).toBe(200);
  });

  it('reads old format (b field) as active + background', () => {
    const result = readTimeEntry({ a: 100, b: 50, h: [10] });
    expect(result.active).toBe(100);
    expect(result.open).toBe(150); // active + background
  });

  it('prefers o over b when both present', () => {
    const result = readTimeEntry({ a: 100, o: 200, b: 50, h: [10] });
    expect(result.open).toBe(200); // uses o, not a+b
  });

  it('handles missing active field', () => {
    const result = readTimeEntry({ o: 200, h: [10] });
    expect(result.active).toBe(0);
    expect(result.open).toBe(200);
  });

  it('handles entry with neither o nor b', () => {
    const result = readTimeEntry({ a: 100, h: [10] });
    expect(result.active).toBe(100);
    expect(result.open).toBe(0);
  });

  it('handles o: 0 correctly (explicit zero is not undefined)', () => {
    const result = readTimeEntry({ a: 100, o: 0, h: [10] });
    expect(result.open).toBe(0);
  });
});

// ===== aggregateUrlTime =====
// Storage keeps time data split up by date (one entry per day per URL).
// But when the panel shows "you spent 2 hours on example.com", it needs
// the TOTAL across all days. This function adds up all the daily entries
// for one URL into a single grand total. It also separately tracks
// "how much was today?" so the UI can show both.

describe('aggregateUrlTime', () => {
  const url = 'https://example.com/page';
  const hash = hashUrlForTime(url);

  it('sums time across multiple dates', () => {
    const urlTimeData = {
      [`${hash}:2026-02-28`]: { a: 100, o: 200, h: [10] },
      [`${hash}:2026-03-01`]: { a: 50, o: 80, h: [14] }
    };

    const result = aggregateUrlTime(urlTimeData, hash, '2026-03-01');

    expect(result.activeSeconds).toBe(150);
    expect(result.openSeconds).toBe(280);
    expect(result.activeTodaySeconds).toBe(50);
    expect(result.openTodaySeconds).toBe(80);
  });

  it('returns null when no data exists', () => {
    const result = aggregateUrlTime({}, hash, '2026-03-01');
    expect(result).toBeNull();
  });

  it('returns null when all values are zero', () => {
    const urlTimeData = {
      [`${hash}:2026-03-01`]: { a: 0, o: 0, h: [] }
    };
    const result = aggregateUrlTime(urlTimeData, hash, '2026-03-01');
    expect(result).toBeNull();
  });

  it('ignores entries from other URLs', () => {
    const otherHash = hashUrlForTime('https://other.com');
    const urlTimeData = {
      [`${hash}:2026-03-01`]: { a: 100, o: 100, h: [14] },
      [`${otherHash}:2026-03-01`]: { a: 999, o: 999, h: [14] }
    };

    const result = aggregateUrlTime(urlTimeData, hash, '2026-03-01');

    expect(result.activeSeconds).toBe(100);
    expect(result.openSeconds).toBe(100);
  });

  it('handles backwards-compatible b field in aggregation', () => {
    const urlTimeData = {
      [`${hash}:2026-02-28`]: { a: 100, b: 50, h: [10] }, // old format
      [`${hash}:2026-03-01`]: { a: 60, o: 120, h: [14] }   // new format
    };

    const result = aggregateUrlTime(urlTimeData, hash, '2026-03-01');

    // Old entry: active=100, open=100+50=150
    // New entry: active=60, open=120
    expect(result.activeSeconds).toBe(160);
    expect(result.openSeconds).toBe(270);
  });

  it('sets today fields to 0 when no today entry exists', () => {
    const urlTimeData = {
      [`${hash}:2026-02-28`]: { a: 100, o: 200, h: [10] }
    };

    const result = aggregateUrlTime(urlTimeData, hash, '2026-03-01');

    expect(result.activeTodaySeconds).toBe(0);
    expect(result.openTodaySeconds).toBe(0);
  });
});

// ===== Integration: full accumulate → merge → aggregate cycle =====
// These tests simulate the entire journey of time data, from start to finish:
//   1. Browser counts seconds on a tab (accumulateTime)
//   2. Every 60s, those seconds get saved to storage (mergeTimeData)
//   3. When the panel opens, it reads storage and adds up the totals (aggregateUrlTime)
//
// If any step loses data or miscounts, these tests will catch it.
// The "1 hour of browsing" test is especially important — it simulates
// 60 alarm cycles of 60 seconds each and checks that the final total is 3600s (1 hour).

describe('full time tracking cycle', () => {
  it('data survives accumulate → merge → aggregate', () => {
    const url = 'https://example.com/page';
    const hash = hashUrlForTime(url);

    // Step 1: Accumulate time (simulates what background.js does each alarm)
    const pending = {};
    const pendingH = {};
    accumulateTime(pending, pendingH, url, 'active', 60, '2026-03-01', 14);
    accumulateTime(pending, pendingH, url, 'open', 60, '2026-03-01', 14);

    // Step 2: Merge into storage (simulates flushTimeData)
    const merged = mergeTimeData({}, {}, pending, pendingH);

    // Step 3: Aggregate for display (simulates panel-time.js loadUrlTimeData)
    const aggregated = aggregateUrlTime(merged.urlTimeData, hash, '2026-03-01');

    expect(aggregated.activeSeconds).toBe(60);
    expect(aggregated.openSeconds).toBe(60);
    expect(aggregated.activeTodaySeconds).toBe(60);
    expect(aggregated.openTodaySeconds).toBe(60);
  });

  it('multiple flush cycles accumulate correctly through to aggregation', () => {
    const url = 'https://example.com/page';
    const hash = hashUrlForTime(url);

    let storageTimeData = {};
    let storageHashes = {};

    // Simulate 60 alarm cycles (1 hour of browsing at 60s intervals)
    for (let i = 0; i < 60; i++) {
      const pending = {};
      const pendingH = {};
      const hour = 14 + Math.floor(i / 60); // stays at hour 14
      accumulateTime(pending, pendingH, url, 'active', 60, '2026-03-01', hour);
      accumulateTime(pending, pendingH, url, 'open', 60, '2026-03-01', hour);

      const merged = mergeTimeData(storageTimeData, storageHashes, pending, pendingH);
      storageTimeData = merged.urlTimeData;
      storageHashes = merged.urlHashes;
    }

    const aggregated = aggregateUrlTime(storageTimeData, hash, '2026-03-01');

    // 60 cycles * 60s = 3600s = 1 hour
    expect(aggregated.activeSeconds).toBe(3600);
    expect(aggregated.openSeconds).toBe(3600);
  });

  it('active tab and background tab tracked correctly through merge', () => {
    const activeUrl = 'https://active.com';
    const bgUrl = 'https://background.com';
    const activeHash = hashUrlForTime(activeUrl);
    const bgHash = hashUrlForTime(bgUrl);

    let storageTimeData = {};
    let storageHashes = {};

    // Simulate 5 alarm cycles where activeUrl is focused and bgUrl is in background
    for (let i = 0; i < 5; i++) {
      const pending = {};
      const pendingH = {};

      // Active tab gets both active + open (like finalizeActiveTabTime)
      accumulateTime(pending, pendingH, activeUrl, 'active', 60, '2026-03-01', 14);
      accumulateTime(pending, pendingH, activeUrl, 'open', 60, '2026-03-01', 14);

      // Background tab gets only open (like finalizeOpenTime)
      accumulateTime(pending, pendingH, bgUrl, 'open', 60, '2026-03-01', 14);

      const merged = mergeTimeData(storageTimeData, storageHashes, pending, pendingH);
      storageTimeData = merged.urlTimeData;
      storageHashes = merged.urlHashes;
    }

    const activeAgg = aggregateUrlTime(storageTimeData, activeHash, '2026-03-01');
    const bgAgg = aggregateUrlTime(storageTimeData, bgHash, '2026-03-01');

    // Active: 300s active, 300s open
    expect(activeAgg.activeSeconds).toBe(300);
    expect(activeAgg.openSeconds).toBe(300);

    // Background: 0s active, 300s open
    expect(bgAgg.activeSeconds).toBe(0);
    expect(bgAgg.openSeconds).toBe(300);
  });
});
