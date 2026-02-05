import { useState, useEffect } from 'react';
import { extractDomain, getGoogleFaviconUrl } from '@shared/utils/url-utils';

interface ClosedTab {
  sessionId: string;
  title: string;
  url: string;
  favIconUrl?: string;
  lastModified: number;
}

/**
 * Shows recently closed tabs from the current session
 */
export function RecentlyClosed() {
  const [closedTabs, setClosedTabs] = useState<ClosedTab[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClosedTabs() {
      try {
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
        const tabs: ClosedTab[] = [];

        for (const session of sessions) {
          if (session.tab && session.tab.url && !session.tab.url.startsWith('chrome://')) {
            tabs.push({
              sessionId: session.tab.sessionId || String(session.lastModified),
              title: session.tab.title || 'Untitled',
              url: session.tab.url,
              favIconUrl: session.tab.favIconUrl,
              lastModified: session.lastModified || Date.now(),
            });
          }
        }

        setClosedTabs(tabs);
      } catch (error) {
        console.error('Failed to load closed tabs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadClosedTabs();
  }, []);

  const handleRestore = async (tab: ClosedTab) => {
    try {
      await chrome.sessions.restore(tab.sessionId);
      // Remove from list after restoring
      setClosedTabs((prev) => prev.filter((t) => t.sessionId !== tab.sessionId));
    } catch (error) {
      console.error('Failed to restore tab:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp * 1000;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="tabs-view loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (closedTabs.length === 0) {
    return (
      <div className="tabs-view empty">
        <p>No recently closed tabs</p>
      </div>
    );
  }

  return (
    <div className="tabs-view">
      <div className="tabs-header">
        <span className="tabs-count">{closedTabs.length} recently closed</span>
      </div>
      <div className="tabs-list">
        {closedTabs.map((tab) => {
          const domain = extractDomain(tab.url) || '';
          const faviconUrl = tab.favIconUrl || getGoogleFaviconUrl(domain);

          return (
            <div
              key={tab.sessionId}
              className="tab-item"
              onClick={() => handleRestore(tab)}
            >
              <img
                className="tab-favicon"
                src={faviconUrl}
                alt=""
                width={16}
                height={16}
              />
              <div className="tab-info">
                <div className="tab-title">{tab.title}</div>
                <div className="tab-meta">
                  <span className="tab-domain">{domain}</span>
                  <span className="tab-time">{formatTime(tab.lastModified)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
