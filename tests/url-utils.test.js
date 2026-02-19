import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  isValidUrl,
  getHostname,
  getOrigin,
  hasValidProtocol,
  getFaviconFallbackUrls,
  getGoogleFaviconUrl,
  isValidFaviconUrl,
  hashUrl
} from '../utils/url-utils.js';

describe('extractDomain', () => {
  it('extracts domain from https URL', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });

  it('strips www by default', () => {
    expect(extractDomain('https://www.example.com/path')).toBe('example.com');
  });

  it('preserves www when stripWww is false', () => {
    expect(extractDomain('https://www.example.com', { stripWww: false })).toBe('www.example.com');
  });

  it('handles subdomains', () => {
    expect(extractDomain('https://blog.example.com')).toBe('blog.example.com');
  });

  it('returns null for invalid URL', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
});

describe('isValidUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('returns false for invalid strings', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('getHostname', () => {
  it('returns hostname preserving www', () => {
    expect(getHostname('https://www.example.com/path')).toBe('www.example.com');
  });

  it('returns hostname without www', () => {
    expect(getHostname('https://example.com')).toBe('example.com');
  });

  it('returns null for invalid URL', () => {
    expect(getHostname('bad')).toBeNull();
  });
});

describe('getOrigin', () => {
  it('returns protocol + hostname', () => {
    expect(getOrigin('https://example.com/path?q=1')).toBe('https://example.com');
  });

  it('returns http origin', () => {
    expect(getOrigin('http://example.com')).toBe('http://example.com');
  });

  it('returns null for invalid URL', () => {
    expect(getOrigin('bad')).toBeNull();
  });
});

describe('hasValidProtocol', () => {
  it('returns true for http and https', () => {
    expect(hasValidProtocol('https://example.com')).toBe(true);
    expect(hasValidProtocol('http://example.com')).toBe(true);
  });

  it('returns false for other protocols', () => {
    expect(hasValidProtocol('ftp://example.com')).toBe(false);
    expect(hasValidProtocol('chrome://settings')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(hasValidProtocol('not a url')).toBe(false);
  });
});

describe('getFaviconFallbackUrls', () => {
  it('returns array of fallback URLs', () => {
    const urls = getFaviconFallbackUrls('https://example.com/page');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toContain('google.com/s2/favicons');
    expect(urls[0]).toContain('example.com');
  });

  it('includes direct favicon paths for http/https URLs', () => {
    const urls = getFaviconFallbackUrls('https://example.com/page');
    expect(urls).toContain('https://example.com/favicon.ico');
    expect(urls).toContain('https://example.com/favicon.png');
  });

  it('ends with duckduckgo fallback', () => {
    const urls = getFaviconFallbackUrls('https://example.com');
    expect(urls[urls.length - 1]).toContain('duckduckgo.com');
  });

  it('returns empty array for invalid URL', () => {
    expect(getFaviconFallbackUrls('bad')).toEqual([]);
  });
});

describe('getGoogleFaviconUrl', () => {
  it('generates correct URL with default size', () => {
    expect(getGoogleFaviconUrl('example.com')).toBe(
      'https://www.google.com/s2/favicons?domain=https://example.com&sz=16'
    );
  });

  it('accepts custom size', () => {
    expect(getGoogleFaviconUrl('example.com', 32)).toContain('sz=32');
  });
});

describe('isValidFaviconUrl', () => {
  it('returns true for valid favicon URLs', () => {
    expect(isValidFaviconUrl('https://example.com/favicon.ico')).toBe(true);
  });

  it('returns false for chrome:// URLs', () => {
    expect(isValidFaviconUrl('chrome://favicon/example.com')).toBe(false);
  });

  it('returns false for empty or null', () => {
    expect(isValidFaviconUrl('')).toBeFalsy();
    expect(isValidFaviconUrl(null)).toBeFalsy();
    expect(isValidFaviconUrl(undefined)).toBeFalsy();
  });
});

describe('hashUrl', () => {
  it('returns 8-character hex string', () => {
    const hash = hashUrl('https://example.com');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns consistent hashes', () => {
    expect(hashUrl('https://example.com')).toBe(hashUrl('https://example.com'));
  });

  it('returns different hashes for different URLs', () => {
    expect(hashUrl('https://example.com')).not.toBe(hashUrl('https://other.com'));
  });
});
