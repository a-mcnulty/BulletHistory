// panel-expanded.js — Expanded/detail views

BulletHistory.prototype.showFullHistory = async function() {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    // Hide calendar section (not used in full history view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    // Set view type
    this.expandedViewType = 'full';
    this.currentDomain = null;

    // Set active menu button
    this.setActiveMenuButton('recentHistoryBtn');

    // Restore full domain list (full history shows all domains)
    this.restoreAllDomains();

    // Calculate total visits across all domains
    let totalVisits = 0;
    Object.values(this.historyData).forEach(domainData => {
      Object.values(domainData.days).forEach(day => {
        totalVisits += day.count;
      });
    });

    // Set title
    expandedTitle.textContent = `Full History (${totalVisits} total)`;

    // Remove navigation and delete button if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) navContainer.remove();
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) deleteBtn.remove();

    // Collect all URLs from all domains with their dates
    const allUrls = [];
    Object.keys(this.historyData).forEach(domain => {
      Object.keys(this.historyData[domain].days).forEach(dateStr => {
        const dayData = this.historyData[domain].days[dateStr];
        dayData.urls.forEach(urlData => {
          allUrls.push({
            ...urlData,
            domain: domain,
            date: dateStr
          });
        });
      });
    });

    // Sort based on current sort mode
    if (this.sortMode === 'popular') {
      // Most Popular: Sort by visit count (descending)
      allUrls.sort((a, b) => b.visitCount - a.visitCount);
    } else if (this.sortMode === 'alphabetical') {
      // Alphabetical: Sort by domain, then by URL
      allUrls.sort((a, b) => {
        const domainCompare = a.domain.localeCompare(b.domain);
        if (domainCompare !== 0) return domainCompare;
        return a.url.localeCompare(b.url);
      });
    } else {
      // Most Recent (default): Sort by most recent visit
      allUrls.sort((a, b) => b.lastVisit - a.lastVisit);
    }

    // Store URLs and render with virtual scrolling
    this.expandedUrls = allUrls;

    // Refresh time data cache before rendering
    await this.refreshUrlTimeCache();

    this.renderUrlList();

    this.showExpandedViewAnimated();
};

// Show domain view with all URLs grouped by date
BulletHistory.prototype.showDomainView = async function(domain) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');
    const expandedHeader = document.querySelector('.expanded-header');

    // Hide calendar section (not used in domain view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    // Set view type
    this.expandedViewType = 'domain';
    this.currentDomain = domain;

    // Clear active menu button (domain view is not triggered by menu buttons)
    this.setActiveMenuButton(null);

    // Calculate total visits
    const domainData = this.historyData[domain];
    let totalVisits = 0;
    Object.values(domainData.days).forEach(day => {
      totalVisits += day.count;
    });

    // Set title (no navigation buttons for domain view)
    expandedTitle.textContent = `${domain} (${totalVisits} total url${totalVisits !== 1 ? 's' : ''})`;

    // Remove navigation if it exists
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) {
      navContainer.remove();
    }

    // Add delete domain button if not exists
    let deleteBtn = document.getElementById('deleteDomain');
    if (!deleteBtn) {
      deleteBtn = document.createElement('button');
      deleteBtn.id = 'deleteDomain';
      deleteBtn.className = 'delete-domain-btn';
      deleteBtn.textContent = 'delete all';
      deleteBtn.title = 'Delete all history for this domain';

      // Insert before close button
      const closeBtn = document.getElementById('closeExpanded');
      expandedHeader.insertBefore(deleteBtn, closeBtn);
    }

    // Update delete button click handler
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    newDeleteBtn.addEventListener('click', () => this.deleteDomain(domain));

    // Collect all URLs for this domain
    const allUrls = [];
    Object.keys(domainData.days).forEach(dateStr => {
      const dayData = domainData.days[dateStr];
      dayData.urls.forEach(urlData => {
        allUrls.push({
          ...urlData,
          domain: domain,
          date: dateStr
        });
      });
    });

    // Sort by most recent first
    allUrls.sort((a, b) => b.lastVisit - a.lastVisit);

    // Store URLs and render with virtual scrolling
    this.expandedUrls = allUrls;

    // Refresh time data cache before rendering
    await this.refreshUrlTimeCache();

    this.renderUrlList();

    this.showExpandedViewAnimated();
};

// Show expanded view with URLs
BulletHistory.prototype.showExpandedView = async function(domain, date, count) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Set view type
    this.expandedViewType = 'cell';
    this.currentDomain = null;

    // Clear active menu button (cell view is not triggered by menu buttons)
    this.setActiveMenuButton(null);

    // Restore full domain list (cell view is domain-specific)
    this.restoreAllDomains();

    // Remove delete domain button if it exists
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) {
      deleteBtn.remove();
    }

    // Format date nicely
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Update or create navigation controls
    let navContainer = document.getElementById('expandedNav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.id = 'expandedNav';
      navContainer.className = 'expanded-nav';

      const dateElement = document.createElement('span');
      dateElement.id = 'expandedDate';
      dateElement.className = 'expanded-date';

      const prevBtn = document.createElement('button');
      prevBtn.id = 'prevDay';
      prevBtn.className = 'nav-btn';
      prevBtn.innerHTML = '‹';
      prevBtn.title = 'Previous day';

      const nextBtn = document.createElement('button');
      nextBtn.id = 'nextDay';
      nextBtn.className = 'nav-btn';
      nextBtn.innerHTML = '›';
      nextBtn.title = 'Next day';

      navContainer.appendChild(prevBtn);
      navContainer.appendChild(dateElement);
      navContainer.appendChild(nextBtn);

      document.querySelector('.expanded-header').insertBefore(
        navContainer,
        document.getElementById('closeExpanded')
      );
    }

    // Update click handlers with current date
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');

    // Remove old listeners by cloning
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

    // Add new listeners with current date
    newPrevBtn.addEventListener('click', () => this.navigateDay(domain, date, -1));
    newNextBtn.addEventListener('click', () => this.navigateDay(domain, date, 1));

    // Update date text
    document.getElementById('expandedDate').textContent = formattedDate;

    // Update button states
    this.updateNavButtons(domain, date);

    // Get the actual unique URL count for this cell (from time data or history)
    const actualCount = this.getUniqueUrlCountForCell(domain, date, false);

    // Update title with actual count
    expandedTitle.textContent = `${domain} (${actualCount} url${actualCount !== 1 ? 's' : ''})`;

    // Get URLs for this cell from Chrome history
    const dayData = this.historyData[domain]?.days[date];
    const historyUrls = dayData?.urls || [];

    // Get URLs from time tracking data (tabs that were open this day)
    const timeTrackingUrls = this.getUrlsFromTimeData(domain, date, false);

    // Merge URLs: start with history URLs, add time tracking URLs that aren't already included
    const historyUrlSet = new Set(historyUrls.map(u => u.url));
    const mergedUrls = [...historyUrls];

    // Add URLs from time tracking that aren't in history
    for (const url of timeTrackingUrls) {
      if (!historyUrlSet.has(url)) {
        // Create a minimal URL entry for time-tracked-only URLs
        mergedUrls.push({
          url: url,
          title: url, // Will be improved if we have cached title
          visitCount: 0, // No visits, just time tracked
          lastVisit: Date.now() // Use current time as placeholder
        });
      }
    }

    if (mergedUrls.length === 0) {
      urlList.innerHTML = '<div style="padding: 16px; color: #999;">No URLs found</div>';
      this.showExpandedViewAnimated();
      return;
    }

    // Sort URLs chronologically (most recent first), time-only URLs at end
    const urls = mergedUrls.sort((a, b) => {
      // URLs with visits come first, sorted by lastVisit
      if (a.visitCount > 0 && b.visitCount === 0) return -1;
      if (a.visitCount === 0 && b.visitCount > 0) return 1;
      return b.lastVisit - a.lastVisit;
    });

    // Add domain and date to each URL
    const urlsWithContext = urls.map(urlData => ({
      ...urlData,
      domain: domain,
      date: date
    }));

    // Store URLs and render with virtual scrolling
    this.expandedUrls = urlsWithContext;

    // Refresh time data cache before rendering
    await this.refreshUrlTimeCache();

    this.renderUrlList();

    // Render calendar events for this date
    this.renderCalendarEventsForDate(date);

    this.showExpandedViewAnimated();
};

// Render URL list with virtual scrolling
BulletHistory.prototype.renderUrlList = function() {
    const urlList = document.getElementById('urlList');
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');

    // Clear collapsed groups when view type changes
    if (this.lastExpandedViewType !== this.expandedViewType) {
      this.collapsedGroups.clear();
      this.lastExpandedViewType = this.expandedViewType;
    }

    // Filter URLs based on search filter
    let filteredUrls = this.expandedUrls;
    if (this.searchFilter) {
      const filterLower = this.searchFilter.toLowerCase();
      filteredUrls = this.expandedUrls.filter(urlData => {
        const domain = urlData.domain?.toLowerCase() || '';
        const url = urlData.url?.toLowerCase() || '';
        const title = urlData.title?.toLowerCase() || '';
        return domain.includes(filterLower) || url.includes(filterLower) || title.includes(filterLower);
      });
    }
    this.filteredUrlsCache = filteredUrls;

    // Update title with filtered count
    if (this.searchFilter && filteredUrls.length !== this.expandedUrls.length) {
      const viewName = this.getViewName();
      expandedTitle.textContent = `${viewName} (${filteredUrls.length} found)`;
    } else {
      const viewName = this.getViewName();
      expandedTitle.textContent = `${viewName} (${this.expandedUrls.length} total)`;
    }

    // Store filtered URLs for later use (e.g., when toggling folder collapse)
    this.currentFilteredUrls = filteredUrls;

    // Build flat list of virtual rows (headers + items)
    this.buildVirtualRows(filteredUrls);

    // Calculate total height
    const totalHeight = this.virtualRows.reduce((sum, row) => {
      return sum + (row.type === 'header' ? this.urlListHeaderHeight : this.urlListRowHeight);
    }, 0);

    // Clear list and set view-specific class
    urlList.innerHTML = '';
    urlList.classList.toggle('bookmarks-view', this.expandedViewType === 'bookmarks');

    // Create container for all items
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'virtual-scroll-container';
    urlList.appendChild(itemsContainer);

    // Disconnect old observer if exists
    if (this.urlListObserver) {
      this.urlListObserver.disconnect();
    }

    // Create Intersection Observer to detect visible items
    this.urlListObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const placeholder = entry.target;
        if (entry.isIntersecting && !placeholder.dataset.populated) {
          // Item is visible - populate it
          this.populateUrlItem(placeholder);
        }
      });
    }, {
      root: expandedView,
      rootMargin: '100px 0px', // Pre-load items 100px before they're visible
      threshold: 0
    });

    // Create placeholder elements for all items
    for (let i = 0; i < this.virtualRows.length; i++) {
      const row = this.virtualRows[i];
      const placeholder = document.createElement('div');
      placeholder.dataset.rowIndex = i;

      if (row.type === 'header') {
        placeholder.className = 'url-item-placeholder header-placeholder';
        placeholder.style.height = `${this.urlListHeaderHeight}px`;
      } else {
        placeholder.className = 'url-item-placeholder';
        placeholder.style.height = `${this.urlListRowHeight}px`;
      }

      itemsContainer.appendChild(placeholder);
      this.urlListObserver.observe(placeholder);
    }

    // For bookmarks view: set up container-level drag handlers
    if (this.expandedViewType === 'bookmarks') {
      this.setupUrlListDropTarget(itemsContainer);
    }
};

