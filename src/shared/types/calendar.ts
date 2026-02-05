/**
 * Google Calendar integration types
 */

/** Calendar event from Google Calendar API */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  htmlLink?: string;
}

/** Calendar list entry from Google Calendar API */
export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  selected?: boolean;
  primary?: boolean;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
}

/** Calendar authentication state */
export interface CalendarAuthState {
  isAuthenticated: boolean;
  userEmail?: string;
  token?: string;
  tokenExpiry?: number;
}

/** Calendar settings stored in extension storage */
export interface CalendarSettings {
  enabled: boolean;
  selectedCalendarIds: string[];
  showAllDayEvents: boolean;
  showDeclinedEvents: boolean;
}

/** Processed calendar event for display */
export interface DisplayCalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  color: string;
  calendarId: string;
  htmlLink?: string;
}
