/**
 * Core history data types
 */

/** Individual URL visit data */
export interface UrlData {
  url: string;
  title: string;
  lastVisit: number;
  visitCount: number;
  favIconUrl?: string;
}

/** Data for a single day within a domain */
export interface DayData {
  count: number;
  urls: UrlData[];
}

/** Domain-level history data */
export interface DomainData {
  lastVisit: number;
  days: Record<string, DayData>;
}

/** Complete history data structure, keyed by domain */
export type HistoryData = Record<string, DomainData>;

/** Hourly organized URL data */
export interface HourlyUrlData {
  url: string;
  title: string;
  time: number;
  favIconUrl?: string;
}

/** Hourly data for a domain */
export interface DomainHourlyData {
  hours: Record<string, HourlyUrlData[]>;
}

/** Complete hourly history data, keyed by domain */
export type HourlyHistoryData = Record<string, DomainHourlyData>;

/** Time tracking data for a URL */
export interface UrlTimeData {
  activeTime: number;
  openTime: number;
  lastUpdated: number;
}

/** Time data storage structure */
export type TimeDataStore = Record<string, UrlTimeData>;

/** Sort mode options */
export type SortMode = 'recent' | 'count' | 'domain' | 'time';

/** View mode options */
export type ViewMode = 'day' | 'hour';

/** Favicon cache entry */
export interface FaviconCacheEntry {
  url: string;
  timestamp: number;
}

/** Favicon cache structure, keyed by domain */
export type FaviconCache = Record<string, FaviconCacheEntry>;