// Populate a placeholder with actual content
BulletHistory.prototype.populateUrlItem = function(placeholder) {
    const rowIndex = parseInt(placeholder.dataset.rowIndex, 10);
    const row = this.virtualRows[rowIndex];
    if (!row) return;

    placeholder.dataset.populated = 'true';

    if (row.type === 'header') {
      placeholder.className = 'date-group-header collapsible-header';
      placeholder.style.height = `${this.urlListHeaderHeight}px`;
      placeholder.style.boxSizing = 'border-box';

      if (row.isCollapsed) {
        placeholder.classList.add('collapsed');
      }

      // Create chevron icon
      const chevron = document.createElement('span');
      chevron.className = 'group-chevron';
      chevron.innerHTML = '&#9662;';
      placeholder.appendChild(chevron);

      // Add group name
      const groupName = document.createElement('span');
      groupName.className = 'group-name';
      groupName.textContent = row.groupLabel;
      placeholder.appendChild(groupName);

      // Add count
      const countSpan = document.createElement('span');
      countSpan.className = 'group-count';
      countSpan.textContent = `(${row.itemCount})`;
      placeholder.appendChild(countSpan);

      // Click handler for collapse/expand
      const expandedView = document.getElementById('expandedView');
      placeholder.addEventListener('click', () => {
        const groupKey = row.groupKey;
        if (this.collapsedGroups.has(groupKey)) {
          this.collapsedGroups.delete(groupKey);
        } else {
          this.collapsedGroups.add(groupKey);
        }
        this.buildVirtualRows(this.currentFilteredUrls);
        this.renderUrlList(this.currentFilteredUrls, document.getElementById('expandedUrlList'), expandedView);
      });

      if (this.expandedViewType === 'bookmarks') {
        placeholder.dataset.folderName = row.groupKey;
        placeholder.dataset.folderId = row.folderId;
        placeholder.classList.add('bookmark-folder-header');
        this.setupFolderDropTarget(placeholder);
      }
    } else {
      // Regular URL item
      const urlData = row.data;
      const urlItem = this.createUrlItem(urlData, urlData.domain, urlData.date);
      placeholder.className = urlItem.className;
      placeholder.innerHTML = '';  // Clear placeholder
      while (urlItem.firstChild) {
        placeholder.appendChild(urlItem.firstChild);  // Move (not copy) children
      }
      placeholder.style.height = `${this.urlListRowHeight}px`;
      placeholder.style.boxSizing = 'border-box';

      // For bookmarks view: make items draggable and droppable
      if (this.expandedViewType === 'bookmarks') {
        placeholder.draggable = true;
        placeholder.dataset.bookmarkId = urlData.id;
        placeholder.dataset.currentFolder = urlData.folder;
        placeholder.dataset.folderId = urlData.folderId;
        placeholder.dataset.folderName = urlData.folder;
        this.setupBookmarkDrag(placeholder, urlData);
        this.setupUrlItemDropTarget(placeholder);
      }
    }
};

// Build flat list of virtual rows from filtered URLs
BulletHistory.prototype.buildVirtualRows = function(filteredUrls) {
    this.virtualRows = [];
    let currentGroup = null;

    // Helper function to get group key for a URL item
    const getGroupKey = (urlData) => {
      if (this.expandedViewType === 'bookmarks') {
        return urlData.folder || 'Root';
      } else if (this.expandedViewType === 'active') {
        return urlData.windowId ? `window-${urlData.windowId}` : null;
      } else if (this.expandedViewType === 'domain') {
        // Domain view always groups by date
        return this.formatDate(new Date(urlData.lastVisit));
      } else if (this.expandedViewType === 'closed' || this.expandedViewType === 'full' || this.expandedViewType === 'recent') {
        if (this.sortMode === 'recent') {
          if (this.expandedViewType === 'closed') {
            return this.formatDate(new Date(urlData.closedAt));
          } else {
            return this.formatDate(new Date(urlData.lastVisit));
          }
        }
      }
      return null;
    };

    // Count items per group for all views with headers
    const groupCounts = {};
    filteredUrls.forEach(urlData => {
      const key = getGroupKey(urlData);
      if (key) {
        groupCounts[key] = (groupCounts[key] || 0) + 1;
      }
    });

    for (let i = 0; i < filteredUrls.length; i++) {
      const urlData = filteredUrls[i];

      // Determine group based on view type and sort mode
      let groupKey = null;
      let groupLabel = null;

      if (this.expandedViewType === 'bookmarks') {
        groupKey = urlData.folder || 'Root';
        groupLabel = groupKey;
      } else if (this.expandedViewType === 'active') {
        if (urlData.windowId) {
          groupKey = `window-${urlData.windowId}`;
          groupLabel = `Window ${urlData.windowId}`;
        }
      } else if (this.expandedViewType === 'domain') {
        // Domain view always groups by date
        groupKey = this.formatDate(new Date(urlData.lastVisit));
        groupLabel = this.formatDateHeader(groupKey);
      } else if (this.expandedViewType === 'closed' || this.expandedViewType === 'full' || this.expandedViewType === 'recent') {
        if (this.sortMode === 'recent') {
          if (this.expandedViewType === 'closed') {
            groupKey = this.formatDate(new Date(urlData.closedAt));
            groupLabel = this.formatDateHeader(groupKey);
          } else {
            groupKey = this.formatDate(new Date(urlData.lastVisit));
            groupLabel = this.formatDateHeader(groupKey);
          }
        }
      }

      // Add header row if group changed
      if (groupKey && groupKey !== currentGroup) {
        currentGroup = groupKey;
        const isCollapsed = this.collapsedGroups.has(groupKey);
        this.virtualRows.push({
          type: 'header',
          groupKey,
          groupLabel,
          folderId: urlData.folderId,
          isCollapsed,
          itemCount: groupCounts[groupKey] || 0
        });
      }

      // Skip items if group is collapsed
      if (groupKey && this.collapsedGroups.has(currentGroup)) {
        continue;
      }

      // Add item row
      this.virtualRows.push({
        type: 'item',
        index: i,
        data: urlData,
        groupKey
      });
    }
};

// Update virtual scroll container height after collapse/expand
BulletHistory.prototype.updateVirtualScrollHeight = function(animate) {
    const totalHeight = this.virtualRows.reduce((sum, row) => {
      return sum + (row.type === 'header' ? this.urlListHeaderHeight : this.urlListRowHeight);
    }, 0);

    const expandedView = document.getElementById('expandedView');
    const virtualContainer = expandedView?.querySelector('.virtual-scroll-container');
    if (virtualContainer) {
      if (animate) {
        virtualContainer.classList.add('animating');
        // Remove animation class after transition completes
        setTimeout(() => {
          virtualContainer.classList.remove('animating');
        }, 200);
      }
      virtualContainer.style.height = `${totalHeight}px`;
    }
};

// Render only visible items based on scroll position
BulletHistory.prototype.renderVisibleUrlItems = function(scrollContainer, contentContainer) {
    const scrollTop = scrollContainer.scrollTop;
    const viewportHeight = scrollContainer.clientHeight;

    // Find visible range
    let currentY = 0;
    let startIndex = -1;
    let endIndex = -1;
    let startY = 0;

    for (let i = 0; i < this.virtualRows.length; i++) {
      const row = this.virtualRows[i];
      const rowHeight = row.type === 'header' ? this.urlListHeaderHeight : this.urlListRowHeight;

      // Check if row is in visible range (with buffer)
      const rowTop = currentY;
      const rowBottom = currentY + rowHeight;

      if (rowBottom >= scrollTop - (this.urlListBuffer * this.urlListRowHeight) && startIndex === -1) {
        startIndex = i;
        startY = rowTop;
      }

      if (rowTop <= scrollTop + viewportHeight + (this.urlListBuffer * this.urlListRowHeight)) {
        endIndex = i;
      }

      currentY += rowHeight;
    }

    if (startIndex === -1) startIndex = 0;
    if (endIndex === -1) endIndex = this.virtualRows.length - 1;

    // Position content container
    contentContainer.style.top = `${startY}px`;

    // Clear and render visible items
    contentContainer.innerHTML = '';

    for (let i = startIndex; i <= endIndex && i < this.virtualRows.length; i++) {
      const row = this.virtualRows[i];

      if (row.type === 'header') {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'date-group-header collapsible-header';
        groupHeader.style.height = `${this.urlListHeaderHeight}px`;
        groupHeader.style.boxSizing = 'border-box';

        // Add collapsed class if group is collapsed
        if (row.isCollapsed) {
          groupHeader.classList.add('collapsed');
        }

        // Create chevron icon
        const chevron = document.createElement('span');
        chevron.className = 'group-chevron';
        chevron.innerHTML = '&#9662;'; // Down-pointing triangle
        groupHeader.appendChild(chevron);

        // Add group name
        const groupName = document.createElement('span');
        groupName.className = 'group-name';
        groupName.textContent = row.groupLabel;
        groupHeader.appendChild(groupName);

        // Add item count
        const itemCount = document.createElement('span');
        itemCount.className = 'group-item-count';
        itemCount.textContent = `(${row.itemCount})`;
        groupHeader.appendChild(itemCount);

        // Add click handler to toggle collapsed state
        groupHeader.addEventListener('click', (e) => {
          // Don't toggle if clicking during drag
          if (e.defaultPrevented) return;

          const groupKey = row.groupKey;
          const isExpanding = this.collapsedGroups.has(groupKey);

          // Immediate visual feedback - toggle collapsed class on clicked header
          groupHeader.classList.toggle('collapsed', !isExpanding);

          // Update state
          if (isExpanding) {
            this.collapsedGroups.delete(groupKey);
          } else {
            this.collapsedGroups.add(groupKey);
          }

          // Get containers
          const expandedView = document.getElementById('expandedView');
          const virtualContainer = expandedView.querySelector('.virtual-scroll-container');
          const contentContainer = virtualContainer.querySelector('.virtual-scroll-content');

          // Rebuild virtual rows and update height with animation
          this.buildVirtualRows(this.currentFilteredUrls);
          this.updateVirtualScrollHeight(true); // true = animate

          // Re-render visible items
          this.renderVisibleUrlItems(expandedView, contentContainer);
        });

        // For bookmarks view: also make folder headers drop targets
        if (this.expandedViewType === 'bookmarks') {
          groupHeader.dataset.folderName = row.groupKey;
          groupHeader.dataset.folderId = row.folderId;
          groupHeader.classList.add('bookmark-folder-header');
          this.setupFolderDropTarget(groupHeader);
        }

        contentContainer.appendChild(groupHeader);
      } else {
        const urlData = row.data;
        const urlItem = this.createUrlItem(urlData, urlData.domain, urlData.date);
        urlItem.style.height = `${this.urlListRowHeight}px`;
        urlItem.style.boxSizing = 'border-box';

        // For bookmarks view: make items draggable and droppable
        if (this.expandedViewType === 'bookmarks') {
          urlItem.draggable = true;
          urlItem.dataset.bookmarkId = urlData.id;
          urlItem.dataset.currentFolder = urlData.folder;
          urlItem.dataset.folderId = urlData.folderId;
          urlItem.dataset.folderName = urlData.folder;
          this.setupBookmarkDrag(urlItem, urlData);
          this.setupUrlItemDropTarget(urlItem);
        }

        contentContainer.appendChild(urlItem);
      }
    }
};

