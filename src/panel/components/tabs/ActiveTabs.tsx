import { useState, useEffect } from 'react';
import { extractDomain, getGoogleFaviconUrl } from '@shared/utils/url-utils';

interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  windowId: number;
}

/**
 * Shows currently open tabs across all windows
 */
export function ActiveTabs() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTabs() {
      try {
        const allTabs = await chrome.tabs.query({});
        const tabInfos: TabInfo[] = allTabs
          .filter((t) => t.id && t.url && !t.url.startsWith('chrome://'))
          .map((t) => ({
            id: t.id!,
            title: t.title || 'Untitled',
            url: t.url!,
            favIconUrl: t.favIconUrl,
            windowId: t.windowId,
          }));
        setTabs(tabInfos);
      } catch (error) {
        console.error('Failed to load tabs:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTabs();
  }, []);

  const handleTabClick = (tab: TabInfo) => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  };

  if (loading) {
    return (
      <div className="tabs-view loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <div className="tabs-view empty">
        <p>No open tabs</p>
      </div>
    );
  }

  return (
    <div className="tabs-view">
      <div className="tabs-header">
        <span className="tabs-count">{tabs.length} open tabs</span>
      </div>
      <div className="tabs-list">
        {tabs.map((tab) => {
          const domain = extractDomain(tab.url) || '';
          const faviconUrl = tab.favIconUrl || getGoogleFaviconUrl(domain);

          return (
            <div
              key={tab.id}
              className="tab-item"
              onClick={() => handleTabClick(tab)}
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
                <div className="tab-domain">{domain}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
