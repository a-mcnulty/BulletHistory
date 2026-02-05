import { StateCreator } from 'zustand';
import type { ViewMode } from '@shared/types';

/**
 * View state slice of the store
 * Manages view mode, expanded view state, and UI settings
 */
export interface ViewSlice {
  // State
  viewMode: ViewMode;
  currentDate: string;
  currentHour: string | null;
  searchQuery: string;
  isExpandedViewOpen: boolean;
  expandedViewType: 'day' | 'hour' | 'domain' | 'full' | null;
  expandedViewData: {
    domain?: string;
    date?: string;
    hour?: string;
  } | null;
  zoomLevel: number;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCurrentDate: (date: string) => void;
  setCurrentHour: (hour: string | null) => void;
  setSearchQuery: (query: string) => void;
  openExpandedView: (
    type: 'day' | 'hour' | 'domain' | 'full',
    data?: { domain?: string; date?: string; hour?: string }
  ) => void;
  closeExpandedView: () => void;
  setZoomLevel: (level: number) => void;
}

export const viewSlice: StateCreator<ViewSlice> = (set) => ({
  // Initial state
  viewMode: 'day',
  currentDate: new Date().toISOString().split('T')[0],
  currentHour: null,
  searchQuery: '',
  isExpandedViewOpen: false,
  expandedViewType: null,
  expandedViewData: null,
  zoomLevel: 1,

  // Actions
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentDate: (date) => set({ currentDate: date }),
  setCurrentHour: (hour) => set({ currentHour: hour }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openExpandedView: (type, data) =>
    set({
      isExpandedViewOpen: true,
      expandedViewType: type,
      expandedViewData: data || null,
    }),
  closeExpandedView: () =>
    set({
      isExpandedViewOpen: false,
      expandedViewType: null,
      expandedViewData: null,
    }),
  setZoomLevel: (level) => set({ zoomLevel: level }),
});