// Setup drag handlers for bookmark items
BulletHistory.prototype.setupBookmarkDrag = function(urlItem, urlData) {
    urlItem.addEventListener('dragstart', (e) => {
      // Store bookmark data in drag event
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({
        bookmarkId: urlData.id,
        currentFolder: urlData.folder,
        currentFolderId: urlData.folderId
      }));

      // Add visual feedback - make item semi-transparent
      urlItem.classList.add('dragging');
    });

    urlItem.addEventListener('dragend', (e) => {
      // Remove visual feedback
      urlItem.classList.remove('dragging');

      // Remove all drop target highlights
      document.querySelectorAll('.bookmark-folder-header').forEach(header => {
        header.classList.remove('drag-over', 'drag-invalid');
      });
    });
};

// Setup drop target handlers for folder headers
BulletHistory.prototype.setupFolderDropTarget = function(groupHeader) {
    const targetFolderId = groupHeader.dataset.folderId;
    const targetFolderName = groupHeader.dataset.folderName;

    groupHeader.addEventListener('dragover', (e) => {
      e.preventDefault(); // Allow drop
      e.dataTransfer.dropEffect = 'move';

      // Get dragged bookmark data
      try {
        const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

        // Check if dropping on same folder (invalid)
        if (dragData.currentFolder === targetFolderName) {
          groupHeader.classList.add('drag-invalid');
          groupHeader.classList.remove('drag-over');
        } else {
          groupHeader.classList.add('drag-over');
          groupHeader.classList.remove('drag-invalid');
        }
      } catch (err) {
        // Can't access dataTransfer during dragover in some browsers
        // Just show as valid drop target
        groupHeader.classList.add('drag-over');
      }
    });

    groupHeader.addEventListener('dragleave', (e) => {
      // Only remove highlight if actually leaving (not entering child)
      if (!groupHeader.contains(e.relatedTarget)) {
        groupHeader.classList.remove('drag-over', 'drag-invalid');
      }
    });

    groupHeader.addEventListener('drop', (e) => {
      e.preventDefault();
      groupHeader.classList.remove('drag-over', 'drag-invalid');

      // Get dragged bookmark data
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

      // Don't move if dropping on same folder
      if (dragData.currentFolder === targetFolderName) {
        console.log('Cannot drop bookmark in same folder');
        return;
      }

      // Move the bookmark using Chrome API
      chrome.bookmarks.move(dragData.bookmarkId, {
        parentId: targetFolderId
      }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to move bookmark:', chrome.runtime.lastError);
        } else {
          console.log('Bookmark moved successfully');
          // Refresh will happen automatically via onMoved listener
        }
      });
    });
};

// Setup drop target handlers for url items within bookmark groups
BulletHistory.prototype.setupUrlItemDropTarget = function(urlItem) {
    const targetFolderId = urlItem.dataset.folderId;
    const targetFolderName = urlItem.dataset.folderName;

    urlItem.addEventListener('dragover', (e) => {
      // Don't allow dropping on yourself
      const draggedId = e.dataTransfer.types.includes('text/plain');
      if (!draggedId) return;

      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      // Find the parent folder header to highlight
      const folderHeader = this.findFolderHeader(targetFolderName);

      if (folderHeader) {
        try {
          const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

          // Check if dropping on same folder (invalid)
          if (dragData.currentFolder === targetFolderName) {
            folderHeader.classList.add('drag-invalid');
            folderHeader.classList.remove('drag-over');
          } else {
            folderHeader.classList.add('drag-over');
            folderHeader.classList.remove('drag-invalid');
          }
        } catch (err) {
          // Can't access dataTransfer during dragover in some browsers
          folderHeader.classList.add('drag-over');
        }
      }
    });

    urlItem.addEventListener('dragleave', (e) => {
      // Find the folder header to remove highlight
      const folderHeader = this.findFolderHeader(targetFolderName);

      if (folderHeader && !urlItem.contains(e.relatedTarget)) {
        // Only remove if we're not moving to another element in the same group
        const relatedFolder = e.relatedTarget?.closest('.url-item')?.dataset?.folderName;
        const relatedHeader = e.relatedTarget?.classList?.contains('bookmark-folder-header');

        if (relatedFolder !== targetFolderName && !relatedHeader) {
          folderHeader.classList.remove('drag-over', 'drag-invalid');
        }
      }
    });

    urlItem.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find and remove highlight from folder header
      const folderHeader = this.findFolderHeader(targetFolderName);
      if (folderHeader) {
        folderHeader.classList.remove('drag-over', 'drag-invalid');
      }

      // Get dragged bookmark data
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));

      // Don't move if dropping on same folder
      if (dragData.currentFolder === targetFolderName) {
        console.log('Cannot drop bookmark in same folder');
        return;
      }

      // Move the bookmark using Chrome API
      chrome.bookmarks.move(dragData.bookmarkId, {
        parentId: targetFolderId
      }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to move bookmark:', chrome.runtime.lastError);
        } else {
          console.log('Bookmark moved successfully');
          // Refresh will happen automatically via onMoved listener
        }
      });
    });
};

// Helper to find folder header by folder name
BulletHistory.prototype.findFolderHeader = function(folderName) {
    const headers = document.querySelectorAll('.bookmark-folder-header');
    for (const header of headers) {
      if (header.dataset.folderName === folderName) {
        return header;
      }
    }
    return null;
};

// Setup drop target handlers for the url-list container (catches drops in gaps between items)
BulletHistory.prototype.setupUrlListDropTarget = function(urlList) {
    // Remove existing handlers to avoid duplicates
    urlList.removeEventListener('dragover', urlList._dragoverHandler);
    urlList.removeEventListener('drop', urlList._dropHandler);
    urlList.removeEventListener('dragleave', urlList._dragleaveHandler);

    // Find nearest folder based on Y position
    const findNearestFolder = (y) => {
      const headers = urlList.querySelectorAll('.bookmark-folder-header');
      let nearestHeader = null;
      let minDistance = Infinity;

      headers.forEach(header => {
        const rect = header.getBoundingClientRect();
        const headerMiddle = rect.top + rect.height / 2;
        const distance = Math.abs(y - headerMiddle);

        // Also check if we're below this header (prefer the folder we're in)
        if (y >= rect.top && (nearestHeader === null || rect.top > nearestHeader.getBoundingClientRect().top)) {
          nearestHeader = header;
          minDistance = 0;
        } else if (distance < minDistance && nearestHeader === null) {
          nearestHeader = header;
          minDistance = distance;
        }
      });

      return nearestHeader;
    };

    urlList._dragoverHandler = (e) => {
      // Only handle if the direct target is the urlList or spacer (not url-items or headers)
      if (e.target !== urlList && !e.target.classList.contains('url-list-spacer')) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Find nearest folder and highlight it
      const nearestHeader = findNearestFolder(e.clientY);
      if (nearestHeader) {
        // Clear other highlights
        urlList.querySelectorAll('.bookmark-folder-header').forEach(h => {
          if (h !== nearestHeader) {
            h.classList.remove('drag-over', 'drag-invalid');
          }
        });

        try {
          const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (dragData.currentFolder === nearestHeader.dataset.folderName) {
            nearestHeader.classList.add('drag-invalid');
            nearestHeader.classList.remove('drag-over');
          } else {
            nearestHeader.classList.add('drag-over');
            nearestHeader.classList.remove('drag-invalid');
          }
        } catch (err) {
          nearestHeader.classList.add('drag-over');
        }
      }
    };

    urlList._dragleaveHandler = (e) => {
      if (e.target !== urlList && !e.target.classList.contains('url-list-spacer')) {
        return;
      }
      // Only clear if leaving the container entirely
      if (!urlList.contains(e.relatedTarget)) {
        urlList.querySelectorAll('.bookmark-folder-header').forEach(h => {
          h.classList.remove('drag-over', 'drag-invalid');
        });
      }
    };

    urlList._dropHandler = (e) => {
      // Only handle if the direct target is the urlList or spacer
      if (e.target !== urlList && !e.target.classList.contains('url-list-spacer')) {
        return;
      }

      e.preventDefault();

      // Find nearest folder
      const nearestHeader = findNearestFolder(e.clientY);
      if (!nearestHeader) return;

      // Clear highlights
      urlList.querySelectorAll('.bookmark-folder-header').forEach(h => {
        h.classList.remove('drag-over', 'drag-invalid');
      });

      // Get dragged bookmark data
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      const targetFolderName = nearestHeader.dataset.folderName;
      const targetFolderId = nearestHeader.dataset.folderId;

      // Don't move if dropping on same folder
      if (dragData.currentFolder === targetFolderName) {
        return;
      }

      // Move the bookmark
      chrome.bookmarks.move(dragData.bookmarkId, {
        parentId: targetFolderId
      });
    };

    urlList.addEventListener('dragover', urlList._dragoverHandler);
    urlList.addEventListener('dragleave', urlList._dragleaveHandler);
    urlList.addEventListener('drop', urlList._dropHandler);
};

