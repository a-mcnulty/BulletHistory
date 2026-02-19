// utils/url-utils.js — URL and domain utility functions

/**
 * Extract domain from a URL string
 * @param {string} url - The URL to extract domain from
 * @param {Object} options - Options for extraction
 * @param {boolean} options.stripWww - Whether to strip 'www.' prefix (default: true)
 * @returns {string|null} The domain, or null if URL is invalid
 */
function extractDomain(url, options = { stripWww: true }) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    if (options.stripWww) {
      domain = domain.replace(/^www\./, '');
    }
    return domain;
  } catch (e) {
    return null;
  }
}

/**
 * Check if a string is a valid URL
 * @param {string} url - The string to check
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get the hostname from a URL (preserves www if present)
 * @param {string} url - The URL to parse
 * @returns {string|null} The hostname, or null if invalid
 */
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Get the origin from a URL (protocol + hostname + port)
 * @param {string} url - The URL to parse
 * @returns {string|null} The origin, or null if invalid
 */
function getOrigin(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch (e) {
    return null;
  }
}

/**
 * Check if a URL has a valid protocol (http or https)
 * @param {string} url - The URL to check
 * @returns {boolean} True if protocol is http or https
 */
function hasValidProtocol(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Generate favicon URLs for a domain in fallback order
 * @param {string} url - The URL to generate favicon URLs for
 * @returns {string[]} Array of favicon URLs to try in order
 */
function getFaviconFallbackUrls(url) {
  const fallbackUrls = [];
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
 * @param {string} domain - The domain
 * @param {number} size - Icon size (default: 16)
 * @returns {string} Google favicon URL
 */
function getGoogleFaviconUrl(domain, size = 16) {
  return `https://www.google.com/s2/favicons?domain=https://${domain}&sz=${size}`;
}

/**
 * Check if a favicon URL is valid (not a chrome:// URL or empty)
 * @param {string} faviconUrl - The favicon URL to check
 * @returns {boolean} True if valid
 */
function isValidFaviconUrl(faviconUrl) {
  return faviconUrl &&
         faviconUrl.length > 0 &&
         !faviconUrl.startsWith('chrome://');
}

/**
 * Hash a URL to a short string (for storage keys)
 * Uses djb2 hash algorithm
 * @param {string} url - The URL to hash
 * @returns {string} 8-character hex hash
 */
function hashUrl(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Export for testing (Vitest)
export {
  extractDomain, isValidUrl, getHostname, getOrigin, hasValidProtocol,
  getFaviconFallbackUrls, getGoogleFaviconUrl, isValidFaviconUrl, hashUrl
};

// Export functions to global scope for use in browser scripts
if (typeof window !== 'undefined') window.UrlUtils = {
  extractDomain,
  isValidUrl,
  getHostname,
  getOrigin,
  hasValidProtocol,
  getFaviconFallbackUrls,
  getGoogleFaviconUrl,
  isValidFaviconUrl,
  hashUrl
};
