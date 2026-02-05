/**
 * Calendar API service for the panel
 * Communicates with background service for calendar operations
 */

import type {
  CalendarEvent,
  CalendarListEntry,
  CalendarAuthState,
  CalendarSettings,
  DisplayCalendarEvent,
} from '@shared/types';

const CALENDAR_SETTINGS_KEY = 'calendarSettings';

/**
 * Get calendar authentication state
 */
export async function getCalendarAuthState(): Promise<CalendarAuthState> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: false });
    const token = result?.token;
    if (token) {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const userInfo = await response.json();
        return {
          isAuthenticated: true,
          token,
          userEmail: userInfo.email,
        };
      }
    }
  } catch {
    // Auth check failed
  }

  return { isAuthenticated: false };
}

/**
 * Authenticate with Google Calendar
 */
export async function authenticateCalendar(): Promise<CalendarAuthState> {
  try {
    const result = await chrome.identity.getAuthToken({ interactive: true });
    const token = result?.token;
    if (token) {
      return {
        isAuthenticated: true,
        token,
      };
    }
  } catch (error) {
    console.error('Calendar authentication failed:', error);
  }

  return { isAuthenticated: false };
}

/**
 * Sign out from Google Calendar
 */
export async function signOutCalendar(token: string): Promise<void> {
  await chrome.identity.removeCachedAuthToken({ token });
}

/**
 * Get list of user's calendars
 */
export async function getCalendarList(token: string): Promise<CalendarListEntry[]> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${token}` },
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
 * Get calendar events for a date range
 */
export async function getCalendarEvents(
  token: string,
  calendarIds: string[],
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const allEvents: CalendarEvent[] = [];

  for (const calendarId of calendarIds) {
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
          headers: { Authorization: `Bearer ${token}` },
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
 * Get calendar settings from storage
 */
export async function getCalendarSettings(): Promise<CalendarSettings> {
  const result = await chrome.storage.local.get([CALENDAR_SETTINGS_KEY]);
  return result[CALENDAR_SETTINGS_KEY] || {
    enabled: false,
    selectedCalendarIds: [],
    showAllDayEvents: true,
    showDeclinedEvents: false,
  };
}

/**
 * Save calendar settings to storage
 */
export async function saveCalendarSettings(settings: CalendarSettings): Promise<void> {
  await chrome.storage.local.set({ [CALENDAR_SETTINGS_KEY]: settings });
}

/**
 * Transform API calendar event to display format
 */
export function transformCalendarEvent(
  event: CalendarEvent,
  calendarId: string,
  color: string = '#4285f4'
): DisplayCalendarEvent {
  const isAllDay = !event.start.dateTime;

  const startTime = isAllDay
    ? new Date(event.start.date + 'T00:00:00')
    : new Date(event.start.dateTime!);

  const endTime = isAllDay
    ? new Date(event.end.date + 'T23:59:59')
    : new Date(event.end.dateTime!);

  return {
    id: event.id,
    title: event.summary,
    startTime,
    endTime,
    isAllDay,
    color,
    calendarId,
    htmlLink: event.htmlLink,
  };
}

/**
 * Get events for a specific date
 */
export function filterEventsForDate(
  events: DisplayCalendarEvent[],
  dateStr: string
): DisplayCalendarEvent[] {
  const date = new Date(dateStr + 'T00:00:00');
  const nextDate = new Date(dateStr + 'T23:59:59');

  return events.filter((event) => {
    const eventStart = event.startTime.getTime();
    const eventEnd = event.endTime.getTime();
    const dayStart = date.getTime();
    const dayEnd = nextDate.getTime();

    // Event overlaps with this day
    return eventStart <= dayEnd && eventEnd >= dayStart;
  });
}

/**
 * Get events for a specific hour
 */
export function filterEventsForHour(
  events: DisplayCalendarEvent[],
  dateStr: string,
  hour: number
): DisplayCalendarEvent[] {
  const hourStart = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`);
  const hourEnd = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:59:59`);

  return events.filter((event) => {
    if (event.isAllDay) return false;

    const eventStart = event.startTime.getTime();
    const eventEnd = event.endTime.getTime();

    // Event overlaps with this hour
    return eventStart <= hourEnd.getTime() && eventEnd >= hourStart.getTime();
  });
}