BulletHistory.prototype.createUrlItem = function(urlData, domain, date) {
    const urlItem = document.createElement('div');
    urlItem.className = 'url-item';

    // Left side: count + timestamp
    const leftDiv = document.createElement('div');
    leftDiv.className = 'url-item-left';

    const countSpan = document.createElement('span');
    countSpan.className = 'url-item-count';

    // For active tabs: show duration instead of visit count
    if (this.expandedViewType === 'active' && urlData.duration !== undefined) {
      countSpan.textContent = this.formatDuration(urlData.duration);
    } else {
      countSpan.textContent = `${urlData.visitCount}×`;
    }

    // Create time tracking span
    const timeSpan = document.createElement('span');
    timeSpan.className = 'url-item-time';

    // Check if this URL is currently open - use openedAt for accurate open time
    const openedAt = urlData.openedAt || this.openTabsByUrl[urlData.url];

    // Helper to format today's open time for url-item-time display
    const formatOpenToday = (seconds) => {
      if (seconds >= 3600) {
        return `${Math.floor(seconds / 3600)}h`;
      } else if (seconds >= 60) {
        return `${Math.floor(seconds / 60)}m`;
      } else {
        return `${seconds}s`;
      }
    };

    if (openedAt) {
      // URL is currently open - calculate today's open time
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();

      let liveOpenToday;
      if (openedAt >= todayStartMs) {
        // Tab was opened today - all live time counts as today
        liveOpenToday = Math.floor((now - openedAt) / 1000);
      } else {
        // Tab was opened before today - only time since midnight counts as today
        liveOpenToday = Math.floor((now - todayStartMs) / 1000);
      }

      const cachedTimeData = this.getCachedUrlTimeData(urlData.url);
      const storedOpenToday = cachedTimeData?.openTodaySeconds || 0;
      const openTodayTotal = storedOpenToday + liveOpenToday;

      timeSpan.textContent = formatOpenToday(openTodayTotal);
      timeSpan.title = `Open today: ${formatOpenToday(openTodayTotal)}`;
    } else {
      // URL is not currently open - use stored time data for today
      const cachedTimeData = this.getCachedUrlTimeData(urlData.url);
      if (cachedTimeData !== null && cachedTimeData.openTodaySeconds > 0) {
        timeSpan.textContent = formatOpenToday(cachedTimeData.openTodaySeconds);
        timeSpan.title = `Open today: ${formatOpenToday(cachedTimeData.openTodaySeconds)}`;
      }

      // Always load to populate cache for future renders (if not already cached)
      if (cachedTimeData === null && this.urlTimeCache[urlData.url] === undefined) {
        this.loadUrlTimeData(urlData.url).then(timeData => {
          if (timeData && timeData.openTodaySeconds > 0) {
            timeSpan.textContent = formatOpenToday(timeData.openTodaySeconds);
            timeSpan.title = `Open today: ${formatOpenToday(timeData.openTodaySeconds)}`;
          }
        });
      }
    }

    // Create timestamp
    const timestamp = document.createElement('span');
    timestamp.className = 'url-timestamp';
    const lastVisitDate = new Date(urlData.lastVisit);

    // Format as 12-hour time (e.g., 6:49pm)
    const hours24 = lastVisitDate.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = String(lastVisitDate.getMinutes()).padStart(2, '0');
    const ampm = hours24 < 12 ? 'am' : 'pm';
    const timeText = `${hours12}:${minutes}${ampm}`;

    timestamp.textContent = timeText;
    timestamp.title = lastVisitDate.toLocaleString();

    leftDiv.appendChild(countSpan);
    leftDiv.appendChild(timestamp);
    leftDiv.appendChild(timeSpan);

    // Actions (shown on hover, on the right side)
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'url-item-actions';

    // For bookmarks view: Show "Manage" button instead of delete
    if (this.expandedViewType === 'bookmarks') {
      const manageBtn = document.createElement('button');
      manageBtn.className = 'icon-btn manage';
      manageBtn.textContent = '⚙️ Manage';
      manageBtn.title = 'Manage bookmark in Chrome';
      manageBtn.addEventListener('click', () => {
        // Open Chrome's bookmark manager to the specific folder
        const folderId = urlData.folderId || '';
        const bookmarkUrl = folderId ? `chrome://bookmarks/?id=${folderId}` : 'chrome://bookmarks/';
        chrome.tabs.create({ url: bookmarkUrl });
      });
      actionsDiv.appendChild(manageBtn);
    } else if (this.expandedViewType === 'active' && urlData.tabId) {
      // For active tabs view: Show close tab button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'icon-btn delete';
      closeBtn.textContent = '✕ Close';
      closeBtn.title = 'Close tab';
      closeBtn.addEventListener('click', async (e) => {
        // Find the parent url-item element
        const urlItem = e.target.closest('.url-item');

        // Add deleting animation
        if (urlItem) {
          urlItem.classList.add('deleting');
        }

        // Close the tab
        chrome.tabs.remove(urlData.tabId, () => {
          // After animation, refresh the active tabs view
          setTimeout(() => {
            this.showActiveTabs();
          }, 250);
        });
      });
      actionsDiv.appendChild(closeBtn);
    } else {
      // For other views: Show delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-btn delete';
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.title = 'Delete from history';
      deleteBtn.addEventListener('click', (e) => {
        // Find the parent url-item element
        const urlItem = e.target.closest('.url-item');
        // Trigger delete animation, then delete
        this.deleteUrlWithAnimation(urlItem, urlData.url, domain, date);
      });
      actionsDiv.appendChild(deleteBtn);
    }

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'icon-btn bookmark';
    bookmarkBtn.textContent = '⭐ Favorite';
    bookmarkBtn.title = 'Toggle bookmark';
    bookmarkBtn.addEventListener('click', () => this.toggleBookmark(urlData.url, urlData.title, bookmarkBtn));

    // Check if URL is already bookmarked
    this.checkBookmarkStatus(urlData.url, bookmarkBtn);

    actionsDiv.appendChild(bookmarkBtn);

    // Right side: Favicon + URL as clickable link
    const rightDiv = document.createElement('div');
    rightDiv.className = 'url-item-right';

    // Add favicon
    const favicon = document.createElement('img');
    favicon.className = 'url-favicon';

    // Extract hostname for favicon fallback
    let faviconDomain;
    try {
      const urlObj = new URL(urlData.url);
      faviconDomain = urlObj.hostname;
    } catch (e) {
      faviconDomain = urlData.domain || urlData.url;
    }

    // Priority order for favicon:
    // 1. Cached favicon from active tabs
    // 2. Favicon from Chrome History API
    // 3. Google's favicon service
    const cachedFavicon = this.faviconCache[urlData.url]?.favicon;
    const hasCachedFavicon = cachedFavicon &&
                             cachedFavicon.length > 0 &&
                             !cachedFavicon.startsWith('chrome://');

    const hasFavicon = urlData.favIconUrl &&
                       urlData.favIconUrl.length > 0 &&
                       !urlData.favIconUrl.startsWith('chrome://');
    const fallbackSrc = `https://www.google.com/s2/favicons?domain=https://${faviconDomain}&sz=16`;

    // Use cached favicon first, then urlData favicon, then fallback
    favicon.src = hasCachedFavicon ? cachedFavicon : (hasFavicon ? urlData.favIconUrl : fallbackSrc);
    favicon.alt = '';
    favicon.width = 16;
    favicon.height = 16;

    // Add error handler with multi-level fallback
    let fallbackAttempts = 0;
    const fallbackUrls = [];

    try {
      const urlObj = new URL(urlData.url);
      fallbackUrls.push(fallbackSrc);
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        const origin = `${urlObj.protocol}//${urlObj.hostname}`;
        fallbackUrls.push(
          `${origin}/favicon.ico`,
          `${origin}/favicon.png`,
          `${origin}/apple-touch-icon.png`
        );
      }
      fallbackUrls.push(`https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`);
    } catch (e) {
      fallbackUrls.push(fallbackSrc);
    }

    favicon.onerror = () => {
      fallbackAttempts++;
      if (fallbackAttempts < fallbackUrls.length) {
        favicon.src = fallbackUrls[fallbackAttempts];
      } else {
        // All fallbacks failed - hide the broken image
        favicon.style.display = 'none';
      }
    };

    // For active tabs, make favicon also switch to the tab
    if (this.expandedViewType === 'active' && urlData.tabId) {
      favicon.style.cursor = 'pointer';
      favicon.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const tab = await chrome.tabs.get(urlData.tabId);
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(urlData.tabId, { active: true });
        } catch (error) {
          console.warn('Could not switch to tab:', error);
          this.showActiveTabs();
        }
      });
    }

    // Container for title and URL
    const urlTextContainer = document.createElement('div');
    urlTextContainer.className = 'url-text-container';

    const urlLink = document.createElement('a');
    urlLink.href = urlData.url;
    urlLink.className = 'url-title';

    // Show title if available, otherwise show URL
    const displayText = urlData.title || urlData.url;
    urlLink.textContent = displayText;

    // Add hover display (shows full title + URL)
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';

    // Add full title if it differs from what's shown (truncated via CSS)
    if (urlData.title && urlData.title.length > 0) {
      const fullTitle = document.createElement('div');
      fullTitle.className = 'url-display-title';
      fullTitle.textContent = urlData.title;
      urlDisplay.appendChild(fullTitle);
    }

    // Add URL below title (limited to 3 lines via CSS)
    const fullUrl = document.createElement('div');
    fullUrl.className = 'url-display-url';
    fullUrl.textContent = urlData.url;
    urlDisplay.appendChild(fullUrl);

    // Helper to format time for display
    const formatTimeDisplay = (seconds) => {
      if (seconds >= 86400) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        return h > 0 ? `${d}d ${h}h` : `${d}d`;
      } else if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      } else if (seconds >= 60) {
        return `${Math.floor(seconds / 60)}m`;
      } else {
        return `${seconds}s`;
      }
    };

    // Today's stats section
    const todaySection = document.createElement('div');
    todaySection.className = 'url-display-section';

    // Visit Day row
    const visitDayRow = document.createElement('div');
    visitDayRow.className = 'url-display-row';
    if (urlData.lastVisit) {
      const lastVisitDate = new Date(urlData.lastVisit);
      const dayFormat = lastVisitDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      visitDayRow.innerHTML = `<span class="meta-label">Visit Day:</span> ${dayFormat}`;
    }
    todaySection.appendChild(visitDayRow);

    // Visit Time(s) row - fetch all visits for today
    const visitTimeRow = document.createElement('div');
    visitTimeRow.className = 'url-display-row';
    todaySection.appendChild(visitTimeRow);

    // Async: Get all visits for this URL today
    if (urlData.url) {
      chrome.history.getVisits({ url: urlData.url }).then(visits => {
        // Filter to today's visits
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();

        const todayVisits = visits.filter(v => v.visitTime >= todayStartMs);

        if (todayVisits.length > 0) {
          // Sort by time (earliest first)
          todayVisits.sort((a, b) => a.visitTime - b.visitTime);

          // Format each visit time
          const formatVisitTime = (timestamp) => {
            const date = new Date(timestamp);
            const hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            const hours12 = hours % 12 || 12;
            return `${hours12}:${minutes}${ampm}`;
          };

          const timeStrings = todayVisits.map(v => formatVisitTime(v.visitTime));
          const label = todayVisits.length === 1 ? 'Visit Time:' : 'Visit Times:';
          visitTimeRow.innerHTML = `<span class="meta-label">${label}</span> ${timeStrings.join(', ')}`;
        } else if (urlData.lastVisit) {
          // Fallback to last visit if no visits found today
          const lastVisitDate = new Date(urlData.lastVisit);
          const hours = lastVisitDate.getHours();
          const minutes = String(lastVisitDate.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'pm' : 'am';
          const hours12 = hours % 12 || 12;
          visitTimeRow.innerHTML = `<span class="meta-label">Visit Time:</span> ${hours12}:${minutes}${ampm}`;
        }
      }).catch(() => {
        // Fallback on error
        if (urlData.lastVisit) {
          const lastVisitDate = new Date(urlData.lastVisit);
          const hours = lastVisitDate.getHours();
          const minutes = String(lastVisitDate.getMinutes()).padStart(2, '0');
          const ampm = hours >= 12 ? 'pm' : 'am';
          const hours12 = hours % 12 || 12;
          visitTimeRow.innerHTML = `<span class="meta-label">Visit Time:</span> ${hours12}:${minutes}${ampm}`;
        }
      });
    }

    // Active Time (today) row
    const activeTodayRow = document.createElement('div');
    activeTodayRow.className = 'url-display-row';
    todaySection.appendChild(activeTodayRow);

    // Open Time (today) row
    const openTodayRow = document.createElement('div');
    openTodayRow.className = 'url-display-row url-display-row-open';
    todaySection.appendChild(openTodayRow);

    urlDisplay.appendChild(todaySection);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'url-display-divider';
    urlDisplay.appendChild(divider);

    // Totals section
    const totalsSection = document.createElement('div');
    totalsSection.className = 'url-display-section';

    // Total Visits row
    const totalVisitsRow = document.createElement('div');
    totalVisitsRow.className = 'url-display-row';
    totalVisitsRow.innerHTML = `<span class="meta-label">Total Visits:</span> ${urlData.visitCount || 1}`;
    totalsSection.appendChild(totalVisitsRow);

    // Total Active Time row
    const totalActiveRow = document.createElement('div');
    totalActiveRow.className = 'url-display-row';
    totalsSection.appendChild(totalActiveRow);

    // Total Open Time row
    const totalOpenRow = document.createElement('div');
    totalOpenRow.className = 'url-display-row';
    totalsSection.appendChild(totalOpenRow);

    urlDisplay.appendChild(totalsSection);

    // Helper to populate time rows
    const populateTimeRows = (timeData, liveOpenToday = 0, liveTotalOpen = 0) => {
      const openToday = (timeData?.openTodaySeconds || 0) + liveOpenToday;
      const activeToday = timeData?.activeTodaySeconds || 0;
      const totalOpen = (timeData?.openSeconds || 0) + liveTotalOpen;
      const totalActive = timeData?.activeSeconds || 0;

      activeTodayRow.innerHTML = `<span class="meta-label">Active Time:</span> ${formatTimeDisplay(activeToday)}`;
      openTodayRow.innerHTML = `<span class="meta-label">Open Time:</span> ${formatTimeDisplay(openToday)}`;
      totalActiveRow.innerHTML = `<span class="meta-label">Total Active Time:</span> ${formatTimeDisplay(totalActive)}`;
      totalOpenRow.innerHTML = `<span class="meta-label">Total Open Time:</span> ${formatTimeDisplay(totalOpen)}`;
    };

    // Calculate live open time for currently open tabs
    if (openedAt) {
      const now = Date.now();
      const liveTotalOpen = Math.floor((now - openedAt) / 1000);

      // Calculate how much of that is "today"
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartMs = todayStart.getTime();

      let liveOpenToday;
      if (openedAt >= todayStartMs) {
        // Tab was opened today - all live time counts as today
        liveOpenToday = liveTotalOpen;
      } else {
        // Tab was opened before today - only time since midnight counts as today
        liveOpenToday = Math.floor((now - todayStartMs) / 1000);
      }

      const cachedTime = this.getCachedUrlTimeData(urlData.url);
      populateTimeRows(cachedTime, liveOpenToday, liveTotalOpen);
    } else {
      // URL is not currently open - use stored time data only
      const cachedTime = this.getCachedUrlTimeData(urlData.url);
      if (cachedTime !== null) {
        populateTimeRows(cachedTime);
      } else if (this.urlTimeCache[urlData.url] === undefined) {
        // Load async if not yet cached
        this.loadUrlTimeData(urlData.url).then(data => populateTimeRows(data));
      } else {
        populateTimeRows(null);
      }
    }

    // Add actions inside the hover display
    urlDisplay.appendChild(actionsDiv);

    // For active tabs, switch to the tab instead of opening a new one
    if (this.expandedViewType === 'active' && urlData.tabId) {
      urlLink.href = '#'; // Prevent normal navigation
      urlLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          // Get the tab to find its windowId
          const tab = await chrome.tabs.get(urlData.tabId);
          // Focus the window
          await chrome.windows.update(tab.windowId, { focused: true });
          // Activate the tab
          await chrome.tabs.update(urlData.tabId, { active: true });
        } catch (error) {
          console.warn('Could not switch to tab:', error);
          // Tab might have been closed, refresh the view
          this.showActiveTabs();
        }
      });
    } else {
      urlLink.target = '_blank';
      urlLink.rel = 'noopener noreferrer';
    }

    urlTextContainer.appendChild(urlLink);
    urlTextContainer.appendChild(urlDisplay);

    rightDiv.appendChild(favicon);
    rightDiv.appendChild(urlTextContainer);

    urlItem.appendChild(leftDiv);
    urlItem.appendChild(rightDiv);

    return urlItem;
};

