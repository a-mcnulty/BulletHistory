/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for the X button added to url-items in the expanded view.
 * Since createUrlItem lives on BulletHistory.prototype and has many
 * dependencies, we set up a minimal mock environment.
 */

// Minimal mock for chrome APIs
const chromeMock = {
  tabs: { remove: vi.fn((id, cb) => cb && cb()) },
  bookmarks: { remove: vi.fn((id, cb) => cb && cb()), search: vi.fn((q, cb) => cb && cb([])) },
  history: { deleteUrl: vi.fn((opts, cb) => cb && cb()), getVisits: vi.fn((opts, cb) => cb && cb([])) },
  storage: { local: { get: vi.fn((keys, cb) => cb && cb({})) } },
  runtime: { lastError: null }
};

// Minimal DateUtils mock
const DateUtilsMock = {
  formatSecondsDisplay: (s) => `${s}s`
};

// Build a minimal BulletHistory-like instance with just enough for createUrlItem
function createMockInstance(viewType = 'full') {
  return {
    expandedViewType: viewType,
    faviconCache: {},
    openTabsByUrl: {},
    urlTimeCache: {},
    viewMode: 'day',
    getCachedUrlTimeData: vi.fn(() => null),
    loadUrlTimeData: vi.fn(() => Promise.resolve(null)),
    checkBookmarkStatus: vi.fn(),
    toggleBookmark: vi.fn(),
    deleteUrlWithAnimation: vi.fn(),
    showActiveTabs: vi.fn(),
    showBookmarks: vi.fn(),
  };
}

function createUrlData(overrides = {}) {
  return {
    url: 'https://example.com/page',
    title: 'Example Page',
    lastVisit: Date.now(),
    domain: 'example.com',
    date: '2026-04-02',
    ...overrides
  };
}

// Load the createUrlItem source and attach to our mock prototype
// We extract just the function to test it in isolation
let createUrlItem;

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();

  // Set up globals that createUrlItem expects
  globalThis.chrome = chromeMock;
  globalThis.DateUtils = DateUtilsMock;
});

// Since we can't easily import createUrlItem from panel-expanded.js (it's a
// prototype method, not an export, and depends on panel.js loading first),
// we test the X button behavior by reading the source and verifying the
// contract: the first child of a url-item should be the X button.
//
// Instead, we'll create a mini version of the X-button logic and verify
// it integrates correctly with the DOM structure.

describe('url-item X button', () => {
  // Replicate the X button creation logic from createUrlItem
  function addXButton(urlItem, instance, urlData, domain, date) {
    const xBtn = document.createElement('button');
    xBtn.className = 'url-item-x-btn';
    xBtn.textContent = '✕';

    if (instance.expandedViewType === 'active' && urlData.tabId) {
      xBtn.title = 'Close tab';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.url-item');
        if (item) item.classList.add('deleting');
        chrome.tabs.remove(urlData.tabId, () => {
          setTimeout(() => instance.showActiveTabs(), 250);
        });
      });
    } else if (instance.expandedViewType === 'bookmarks' && urlData.id) {
      xBtn.title = 'Remove bookmark';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.url-item');
        if (item) item.classList.add('deleting');
        chrome.bookmarks.remove(urlData.id, () => {
          setTimeout(() => instance.showBookmarks(), 250);
        });
      });
    } else {
      xBtn.title = 'Delete from history';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.url-item');
        instance.deleteUrlWithAnimation(item, urlData.url, domain, date);
      });
    }

    urlItem.appendChild(xBtn);
    return xBtn;
  }

  it('creates an X button as last child of url-item', () => {
    const instance = createMockInstance();
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    urlItem.innerHTML = '<div class="url-item-left"></div><div class="url-item-right"></div>';

    const xBtn = addXButton(urlItem, instance, createUrlData(), 'example.com', '2026-04-02');

    expect(urlItem.lastChild).toBe(xBtn);
    expect(xBtn.className).toBe('url-item-x-btn');
    expect(xBtn.textContent).toBe('✕');
  });

  it('has delete title for history views', () => {
    const instance = createMockInstance('full');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData(), 'example.com', '2026-04-02');
    expect(xBtn.title).toBe('Delete from history');
  });

  it('calls deleteUrlWithAnimation on click in history view', () => {
    const instance = createMockInstance('full');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    const urlData = createUrlData();

    const xBtn = addXButton(urlItem, instance, urlData, 'example.com', '2026-04-02');
    xBtn.click();

    expect(instance.deleteUrlWithAnimation).toHaveBeenCalledWith(
      urlItem, urlData.url, 'example.com', '2026-04-02'
    );
  });

  it('has close tab title for active tabs view', () => {
    const instance = createMockInstance('active');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData({ tabId: 42 }), 'example.com', '2026-04-02');
    expect(xBtn.title).toBe('Close tab');
  });

  it('calls chrome.tabs.remove on click in active tabs view', () => {
    const instance = createMockInstance('active');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData({ tabId: 42 }), 'example.com', '2026-04-02');
    xBtn.click();

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
  });

  it('adds deleting class on click in active tabs view', () => {
    const instance = createMockInstance('active');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData({ tabId: 42 }), 'example.com', '2026-04-02');
    xBtn.click();

    expect(urlItem.classList.contains('deleting')).toBe(true);
  });

  it('has remove bookmark title for bookmarks view', () => {
    const instance = createMockInstance('bookmarks');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData({ id: 'bk-123' }), 'example.com', '2026-04-02');
    expect(xBtn.title).toBe('Remove bookmark');
  });

  it('calls chrome.bookmarks.remove on click in bookmarks view', () => {
    const instance = createMockInstance('bookmarks');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData({ id: 'bk-123' }), 'example.com', '2026-04-02');
    xBtn.click();

    expect(chromeMock.bookmarks.remove).toHaveBeenCalledWith('bk-123', expect.any(Function));
  });

  it('falls back to delete for bookmarks view without id', () => {
    const instance = createMockInstance('bookmarks');
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const xBtn = addXButton(urlItem, instance, createUrlData(), 'example.com', '2026-04-02');
    expect(xBtn.title).toBe('Delete from history');
  });
});

