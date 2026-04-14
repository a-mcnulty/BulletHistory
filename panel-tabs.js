// panel-tabs.js — Active tabs, closed tabs, bookmarks, recent views

// Show recent history (last 100 visits)
BulletHistory.prototype.showRecentHistory = function() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    this.expandedViewType = 'recent';
    this.currentDomain = null;

    expandedTitle.textContent = 'Recent History';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get recent history from Chrome
    chrome.history.search({
      text: '',
      maxResults: 1000,
      startTime: 0
    }, (results) => {
      const recentUrls = results.map(item => ({
        url: item.url,
        title: item.title || item.url,
        visitCount: item.visitCount,
        lastVisit: item.lastVisitTime,
        favIconUrl: item.favIconUrl,
        domain: new URL(item.url).hostname.replace(/^www\./, ''),
        date: new Date(item.lastVisitTime).toISOString().split('T')[0]
      }));

      // Sort by most recent
      recentUrls.sort((a, b) => b.lastVisit - a.lastVisit);

      this.expandedUrls = recentUrls;
      expandedTitle.textContent = `Recent History (${recentUrls.length} total)`;

      // Refresh time data cache before rendering
      this.refreshUrlTimeCache().then(() => {
        this.renderUrlList();
        this.showExpandedViewAnimated();
      });
    });
};

// Show bookmarks organized by folders
BulletHistory.prototype.showBookmarks = async function() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Hide calendar section (not used in bookmarks view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    this.expandedViewType = 'bookmarks';
    this.currentDomain = null;

    // Set active menu button
    this.setActiveMenuButton('bookmarksBtn');

    expandedTitle.textContent = 'Bookmarks';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get all bookmarks
    chrome.bookmarks.getTree((bookmarkTree) => {
      const bookmarks = [];

      // Recursively collect all bookmarks with folder info
      const collectBookmarks = (nodes, folderPath = [], parentId = null) => {
        nodes.forEach(node => {
          if (node.url) {
            // It's a bookmark
            try {
              bookmarks.push({
                id: node.id, // Store bookmark ID for moving
                url: node.url,
                title: node.title || node.url,
                folder: folderPath.join(' > ') || 'Root',
                folderId: node.parentId || parentId, // Store the parent folder ID
                dateAdded: node.dateAdded,
                domain: new URL(node.url).hostname.replace(/^www\./, ''),
                visitCount: 1,
                lastVisit: node.dateAdded
              });
            } catch (e) {
              console.warn('Invalid bookmark URL:', node.url);
            }
          } else if (node.children) {
            // It's a folder
            const newPath = node.title ? [...folderPath, node.title] : folderPath;
            collectBookmarks(node.children, newPath, node.id);
          }
        });
      };

      collectBookmarks(bookmarkTree);

      // Fetch actual visit counts from browser history for each bookmark
      // Optimized: use faviconCache instead of extra history.search per bookmark
      const fetchVisitCounts = async () => {
        const historyPromises = bookmarks.map(bookmark => {
          return new Promise((resolve) => {
            // Use exact URL match to get visit count
            chrome.history.getVisits({ url: bookmark.url }, (visits) => {
              if (visits && visits.length > 0) {
                bookmark.visitCount = visits.length;
                bookmark.lastVisit = Math.max(...visits.map(v => v.visitTime));
              } else {
                bookmark.visitCount = 0;
                bookmark.lastVisit = bookmark.dateAdded;
              }
              // Use cached favicon instead of extra API call
              const cachedFavicon = this.faviconCache[bookmark.url]?.favicon;
              if (cachedFavicon) {
                bookmark.favIconUrl = cachedFavicon;
              }
              resolve();
            });
          });
        });

        await Promise.all(historyPromises);
      };

      // Fetch visit counts, then continue with grouping and sorting
      fetchVisitCounts().then(() => {
        // Group bookmarks by folder first, then sort within each folder
        const folderGroups = {};
        bookmarks.forEach(bookmark => {
          const folder = bookmark.folder || 'Root';
          if (!folderGroups[folder]) {
            folderGroups[folder] = [];
          }
          folderGroups[folder].push(bookmark);
        });

        // Sort within each folder group based on current sort mode
        Object.keys(folderGroups).forEach(folder => {
          const group = folderGroups[folder];
          if (this.sortMode === 'popular') {
            // Sort by visit count
            group.sort((a, b) => b.visitCount - a.visitCount);
          } else if (this.sortMode === 'alphabetical') {
            // Sort alphabetically by title
            group.sort((a, b) => a.title.localeCompare(b.title));
          } else {
            // Most Recent (default): Sort by dateAdded
            group.sort((a, b) => b.dateAdded - a.dateAdded);
          }
        });

        // Flatten back to a single array, keeping folder groups together
        const sortedBookmarks = [];
        Object.keys(folderGroups).sort().forEach(folder => {
          sortedBookmarks.push(...folderGroups[folder]);
        });

        // Store bookmarks and render with filtering
        this.expandedUrls = sortedBookmarks;
        expandedTitle.textContent = `Bookmarks (${bookmarks.length} total)`;

        // Refresh time data cache before rendering
        this.refreshUrlTimeCache().then(() => {
          this.renderUrlList();

          // Restore full domain list first, then filter to bookmarked domains
          this.restoreAllDomains();
          this.filterDomainsToExpandedView();

          this.showExpandedViewAnimated();
        });
      });
    });
};