// Attach URL preview tooltip to a URL item
BulletHistory.prototype.attachUrlPreview = function(urlItem, urlData) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');
    let hoverTimeout;

    urlItem.addEventListener('mouseenter', (e) => {
      // Delay showing the preview slightly
      hoverTimeout = setTimeout(() => {
        this.showUrlPreview(urlData, e);
      }, 300);
    });

    urlItem.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      previewTooltip.classList.remove('visible');
    });

    urlItem.addEventListener('mousemove', (e) => {
      if (previewTooltip.classList.contains('visible')) {
        this.positionUrlPreview(e);
      }
    });
};

// Show URL preview tooltip
BulletHistory.prototype.showUrlPreview = async function(urlData, event) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');

    // Format last visit date
    const lastVisitDate = new Date(urlData.lastVisit);
    const now = new Date();
    const diffMs = now - lastVisitDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo;
    if (diffMins < 1) {
      timeAgo = 'Just now';
    } else if (diffMins < 60) {
      timeAgo = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      timeAgo = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      timeAgo = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      timeAgo = lastVisitDate.toLocaleDateString();
    }

    // Determine if this is from recently closed view
    const isClosedTab = this.expandedViewType === 'closed';
    const timeLabel = isClosedTab ? 'Closed' : 'Last visited';

    // Determine favicon source - check cache first
    let previewFaviconSrc;
    const cachedFavicon = this.faviconCache[urlData.url]?.favicon;
    if (cachedFavicon && cachedFavicon.length > 0 && !cachedFavicon.startsWith('chrome://')) {
      previewFaviconSrc = cachedFavicon;
    } else if (urlData.favIconUrl) {
      previewFaviconSrc = urlData.favIconUrl;
    } else {
      try {
        const urlObj = new URL(urlData.url);
        previewFaviconSrc = `https://www.google.com/s2/favicons?domain=https://${urlObj.hostname}&sz=32`;
      } catch (e) {
        previewFaviconSrc = `https://www.google.com/s2/favicons?domain=${urlData.url}&sz=32`;
      }
    }

    // Show loading state first
    previewTooltip.innerHTML = `
      <div class="url-preview-content">
        <div class="url-preview-header">
          <img src="${previewFaviconSrc}"
               class="url-preview-favicon"
               width="32"
               height="32"
               alt=""
               onerror="(function(t){const tries=['1','2','3','4','5'];const idx=parseInt(t.dataset.tried||'0');if(idx<tries.length){t.dataset.tried=tries[idx];try{const u=new URL('${urlData.url}');const isHttp=u.protocol==='http:'||u.protocol==='https:';const urls=isHttp?[u.protocol+'//'+u.hostname+'/favicon.ico',u.protocol+'//'+u.hostname+'/favicon.png',u.protocol+'//'+u.hostname+'/apple-touch-icon.png','https://icons.duckduckgo.com/ip3/'+u.hostname+'.ico','']:['https://icons.duckduckgo.com/ip3/'+u.hostname+'.ico',''];t.src=urls[idx]||'';if(!urls[idx])t.style.display='none';}catch(e){t.style.display='none';}}else{t.style.display='none';}})(this)">
          <div class="url-preview-title">${urlData.title || 'Untitled'}</div>
        </div>
        <div class="url-preview-url">${urlData.url}</div>
        <div class="url-preview-meta">
          ${isClosedTab ? '' : `<div class="url-preview-meta-item">
            <span class="url-preview-meta-label">Visits</span>
            <span class="url-preview-meta-value">${urlData.visitCount}</span>
          </div>`}
          <div class="url-preview-meta-item">
            <span class="url-preview-meta-label">${timeLabel}</span>
            <span class="url-preview-meta-value">${timeAgo} (${lastVisitDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })})</span>
          </div>
        </div>
      </div>
    `;

    this.positionUrlPreview(event);
    previewTooltip.classList.add('visible');

    // Fetch OG metadata (title and description only)
    const ogData = await this.fetchOpenGraphData(urlData.url);

    // Update with OG data if available
    const descriptionHtml = ogData.description ? `
      <div class="url-preview-description">${ogData.description}</div>
    ` : '';

    previewTooltip.innerHTML = `
      <div class="url-preview-content">
        <div class="url-preview-header">
          <img src="${(() => {
            if (urlData.favIconUrl) return urlData.favIconUrl;
            try {
              const urlObj = new URL(urlData.url);
              return `https://www.google.com/s2/favicons?domain=https://${urlObj.hostname}&sz=32`;
            } catch (e) {
              return `https://www.google.com/s2/favicons?domain=${urlData.url}&sz=32`;
            }
          })()}"
               class="url-preview-favicon"
               width="32"
               height="32"
               alt=""
               onerror="(function(t){const tries=['1','2','3','4','5'];const idx=parseInt(t.dataset.tried||'0');if(idx<tries.length){t.dataset.tried=tries[idx];try{const u=new URL('${urlData.url}');const isHttp=u.protocol==='http:'||u.protocol==='https:';const urls=isHttp?[u.protocol+'//'+u.hostname+'/favicon.ico',u.protocol+'//'+u.hostname+'/favicon.png',u.protocol+'//'+u.hostname+'/apple-touch-icon.png','https://icons.duckduckgo.com/ip3/'+u.hostname+'.ico','']:['https://icons.duckduckgo.com/ip3/'+u.hostname+'.ico',''];t.src=urls[idx]||'';if(!urls[idx])t.style.display='none';}catch(e){t.style.display='none';}}else{t.style.display='none';}})(this)">
          <div class="url-preview-title">${ogData.title || urlData.title || 'Untitled'}</div>
        </div>
        ${descriptionHtml}
        <div class="url-preview-url">${urlData.url}</div>
        <div class="url-preview-meta">
          ${isClosedTab ? '' : `<div class="url-preview-meta-item">
            <span class="url-preview-meta-label">Visits</span>
            <span class="url-preview-meta-value">${urlData.visitCount}</span>
          </div>`}
          <div class="url-preview-meta-item">
            <span class="url-preview-meta-label">${timeLabel}</span>
            <span class="url-preview-meta-value">${timeAgo} (${lastVisitDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })})</span>
          </div>
        </div>
      </div>
    `;

    this.positionUrlPreview(event);
};

// Position the URL preview tooltip
BulletHistory.prototype.positionUrlPreview = function(event) {
    const previewTooltip = document.getElementById('urlPreviewTooltip');
    const offsetX = 15;
    const offsetY = 15;

    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;

    // Get tooltip dimensions
    const rect = previewTooltip.getBoundingClientRect();

    // Prevent tooltip from going off screen
    if (x + rect.width > window.innerWidth) {
      x = event.clientX - rect.width - offsetX;
    }

    if (y + rect.height > window.innerHeight) {
      y = event.clientY - rect.height - offsetY;
    }

    previewTooltip.style.left = `${x}px`;
    previewTooltip.style.top = `${y}px`;
};

// Fetch Open Graph metadata (title and description only, no images)
BulletHistory.prototype.fetchOpenGraphData = async function(url) {
    // Check cache first
    if (this.ogCache.has(url)) {
      return this.ogCache.get(url);
    }

    // Default empty data
    const defaultData = {
      title: null,
      description: null
    };

    try {
      // Fetch the HTML page
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
      });

      if (!response.ok) {
        this.ogCache.set(url, defaultData);
        return defaultData;
      }

      const html = await response.text();

      // Parse OG meta tags
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const ogData = {
        title: this.getMetaContent(doc, 'og:title') || this.getMetaContent(doc, 'twitter:title'),
        description: this.getMetaContent(doc, 'og:description') || this.getMetaContent(doc, 'twitter:description') || this.getMetaContent(doc, 'description')
      };

      // Cache the result
      this.ogCache.set(url, ogData);

      return ogData;
    } catch (error) {
      // CORS blocked or other error - cache empty data
      this.ogCache.set(url, defaultData);
      return defaultData;
    }
};

// Helper to extract meta tag content
BulletHistory.prototype.getMetaContent = function(doc, property) {
    const meta = doc.querySelector(`meta[property="${property}"]`) ||
                 doc.querySelector(`meta[name="${property}"]`);
    return meta ? meta.getAttribute('content') : null;
};

// Update main section to account for expanded view height
BulletHistory.prototype.updateExpandedViewPadding = function() {
    requestAnimationFrame(() => {
      const expandedView = document.getElementById('expandedView');
      const mainSection = document.querySelector('.main-section');

      if (expandedView.style.display === 'block') {
        const expandedHeight = expandedView.offsetHeight;
        mainSection.style.paddingBottom = `${expandedHeight}px`;
      } else {
        mainSection.style.paddingBottom = '0';
      }
    });
};

// Close expanded view with animation
BulletHistory.prototype.closeExpandedView = function() {
    const expandedView = document.getElementById('expandedView');

    // Restore full domain list if it was filtered
    this.restoreAllDomains();

    // Clear active menu button state
    this.setActiveMenuButton(null);

    // Add slide-out animation
    expandedView.classList.add('slide-out');

    // Wait for animation to complete before hiding
    setTimeout(() => {
      expandedView.style.display = 'none';
      expandedView.classList.remove('slide-out');
      this.updateExpandedViewPadding();

      // Trigger virtual grid update after viewport height changes
      // Use another requestAnimationFrame to ensure padding update is complete
      requestAnimationFrame(() => {
        this.updateVirtualGrid();
      });
    }, 200); // Match slide-out duration

    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected');
      this.selectedCell = null;
    }

    this.expandedViewType = null;
    this.previousExpandedViewType = null; // Reset so next view opens scrolls to top
    this.currentDomain = null;
    this.currentDate = null;
    this.currentHour = null;
};

// Show expanded view with animation
BulletHistory.prototype.showExpandedViewAnimated = function() {
    const expandedView = document.getElementById('expandedView');

    // Check if already open - if so, skip animation
    const wasAlreadyOpen = expandedView.style.display === 'block';

    // Check if we're switching to a different view type
    const viewTypeChanged = this.previousExpandedViewType !== this.expandedViewType;

    // Set display first
    expandedView.style.display = 'block';

    // Only scroll to top when switching to a different view type
    if (viewTypeChanged) {
      expandedView.scrollTop = 0;
    }

    // Store current view type for next comparison
    this.previousExpandedViewType = this.expandedViewType;

    // Only animate if it wasn't already open
    if (!wasAlreadyOpen) {
      // Force reflow to ensure display change is applied
      expandedView.offsetHeight;

      // Add slide-in animation
      expandedView.classList.add('slide-in');

      // Remove animation class after it completes
      setTimeout(() => {
        expandedView.classList.remove('slide-in');
      }, 250); // Match slide-in duration
    }

    this.updateExpandedViewPadding();

    // Trigger virtual grid update after viewport height changes
    requestAnimationFrame(() => {
      this.updateVirtualGrid();
    });
};

// Navigate to previous or next day for the same domain
BulletHistory.prototype.navigateDay = function(domain, currentDate, direction) {
    // Get all dates for this domain sorted chronologically
    const domainDates = Object.keys(this.historyData[domain].days).sort();

    // Find current date index
    const currentIndex = domainDates.indexOf(currentDate);

    if (currentIndex === -1) return;

    // Get next/prev date
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < domainDates.length) {
      const newDate = domainDates[newIndex];
      const dayData = this.historyData[domain].days[newDate];

      // Update selected cell
      if (this.selectedCell) {
        this.selectedCell.classList.remove('selected');
      }

      // Find and select the new cell (if visible)
      const colIndex = this.dates.indexOf(newDate);
      const rowIndex = this.sortedDomains.indexOf(domain);
      const newCell = document.querySelector(`.cell[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);

      if (newCell) {
        newCell.classList.add('selected');
        this.selectedCell = newCell;
      } else {
        this.selectedCell = null;
      }

      // Show expanded view for new date
      this.showExpandedView(domain, newDate, dayData.count);
    }
};