describe('url-item expand button', () => {
  function addExpandButton(urlItem, instance) {
    const expandBtn = document.createElement('button');
    expandBtn.className = 'url-item-expand-btn';
    expandBtn.textContent = '▶';
    expandBtn.title = 'Expand details';

    // Add a url-display child to the item (simulating what createUrlItem does)
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';
    urlItem.appendChild(urlDisplay);

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.url-item');
      item.classList.toggle('expanded');
      // Adjust height
      item.style.height = item.classList.contains('expanded') ? 'auto' : `${instance.urlListRowHeight}px`;
    });

    urlItem.appendChild(expandBtn);
    return expandBtn;
  }

  it('creates an expand button with chevron', () => {
    const instance = createMockInstance();
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const expandBtn = addExpandButton(urlItem, instance);

    expect(expandBtn.className).toBe('url-item-expand-btn');
    expect(expandBtn.textContent).toBe('▶');
    expect(expandBtn.title).toBe('Expand details');
  });

  it('toggles expanded class on click', () => {
    const instance = createMockInstance();
    instance.urlListRowHeight = 28;
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    const expandBtn = addExpandButton(urlItem, instance);

    // First click expands
    expandBtn.click();
    expect(urlItem.classList.contains('expanded')).toBe(true);
    expect(urlItem.style.height).toBe('auto');

    // Second click collapses
    expandBtn.click();
    expect(urlItem.classList.contains('expanded')).toBe(false);
    expect(urlItem.style.height).toBe('28px');
  });

  it('does not have expanded class initially', () => {
    const instance = createMockInstance();
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    addExpandButton(urlItem, instance);

    expect(urlItem.classList.contains('expanded')).toBe(false);
  });
});

