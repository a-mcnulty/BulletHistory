/**
 * Calendar sync service
 * Handles Google Calendar API integration
 */

import type {
  CalendarEvent,
  CalendarListEntry,
  CalendarAuthState,
  CalendarSettings,
} from '@shared/types';

const CALENDAR_SETTINGS_KEY = 'calendarSettings';
const CALENDAR_CACHE_KEY = 'calendarEventsCache';

interface CalendarEventsCache {
  events: CalendarEvent[];
  fetchedAt: number;
  startDate: string;
  endDate: string;
}

export class CalendarSync {
  private authState: CalendarAuthState = { isAuthenticated: false };

  /**
   * Check if user is authenticated with Google Calendar
   */
  async checkAuth(): Promise<CalendarAuthState> {
    try {
      const result = await chrome.identity.getAuthToken({ interactive: false });
      const token = result?.token;
      if (token) {
        this.authState = {
          isAuthenticated: true,
          token,
        };

        // Get user email
        const response = await fetch(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const userInfo = await response.json();
          this.authState.userEmail = userInfo.email;
        }
      }
    } catch {
      this.authState = { isAuthenticated: false };
    }
    return this.authState;
  }

  /**
   * Authenticate with Google Calendar
   */
  async authenticate(): Promise<CalendarAuthState> {
    try {
      const result = await chrome.identity.getAuthToken({ interactive: true });
      const token = result?.token;
      if (token) {
        this.authState = {
          isAuthenticated: true,
          token,
        };
      }
    } catch (error) {
      console.error('Calendar authentication failed:', error);
      this.authState = { isAuthenticated: false };
    }
    return this.authState;
  }

  /**
   * Sign out from Google Calendar
   */
  async signOut(): Promise<void> {
    if (this.authState.token) {
      await chrome.identity.removeCachedAuthToken({ token: this.authState.token });
    }
    this.authState = { isAuthenticated: false };
  }

  /**
   * Get list of calendars
   */
  async getCalendarList(): Promise<CalendarListEntry[]> {
    if (!this.authState.token) {
      await this.authenticate();
    }

    if (!this.authState.token) {
      return [];
    }

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: { Authorization: `Bearer ${this.authState.token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.status}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to fetch calendar list:', error);
      return [];
    }
  }

  /**
   * Get events for a date range
   */
  async getEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    if (!this.authState.token) {
      await this.authenticate();
    }

    if (!this.authState.token) {
      return [];
    }

    const settings = await this.getSettings();
    if (!settings.enabled || settings.selectedCalendarIds.length === 0) {
      return [];
    }

    const allEvents: CalendarEvent[] = [];

    for (const calendarId of settings.selectedCalendarIds) {
      try {
        const params = new URLSearchParams({
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate + 'T23:59:59').toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
        });

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          {
            headers: { Authorization: `Bearer ${this.authState.token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          allEvents.push(...(data.items || []));
        }
      } catch (error) {
        console.error(`Failed to fetch events for calendar ${calendarId}:`, error);
      }
    }

    return allEvents;
  }

  /**
   * Get calendar settings
   */
  async getSettings(): Promise<CalendarSettings> {
    const result = await chrome.storage.local.get([CALENDAR_SETTINGS_KEY]);
    return result[CALENDAR_SETTINGS_KEY] || {
      enabled: false,
      selectedCalendarIds: [],
      showAllDayEvents: true,
      showDeclinedEvents: false,
    };
  }

  /**
   * Save calendar settings
   */
  async saveSettings(settings: CalendarSettings): Promise<void> {
    await chrome.storage.local.set({ [CALENDAR_SETTINGS_KEY]: settings });
  }

  /**
   * Get cached events
   */
  async getCachedEvents(): Promise<CalendarEventsCache | null> {
    const result = await chrome.storage.local.get([CALENDAR_CACHE_KEY]);
    return result[CALENDAR_CACHE_KEY] || null;
  }

  /**
   * Cache events
   */
  async cacheEvents(events: CalendarEvent[], startDate: string, endDate: string): Promise<void> {
    const cache: CalendarEventsCache = {
      events,
      fetchedAt: Date.now(),
      startDate,
      endDate,
    };
    await chrome.storage.local.set({ [CALENDAR_CACHE_KEY]: cache });
  }
}
