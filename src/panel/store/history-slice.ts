import { StateCreator } from 'zustand';
import type { HistoryData, HourlyHistoryData, SortMode, FaviconCache, TimeDataStore } from '@shared/types';
import { formatDateISO } from '@shared/utils/date-utils';

/**
 * History data slice of the store
 * Manages history data, sorted domains, and loading state
 */
export interface HistorySlice {
  // State
  historyData: HistoryData;
  hourlyData: HourlyHistoryData;
  sortedDomains: string[];
  filteredDomains: string[];
  dates: string[];
  colors: Record<string, string>;
  faviconCache: FaviconCache;
  timeData: TimeDataStore;
  sortMode: SortMode;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchHistory: () => Promise<void>;
  setHistoryData: (data: HistoryData) => void;
  setHourlyData: (data: HourlyHistoryData) => void;
  setSortedDomains: (domains: string[]) => void;
  setSortMode: (mode: SortMode) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  generateColor: (domain: string) => string;
  organizeHistoryByHour: (dateStr: string) => void;
  getFavicon: (domain: string) => string;
  loadTimeData: () => Promise<void>;
  getUrlTimeData: (url: string) => { activeTime: number; openTime: number } | null;
  deleteHistory: (domain: string) => Promise<void>;
}

/**
 * Generate a pastel color based on domain name (deterministic)
 */
