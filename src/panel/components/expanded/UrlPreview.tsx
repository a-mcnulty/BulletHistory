import { memo, useState, useEffect } from 'react';

interface UrlPreviewProps {
  url: string;
  title: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
}

/**
 * URL preview popup shown on hover
 * Attempts to fetch OpenGraph metadata for rich preview
 */
export const UrlPreview = memo(function UrlPreview({
  url,
  title,
  position,
  onClose,
}: UrlPreviewProps) {
  const [ogData, setOgData] = useState<OpenGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchOgData = async () => {
      try {
        // Try to fetch the page and extract OpenGraph data
        // This will often fail due to CORS, so we handle gracefully
        const response = await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
        });

        // no-cors mode returns opaque response, so we can't read it
        // Just show basic info instead
        if (!cancelled) {
          setOgData({ title });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    // Small delay before fetching to avoid unnecessary requests
    const timer = setTimeout(fetchOgData, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, title]);

  // Calculate position to keep preview in viewport
  const previewStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: Math.min(position.y + 20, window.innerHeight - 200),
    zIndex: 1000,
  };

  return (
    <div className="url-preview" style={previewStyle} onMouseLeave={onClose}>
      {loading ? (
        <div className="preview-loading">Loading...</div>
      ) : error ? (
        <div className="preview-error">
          <div className="preview-title">{title}</div>
          <div className="preview-url">{url}</div>
        </div>
      ) : (
        <div className="preview-content">
          {ogData?.image && (
            <img
              className="preview-image"
              src={ogData.image}
              alt=""
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="preview-title">{ogData?.title || title}</div>
          {ogData?.description && (
            <div className="preview-description">{ogData.description}</div>
          )}
          <div className="preview-url">{url}</div>
        </div>
      )}
    </div>
  );
});
