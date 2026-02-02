// Google Calendar Integration Module
// Handles OAuth authentication, API calls, caching, and data management

class GoogleCalendarService {
  constructor() {
    this.calendarData = {
      events: {},      // { 'YYYY-MM-DD': [event objects] }
      calendars: {},   // { calendarId: { id, name, backgroundColor, enabled } }
      lastSync: null,
      syncToken: null
    };

    this.cache = {
      events: new Map(),      // dateStr -> events[]
      etags: new Map(),       // dateStr -> etag
      lastFetch: new Map()    // dateStr -> timestamp
    };

    this.rateLimiter = new RateLimiter(5); // 5 requests per second
    this.CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    this.EVENT_RETENTION_DAYS = 90;
  }

  // ===== AUTHENTICATION =====

  /**
   * Authenticate user with Google OAuth
   * Uses chrome.identity.getAuthToken for OAuth flow
   */
  async authenticateUser() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });

      if (token) {
        // Get user info to display email
        const userInfo = await this.getUserInfo(token);

        // Save auth state
        await chrome.storage.local.set({
          calendarAuth: {
            enabled: true,
            email: userInfo.email,
            authenticatedAt: Date.now()
          }
        });

        return {
          success: true,
          email: userInfo.email,
          token: token
        };
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current auth token (non-interactive)
   * Returns cached token if available, null otherwise
   */
  async getAuthToken() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (token) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(token);
          }
        });
      });
      return token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuthStatus() {
    const result = await chrome.storage.local.get(['calendarAuth']);
    const authState = result.calendarAuth;

    if (!authState || !authState.enabled) {
      return { authenticated: false };
    }

    // Verify token is still valid
    const token = await this.getAuthToken();
    if (!token) {
      // Token invalid, clear auth state
      await this.revokeToken();
      return { authenticated: false };
    }

    return {
      authenticated: true,
      email: authState.email
    };
  }

  /**
   * Get user profile information
   */
  async getUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  }

  /**
   * Revoke auth token and clear calendar data
   */
  async revokeToken() {
    try {
      const token = await this.getAuthToken();

      if (token) {
        // Remove token from cache
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, () => {
            resolve();
          });
        });

        // Revoke token at Google
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
      }

      // Clear local storage
      await chrome.storage.local.remove(['calendarAuth', 'calendarData', 'calendarCache']);

      // Clear in-memory data
      this.calendarData = {
        events: {},
        calendars: {},
        lastSync: null,
        syncToken: null
      };
      this.cache = {
        events: new Map(),
        etags: new Map(),
        lastFetch: new Map()
      };

      return { success: true };
    } catch (error) {
      console.error('Failed to revoke token:', error);
      return { success: false, error: error.message };
    }
  }

  // ===== CALENDAR API METHODS =====

  /**
   * Fetch user's calendar list
   */
  async fetchCalendarList() {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.rateLimiter.throttle(async () => {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await this.handleAuthError();
        }
        throw new Error(`Failed to fetch calendars: ${response.status}`);
      }

      const data = await response.json();

      // Process and store calendar list
      const calendars = {};
      data.items.forEach(cal => {
        // Preserve existing enabled state if calendar already exists
        const existingCalendar = this.calendarData.calendars[cal.id];
        const enabled = existingCalendar !== undefined
          ? existingCalendar.enabled
          : (cal.selected !== false); // Default to enabled if new calendar

        calendars[cal.id] = {
          id: cal.id,
          name: cal.summary,
          backgroundColor: cal.backgroundColor || '#039BE5',
          foregroundColor: cal.foregroundColor || '#ffffff',
          enabled: enabled
        };
      });

      this.calendarData.calendars = calendars;
      await this.saveCalendarData();

      return calendars;
    });
  }

  /**
   * Fetch events for a specific calendar and date range
   */
  async fetchEvents(calendarId, timeMin, timeMax) {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const params = new URLSearchParams({
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500'
    });

    return await this.rateLimiter.throttle(async () => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          await this.handleAuthError();
        }
        if (response.status === 404) {
          // Calendar not found, remove from list
          delete this.calendarData.calendars[calendarId];
          await this.saveCalendarData();
          return { items: [] };
        }
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      return await response.json();
    });
  }

  /**
   * Batch fetch events from multiple calendars
   */
  async batchFetchEvents(calendarIds, timeMin, timeMax) {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Fetch all calendars in parallel (respecting rate limit)
    const promises = calendarIds.map(calendarId =>
      this.fetchEvents(calendarId, timeMin, timeMax)
        .catch(error => {
          console.warn(`Failed to fetch events for calendar ${calendarId}:`, error);
          return { items: [] };
        })
    );

    const results = await Promise.all(promises);

    // Combine all events
    const allEvents = [];
    results.forEach((result, index) => {
      const calendarId = calendarIds[index];
      const calendar = this.calendarData.calendars[calendarId];

      if (result.items) {
        result.items.forEach(event => {
          allEvents.push({
            ...event,
            calendarId: calendarId,
            calendarName: calendar?.name || calendarId,
            backgroundColor: calendar?.backgroundColor || '#039BE5'
          });
        });
      }
    });

    return allEvents;
  }

  /**
   * Fetch events for a date range and organize by date
   */
  async fetchEventsForDateRange(startDate, endDate) {
    try {
      const authStatus = await this.checkAuthStatus();
      if (!authStatus.authenticated) {
        return;
      }

      // Get enabled calendars
      const enabledCalendars = Object.values(this.calendarData.calendars)
        .filter(cal => cal.enabled)
        .map(cal => cal.id);

      if (enabledCalendars.length === 0) {
        return;
      }

      // Format dates for API
      const timeMin = new Date(startDate);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(endDate);
      timeMax.setHours(23, 59, 59, 999);

      // Fetch events
      const events = await this.batchFetchEvents(
        enabledCalendars,
        timeMin.toISOString(),
        timeMax.toISOString()
      );

      // Clear existing events before organizing new ones
      this.calendarData.events = {};

      // Organize events by date
      this.organizeEventsByDate(events);

      // Save to storage
      await this.saveCalendarData();

      return this.calendarData.events;
    } catch (error) {
      console.error('Failed to fetch events for date range:', error);
      throw error;
    }
  }

  /**
   * Organize events by date in calendarData.events
   */
  organizeEventsByDate(events) {
    events.forEach(event => {
      // Determine if all-day event
      const isAllDay = !event.start.dateTime;

      // Get start date in local timezone (not UTC)
      let startDate;
      if (isAllDay) {
        startDate = event.start.date;
      } else {
        const startDateTime = new Date(event.start.dateTime);
        const year = startDateTime.getFullYear();
        const month = String(startDateTime.getMonth() + 1).padStart(2, '0');
        const day = String(startDateTime.getDate()).padStart(2, '0');
        startDate = `${year}-${month}-${day}`;
      }

      // Initialize date array if needed
      if (!this.calendarData.events[startDate]) {
        this.calendarData.events[startDate] = [];
      }

      // Add processed event
      this.calendarData.events[startDate].push({
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        htmlLink: event.htmlLink,
        colorId: event.colorId,
        backgroundColor: event.backgroundColor,
        calendarId: event.calendarId,
        calendarName: event.calendarName,
        isAllDay: isAllDay,
        attendees: event.attendees
      });
    });
  }

  // ===== CACHING & STORAGE =====

  /**
   * Save calendar data to chrome.storage.local
   */
  async saveCalendarData() {
    try {
      await chrome.storage.local.set({
        calendarData: this.calendarData,
        calendarCacheTimestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to save calendar data:', error);
    }
  }

  /**
   * Load calendar data from chrome.storage.local
   */
  async loadCalendarData() {
    try {
      const result = await chrome.storage.local.get(['calendarData', 'calendarCacheTimestamp']);

      if (result.calendarData) {
        this.calendarData = result.calendarData;
      }
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    }
  }

  /**
   * Clear old events from cache
   */
  pruneOldEvents() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.EVENT_RETENTION_DAYS);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const dates = Object.keys(this.calendarData.events);
    dates.forEach(dateStr => {
      if (dateStr < cutoffStr) {
        delete this.calendarData.events[dateStr];
      }
    });
  }

  // ===== UTILITY METHODS =====

  /**
   * Handle authentication errors
   */
  async handleAuthError() {
    console.warn('Authentication error, clearing token');
    await this.revokeToken();
  }

  /**
   * Get events for a specific date
   */
  getEventsForDate(dateStr) {
    return this.calendarData.events[dateStr] || [];
  }

  /**
   * Check if calendar feature is enabled
   */
  async isCalendarEnabled() {
    const authStatus = await this.checkAuthStatus();
    return authStatus.authenticated;
  }

  /**
   * Toggle calendar enabled/disabled state
   */
  async toggleCalendar(calendarId, enabled) {
    if (this.calendarData.calendars[calendarId]) {
      this.calendarData.calendars[calendarId].enabled = enabled;
      await this.saveCalendarData();
    }
  }
}

// ===== RATE LIMITER CLASS =====

class RateLimiter {
  constructor(maxPerSecond = 5) {
    this.maxPerSecond = maxPerSecond;
    this.queue = [];
    this.processing = false;
  }

  async throttle(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    }

    setTimeout(() => {
      this.processing = false;
      this.process();
    }, 1000 / this.maxPerSecond);
  }
}

// Export singleton instance
const googleCalendar = new GoogleCalendarService();
