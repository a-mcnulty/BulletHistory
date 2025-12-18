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
    console.log('Created tab:', tab.id, tab.url);
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
    console.log('Updated tab:', tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  console.log('Tab removed:', tabId, 'isWindowClosing:', removeInfo.isWindowClosing);

  // Get the tab data we stored
  const tabData = activeTabs.get(tabId);

  if (!tabData) {
    console.log('No tab data found for:', tabId);
    return;
  }

  // Don't track when whole window is closing
  if (removeInfo.isWindowClosing) {
    console.log('Window closing, skipping tab:', tabId);
    activeTabs.delete(tabId);
    return;
  }

  console.log('Saving closed tab:', tabData.url);

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
  console.log('Saved. Total closed tabs:', closedTabs.length);

  // Clean up the active tabs map
  activeTabs.delete(tabId);
});

// Initialize: Load existing tabs into the map
chrome.tabs.query({}, (tabs) => {
  console.log('Initializing background script, found', tabs.length, 'tabs');
  tabs.forEach(tab => {
    console.log('Tab', tab.id, ':', tab.url);
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && tab.url !== 'about:blank') {
      activeTabs.set(tab.id, {
        url: tab.url,
        title: tab.title || tab.url,
        favIconUrl: tab.favIconUrl
      });
      console.log('  -> Tracking:', tab.url);
    }
  });
  console.log('Tracking', activeTabs.size, 'tabs total');
});