function generatePastelColor(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 75%)`;
}

/**
 * Generate date range from earliest history to today + 1 week
 */
function generateDates(historyData: HistoryData): string[] {
  let earliestDate = new Date();
  earliestDate.setHours(0, 0, 0, 0);

  // Find earliest date in history
  for (const domain in historyData) {
    for (const dateStr in historyData[domain].days) {
      const date = new Date(dateStr + 'T00:00:00');
      if (date < earliestDate) earliestDate = date;
    }
  }

  // Latest date: today + 1 week
  const latestDate = new Date();
  latestDate.setHours(0, 0, 0, 0);
  latestDate.setDate(latestDate.getDate() + 7);

  // If no history, show last 30 days
  if (Object.keys(historyData).length === 0) {
    earliestDate = new Date();
    earliestDate.setDate(earliestDate.getDate() - 30);
  }

  // Extend earliest by 1 week
  earliestDate.setDate(earliestDate.getDate() - 7);

  // Generate all dates
  const dates: string[] = [];
  const current = new Date(earliestDate);

  while (current <= latestDate) {
    dates.push(formatDateISO(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export const historySlice: StateCreator<HistorySlice> = (set, get) => ({
  // Initial state
  historyData: {},
  hourlyData: {},
  sortedDomains: [],
  filteredDomains: [],
  dates: [],
  colors: {},
  faviconCache: {},
  timeData: {},
  sortMode: 'recent',
  searchQuery: '',
  isLoading: true,
  error: null,

  // Actions
  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      // Query Chrome history API - last 90 days
      const endTime = Date.now();
      const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

      const historyItems = await chrome.history.search({
        text: '',
        startTime,
        endTime,
        maxResults: 10000,
      });

      // Parse history into domain-based structure
      const historyData: HistoryData = {};
      const colors: Record<string, string> = {};

      for (const item of historyItems) {
        if (!item.url || !item.lastVisitTime) continue;

        try {
          const url = new URL(item.url);
          const domain = url.hostname.replace(/^www\./, '');
          const dateStr = formatDateISO(new Date(item.lastVisitTime));

          if (!historyData[domain]) {
            historyData[domain] = {
              lastVisit: item.lastVisitTime,
              days: {},
            };
            // Generate color for new domain
            colors[domain] = generatePastelColor(domain);
          }

          if (!historyData[domain].days[dateStr]) {
            historyData[domain].days[dateStr] = {
              count: 0,
              urls: [],
            };
          }

          historyData[domain].days[dateStr].count++;
          historyData[domain].days[dateStr].urls.push({
            url: item.url,
            title: item.title || url.pathname,
            lastVisit: item.lastVisitTime,
            visitCount: item.visitCount || 1,
          });

          // Update domain's lastVisit if this is more recent
          if (item.lastVisitTime > historyData[domain].lastVisit) {
            historyData[domain].lastVisit = item.lastVisitTime;
          }
        } catch {
          // Skip invalid URLs
        }
      }

      // Generate dates
      const dates = generateDates(historyData);

      // Sort domains by recent activity
      const sortedDomains = Object.keys(historyData).sort(
        (a, b) => historyData[b].lastVisit - historyData[a].lastVisit
      );

      // Load favicon cache from storage
      let faviconCache: FaviconCache = {};
      try {
        const result = await chrome.storage.local.get(['faviconCache']);
        if (result.faviconCache) {
          faviconCache = result.faviconCache;
        }
      } catch (e) {
        console.error('Failed to load favicon cache:', e);
      }

      // Load time data from background
      let timeData: TimeDataStore = {};
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_TIME_DATA' });
        if (response) {
          timeData = response;
        }
      } catch (e) {
        console.error('Failed to load time data:', e);
      }

      set({
        historyData,
        sortedDomains,
        filteredDomains: sortedDomains,
        dates,
        colors,
        faviconCache,
        timeData,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch history',
        isLoading: false,
      });
    }
  },

  setHistoryData: (data) => set({ historyData: data }),
  setHourlyData: (data) => set({ hourlyData: data }),
  setSortedDomains: (domains) => set({ sortedDomains: domains }),
  setSortMode: (mode) => {
    set({ sortMode: mode });
    // Re-sort domains when mode changes
    const { historyData, sortedDomains, searchQuery } = get();
    let sorted: string[];

    switch (mode) {
      case 'recent':
        sorted = [...sortedDomains].sort(
          (a, b) => historyData[b].lastVisit - historyData[a].lastVisit
        );
        break;
      case 'count':
        sorted = [...sortedDomains].sort((a, b) => {
          const countA = Object.values(historyData[a].days).reduce((sum, d) => sum + d.count, 0);
          const countB = Object.values(historyData[b].days).reduce((sum, d) => sum + d.count, 0);
          return countB - countA;
        });
        break;
      case 'domain':
        sorted = [...sortedDomains].sort((a, b) => a.localeCompare(b));
        break;
      default:
        sorted = sortedDomains;
    }

    // Apply search filter
    const filtered = searchQuery
      ? sorted.filter((d) => d.toLowerCase().includes(searchQuery.toLowerCase()))
      : sorted;

    set({ sortedDomains: sorted, filteredDomains: filtered });
  },
  setSearchQuery: (query) => {
    set({ searchQuery: query });
    const { sortedDomains } = get();
    const filtered = query
      ? sortedDomains.filter((d) => d.toLowerCase().includes(query.toLowerCase()))
      : sortedDomains;
    set({ filteredDomains: filtered });
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  generateColor: (domain) => {
    const { colors } = get();
    if (colors[domain]) return colors[domain];
    const color = generatePastelColor(domain);
    set({ colors: { ...colors, [domain]: color } });
    return color;
  },
  organizeHistoryByHour: (dateStr) => {
    const { historyData, sortedDomains, searchQuery } = get();
    const hourlyData: HourlyHistoryData = {};

    // Filter URLs to the specified date and organize by hour
    for (const domain of sortedDomains) {
      const domainData = historyData[domain];
      if (!domainData) continue;

      const dayData = domainData.days[dateStr];
      if (!dayData) continue;

      hourlyData[domain] = { hours: {} };

      for (const url of dayData.urls) {
        const visitDate = new Date(url.lastVisit);
        const hourKey = `${dateStr}T${visitDate.getHours().toString().padStart(2, '0')}`;

        if (!hourlyData[domain].hours[hourKey]) {
          hourlyData[domain].hours[hourKey] = [];
        }

        hourlyData[domain].hours[hourKey].push({
          url: url.url,
          title: url.title,
          time: url.lastVisit,
          favIconUrl: url.favIconUrl,
        });
      }
    }

    // Filter to only include domains with data for this date
    const domainsWithData = sortedDomains.filter((d) => hourlyData[d] && Object.keys(hourlyData[d].hours).length > 0);

    // Apply search filter
    const filtered = searchQuery
      ? domainsWithData.filter((d) => d.toLowerCase().includes(searchQuery.toLowerCase()))
      : domainsWithData;

    set({ hourlyData, filteredDomains: filtered });
  },
  getFavicon: (domain) => {
    const { faviconCache } = get();
    const entry = faviconCache[domain];
    if (entry?.url) {
      return entry.url;
    }
    // Fallback to Google's favicon service
    return `https://www.google.com/s2/favicons?domain=https://${domain}&sz=16`;
  },
  loadTimeData: async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TIME_DATA' });
      if (response) {
        set({ timeData: response });
      }
    } catch (e) {
      console.error('Failed to load time data:', e);
    }
  },
  getUrlTimeData: (url) => {
    const { timeData } = get();
    // Hash the URL to match background service storage key
    const hashUrl = (str: string): string => {
      let hash = 5381;
      for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };
    const key = hashUrl(url);
    const data = timeData[key];
    if (data) {
      return { activeTime: data.activeTime, openTime: data.openTime };
    }
    return null;
  },
  deleteHistory: async (domain) => {
    const { historyData, sortedDomains, filteredDomains } = get();

    // Delete all URLs for this domain from Chrome history
    try {
      const domainData = historyData[domain];
      if (domainData) {
        for (const dayData of Object.values(domainData.days)) {
          for (const urlData of dayData.urls) {
            await chrome.history.deleteUrl({ url: urlData.url });
          }
        }
      }

      // Update state
      const newHistoryData = { ...historyData };
      delete newHistoryData[domain];

      const newSortedDomains = sortedDomains.filter((d) => d !== domain);
      const newFilteredDomains = filteredDomains.filter((d) => d !== domain);

      set({
        historyData: newHistoryData,
        sortedDomains: newSortedDomains,
        filteredDomains: newFilteredDomains,
      });
    } catch (error) {
      console.error('Failed to delete history for domain:', domain, error);
    }
  },
});
