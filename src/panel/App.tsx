import { useEffect, useState, useCallback, useRef } from 'react';
import { useHistoryStore } from './store';
import { VirtualGrid, HourGrid } from './components/grid';
import { ExpandedView } from './components/expanded';
import { ActiveTabs, RecentlyClosed, Bookmarks } from './components/tabs';
import { CalendarSettings } from './components/calendar';
import { getCalendarSettings } from './services/calendar-api';

type BottomMenuView = 'history' | 'tabs' | 'bookmarks' | 'closed';

/**
 * Main application component
 * Entry point for the panel UI
 */
export default function App() {
  const {
    isLoading,
    error,
    fetchHistory,
    sortedDomains,
    filteredDomains,
    isExpandedViewOpen,
    viewMode,
    currentDate,
    setViewMode,
    setCurrentDate,
    organizeHistoryByHour,
  } = useHistoryStore();
  const [activeView, setActiveView] = useState<BottomMenuView>('history');
  const [expandedHeight, setExpandedHeight] = useState(50); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Load calendar settings on mount
  useEffect(() => {
    getCalendarSettings().then((settings) => {
      setCalendarEnabled(settings.enabled);
    });
  }, []);

  // Listen for live updates from background
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'HISTORY_UPDATED') {
        // Refresh history data when new visits happen
        fetchHistory();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [fetchHistory]);

  // Date change detection - refresh at midnight
  useEffect(() => {
    const checkDateChange = () => {
      const now = new Date();
      const currentDateStr = now.toISOString().split('T')[0];
      const storedDate = sessionStorage.getItem('bulletHistory_currentDate');

      if (storedDate && storedDate !== currentDateStr) {
        // Date has changed, refresh history
        fetchHistory();
      }
      sessionStorage.setItem('bulletHistory_currentDate', currentDateStr);
    };

    // Check immediately
    checkDateChange();

    // Calculate ms until midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set timeout for midnight, then check every minute after
    const midnightTimeout = setTimeout(() => {
      checkDateChange();
      // After midnight, check every minute
      const interval = setInterval(checkDateChange, 60000);
      return () => clearInterval(interval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [fetchHistory]);

  const handleSwitchToHourView = useCallback((dateStr: string) => {
    setCurrentDate(dateStr);
    organizeHistoryByHour(dateStr);
    setViewMode('hour');
  }, [setCurrentDate, organizeHistoryByHour, setViewMode]);

  const handleBackToDayView = useCallback(() => {
    setViewMode('day');
    // Reset filtered domains to show all
    fetchHistory();
  }, [setViewMode, fetchHistory]);

  // Resize handle handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!appRef.current) return;
      const rect = appRef.current.getBoundingClientRect();
      const footerHeight = 44; // app-footer height
      const availableHeight = rect.height - footerHeight;
      const mouseY = e.clientY - rect.top;
      const newExpandedHeight = ((availableHeight - mouseY) / availableHeight) * 100;
      setExpandedHeight(Math.max(20, Math.min(80, newExpandedHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <p>Error loading history: {error}</p>
        <button onClick={() => fetchHistory()}>Retry</button>
      </div>
    );
  }

  const renderHistoryView = () => {
    const contentStyle = isExpandedViewOpen
      ? { flex: `0 0 ${100 - expandedHeight}%` }
      : undefined;
    const expandedStyle = isExpandedViewOpen
      ? { flex: `0 0 ${expandedHeight}%` }
      : undefined;

    if (viewMode === 'hour') {
      return (
        <>
          <div className="app-content" style={contentStyle}>
            <HourGrid dateStr={currentDate} onBackToDay={handleBackToDayView} />
          </div>
          {isExpandedViewOpen && (
            <div
              className={`resize-handle ${isResizing ? 'resizing' : ''}`}
              onMouseDown={handleResizeStart}
            />
          )}
          <div style={expandedStyle}>
            <ExpandedView />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="app-content" style={contentStyle}>
          <VirtualGrid onDateClick={handleSwitchToHourView} />
        </div>
        {isExpandedViewOpen && (
          <div
            className={`resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleResizeStart}
          />
        )}
        <div style={expandedStyle}>
          <ExpandedView />
        </div>
      </>
    );
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'tabs':
        return <ActiveTabs />;
      case 'bookmarks':
        return <Bookmarks />;
      case 'closed':
        return <RecentlyClosed />;
      case 'history':
      default:
        return renderHistoryView();
    }
  };

  return (
    <div className={`app ${isResizing ? 'resizing' : ''}`} ref={appRef}>
      {renderMainContent()}
      <footer className="app-footer">
        <button
          className={`menu-btn ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => setActiveView('history')}
        >
          History
        </button>
        <button
          className={`menu-btn ${activeView === 'tabs' ? 'active' : ''}`}
          onClick={() => setActiveView('tabs')}
        >
          Tabs
        </button>
        <button
          className={`menu-btn ${activeView === 'closed' ? 'active' : ''}`}
          onClick={() => setActiveView('closed')}
        >
          Closed
        </button>
        <button
          className={`menu-btn ${activeView === 'bookmarks' ? 'active' : ''}`}
          onClick={() => setActiveView('bookmarks')}
        >
          Bookmarks
        </button>
        <button
          className={`calendar-btn ${calendarEnabled ? 'connected' : ''}`}
          onClick={() => setShowCalendarSettings(true)}
          style={{ marginLeft: 'auto' }}
        >
          📅 Calendar
        </button>
        <span style={{ color: '#888', fontSize: 11 }}>
          {sortedDomains.length} domains
        </span>
      </footer>
      {showCalendarSettings && (
        <CalendarSettings
          onClose={() => setShowCalendarSettings(false)}
          onSettingsChanged={() => {
            getCalendarSettings().then((settings) => {
              setCalendarEnabled(settings.enabled);
            });
          }}
        />
      )}
    </div>
  );
}