// Navigate to previous or next hour for the same domain (for hourly view)
BulletHistory.prototype.navigateDomainHour = function(domain, currentHourStr, direction) {
    // Get all hours where this domain has data
    const domainHours = [];
    if (this.hourlyData[domain]) {
      for (const hourStr of this.hours) {
        if (this.hourlyData[domain][hourStr] && this.hourlyData[domain][hourStr].count > 0) {
          domainHours.push(hourStr);
        }
      }
    }

    if (domainHours.length === 0) return;

    // Find current hour index
    const currentIndex = domainHours.indexOf(currentHourStr);

    if (currentIndex === -1) return;

    // Get next/prev hour
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < domainHours.length) {
      const newHourStr = domainHours[newIndex];
      const hourData = this.hourlyData[domain][newHourStr];

      // Update selected cell
      if (this.selectedCell) {
        this.selectedCell.classList.remove('selected');
      }

      // Find the cell for this domain and hour
      const colIndex = this.hours.indexOf(newHourStr);
      const rowIndex = this.sortedDomains.indexOf(domain);
      const newCell = document.querySelector(`.cell[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);

      if (newCell) {
        newCell.classList.add('selected');
        this.selectedCell = newCell;
      } else {
        this.selectedCell = null;
      }

      // Show expanded view for new domain-hour
      this.showDomainHourView(domain, newHourStr, hourData.count);
    }
};

// Update navigation button states based on available data
BulletHistory.prototype.updateNavButtons = function(domain, currentDate) {
    const prevBtn = document.getElementById('prevDay');
    const nextBtn = document.getElementById('nextDay');

    if (!prevBtn || !nextBtn) return;

    // Get all dates for this domain sorted chronologically
    const domainDates = Object.keys(this.historyData[domain].days).sort();

    // Find current date index
    const currentIndex = domainDates.indexOf(currentDate);

    // Disable buttons at boundaries
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= domainDates.length - 1;
};

// Delete URL with animation
BulletHistory.prototype.deleteUrlWithAnimation = function(urlItemElement, url, domain, date) {
    if (urlItemElement) {
      // Add deleting class to trigger animation
      urlItemElement.classList.add('deleting');

      // Wait for animation to complete before deleting
      setTimeout(() => {
        this.deleteUrl(url, domain, date);
      }, 250); // Match slideOutLeft duration
    } else {
      // No element to animate, delete immediately
      this.deleteUrl(url, domain, date);
    }
};

// Delete URL from history
BulletHistory.prototype.deleteUrl = async function(url, domain, date) {
    // Delete from Chrome history
    chrome.history.deleteUrl({ url: url }, async () => {

      // If in closed tabs view, also remove from closed tabs storage
      if (this.expandedViewType === 'closed') {
        const result = await chrome.storage.local.get(['closedTabs']);
        const closedTabs = result.closedTabs || [];
        const updatedClosedTabs = closedTabs.filter(tab => tab.url !== url);
        await chrome.storage.local.set({ closedTabs: updatedClosedTabs });
      }

      // Update local data based on view mode
      if (this.viewMode === 'hour' && date.includes('T')) {
        // In hour view, date is hourStr - update hourly data
        if (this.hourlyData[domain] && this.hourlyData[domain][date]) {
          const hourData = this.hourlyData[domain][date];
          const urlIndex = hourData.urls.findIndex(u => u.url === url);

          if (urlIndex !== -1) {
            hourData.urls.splice(urlIndex, 1);
            hourData.count--;

            // If no more URLs for this hour, remove the hour
            if (hourData.urls.length === 0) {
              delete this.hourlyData[domain][date];
            }

            // If domain has no more hours, remove domain from hourly data
            if (Object.keys(this.hourlyData[domain]).length === 0) {
              delete this.hourlyData[domain];
            }
          }
        }

        // Also update daily data
        const dayStr = date.split('T')[0];
        const dayData = this.historyData[domain]?.days[dayStr];
        if (dayData) {
          const urlIndex = dayData.urls.findIndex(u => u.url === url);
          if (urlIndex !== -1) {
            dayData.urls.splice(urlIndex, 1);
            dayData.count--;

            if (dayData.urls.length === 0) {
              delete this.historyData[domain].days[dayStr];
            }
          }
        }
      } else {
        // In day view - update daily data only
        const dayData = this.historyData[domain]?.days[date];
        if (dayData) {
          const urlIndex = dayData.urls.findIndex(u => u.url === url);
          if (urlIndex !== -1) {
            dayData.urls.splice(urlIndex, 1);
            dayData.count--;

            if (dayData.urls.length === 0) {
              delete this.historyData[domain].days[date];
            }
          }
        }
      }

      // If domain has no more days, remove domain and close view
      if (this.historyData[domain] && Object.keys(this.historyData[domain].days).length === 0) {
        delete this.historyData[domain];
        // Re-sort based on view mode
        if (this.viewMode === 'hour') {
          this.sortedDomains = this.sortDomainsForHourView();
        } else {
          this.sortedDomains = this.getSortedDomains();
        }
        this.closeExpandedView();

        // Force complete re-render
        this.virtualState = {
          startRow: -1,
          endRow: -1,
          startCol: -1,
          endCol: -1,
          viewportHeight: 0,
          viewportWidth: 0
        };
        this.setupVirtualGrid();
        this.updateVirtualGrid();
      } else {
        // Refresh the appropriate view
        if (this.expandedViewType === 'domain') {
          this.showDomainView(domain);

          // Force complete re-render
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        } else if (this.expandedViewType === 'cell') {
          // Refresh cell view based on current view mode
          if (this.viewMode === 'hour') {
            // In hour view, date is actually hourStr
            const newCount = this.hourlyData[domain]?.[date]?.count || 0;

            // Don't close the view, just refresh it
            this.showDomainHourView(domain, date, newCount);

            // Directly update the cell element in the grid
            const colIndex = this.hours.indexOf(date);
            const rowIndex = this.sortedDomains.indexOf(domain);

            if (colIndex !== -1 && rowIndex !== -1) {
              const cellElement = document.querySelector(`.cell[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);

              if (cellElement) {
                // Calculate maxCount for this domain (row-normalized)
                let maxCount = 0;
                if (this.hourlyData[domain]) {
                  Object.values(this.hourlyData[domain]).forEach(hourData => {
                    maxCount = Math.max(maxCount, hourData.count);
                  });
                }

                // Update cell appearance
                cellElement.dataset.count = newCount;

                if (newCount > 0) {
                  const baseColor = this.colors[domain];
                  cellElement.style.backgroundColor = this.getGitHubStyleColor(newCount, maxCount, baseColor);
                  cellElement.classList.remove('empty');
                  cellElement.textContent = '';
                } else {
                  cellElement.style.backgroundColor = '';
                  cellElement.classList.add('empty');
                  cellElement.textContent = '';
                }
              }
            }
          } else {
            // In day view
            const newCount = this.historyData[domain]?.days[date]?.count || 0;

            // Don't close the view, just refresh it
            this.showExpandedView(domain, date, newCount);

            // Directly update the cell element in the grid
            const colIndex = this.dates.indexOf(date);
            const rowIndex = this.sortedDomains.indexOf(domain);

            if (colIndex !== -1 && rowIndex !== -1) {
              const cellElement = document.querySelector(`.cell[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`);

              if (cellElement) {
                // Calculate maxCount for this domain (row-normalized)
                let maxCount = 0;
                Object.values(this.historyData[domain].days).forEach(day => {
                  maxCount = Math.max(maxCount, day.count);
                });

                // Update cell appearance
                cellElement.dataset.count = newCount;

                if (newCount > 0) {
                  const baseColor = this.colors[domain];
                  cellElement.style.backgroundColor = this.getGitHubStyleColor(newCount, maxCount, baseColor);
                  cellElement.classList.remove('empty');
                  cellElement.textContent = '';
                } else {
                  cellElement.style.backgroundColor = '';
                  cellElement.classList.add('empty');
                  cellElement.textContent = '';
                }
              }
            }
          }
        } else if (this.expandedViewType === 'day') {
          // Refresh day view with updated data
          this.showDayExpandedView(this.currentDate);

          // Force complete re-render
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        } else if (this.expandedViewType === 'hour') {
          // Refresh hour view with updated data
          this.showHourExpandedView(this.currentHour);

          // Force complete re-render
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        } else if (this.expandedViewType === 'full' || this.expandedViewType === 'recent') {
          // Refresh "All" view
          this.showFullHistory();

          // Force complete re-render
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        } else if (this.expandedViewType === 'closed') {
          // Refresh "Closed" view
          this.showRecentlyClosed();

          // Force complete re-render
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        } else {
          // For any other view (bookmarks, etc), just refresh the grid
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
          this.updateVirtualGrid();
        }
      }
    });
};

