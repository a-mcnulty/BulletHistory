import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { UrlData } from '@shared/types';
import { formatTimestamp12Hour, formatSecondsDisplay } from '@shared/utils/date-utils';
import { getGoogleFaviconUrl, extractDomain } from '@shared/utils/url-utils';
import { useHistoryStore } from '../../store';
import { UrlPreview } from './UrlPreview';

interface UrlItemProps {
  url: UrlData;
  onDelete?: (url: string) => void;
}

/**
 * Single URL item in the expanded view
 * Loads time tracking data on hover (lazy loading)
 */
export const UrlItem = memo(function UrlItem({ url, onDelete }: UrlItemProps) {
  const domain = extractDomain(url.url) || '';
  const time = formatTimestamp12Hour(url.lastVisit);
  const getUrlTimeData = useHistoryStore((state) => state.getUrlTimeData);

  const [timeInfo, setTimeInfo] = useState<{ active: string; open: string } | null>(null);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Check bookmark status on mount
  useEffect(() => {
    const checkBookmark = async () => {
      try {
        const results = await chrome.bookmarks.search({ url: url.url });
        if (results.length > 0) {
          setIsBookmarked(true);
          setBookmarkId(results[0].id);
        }
      } catch (e) {
        // Ignore errors
      }
    };
    checkBookmark();
  }, [url.url]);

  const handleClick = () => {
    chrome.tabs.create({ url: url.url });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(url.url);
    }
  };

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isBookmarked && bookmarkId) {
        await chrome.bookmarks.remove(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
      } else {
        const result = await chrome.bookmarks.create({
          title: url.title || url.url,
          url: url.url,
        });
        setIsBookmarked(true);
        setBookmarkId(result.id);
      }
    } catch (e) {
      console.error('Failed to toggle bookmark:', e);
    }
  };

  // Load time data on hover (lazy loading)
  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    // Load time data
    if (!hasLoadedTime) {
      const data = getUrlTimeData(url.url);
      if (data) {
        setTimeInfo({
          active: formatSecondsDisplay(data.activeTime),
          open: formatSecondsDisplay(data.openTime),
        });
      }
      setHasLoadedTime(true);
    }

    // Start preview timer (show preview after 500ms hover)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPreviewPosition({ x: rect.right, y: rect.top });

    hoverTimerRef.current = window.setTimeout(() => {
      setShowPreview(true);
    }, 500);
  }, [url.url, hasLoadedTime, getUrlTimeData]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowPreview(false);
  }, []);

  return (
    <>
      <div
        ref={itemRef}
        className="url-item"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          className="url-favicon"
          src={getGoogleFaviconUrl(domain)}
          alt=""
          width={16}
          height={16}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="url-info">
          <div className="url-title" title={url.title}>
            {url.title || url.url}
          </div>
          <div className="url-meta">
            <span className="url-time">{time}</span>
            <span className="url-domain">{domain}</span>
            {timeInfo && (
              <span className="url-time-tracking">
                {timeInfo.active !== '0s' && <span className="time-active" title="Active time">{timeInfo.active}</span>}
                {timeInfo.open !== '0s' && <span className="time-open" title="Open time">{timeInfo.open}</span>}
              </span>
            )}
          </div>
        </div>
        <button
          className={`url-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleToggleBookmark}
          title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
        {onDelete && (
          <button
            className="url-delete-btn"
            onClick={handleDelete}
            title="Delete from history"
          >
            ×
          </button>
        )}
      </div>
      {showPreview && (
        <UrlPreview
          url={url.url}
          title={url.title}
          position={previewPosition}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
});