// Show recently closed tabs with restore functionality
BulletHistory.prototype.showRecentlyClosed = function() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    // Hide calendar section (not used in recently closed view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    this.expandedViewType = 'closed';
    this.currentDomain = null;

    // Set active menu button
    this.setActiveMenuButton('recentlyClosedBtn');

    expandedTitle.textContent = 'Recently Closed';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Get closed tabs from storage
    chrome.storage.local.get(['closedTabs'], (result) => {
      const closedTabs = result.closedTabs || [];

      // Convert to URL format and add domain + group info
      const closedUrls = closedTabs.map(tabData => {
        const base = {
          url: tabData.url,
          title: tabData.title,
          favIconUrl: tabData.favIconUrl,
          closedAt: tabData.closedAt,
          visitCount: 1,
          lastVisit: tabData.closedAt,
          groupId: tabData.groupId ?? -1,
          groupTitle: tabData.groupTitle,
          groupColor: tabData.groupColor
        };
        try {
          base.domain = new URL(tabData.url).hostname.replace(/^www\./, '');
        } catch (e) {
          base.domain = tabData.url;
        }
        return base;
      });

      // Register closed-tab group metadata in tabGroupsById so createUrlItem
      // can render group labels/colors even for groups that no longer exist.
      closedUrls.forEach(item => {
        if (item.groupId > -1 && !this.tabGroupsById[item.groupId]) {
          this.tabGroupsById[item.groupId] = {
            title: item.groupTitle || '',
            color: item.groupColor || 'grey'
          };
        }
      });

      // Fetch actual visit counts from browser history for each closed tab
      // Already optimized with Promise.all for parallelization
      const fetchVisitCounts = async () => {
        const historyPromises = closedUrls.map(closedTab => {
          return new Promise((resolve) => {
            chrome.history.getVisits({ url: closedTab.url }, (visits) => {
              if (visits && visits.length > 0) {
                closedTab.visitCount = visits.length;
                closedTab.lastVisit = Math.max(...visits.map(v => v.visitTime));
              } else {
                closedTab.visitCount = 0;
              }
              // Use cached favicon if available
              const cachedFavicon = this.faviconCache[closedTab.url]?.favicon;
              if (cachedFavicon && !closedTab.favIconUrl) {
                closedTab.favIconUrl = cachedFavicon;
              }
              resolve();
            });
          });
        });

        await Promise.all(historyPromises);
      };

      // Fetch visit counts, then continue with sorting
      fetchVisitCounts().then(() => {
        // Sort based on current sort mode
        if (this.sortMode === 'popular') {
          // Most Popular: Sort by visit count
          closedUrls.sort((a, b) => b.visitCount - a.visitCount);
        } else if (this.sortMode === 'alphabetical') {
          // Alphabetical: Sort by domain, then by URL
          closedUrls.sort((a, b) => {
            const domainCompare = a.domain.localeCompare(b.domain);
            if (domainCompare !== 0) return domainCompare;
            return a.url.localeCompare(b.url);
          });
        } else {
          // Most Recent (default): Sort by most recently closed
          closedUrls.sort((a, b) => b.closedAt - a.closedAt);
        }

        this.expandedUrls = closedUrls;
        expandedTitle.textContent = `Recently Closed (${closedUrls.length} total)`;

        // Refresh time data cache before rendering
        this.refreshUrlTimeCache().then(() => {
          this.renderUrlList();

          // Restore full domain list first, then filter to closed tab domains
          this.restoreAllDomains();
          this.filterDomainsToExpandedView();

          this.showExpandedViewAnimated();
        });
      });
    });
};