// Delete domain with animation
BulletHistory.prototype.deleteDomainWithAnimation = function(tldRowElement, domain) {
    if (tldRowElement) {
      // Add deleting class to trigger animation
      tldRowElement.classList.add('deleting');

      // Wait for animation to complete before deleting
      setTimeout(() => {
        this.deleteDomain(domain);
      }, 300); // Match shrinkRow duration
    } else {
      // No element to animate, delete immediately
      this.deleteDomain(domain);
    }
};

// Delete all history for a domain (alias for use in TLD row delete button)
BulletHistory.prototype.deleteDomainData = function(domain) {
    this.deleteDomain(domain);
};

// Delete all history for a domain
BulletHistory.prototype.deleteDomain = async function(domain) {
    if (!confirm(`Delete all history for ${domain}? This will remove all ${Object.keys(this.historyData[domain].days).length} days of history for this domain.`)) {
      return;
    }

    // Get all URLs for this domain
    const allUrls = [];
    Object.values(this.historyData[domain].days).forEach(dayData => {
      dayData.urls.forEach(urlData => {
        allUrls.push(urlData.url);
      });
    });

    // Delete each URL from Chrome history
    let deletedCount = 0;
    allUrls.forEach(url => {
      chrome.history.deleteUrl({ url: url }, () => {
        deletedCount++;

        // When all URLs are deleted, update UI
        if (deletedCount === allUrls.length) {

          // Remove domain from local data
          delete this.historyData[domain];

          // Also remove from hourly data if it exists
          if (this.hourlyData[domain]) {
            delete this.hourlyData[domain];
          }

          // Re-sort based on view mode
          if (this.viewMode === 'hour') {
            this.sortedDomains = this.sortDomainsForHourView();
          } else {
            this.sortedDomains = this.getSortedDomains();
          }

          // Close view and refresh grid
          this.closeExpandedView();

          // Force complete re-render by resetting virtual state
          this.virtualState = {
            startRow: -1,
            endRow: -1,
            startCol: -1,
            endCol: -1,
            viewportHeight: 0,
            viewportWidth: 0
          };
          this.setupVirtualGrid();
        }
      });
    });
};

// Check if URL is bookmarked and update button state
BulletHistory.prototype.checkBookmarkStatus = function(url, bookmarkBtn) {
    chrome.bookmarks.search({ url: url }, (results) => {
      if (results && results.length > 0) {
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.dataset.bookmarkId = results[0].id;
        bookmarkBtn.textContent = '⭐ Unfavorite';
      }
    });
};

// Toggle bookmark (add or remove)
BulletHistory.prototype.toggleBookmark = function(url, title, bookmarkBtn) {
    const bookmarkId = bookmarkBtn.dataset.bookmarkId;

    if (bookmarkId) {
      // Remove bookmark
      chrome.bookmarks.remove(bookmarkId, () => {
        bookmarkBtn.classList.remove('saved');
        delete bookmarkBtn.dataset.bookmarkId;
        bookmarkBtn.textContent = '⭐ Favorite';
      });
    } else {
      // Add bookmark
      chrome.bookmarks.create({
        title: title || url,
        url: url
      }, (bookmark) => {
        bookmarkBtn.classList.add('saved');
        bookmarkBtn.dataset.bookmarkId = bookmark.id;
        bookmarkBtn.textContent = '⭐ Unfavorite';
      });
    }
};

