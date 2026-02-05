import { StateCreator } from 'zustand';
import type { HistoryData, HourlyHistoryData, SortMode } from '@shared/types';

/**
 * History data slice of the store
 * Manages history data, sorted domains, and loading state
 */
export interface HistorySlice {
  // State
  historyData: HistoryData;
  hourlyData: HourlyHistoryData;
  sortedDomains: string[];
  sortMode: SortMode;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchHistory: () => Promise<void>;
  setHistoryData: (data: HistoryData) => void;
  setHourlyData: (data: HourlyHistoryData) => void;
  setSortedDomains: (domains: string[]) => void;
  setSortMode: (mode: SortMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const historySlice: StateCreator<HistorySlice> = (set, get) => ({
  // Initial state
  historyData: {},
  hourlyData: {},
  sortedDomains: [],
  sortMode: 'recent',
  isLoading: true,
  error: null,

  // Actions
  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      // Query Chrome history API
      const endTime = Date.now();
      const startTime = endTime - 90 * 24 * 60 * 60 * 1000; // 90 days

      const historyItems = await chrome.history.search({
        text: '',
        startTime,
        endTime,
        maxResults: 10000,
      });

      // Parse history into domain-based structure
      const historyData: HistoryData = {};

      for (const item of historyItems) {
        if (!item.url || !item.lastVisitTime) continue;

        try {
          const url = new URL(item.url);
          const domain = url.hostname.replace(/^www\./, '');
          const dateStr = new Date(item.lastVisitTime).toISOString().split('T')[0];

          if (!historyData[domain]) {
            historyData[domain] = {
              lastVisit: item.lastVisitTime,
              days: {},
            };
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

      // Sort domains by recent activity
      const sortedDomains = Object.keys(historyData).sort(
        (a, b) => historyData[b].lastVisit - historyData[a].lastVisit
      );

      set({
        historyData,
        sortedDomains,
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
    const { historyData, sortedDomains } = get();
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

    set({ sortedDomains: sorted });
  },
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
});
