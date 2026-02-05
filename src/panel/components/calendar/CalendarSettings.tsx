import { useState, useEffect } from 'react';
import type { CalendarListEntry, CalendarSettings as CalendarSettingsType, CalendarAuthState } from '@shared/types';
import {
  getCalendarAuthState,
  authenticateCalendar,
  signOutCalendar,
  getCalendarList,
  getCalendarSettings,
  saveCalendarSettings,
} from '../../services/calendar-api';

interface CalendarSettingsProps {
  onClose: () => void;
  onSettingsChanged: () => void;
}

export function CalendarSettings({ onClose, onSettingsChanged }: CalendarSettingsProps) {
  const [authState, setAuthState] = useState<CalendarAuthState>({ isAuthenticated: false });
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([]);
  const [settings, setSettings] = useState<CalendarSettingsType>({
    enabled: false,
    selectedCalendarIds: [],
    showAllDayEvents: true,
    showDeclinedEvents: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      const auth = await getCalendarAuthState();
      setAuthState(auth);

      if (auth.isAuthenticated && auth.token) {
        const calendarList = await getCalendarList(auth.token);
        setCalendars(calendarList);
      }

      const savedSettings = await getCalendarSettings();
      setSettings(savedSettings);
      setLoading(false);
    }
    initialize();
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    const auth = await authenticateCalendar();
    setAuthState(auth);

    if (auth.isAuthenticated && auth.token) {
      const calendarList = await getCalendarList(auth.token);
      setCalendars(calendarList);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    if (authState.token) {
      await signOutCalendar(authState.token);
    }
    setAuthState({ isAuthenticated: false });
    setCalendars([]);
    setSettings((prev) => ({ ...prev, enabled: false, selectedCalendarIds: [] }));
  };

  const handleToggleEnabled = () => {
    setSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleToggleCalendar = (calendarId: string) => {
    setSettings((prev) => {
      const selected = prev.selectedCalendarIds.includes(calendarId)
        ? prev.selectedCalendarIds.filter((id) => id !== calendarId)
        : [...prev.selectedCalendarIds, calendarId];
      return { ...prev, selectedCalendarIds: selected };
    });
  };

  const handleSave = async () => {
    await saveCalendarSettings(settings);
    onSettingsChanged();
    onClose();
  };

  if (loading) {
    return (
      <div className="calendar-settings-modal">
        <div className="calendar-settings-content">
          <div className="calendar-settings-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-settings-modal" onClick={onClose}>
      <div className="calendar-settings-content" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-settings-header">
          <h3>Calendar Settings</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {!authState.isAuthenticated ? (
          <div className="calendar-auth-section">
            <p>Connect your Google Calendar to see events in the history view.</p>
            <button className="auth-btn" onClick={handleSignIn}>
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            <div className="calendar-user-section">
              <span className="user-email">{authState.userEmail}</span>
              <button className="sign-out-btn" onClick={handleSignOut}>
                Sign out
              </button>
            </div>

            <div className="calendar-toggle-section">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={handleToggleEnabled}
                />
                <span>Show calendar events</span>
              </label>
            </div>

            {settings.enabled && (
              <div className="calendar-list-section">
                <h4>Select calendars:</h4>
                {calendars.length === 0 ? (
                  <p className="no-calendars">No calendars found</p>
                ) : (
                  <div className="calendar-list">
                    {calendars.map((cal) => (
                      <label key={cal.id} className="calendar-item">
                        <input
                          type="checkbox"
                          checked={settings.selectedCalendarIds.includes(cal.id)}
                          onChange={() => handleToggleCalendar(cal.id)}
                        />
                        <span
                          className="calendar-color"
                          style={{ backgroundColor: cal.backgroundColor }}
                        />
                        <span className="calendar-name">{cal.summary}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="calendar-settings-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