// Show currently active tabs with duration
BulletHistory.prototype.showActiveTabs = async function() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Hide calendar section (not used in active tabs view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    this.expandedViewType = 'active';
    this.currentDomain = null;

    // Set active menu button
    this.setActiveMenuButton('activeTabsBtn');

    expandedTitle.textContent = 'Active Tabs';

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Refresh time data cache for fresh data
    await this.refreshUrlTimeCache();

    // Get open tabs from storage
    const result = await chrome.storage.local.get(['openTabs']);
    const openTabs = result.openTabs || {};

    // Get current tab info from Chrome to get windowId, lastAccessed, and groupId
    const chromeTabs = await chrome.tabs.query({});
    const tabWindowMap = {};
    const tabAccessMap = {};
    const tabGroupMap = {};
    chromeTabs.forEach(tab => {
      tabWindowMap[tab.id] = tab.windowId;
      tabAccessMap[tab.id] = tab.lastAccessed || 0;
      tabGroupMap[tab.id] = tab.groupId ?? -1;

      // Backfill tabs not yet in storage (e.g. after extension reload, or chrome:// tabs)
      if (!openTabs[tab.id] && tab.url && tab.url !== 'about:blank') {
        openTabs[tab.id] = {
          url: tab.url,
          title: tab.title || tab.url,
          favIconUrl: tab.favIconUrl,
          openedAt: Date.now()
        };
      }
    });

    // Load tab group metadata (names, colors)
    await this.loadTabGroups();

    // Convert to array and add domain + duration + windowId + lastAccessed
    const activeTabsArray = Object.entries(openTabs).map(([tabId, tabData]) => {
      const tabIdNum = parseInt(tabId);
      const windowId = tabWindowMap[tabIdNum];
      const lastAccessed = tabAccessMap[tabIdNum];

      const groupId = tabGroupMap[tabIdNum] ?? -1;
      try {
        return {
          tabId: tabIdNum,
          windowId: windowId,
          groupId: groupId,
          url: tabData.url,
          title: tabData.title,
          favIconUrl: tabData.favIconUrl,
          openedAt: tabData.openedAt,
          duration: Date.now() - tabData.openedAt,
          lastAccessed: lastAccessed,
          domain: new URL(tabData.url).hostname.replace(/^www\./, ''),
          visitCount: 1,
          lastVisit: tabData.openedAt
        };
      } catch (e) {
        return {
          tabId: tabIdNum,
          windowId: windowId,
          groupId: groupId,
          url: tabData.url,
          title: tabData.title,
          favIconUrl: tabData.favIconUrl,
          openedAt: tabData.openedAt,
          duration: Date.now() - tabData.openedAt,
          lastAccessed: lastAccessed,
          domain: tabData.url,
          visitCount: 1,
          lastVisit: tabData.openedAt
        };
      }
    }).filter(tab => tab.windowId !== undefined); // Filter out tabs that no longer exist

    // Group by window, then sort within each window based on sort mode
    const tabsByWindow = {};
    activeTabsArray.forEach(tab => {
      if (!tabsByWindow[tab.windowId]) {
        tabsByWindow[tab.windowId] = [];
      }
      tabsByWindow[tab.windowId].push(tab);
    });

    // Sort tabs within each window by sort mode, then keep tab groups contiguous
    Object.values(tabsByWindow).forEach(tabs => {
      const sortFn = this.sortMode === 'recent' ? (a, b) => b.openedAt - a.openedAt
        : this.sortMode === 'popular' ? (a, b) => b.lastAccessed - a.lastAccessed
        : this.sortMode === 'alphabetical' ? (a, b) => (a.title || a.url).localeCompare(b.title || b.url)
        : (a, b) => b.duration - a.duration;

      tabs.sort(sortFn);
      const cohesive = this.applyTabGroupCohesion([...tabs]);
      tabs.length = 0;
      tabs.push(...cohesive);
    });

    // Remove empty windows (stale entries from closed windows)
    Object.keys(tabsByWindow).forEach(windowId => {
      if (tabsByWindow[windowId].length === 0) {
        delete tabsByWindow[windowId];
      }
    });

    // Flatten back to array, keeping window groups together
    // Sort windows by window ID
    const sortedActiveTabsArray = [];
    Object.keys(tabsByWindow).sort((a, b) => parseInt(a) - parseInt(b)).forEach(windowId => {
      sortedActiveTabsArray.push(...tabsByWindow[windowId]);
    });

    this.expandedUrls = sortedActiveTabsArray;
    const windowCount = Object.keys(tabsByWindow).length;
    console.log('[ActiveTabs] chromeTabs:', chromeTabs.length, 'openTabs keys:', Object.keys(openTabs).length, 'activeTabsArray:', activeTabsArray.length, 'windows:', windowCount);
    // Show all chrome tabs grouped by window
    const chromeByWindow = {};
    chromeTabs.forEach(t => {
      if (!chromeByWindow[t.windowId]) chromeByWindow[t.windowId] = [];
      chromeByWindow[t.windowId].push({ id: t.id, url: t.url, type: t.url?.startsWith('chrome') ? 'chrome' : 'http' });
    });
    console.log('[ActiveTabs] Chrome windows:', JSON.stringify(chromeByWindow, null, 2));
    // Show which openTabs entries have no matching chrome tab
    Object.keys(openTabs).forEach(tabId => {
      if (!tabWindowMap[parseInt(tabId)]) {
        console.log('[ActiveTabs] STALE openTab:', tabId, openTabs[tabId].url);
      }
    });
    // Show final tabsByWindow
    Object.entries(tabsByWindow).forEach(([wid, tabs]) => {
      console.log(`[ActiveTabs] Rendered Window ${wid}: ${tabs.length} tab(s)`, tabs.map(t => t.url));
    });
    expandedTitle.textContent = `Active Tabs (${sortedActiveTabsArray.length} tabs in ${windowCount} window${windowCount !== 1 ? 's' : ''})`;

    this.renderUrlList();

    // Restore full domain list first, then filter to active tab domains
    this.restoreAllDomains();
    this.filterDomainsToExpandedView();

    this.showExpandedViewAnimated();
};

