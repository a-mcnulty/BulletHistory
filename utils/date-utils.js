// utils/date-utils.js — Date and time utility functions

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 * @param {Date} date - The date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
function getTodayISO() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return formatDateISO(today);
}

/**
 * Create an hour string from a Date object (YYYY-MM-DDTHH format)
 * @param {Date} date - The date to format
 * @returns {string} Hour string in YYYY-MM-DDTHH format
 */
function formatHourISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}`;
}

/**
 * Get current hour as ISO string (YYYY-MM-DDTHH format)
 * @returns {string} Current hour in YYYY-MM-DDTHH format
 */
function getCurrentHourISO() {
  return formatHourISO(new Date());
}

/**
 * Parse an hour string (YYYY-MM-DDTHH) into components
 * @param {string} hourStr - Hour string to parse
 * @returns {{dateStr: string, hour: number}} Parsed components
 */
function parseHourString(hourStr) {
  const [dateStr, hourPart] = hourStr.split('T');
  return {
    dateStr,
    hour: parseInt(hourPart, 10)
  };
}

/**
 * Format a date string for display (e.g., "Today", "Yesterday", or "Monday, Dec 23, 2025")
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date for display
 */
function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = formatDateISO(today);
  const yesterdayStr = formatDateISO(yesterday);

  if (dateStr === todayStr) {
    return 'Today';
  } else if (dateStr === yesterdayStr) {
    return 'Yesterday';
  }

  const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format hour as 12-hour time label (e.g., "12a", "1p", "11p")
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {string} Formatted hour label
 */
function formatHourLabel(hour) {
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return `${displayHour}${isPM ? 'p' : 'a'}`;
}

/**
 * Format a duration in milliseconds to a short string (e.g., "5m", "2h", "3d")
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDuration(durationMs) {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format seconds to a display string (e.g., "5m", "2h 30m", "3d 2h")
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 */
function formatSecondsDisplay(seconds) {
  if (seconds >= 86400) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  } else if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp to 12-hour time string (e.g., "6:49pm")
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
function formatTimestamp12Hour(timestamp) {
  const date = new Date(timestamp);
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours24 < 12 ? 'am' : 'pm';
  return `${hours12}:${minutes}${ampm}`;
}

/**
 * Get ordinal suffix for a day number (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} day - Day of month
 * @returns {string} Ordinal suffix
 */
function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Get the start of today as milliseconds timestamp
 * @returns {number} Timestamp of today at midnight
 */
function getTodayStartMs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

// Export functions to global scope for use in browser scripts
window.DateUtils = {
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
  getTodayStartMs
};
