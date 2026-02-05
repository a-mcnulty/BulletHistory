import { create } from 'zustand';
import { historySlice, HistorySlice } from './history-slice';
import { viewSlice, ViewSlice } from './view-slice';

/**
 * Combined store type
 */
export type Store = HistorySlice & ViewSlice;

/**
 * Main Zustand store combining all slices
 * Replaces the BulletHistory class state
 */
export const useHistoryStore = create<Store>()((...args) => ({
  ...historySlice(...args),
  ...viewSlice(...args),
}));

// Export individual slices for use in components
export { type HistorySlice } from './history-slice';
export { type ViewSlice } from './view-slice';