BulletHistory.prototype.showDayExpandedView = function(dateStr) {
    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Set view type
    this.expandedViewType = 'day';
    this.currentDomain = null;
    this.currentDate = dateStr;

    // Clear active menu button (day view is not triggered by menu buttons)
    this.setActiveMenuButton(null);

    // Restore full domain list (day view is date-specific)
    this.restoreAllDomains();

    // Remove delete domain button if it exists
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) {
      deleteBtn.remove();
    }

    // Format date nicely
    const dateObj = new Date(dateStr + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Collect all URLs from all domains for this date
    const allUrls = [];
    let totalCount = 0;

    for (const domain in this.historyData) {
      const dayData = this.historyData[domain].days[dateStr];
      if (dayData && dayData.urls) {
        dayData.urls.forEach(urlData => {
          allUrls.push({
            ...urlData,
            domain: domain,
            date: dateStr
          });
        });
        totalCount += dayData.count;
      }
    }

    // Sort based on current sort mode
    if (this.sortMode === 'popular') {
      // Most Popular: Sort by visit count (descending)
      allUrls.sort((a, b) => b.visitCount - a.visitCount);
    } else if (this.sortMode === 'alphabetical') {
      // Alphabetical: Sort by domain, then by URL
      allUrls.sort((a, b) => {
        const domainCompare = a.domain.localeCompare(b.domain);
        if (domainCompare !== 0) return domainCompare;
        return a.url.localeCompare(b.url);
      });
    } else {
      // Most Recent (default): Sort by most recent visit
      allUrls.sort((a, b) => b.lastVisit - a.lastVisit);
    }

    // Set title
    expandedTitle.textContent = `${formattedDate} (${totalCount} url${totalCount !== 1 ? 's' : ''})`;

    // Remove navigation controls if they exist (not needed for day view)
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) {
      navContainer.remove();
    }

    // Render calendar events for this date
    this.renderCalendarEventsForDate(dateStr);

    // Clear URL list
    urlList.innerHTML = '';

    if (allUrls.length === 0) {
      urlList.innerHTML = '<div class="no-urls">No visits on this day</div>';
    } else {
      // Only group by hour if sorting by recent time
      // For other sort modes, show flat list
      if (this.sortMode === 'recent') {
        // Group URLs by hour for better organization
        const urlsByHour = {};

      allUrls.forEach(urlData => {
        const visitDate = new Date(urlData.lastVisit);
        const hour = visitDate.getHours();
        const hourKey = `${String(hour).padStart(2, '0')}:00`;

        if (!urlsByHour[hourKey]) {
          urlsByHour[hourKey] = [];
        }
        urlsByHour[hourKey].push(urlData);
      });

      // Render URLs grouped by hour
      const hours = Object.keys(urlsByHour).sort().reverse(); // Most recent hour first

      hours.forEach(hourKey => {
        // Hour header
        const hourHeader = document.createElement('div');
        hourHeader.className = 'hour-group-header';
        const hourNum = parseInt(hourKey.split(':')[0]);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const displayHour = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
        hourHeader.textContent = `${displayHour}:00 ${ampm} (${urlsByHour[hourKey].length} visit${urlsByHour[hourKey].length !== 1 ? 's' : ''})`;
        urlList.appendChild(hourHeader);

        // URLs for this hour - use the standard createUrlItem method
        urlsByHour[hourKey].forEach(urlData => {
          const urlItem = this.createUrlItem(urlData, urlData.domain, dateStr);
          urlList.appendChild(urlItem);
        });
      });
      } else {
        // For popular and alphabetical sort modes, show flat list without hour grouping
        allUrls.forEach(urlData => {
          const urlItem = this.createUrlItem(urlData, urlData.domain, dateStr);
          urlList.appendChild(urlItem);
        });
      }
    }

    // Show the expanded view
    this.showExpandedViewAnimated();
};

// Show expanded view for a specific domain and hour
BulletHistory.prototype.showDomainHourView = async function(domain, hourStr, count) {
    // Refresh time data cache before showing URL items
    await this.refreshUrlTimeCache();

    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Set view type
    this.expandedViewType = 'cell';
    this.currentDomain = domain;
    this.currentDate = hourStr; // Store hourStr as currentDate for navigation

    // Hide calendar section (not used for single domain-hour view)
    const calendarSection = document.getElementById('calendarSection');
    if (calendarSection) {
      calendarSection.style.display = 'none';
    }

    // Parse hourStr (format: 'YYYY-MM-DDTHH')
    const [datePart, hourPart] = hourStr.split('T');
    const hourNum = parseInt(hourPart);

    // Format date and time nicely
    const dateObj = new Date(datePart + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Format hour for display
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
    const hourDisplay = `${displayHour}:00 ${ampm}`;

    // Remove delete domain button if it exists
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) {
      deleteBtn.remove();
    }

    // Remove navigation controls if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) {
      navContainer.remove();
    }

    // Get URLs for this domain and hour from Chrome history
    const hourData = this.hourlyData[domain]?.[hourStr];
    const historyUrls = hourData?.urls || [];

    // Get URLs from time tracking data (tabs that were open this hour)
    const timeTrackingUrls = this.getUrlsFromTimeData(domain, hourStr, true);

    // Merge URLs: start with history URLs, add time tracking URLs that aren't already included
    const historyUrlSet = new Set(historyUrls.map(u => u.url));
    const mergedUrls = [...historyUrls];

    // Add URLs from time tracking that aren't in history
    for (const url of timeTrackingUrls) {
      if (!historyUrlSet.has(url)) {
        mergedUrls.push({
          url: url,
          title: url,
          visitCount: 0,
          lastVisit: Date.now()
        });
      }
    }

    // Clear URL list
    urlList.innerHTML = '';

    // Get the actual unique URL count for this cell
    const actualCount = this.getUniqueUrlCountForCell(domain, hourStr, true);

    // Update title with actual count
    expandedTitle.textContent = `${domain} - ${formattedDate} ${hourDisplay} (${actualCount} url${actualCount !== 1 ? 's' : ''})`;

    if (mergedUrls.length === 0) {
      urlList.innerHTML = '<div class="no-urls">No URLs found</div>';
      this.showExpandedViewAnimated();
      return;
    }

    // Sort URLs based on current sort mode
    let urls = [...mergedUrls];
    if (this.sortMode === 'popular') {
      urls.sort((a, b) => b.visitCount - a.visitCount);
    } else if (this.sortMode === 'alphabetical') {
      urls.sort((a, b) => a.url.localeCompare(b.url));
    } else {
      // Most Recent (default) - URLs with visits first, then by time
      urls.sort((a, b) => {
        if (a.visitCount > 0 && b.visitCount === 0) return -1;
        if (a.visitCount === 0 && b.visitCount > 0) return 1;
        return b.lastVisit - a.lastVisit;
      });
    }

    // Add domain and hourStr to each URL (not datePart!)
    const urlsWithContext = urls.map(urlData => ({
      ...urlData,
      domain: domain,
      date: hourStr  // Pass full hourStr, not just datePart
    }));

    // Render URLs
    urlsWithContext.forEach(urlData => {
      const urlItem = this.createUrlItem(urlData, domain, hourStr);  // Pass hourStr, not datePart
      urlList.appendChild(urlItem);
    });

    // Show the expanded view
    this.showExpandedViewAnimated();
};

// Show expanded view for a specific hour with URLs and calendar events
BulletHistory.prototype.showHourExpandedView = async function(hourStr) {
    // Refresh time data cache before showing URL items
    await this.refreshUrlTimeCache();

    const expandedView = document.getElementById('expandedView');
    const expandedTitle = document.getElementById('expandedTitle');
    const urlList = document.getElementById('urlList');

    // Set view type
    this.expandedViewType = 'hour';
    this.currentDomain = null;
    this.currentDate = null;
    this.currentHour = hourStr;

    // Clear active menu button (hour view is not triggered by menu buttons)
    this.setActiveMenuButton(null);

    // Restore full domain list (hour view is hour-specific)
    this.restoreAllDomains();

    // Remove delete domain button if it exists
    const deleteBtn = document.getElementById('deleteDomain');
    if (deleteBtn) {
      deleteBtn.remove();
    }

    // Parse hourStr (format: 'YYYY-MM-DDTHH')
    const [datePart, hourPart] = hourStr.split('T');
    const hourNum = parseInt(hourPart);

    // Format date and time nicely
    const dateObj = new Date(datePart + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Format hour for display
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : (hourNum > 12 ? hourNum - 12 : hourNum);
    const hourDisplay = `${displayHour}:00 ${ampm}`;

    // Collect all URLs from all domains for this hour
    const allUrls = [];
    let totalCount = 0;

    for (const domain in this.hourlyData) {
      const hourData = this.hourlyData[domain]?.[hourStr];
      if (hourData && hourData.urls) {
        hourData.urls.forEach(urlData => {
          allUrls.push({
            ...urlData,
            domain: domain,
            date: datePart // Use date part for URL item creation
          });
        });
        totalCount += hourData.count;
      }
    }

    // Sort based on current sort mode
    if (this.sortMode === 'popular') {
      // Most Popular: Sort by visit count (descending)
      allUrls.sort((a, b) => b.visitCount - a.visitCount);
    } else if (this.sortMode === 'alphabetical') {
      // Alphabetical: Sort by domain, then by URL
      allUrls.sort((a, b) => {
        const domainCompare = a.domain.localeCompare(b.domain);
        if (domainCompare !== 0) return domainCompare;
        return a.url.localeCompare(b.url);
      });
    } else {
      // Most Recent (default): Sort by most recent visit
      allUrls.sort((a, b) => b.lastVisit - a.lastVisit);
    }

    // Set title
    expandedTitle.textContent = `${formattedDate} - ${hourDisplay} (${totalCount} url${totalCount !== 1 ? 's' : ''})`;

    // Remove navigation controls if they exist
    const navContainer = document.getElementById('expandedNav');
    if (navContainer) {
      navContainer.remove();
    }

    // Render calendar events for this specific hour
    this.renderCalendarEventsForHour(hourStr);

    // Clear URL list
    urlList.innerHTML = '';

    if (allUrls.length === 0) {
      urlList.innerHTML = '<div class="no-urls">No visits during this hour</div>';
    } else {
      // Render URLs based on sort mode
      allUrls.forEach(urlData => {
        const urlItem = this.createUrlItem(urlData, urlData.domain, hourStr);  // Pass hourStr, not datePart
        urlList.appendChild(urlItem);
      });
    }

    // Show the expanded view
    this.showExpandedViewAnimated();
};
