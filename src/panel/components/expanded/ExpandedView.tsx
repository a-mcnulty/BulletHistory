import { memo, useMemo, useCallback } from 'react';
import { useHistoryStore } from '../../store';
import { UrlList } from './UrlList';
import { formatDateForDisplay, formatHourLabel } from '@shared/utils/date-utils';
import type { UrlData } from '@shared/types';

interface ExpandedResult {
  title: string;
  urls: UrlData[];
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

/**
 * Expanded view showing URLs for a selected cell/domain/day/hour
 */
export const ExpandedView = memo(function ExpandedView() {
  const {
    isExpandedViewOpen,
    expandedViewType,
    expandedViewData,
    closeExpandedView,
    openExpandedView,
    historyData,
    hourlyData,
    dates,
    fetchHistory,
  } = useHistoryStore();

  // Get URLs based on expanded view type
  const { title, urls, canNavigatePrev, canNavigateNext } = useMemo((): ExpandedResult => {
    if (!expandedViewData) {
      return { title: '', urls: [], canNavigatePrev: false, canNavigateNext: false };
    }

    const { domain, date, hour } = expandedViewData;

    if (expandedViewType === 'cell' && domain && date) {
      // Single cell: domain + date
      const dayData = historyData[domain]?.days[date];
      const dateDisplay = formatDateForDisplay(date);
      const dateIndex = dates.indexOf(date);
      return {
        title: `${domain} - ${dateDisplay}`,
        urls: dayData?.urls || [],
        canNavigatePrev: dateIndex > 0,
        canNavigateNext: dateIndex < dates.length - 1,
      };
    }

    if (expandedViewType === 'domain' && domain) {
      // All URLs for a domain
      const domainData = historyData[domain];
      if (!domainData) return { title: domain, urls: [], canNavigatePrev: false, canNavigateNext: false };

      const allUrls = Object.values(domainData.days).flatMap((day) => day.urls);
      return {
        title: domain,
        urls: allUrls,
        canNavigatePrev: false,
        canNavigateNext: false,
      };
    }

    if (expandedViewType === 'day' && date) {
      // All URLs for a day across all domains
      const dateDisplay = formatDateForDisplay(date);
      const allUrls: UrlData[] = [];
      const dateIndex = dates.indexOf(date);

      for (const domainKey of Object.keys(historyData)) {
        const dayData = historyData[domainKey]?.days[date];
        if (dayData) {
          allUrls.push(...dayData.urls);
        }
      }

      return {
        title: dateDisplay,
        urls: allUrls,
        canNavigatePrev: dateIndex > 0,
        canNavigateNext: dateIndex < dates.length - 1,
      };
    }

    if (expandedViewType === 'hour' && domain && hour) {
      // URLs for a specific hour
      const hourUrls = hourlyData[domain]?.hours[hour] || [];
      const hourNum = parseInt(hour.split('T')[1], 10);
      const dateStr = hour.split('T')[0];
      const dateDisplay = formatDateForDisplay(dateStr);

      return {
        title: `${domain} - ${dateDisplay} ${formatHourLabel(hourNum)}`,
        urls: hourUrls.map((u) => ({
          url: u.url,
          title: u.title,
          lastVisit: u.time,
          visitCount: 1,
          favIconUrl: u.favIconUrl,
        })),
        canNavigatePrev: hourNum > 0,
        canNavigateNext: hourNum < 23,
      };
    }

    return { title: '', urls: [], canNavigatePrev: false, canNavigateNext: false };
  }, [expandedViewType, expandedViewData, historyData, hourlyData, dates]);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!expandedViewData) return;

    const { domain, date, hour } = expandedViewData;

    if (expandedViewType === 'day' && date) {
      const dateIndex = dates.indexOf(date);
      const newIndex = direction === 'prev' ? dateIndex - 1 : dateIndex + 1;
      if (newIndex >= 0 && newIndex < dates.length) {
        openExpandedView('day', { date: dates[newIndex] });
      }
    } else if (expandedViewType === 'cell' && domain && date) {
      const dateIndex = dates.indexOf(date);
      const newIndex = direction === 'prev' ? dateIndex - 1 : dateIndex + 1;
      if (newIndex >= 0 && newIndex < dates.length) {
        openExpandedView('cell', { domain, date: dates[newIndex] });
      }
    } else if (expandedViewType === 'hour' && domain && hour) {
      const hourNum = parseInt(hour.split('T')[1], 10);
      const dateStr = hour.split('T')[0];
      const newHour = direction === 'prev' ? hourNum - 1 : hourNum + 1;
      if (newHour >= 0 && newHour <= 23) {
        const newHourStr = `${dateStr}T${newHour.toString().padStart(2, '0')}`;
        openExpandedView('hour', { domain, hour: newHourStr });
      }
    }
  }, [expandedViewType, expandedViewData, dates, openExpandedView]);

  const handleDeleteUrl = useCallback(async (url: string) => {
    try {
      await chrome.history.deleteUrl({ url });
      // Refresh history data to reflect the deletion
      await fetchHistory();
    } catch (error) {
      console.error('Failed to delete URL:', error);
    }
  }, [fetchHistory]);

  const handleDeleteDomain = useCallback(async () => {
    if (!expandedViewData?.domain) return;

    const domain = expandedViewData.domain;
    const domainData = historyData[domain];
    if (!domainData) return;

    try {
      // Delete all URLs for this domain
      const allUrls = Object.values(domainData.days).flatMap((day) => day.urls);
      for (const urlData of allUrls) {
        await chrome.history.deleteUrl({ url: urlData.url });
      }
      // Refresh and close expanded view
      await fetchHistory();
      closeExpandedView();
    } catch (error) {
      console.error('Failed to delete domain:', error);
    }
  }, [expandedViewData, historyData, fetchHistory, closeExpandedView]);

  if (!isExpandedViewOpen) {
    return null;
  }

  return (
    <div className="expanded-view">
      <div className="expanded-header">
        {(canNavigatePrev || canNavigateNext) && (
          <div className="expanded-nav">
            <button
              className="nav-btn"
              onClick={() => handleNavigate('prev')}
              disabled={!canNavigatePrev}
            >
              ←
            </button>
            <button
              className="nav-btn"
              onClick={() => handleNavigate('next')}
              disabled={!canNavigateNext}
            >
              →
            </button>
          </div>
        )}
        <h2 className="expanded-title">{title}</h2>
        <div className="expanded-meta">
          {urls.length} URL{urls.length !== 1 ? 's' : ''}
        </div>
        {expandedViewType === 'domain' && (
          <button
            className="expanded-delete-domain"
            onClick={handleDeleteDomain}
            title="Delete all history for this domain"
          >
            Delete Domain
          </button>
        )}
        <button className="expanded-close" onClick={closeExpandedView}>
          ×
        </button>
      </div>
      <div className="expanded-content">
        <UrlList urls={urls} onDeleteUrl={handleDeleteUrl} />
      </div>
    </div>
  );
});
