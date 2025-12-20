// Background service worker - handles extension icon clicks

chrome.action.onClicked.addListener((tab) => {
  // Open the side panel when extension icon is clicked
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Track recently closed tabs
const MAX_CLOSED_TABS = 50;
const activeTabs = new Map();

// Track when tabs are created
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    activeTabs.set(tab.id, {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl
    });
  }
});

// Track when tabs are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Store tab info whenever it updates
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    activeTabs.set(tabId, {
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl
    });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Get the tab data we stored
  const tabData = activeTabs.get(tabId);

  if (!tabData) {
    return;
  }

  // Don't track when whole window is closing
  if (removeInfo.isWindowClosing) {
    activeTabs.delete(tabId);
    return;
  }

  // Get existing closed tabs list
  const result = await chrome.storage.local.get(['closedTabs']);
  const closedTabs = result.closedTabs || [];

  // Add new closed tab at the beginning
  closedTabs.unshift({
    url: tabData.url,
    title: tabData.title,
    favIconUrl: tabData.favIconUrl,
    closedAt: Date.now()
  });

  // Keep only the most recent MAX_CLOSED_TABS
  if (closedTabs.length > MAX_CLOSED_TABS) {
    closedTabs.length = MAX_CLOSED_TABS;
  }

  // Save back to storage
  await chrome.storage.local.set({ closedTabs });

  // Clean up the active tabs map
  activeTabs.delete(tabId);
});

// Initialize: Load existing tabs into the map
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && tab.url !== 'about:blank') {
      activeTabs.set(tab.id, {
        url: tab.url,
        title: tab.title || tab.url,
        favIconUrl: tab.favIconUrl
      });
    }
  });
});