// Create a closed tab item
BulletHistory.prototype.createClosedTabItem = function(tabData, index) {
    const item = document.createElement('div');
    item.className = 'url-item';

    // Left side: restore button
    const leftDiv = document.createElement('div');
    leftDiv.className = 'url-item-left';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'icon-btn restore';
    restoreBtn.textContent = '⟲';
    restoreBtn.title = 'Reopen this tab';
    restoreBtn.addEventListener('click', async () => {
      // Open the URL in a new tab
      chrome.tabs.create({ url: tabData.url });

      // Remove this item from storage
      const result = await chrome.storage.local.get(['closedTabs']);
      const closedTabs = result.closedTabs || [];
      closedTabs.splice(index, 1);
      await chrome.storage.local.set({ closedTabs });

      // Refresh the list
      this.showRecentlyClosed();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Remove from list';
    deleteBtn.addEventListener('click', async () => {
      // Remove this item from storage
      const result = await chrome.storage.local.get(['closedTabs']);
      const closedTabs = result.closedTabs || [];
      closedTabs.splice(index, 1);
      await chrome.storage.local.set({ closedTabs });

      // Refresh the list
      this.showRecentlyClosed();
    });

    leftDiv.appendChild(restoreBtn);
    leftDiv.appendChild(deleteBtn);

    // Right side: Favicon + Title/URL info
    const rightDiv = document.createElement('div');
    rightDiv.className = 'url-item-right';

    // Add favicon
    const favicon = document.createElement('img');
    favicon.className = 'url-favicon';

    // Check cache first, then use stored favIconUrl, then fallback to Google
    const cachedFavicon = this.faviconCache[tabData.url]?.favicon;
    const hasCachedFavicon = cachedFavicon &&
                             cachedFavicon.length > 0 &&
                             !cachedFavicon.startsWith('chrome://');
    favicon.src = hasCachedFavicon ? cachedFavicon : (tabData.favIconUrl || `https://www.google.com/s2/favicons?domain=${tabData.url}&sz=16`);
    favicon.alt = '';
    favicon.width = 16;
    favicon.height = 16;

    // Container for title and URL
    const urlTextContainer = document.createElement('div');
    urlTextContainer.className = 'url-text-container';

    // Create clickable link
    const urlLink = document.createElement('a');
    urlLink.href = tabData.url;
    urlLink.target = '_blank';
    urlLink.className = 'url-title';

    // Show title if available, otherwise show URL
    const displayText = tabData.title || tabData.url;
    urlLink.textContent = displayText;

    // Add hover display (shows full title + URL)
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';

    // Add full title if available
    if (tabData.title && tabData.title.length > 0) {
      const fullTitle = document.createElement('div');
      fullTitle.className = 'url-display-title';
      fullTitle.textContent = tabData.title;
      urlDisplay.appendChild(fullTitle);
    }

    // Add URL
    const fullUrl = document.createElement('div');
    fullUrl.className = 'url-display-url';
    fullUrl.textContent = tabData.url;
    urlDisplay.appendChild(fullUrl);

    urlTextContainer.appendChild(urlLink);
    urlTextContainer.appendChild(urlDisplay);

    rightDiv.appendChild(favicon);
    rightDiv.appendChild(urlTextContainer);

    item.appendChild(leftDiv);
    item.appendChild(rightDiv);

    return item;
};
