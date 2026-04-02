// utils/time-tracking-utils.js — Pure time tracking logic
// These functions contain no Chrome API dependencies and are independently testable.
// background.js loads this via importScripts() and uses these functions.

/**
 * Check if a URL should be excluded from time tracking
 * @param {string} url
 * @returns {boolean}
 */
function shouldSkipUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url === 'about:blank' ||
         url.startsWith('about:');
}

/**
 * djb2 hash function, returns 8-char hex string
 * @param {string} url
 * @returns {string}
 */
function hashUrlForTime(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Accumulate time into a pending updates object (no I/O).
 * Mutates pendingUpdates and pendingHashes in place.
 *
 * @param {Object} pendingUpdates - { "urlHash:dateStr": { a, o, h: Set } }
 * @param {Object} pendingHashes - { urlHash: url }
 * @param {string} url - The URL to track
 * @param {string} timeType - 'active' or 'open'
 * @param {number} seconds - Seconds to add
 * @param {string} dateStr - Date string 'YYYY-MM-DD'
 * @param {number} currentHour - Hour 0-23
 */
function accumulateTime(pendingUpdates, pendingHashes, url, timeType, seconds, dateStr, currentHour) {
  if (shouldSkipUrl(url) || seconds <= 0) return;

  const urlHash = hashUrlForTime(url);
  const key = `${urlHash}:${dateStr}`;

  if (!pendingHashes[urlHash]) {
    pendingHashes[urlHash] = url;
  }

  if (!pendingUpdates[key]) {
    pendingUpdates[key] = { a: 0, o: 0, h: new Set() };
  }

  if (timeType === 'active') {
    pendingUpdates[key].a += seconds;
  } else if (timeType === 'open') {
    pendingUpdates[key].o += seconds;
  }

  pendingUpdates[key].h.add(currentHour);
}

/**
 * Calculate elapsed seconds between two timestamps.
 * Returns 0 if either timestamp is missing or result is negative.
 *
 * @param {number|null} startMs - Start timestamp in ms
 * @param {number|null} endMs - End timestamp in ms
 * @returns {number} Whole seconds elapsed (floored), minimum 0
 */
function calculateElapsedSeconds(startMs, endMs) {
  if (!startMs || !endMs) return 0;
  const elapsed = Math.floor((endMs - startMs) / 1000);
  return elapsed > 0 ? elapsed : 0;
}

/**
 * Detect whether the time gap since last alarm indicates system sleep.
 *
 * @param {number} lastAlarmTime - Timestamp of last alarm in ms
 * @param {number} now - Current timestamp in ms
 * @param {number} maxGapMs - Maximum expected gap before considering it sleep
 * @returns {boolean} True if the gap suggests system sleep
 */
function isSleepGap(lastAlarmTime, now, maxGapMs) {
  return (now - lastAlarmTime) > maxGapMs;
}

/**
 * Merge pending time updates into existing storage data.
 * Returns new objects (does not mutate inputs).
 *
 * @param {Object} existingTimeData - From storage: { "hash:date": { a, o, h: number[] } }
 * @param {Object} existingHashes - From storage: { hash: url }
 * @param {Object} pendingUpdates - In-memory: { "hash:date": { a, o, h: Set } }
 * @param {Object} pendingHashes - In-memory: { hash: url }
 * @returns {{ urlTimeData: Object, urlHashes: Object }} Merged data ready for storage
 */
function mergeTimeData(existingTimeData, existingHashes, pendingUpdates, pendingHashes) {
  const urlTimeData = { ...existingTimeData };
  const urlHashes = { ...existingHashes };

  // Merge pending URL hashes
  for (const [hash, url] of Object.entries(pendingHashes)) {
    if (!urlHashes[hash]) {
      urlHashes[hash] = url;
    }
  }

  // Merge pending time updates
  for (const [key, update] of Object.entries(pendingUpdates)) {
    if (!urlTimeData[key]) {
      urlTimeData[key] = { a: 0, o: 0, h: [] };
    } else {
      // Clone the entry to avoid mutating the input
      urlTimeData[key] = { ...urlTimeData[key], h: [...(urlTimeData[key].h || [])] };
    }

    urlTimeData[key].a += update.a;
    urlTimeData[key].o += update.o;

    // Merge hours (convert Set to array and merge)
    const existingHours = new Set(urlTimeData[key].h || []);
    for (const hour of update.h) {
      existingHours.add(hour);
    }
    urlTimeData[key].h = Array.from(existingHours).sort((a, b) => a - b);
  }

  return { urlTimeData, urlHashes };
}

/**
 * Prune time data entries older than maxAgeDays.
 * Also removes orphaned hash entries.
 * Returns new objects (does not mutate inputs).
 *
 * @param {Object} urlTimeData - { "hash:YYYY-MM-DD": { a, o, h } }
 * @param {Object} urlHashes - { hash: url }
 * @param {number} maxAgeDays - Maximum age in days
 * @param {Date} referenceDate - The date to compare against (usually "now")
 * @returns {{ urlTimeData: Object, urlHashes: Object, pruned: boolean }}
 */
function pruneOldEntries(urlTimeData, urlHashes, maxAgeDays, referenceDate) {
  const result = { ...urlTimeData };
  const resultHashes = { ...urlHashes };
  let pruned = false;

  const cutoffDate = new Date(referenceDate);
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  for (const key of Object.keys(result)) {
    const colonIdx = key.indexOf(':');
    if (colonIdx === -1) continue;
    const datePart = key.substring(colonIdx + 1);
    if (datePart) {
      const entryDate = new Date(datePart);
      if (entryDate < cutoffDate) {
        delete result[key];
        pruned = true;
      }
    }
  }

  // Clean up orphaned hashes
  const usedHashes = new Set(Object.keys(result).map(key => key.split(':')[0]));
  for (const hash of Object.keys(resultHashes)) {
    if (!usedHashes.has(hash)) {
      delete resultHashes[hash];
      pruned = true;
    }
  }

  return { urlTimeData: result, urlHashes: resultHashes, pruned };
}

/**
 * Read open time from a time data entry, handling backwards compatibility.
 * Old format used 'b' (background seconds), new format uses 'o' (open seconds).
 *
 * @param {Object} entry - { a: number, o?: number, b?: number }
 * @returns {{ active: number, open: number }}
 */
function readTimeEntry(entry) {
  const active = entry.a || 0;
  let open = 0;

  if (entry.o !== undefined) {
    open = entry.o;
  } else if (entry.b !== undefined) {
    open = active + entry.b;
  }

  return { active, open };
}

/**
 * Aggregate time data for a single URL across all dates.
 *
 * @param {Object} urlTimeData - Full time data from storage
 * @param {string} urlHash - The hash of the URL to aggregate
 * @param {string} todayStr - Today's date as 'YYYY-MM-DD'
 * @returns {{ activeSeconds: number, openSeconds: number, activeTodaySeconds: number, openTodaySeconds: number }|null}
 */
function aggregateUrlTime(urlTimeData, urlHash, todayStr) {
  let totalActive = 0;
  let totalOpen = 0;
  let activeToday = 0;
  let openToday = 0;
  const prefix = urlHash + ':';

  for (const key of Object.keys(urlTimeData)) {
    if (key.startsWith(prefix)) {
      const { active, open } = readTimeEntry(urlTimeData[key]);
      totalActive += active;
      totalOpen += open;

      const dateStr = key.substring(prefix.length);
      if (dateStr === todayStr) {
        activeToday = active;
        openToday = open;
      }
    }
  }

  if (totalActive === 0 && totalOpen === 0) return null;

  return {
    activeSeconds: totalActive,
    openSeconds: totalOpen,
    activeTodaySeconds: activeToday,
    openTodaySeconds: openToday
  };
}

// Export to global scope for service worker (importScripts) and panel (script tag)
if (typeof self !== 'undefined') self.TimeTrackingUtils = {
  shouldSkipUrl,
  hashUrlForTime,
  accumulateTime,
  calculateElapsedSeconds,
  isSleepGap,
  mergeTimeData,
  pruneOldEntries,
  readTimeEntry,
  aggregateUrlTime
};
