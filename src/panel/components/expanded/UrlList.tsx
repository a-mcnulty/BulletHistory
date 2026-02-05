import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import type { UrlData } from '@shared/types';
import { UrlItem } from './UrlItem';

const ITEM_HEIGHT = 52; // Approximate height of each URL item
const BUFFER_COUNT = 5; // Extra items to render above/below viewport

interface UrlListProps {
  urls: UrlData[];
  onDeleteUrl?: (url: string) => void;
}

/**
 * Virtualized list of URLs in the expanded view
 * Uses IntersectionObserver for efficient rendering of large lists
 */
export const UrlList = memo(function UrlList({ urls, onDeleteUrl }: UrlListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  // Sort URLs by most recent visit
  const sortedUrls = useMemo(() => {
    return [...urls].sort((a, b) => b.lastVisit - a.lastVisit);
  }, [urls]);

  const totalHeight = sortedUrls.length * ITEM_HEIGHT;

  // Calculate visible range based on scroll position
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_COUNT);
    const endIndex = Math.min(
      sortedUrls.length,
      Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_COUNT
    );

    setVisibleRange((prev) => {
      if (prev.start === startIndex && prev.end === endIndex) {
        return prev;
      }
      return { start: startIndex, end: endIndex };
    });
  }, [sortedUrls.length]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation
    updateVisibleRange();

    container.addEventListener('scroll', updateVisibleRange, { passive: true });
    return () => container.removeEventListener('scroll', updateVisibleRange);
  }, [updateVisibleRange]);

  // Reset scroll position when URLs change significantly
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
      updateVisibleRange();
    }
  }, [urls, updateVisibleRange]);

  if (sortedUrls.length === 0) {
    return (
      <div className="url-list-empty">
        <p>No URLs found</p>
      </div>
    );
  }

  // Get visible items
  const visibleUrls = sortedUrls.slice(visibleRange.start, visibleRange.end);

  return (
    <div className="url-list-container" ref={containerRef}>
      <div
        className="url-list-virtual"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {visibleUrls.map((url, index) => {
          const actualIndex = visibleRange.start + index;
          return (
            <div
              key={`${url.url}-${actualIndex}`}
              className="url-item-wrapper"
              style={{
                position: 'absolute',
                top: actualIndex * ITEM_HEIGHT,
                left: 0,
                right: 0,
                height: ITEM_HEIGHT,
              }}
            >
              <UrlItem
                url={url}
                onDelete={onDeleteUrl}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
