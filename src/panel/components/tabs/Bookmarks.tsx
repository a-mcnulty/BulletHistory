import { useState, useEffect, useCallback } from 'react';
import { extractDomain, getGoogleFaviconUrl } from '@shared/utils/url-utils';

interface BookmarkItem {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkItem[];
  parentId?: string;
  dateAdded?: number;
}

/**
 * Shows user's bookmarks in a flat list
 */
export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; title: string }[]>([]);

  const loadBookmarks = useCallback(async (folderId?: string) => {
    try {
      setLoading(true);
      let nodes: chrome.bookmarks.BookmarkTreeNode[];

      if (folderId) {
        nodes = await chrome.bookmarks.getChildren(folderId);
      } else {
        const tree = await chrome.bookmarks.getTree();
        // Root has children: [Bookmarks Bar, Other Bookmarks, Mobile Bookmarks]
        nodes = tree[0]?.children || [];
      }

      const items: BookmarkItem[] = nodes.map((node) => ({
        id: node.id,
        title: node.title || 'Untitled',
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded,
      }));

      setBookmarks(items);
      setCurrentFolder(folderId || null);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleItemClick = (item: BookmarkItem) => {
    if (item.url) {
      // Open the URL
      chrome.tabs.create({ url: item.url, active: true });
    } else {
      // Navigate into folder
      setFolderPath((prev) => [...prev, { id: item.id, title: item.title }]);
      loadBookmarks(item.id);
    }
  };

  const handleNavigateUp = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      const parentId = newPath.length > 0 ? newPath[newPath.length - 1].id : undefined;
      loadBookmarks(parentId);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setFolderPath([]);
      loadBookmarks();
    } else {
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      loadBookmarks(newPath[newPath.length - 1].id);
    }
  };

  if (loading) {
    return (
      <div className="tabs-view loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="tabs-view bookmarks-view">
      {/* Breadcrumb navigation */}
      <div className="bookmarks-breadcrumb">
        <span
          className={`breadcrumb-item ${folderPath.length === 0 ? 'active' : ''}`}
          onClick={() => handleBreadcrumbClick(-1)}
        >
          Bookmarks
        </span>
        {folderPath.map((folder, index) => (
          <span key={folder.id}>
            <span className="breadcrumb-separator">/</span>
            <span
              className={`breadcrumb-item ${index === folderPath.length - 1 ? 'active' : ''}`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {folder.title}
            </span>
          </span>
        ))}
      </div>

      {/* Back button when in subfolder */}
      {folderPath.length > 0 && (
        <div className="bookmark-back" onClick={handleNavigateUp}>
          <span className="back-arrow">&larr;</span>
          <span>Back</span>
        </div>
      )}

      {bookmarks.length === 0 ? (
        <div className="tabs-view empty">
          <p>No bookmarks in this folder</p>
        </div>
      ) : (
        <div className="tabs-list">
          {bookmarks.map((item) => {
            const isFolder = !item.url;
            const domain = item.url ? extractDomain(item.url) || '' : '';
            const faviconUrl = item.url && domain ? getGoogleFaviconUrl(domain) : '';

            return (
              <div
                key={item.id}
                className={`tab-item ${isFolder ? 'folder' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                {isFolder ? (
                  <span className="folder-icon">📁</span>
                ) : (
                  <img
                    className="tab-favicon"
                    src={faviconUrl}
                    alt=""
                    width={16}
                    height={16}
                  />
                )}
                <div className="tab-info">
                  <div className="tab-title">{item.title}</div>
                  {!isFolder && <div className="tab-domain">{domain}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
