/**
 * URL and domain utility functions
 */

export interface ExtractDomainOptions {
  stripWww?: boolean;
}

/**
 * Extract domain from a URL string
 */
export function extractDomain(url: string, options: ExtractDomainOptions = { stripWww: true }): string | null {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    if (options.stripWww) {
      domain = domain.replace(/^www\./, '');
    }
    return domain;
  } catch {
    return null;
  }
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the hostname from a URL (preserves www if present)
 */
export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Get the origin from a URL (protocol + hostname)
 */
export function getOrigin(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return null;
  }
}

/**
 * Check if a URL has a valid protocol (http or https)
 */
export function hasValidProtocol(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate favicon URLs for a domain in fallback order
 */
export function getFaviconFallbackUrls(url: string): string[] {
  const fallbackUrls: string[] = [];
  const hostname = getHostname(url);

  if (!hostname) {
    return fallbackUrls;
  }

  // Google's favicon service (most reliable)
  fallbackUrls.push(`https://www.google.com/s2/favicons?domain=https://${hostname}&sz=16`);

  if (hasValidProtocol(url)) {
    const origin = getOrigin(url);
    if (origin) {
      fallbackUrls.push(
        `${origin}/favicon.ico`,
        `${origin}/favicon.png`,
        `${origin}/apple-touch-icon.png`
      );
    }
  }

  // DuckDuckGo's favicon service as last resort
  fallbackUrls.push(`https://icons.duckduckgo.com/ip3/${hostname}.ico`);

  return fallbackUrls;
}

/**
 * Get Google favicon service URL for a domain
 */
export function getGoogleFaviconUrl(domain: string, size: number = 16): string {
  return `https://www.google.com/s2/favicons?domain=https://${domain}&sz=${size}`;
}

/**
 * Check if a favicon URL is valid (not a chrome:// URL or empty)
 */
export function isValidFaviconUrl(faviconUrl: string | undefined | null): boolean {
  return Boolean(
    faviconUrl && faviconUrl.length > 0 && !faviconUrl.startsWith('chrome://')
  );
}

/**
 * Hash a URL to a short string (for storage keys)
 * Uses djb2 hash algorithm
 */
export function hashUrl(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Re-export all functions as UrlUtils for backward compatibility
export const UrlUtils = {
  extractDomain,
  isValidUrl,
  getHostname,
  getOrigin,
  hasValidProtocol,
  getFaviconFallbackUrls,
  getGoogleFaviconUrl,
  isValidFaviconUrl,
  hashUrl,
};
