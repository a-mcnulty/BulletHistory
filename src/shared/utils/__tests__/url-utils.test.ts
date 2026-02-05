import {
  extractDomain,
  isValidUrl,
  getHostname,
  getOrigin,
  hasValidProtocol,
  getFaviconFallbackUrls,
  getGoogleFaviconUrl,
  isValidFaviconUrl,
  hashUrl,
} from '../url-utils';

describe('url-utils', () => {
  describe('extractDomain', () => {
    it('extracts domain from https URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('extracts domain from http URL', () => {
      expect(extractDomain('http://example.com/path')).toBe('example.com');
    });

    it('strips www by default', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
    });

    it('preserves www when stripWww is false', () => {
      expect(extractDomain('https://www.example.com/path', { stripWww: false })).toBe(
        'www.example.com'
      );
    });

    it('returns null for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBeNull();
    });

    it('handles subdomains', () => {
      expect(extractDomain('https://sub.example.com')).toBe('sub.example.com');
    });

    it('handles URLs with port', () => {
      expect(extractDomain('https://example.com:8080/path')).toBe('example.com');
    });
  });

  describe('isValidUrl', () => {
    it('returns true for valid https URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('returns true for valid http URL', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('returns true for file URL', () => {
      expect(isValidUrl('file:///path/to/file')).toBe(true);
    });

    it('returns false for invalid URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('getHostname', () => {
    it('extracts hostname from URL', () => {
      expect(getHostname('https://example.com/path')).toBe('example.com');
    });

    it('preserves www prefix', () => {
      expect(getHostname('https://www.example.com')).toBe('www.example.com');
    });

    it('returns null for invalid URL', () => {
      expect(getHostname('not-a-url')).toBeNull();
    });
  });

  describe('getOrigin', () => {
    it('extracts origin from https URL', () => {
      expect(getOrigin('https://example.com/path')).toBe('https://example.com');
    });

    it('extracts origin from http URL', () => {
      expect(getOrigin('http://example.com/path')).toBe('http://example.com');
    });

    it('excludes port from origin', () => {
      expect(getOrigin('https://example.com:8080/path')).toBe('https://example.com');
    });

    it('returns null for invalid URL', () => {
      expect(getOrigin('not-a-url')).toBeNull();
    });
  });

  describe('hasValidProtocol', () => {
    it('returns true for https', () => {
      expect(hasValidProtocol('https://example.com')).toBe(true);
    });

    it('returns true for http', () => {
      expect(hasValidProtocol('http://example.com')).toBe(true);
    });

    it('returns false for file protocol', () => {
      expect(hasValidProtocol('file:///path')).toBe(false);
    });

    it('returns false for chrome protocol', () => {
      expect(hasValidProtocol('chrome://extensions')).toBe(false);
    });

    it('returns false for invalid URL', () => {
      expect(hasValidProtocol('not-a-url')).toBe(false);
    });
  });

  describe('getFaviconFallbackUrls', () => {
    it('returns array of fallback URLs', () => {
      const urls = getFaviconFallbackUrls('https://example.com/page');
      expect(urls.length).toBeGreaterThan(0);
    });

    it('includes Google favicon service URL first', () => {
      const urls = getFaviconFallbackUrls('https://example.com/page');
      expect(urls[0]).toContain('google.com/s2/favicons');
      expect(urls[0]).toContain('example.com');
    });

    it('includes direct favicon URLs for valid protocol', () => {
      const urls = getFaviconFallbackUrls('https://example.com/page');
      expect(urls).toContain('https://example.com/favicon.ico');
      expect(urls).toContain('https://example.com/favicon.png');
    });

    it('includes DuckDuckGo favicon service', () => {
      const urls = getFaviconFallbackUrls('https://example.com/page');
      expect(urls.some((url) => url.includes('duckduckgo.com'))).toBe(true);
    });

    it('returns empty array for invalid URL', () => {
      expect(getFaviconFallbackUrls('not-a-url')).toEqual([]);
    });
  });

  describe('getGoogleFaviconUrl', () => {
    it('returns Google favicon URL with default size', () => {
      const url = getGoogleFaviconUrl('example.com');
      expect(url).toBe('https://www.google.com/s2/favicons?domain=https://example.com&sz=16');
    });

    it('uses custom size', () => {
      const url = getGoogleFaviconUrl('example.com', 32);
      expect(url).toBe('https://www.google.com/s2/favicons?domain=https://example.com&sz=32');
    });
  });

  describe('isValidFaviconUrl', () => {
    it('returns true for valid https favicon', () => {
      expect(isValidFaviconUrl('https://example.com/favicon.ico')).toBe(true);
    });

    it('returns false for chrome:// URL', () => {
      expect(isValidFaviconUrl('chrome://favicon/size/16@1x/https://example.com')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidFaviconUrl('')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidFaviconUrl(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isValidFaviconUrl(null)).toBe(false);
    });
  });

  describe('hashUrl', () => {
    it('returns 8-character hex string', () => {
      const hash = hashUrl('https://example.com');
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('returns consistent hash for same input', () => {
      const hash1 = hashUrl('https://example.com');
      const hash2 = hashUrl('https://example.com');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
      const hash1 = hashUrl('https://example.com');
      const hash2 = hashUrl('https://different.com');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', () => {
      const hash = hashUrl('');
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('handles long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000);
      const hash = hashUrl(longUrl);
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
