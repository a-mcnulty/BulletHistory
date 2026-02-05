/**
 * Shared type exports
 */

export * from './history';
export * from './calendar';

/** Tab data for active tabs view */
export interface TabData {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  lastAccessed?: number;
}

/** Closed tab session data */
export interface ClosedTabData {
  tab: {
    url?: string;
    title?: string;
    favIconUrl?: string;
  };
  lastModified: number;
  sessionId?: string;
}

/** Bookmark node data */
export interface BookmarkData {
  id: string;
  parentId?: string;
  index?: number;
  url?: string;
  title: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkData[];
}

/** Open graph data for URL preview */
export interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
}

/** Message types for runtime messaging */
export type MessageType =
  | 'GET_TIME_DATA'
  | 'GET_OPEN_TABS'
  | 'GET_FAVICON_CACHE'
  | 'NEW_VISIT'
  | 'TAB_UPDATED'
  | 'REFRESH_DATA';

/** Runtime message structure */
export interface RuntimeMessage {
  type: MessageType;
  payload?: unknown;
}

/** Background script response */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