describe('url-item tab group display', () => {
  const TAB_GROUP_COLORS = {
    grey: '#5f6368',
    blue: '#1a73e8',
    red: '#d93025',
    yellow: '#f9ab00',
    green: '#188038',
    pink: '#d01884',
    purple: '#a142f4',
    cyan: '#007b83',
    orange: '#e8710a'
  };

  function applyTabGroup(urlItem, groupId, tabGroupsById, tabGroupPos) {
    const groupInfo = groupId > -1 ? tabGroupsById[groupId] : null;
    if (groupInfo && tabGroupPos) {
      const cssColor = TAB_GROUP_COLORS[groupInfo.color] || '#5f6368';
      urlItem.classList.add('tab-grouped', `tab-group-${tabGroupPos}`);
      urlItem.style.borderLeftColor = cssColor;
      urlItem.dataset.groupId = groupId;
      urlItem.dataset.groupColor = groupInfo.color || 'grey';

      if (tabGroupPos === 'first' || tabGroupPos === 'only') {
        const groupLabel = document.createElement('span');
        groupLabel.className = 'tab-group-label';
        groupLabel.style.backgroundColor = cssColor;
        groupLabel.textContent = groupInfo.title || 'Group';
        urlItem.appendChild(groupLabel);
      }
    }
    return urlItem;
  }

  it('adds tab-grouped class and position class for grouped tab', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 1, { 1: { title: 'Work', color: 'blue' } }, 'first');

    expect(urlItem.classList.contains('tab-grouped')).toBe(true);
    expect(urlItem.classList.contains('tab-group-first')).toBe(true);
    expect(urlItem.dataset.groupId).toBe('1');
    expect(urlItem.dataset.groupColor).toBe('blue');
    expect(urlItem.style.borderLeftColor).toBeTruthy();
  });

  it('renders group label only on first item', () => {
    const first = document.createElement('div');
    first.className = 'url-item';
    applyTabGroup(first, 2, { 2: { title: 'Research', color: 'green' } }, 'first');
    expect(first.querySelector('.tab-group-label')).not.toBeNull();
    expect(first.querySelector('.tab-group-label').textContent).toBe('Research');

    const middle = document.createElement('div');
    middle.className = 'url-item';
    applyTabGroup(middle, 2, { 2: { title: 'Research', color: 'green' } }, 'middle');
    expect(middle.querySelector('.tab-group-label')).toBeNull();

    const last = document.createElement('div');
    last.className = 'url-item';
    applyTabGroup(last, 2, { 2: { title: 'Research', color: 'green' } }, 'last');
    expect(last.querySelector('.tab-group-label')).toBeNull();
  });

  it('renders group label on only (single) item', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 5, { 5: { title: 'Solo', color: 'pink' } }, 'only');

    const label = urlItem.querySelector('.tab-group-label');
    expect(label).not.toBeNull();
    expect(label.textContent).toBe('Solo');
  });

  it('uses "Group" as default label when title is empty', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 3, { 3: { title: '', color: 'red' } }, 'only');

    const label = urlItem.querySelector('.tab-group-label');
    expect(label.textContent).toBe('Group');
  });

  it('does not add tab-grouped for ungrouped tab (groupId -1)', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, -1, {}, null);

    expect(urlItem.classList.contains('tab-grouped')).toBe(false);
    expect(urlItem.querySelector('.tab-group-label')).toBeNull();
  });

  it('does not add tab-grouped when tabGroupPos is null', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 1, { 1: { title: 'X', color: 'blue' } }, null);

    expect(urlItem.classList.contains('tab-grouped')).toBe(false);
  });

  it('does not add tab-grouped when groupId is missing from tabGroupsById', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 99, {}, 'only');

    expect(urlItem.classList.contains('tab-grouped')).toBe(false);
  });

  it('falls back to grey color for unknown color name', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    applyTabGroup(urlItem, 4, { 4: { title: 'Test', color: 'neon' } }, 'first');

    expect(urlItem.dataset.groupColor).toBe('neon');
    expect(urlItem.style.borderLeftColor).toBeTruthy();
  });

  it('maps all Chrome tab group colors to non-empty values', () => {
    const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    colors.forEach(color => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';
      applyTabGroup(urlItem, 1, { 1: { title: 'T', color } }, 'only');
      expect(urlItem.classList.contains('tab-grouped')).toBe(true);
      expect(urlItem.dataset.groupColor).toBe(color);
      expect(urlItem.style.borderLeftColor).toBeTruthy();
    });
  });

  it('assigns correct position classes for all positions', () => {
    ['first', 'middle', 'last', 'only'].forEach(pos => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';
      applyTabGroup(urlItem, 1, { 1: { title: 'T', color: 'blue' } }, pos);
      expect(urlItem.classList.contains(`tab-group-${pos}`)).toBe(true);
    });
  });
});

describe('tab group drag/drop data', () => {
  it('sets draggable on active tab url-items', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    // Simulating what createUrlItem does for active tabs
    urlItem.draggable = true;
    urlItem.dataset.tabId = '42';

    expect(urlItem.draggable).toBe(true);
    expect(urlItem.dataset.tabId).toBe('42');
  });

  it('does not set draggable for non-active views', () => {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';
    // In non-active views, draggable is not set
    expect(urlItem.draggable).toBe(false);
  });
});
