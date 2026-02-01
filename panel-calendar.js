// panel-calendar.js — Calendar integration UI

// Render calendar events for a specific hour in expanded view
BulletHistory.prototype.renderCalendarEventsForHour = function(hourStr) {
    const calendarSection = document.getElementById('calendarSection');
    const calendarEventsList = document.getElementById('calendarEventsList');

    // Only show if calendar integration is available
    if (typeof googleCalendar === 'undefined') {
      calendarSection.style.display = 'none';
      return;
    }

    // Parse hourStr (format: 'YYYY-MM-DDTHH')
    const [datePart, hourPart] = hourStr.split('T');
    const targetHour = parseInt(hourPart);

    // Get events for this date
    const events = googleCalendar.getEventsForDate(datePart);

    // Filter to only enabled calendars AND events that occur during this hour
    const enabledEvents = events.filter(event => {
      const calendar = googleCalendar.calendarData.calendars[event.calendarId];
      if (!calendar || !calendar.enabled) return false;

      // All-day events appear in every hour
      if (event.isAllDay) return true;

      // Timed events: check if this hour falls within the event time
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const startHour = startTime.getHours();
      const endHour = endTime.getHours();

      // Event occurs during this hour if:
      // - Event starts in this hour, OR
      // - Event ends in this hour, OR
      // - Event spans across this hour
      return (startHour <= targetHour && endHour >= targetHour) ||
             (startHour === targetHour) ||
             (endHour === targetHour && endTime.getMinutes() > 0);
    });

    if (enabledEvents.length === 0) {
      calendarSection.style.display = 'none';
      return;
    }

    calendarSection.style.display = 'block';
    calendarEventsList.innerHTML = '';
    calendarEventsList.classList.remove('collapsed');

    // Group events: all-day first, then by time
    const allDayEvents = enabledEvents.filter(e => e.isAllDay);
    const timedEvents = enabledEvents.filter(e => !e.isAllDay)
      .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

    // Render all-day events
    if (allDayEvents.length > 0) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'calendar-time-group';
      groupHeader.textContent = 'All Day';
      calendarEventsList.appendChild(groupHeader);

      allDayEvents.forEach(event => {
        const eventItem = this.createCalendarEventItem(event);
        calendarEventsList.appendChild(eventItem);
      });
    }

    // Render timed events
    if (timedEvents.length > 0) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'calendar-time-group';
      const hourLabel = targetHour === 0 ? 12 : (targetHour > 12 ? targetHour - 12 : targetHour);
      const ampm = targetHour >= 12 ? 'PM' : 'AM';
      groupHeader.textContent = `${hourLabel}:00 ${ampm}`;
      calendarEventsList.appendChild(groupHeader);

      timedEvents.forEach(event => {
        const eventItem = this.createCalendarEventItem(event);
        calendarEventsList.appendChild(eventItem);
      });
    }
};

// ===== CALENDAR INTEGRATION METHODS =====

/**
 * Initialize calendar service and load data
 */
BulletHistory.prototype.initializeCalendar = async function() {
    try {
      // Load calendar data from storage
      await googleCalendar.loadCalendarData();

      // Check if authenticated
      const authStatus = await googleCalendar.checkAuthStatus();

      if (authStatus.authenticated) {
        // Fetch calendar list if we don't have it
        if (Object.keys(googleCalendar.calendarData.calendars).length === 0) {
          await googleCalendar.fetchCalendarList();
        }

        // Fetch events for current date range
        const startDate = this.dates[0];
        const endDate = this.dates[this.dates.length - 1];
        await googleCalendar.fetchEventsForDateRange(startDate, endDate);
      }
    } catch (error) {
      console.error('Failed to initialize calendar:', error);
    }
};

/**
 * Setup calendar UI event handlers
 */
BulletHistory.prototype.setupCalendarUI = function() {
    const settingsBtn = document.getElementById('calendarSettingsBtn');
    const modal = document.getElementById('calendarSettingsModal');
    const closeModalBtn = document.getElementById('closeCalendarModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const connectBtn = document.getElementById('connectCalendarBtn');
    const disconnectBtn = document.getElementById('disconnectCalendarBtn');
    const refreshBtn = document.getElementById('refreshCalendarsBtn');
    const sectionToggle = document.getElementById('calendarSectionToggle');
    const sectionHeader = document.getElementById('calendarSectionHeader');

    // Open settings modal
    settingsBtn.addEventListener('click', async () => {
      await this.openCalendarSettings();
    });

    // Close modal
    const closeModal = () => {
      modal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Connect calendar
    connectBtn.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';

      try {
        const result = await googleCalendar.authenticateUser();

        if (result.success) {
          // Update UI
          await this.updateCalendarAuthUI();

          // Fetch calendar list
          await googleCalendar.fetchCalendarList();
          this.renderCalendarList();

          // Fetch events for current date range
          const startDate = this.dates[0];
          const endDate = this.dates[this.dates.length - 1];
          await googleCalendar.fetchEventsForDateRange(startDate, endDate);

          // Refresh grid to show event indicators
          this.updateVirtualGrid();
        } else {
          alert('Failed to connect to Google Calendar: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Authentication error:', error);
        alert('Failed to connect to Google Calendar');
      } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect Google Calendar';
      }
    });

    // Disconnect calendar
    disconnectBtn.addEventListener('click', async () => {
      if (confirm('Disconnect from Google Calendar? Your calendar events will no longer be displayed.')) {
        await googleCalendar.revokeToken();
        await this.updateCalendarAuthUI();

        // Refresh grid to remove event indicators
        this.updateVirtualGrid();
      }
    });

    // Refresh calendar list
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '🔄 Refreshing...';

      try {
        await googleCalendar.fetchCalendarList();
        this.renderCalendarList();

        // Re-fetch events
        const startDate = this.dates[0];
        const endDate = this.dates[this.dates.length - 1];
        await googleCalendar.fetchEventsForDateRange(startDate, endDate);

        // Refresh calendar events in header
        this.renderDateHeader();

        // Refresh grid (force update to re-render calendar dots)
        this.updateVirtualGrid(true);
      } catch (error) {
        console.error('Failed to refresh calendars:', error);
        alert('Failed to refresh calendar list');
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Refresh Calendar List';
      }
    });

    // Create event in Google Calendar (deep link)
    const createEventBtn = document.getElementById('createEventBtn');
    if (createEventBtn) {
      createEventBtn.addEventListener('click', () => {
        // Build Google Calendar event creation URL
        // Format: https://calendar.google.com/calendar/r/eventedit?dates=START/END&text=TITLE

        // Determine date to pre-fill:
        // 1. If viewing a specific day/hour in expanded view, use that date
        // 2. Otherwise, use today's date
        let targetDate;

        if (this.currentDate) {
          // Day view - use the specific date
          targetDate = new Date(this.currentDate + 'T12:00:00');
        } else if (this.currentHour) {
          // Hour view - extract date from hour string
          const hourDate = this.currentHour.split('T')[0];
          targetDate = new Date(hourDate + 'T12:00:00');
        } else {
          // Default to today
          targetDate = new Date();
          targetDate.setHours(12, 0, 0, 0);
        }

        // Format dates for Google Calendar URL (ISO format without separators)
        // Example: 20260113T120000Z
        const startTime = new Date(targetDate);
        const endTime = new Date(targetDate);
        endTime.setHours(endTime.getHours() + 1); // Default 1-hour duration

        const formatGoogleDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
        };

        const startStr = formatGoogleDate(startTime);
        const endStr = formatGoogleDate(endTime);

        // Build URL
        const url = `https://calendar.google.com/calendar/r/eventedit?dates=${startStr}/${endStr}`;

        // Open in new tab
        chrome.tabs.create({ url });
      });
    }

    // Toggle calendar section in expanded view
    if (sectionHeader) {
      sectionHeader.addEventListener('click', () => {
        const eventsList = document.getElementById('calendarEventsList');
        const isCollapsed = eventsList.classList.contains('collapsed');

        if (isCollapsed) {
          eventsList.classList.remove('collapsed');
          sectionToggle.classList.remove('collapsed');
          sectionToggle.textContent = '▼';
        } else {
          eventsList.classList.add('collapsed');
          sectionToggle.classList.add('collapsed');
          sectionToggle.textContent = '▶';
        }
      });
    }
};

/**
 * Open calendar settings modal and update UI
 */
BulletHistory.prototype.openCalendarSettings = async function() {
    const modal = document.getElementById('calendarSettingsModal');
    modal.style.display = 'flex';

    await this.updateCalendarAuthUI();
};

/**
 * Update calendar authentication UI state
 */
BulletHistory.prototype.updateCalendarAuthUI = async function() {
    const authStatus = await googleCalendar.checkAuthStatus();
    const authStatusEl = document.getElementById('authStatus');
    const authStatusText = authStatusEl.querySelector('.auth-status-text');
    const connectBtn = document.getElementById('connectCalendarBtn');
    const disconnectBtn = document.getElementById('disconnectCalendarBtn');
    const calendarListSection = document.getElementById('calendarListSection');
    const calendarActionsSection = document.getElementById('calendarActionsSection');

    if (authStatus.authenticated) {
      authStatusEl.classList.add('authenticated');
      authStatusText.textContent = `✓ Connected as ${authStatus.email}`;
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
      calendarListSection.style.display = 'block';
      if (calendarActionsSection) {
        calendarActionsSection.style.display = 'block';
      }

      this.renderCalendarList();
    } else {
      authStatusEl.classList.remove('authenticated');
      authStatusText.textContent = 'Not connected';
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
      calendarListSection.style.display = 'none';
      if (calendarActionsSection) {
        calendarActionsSection.style.display = 'none';
      }
    }
};

/**
 * Render calendar list with checkboxes
 */
BulletHistory.prototype.renderCalendarList = function() {
    const calendarList = document.getElementById('calendarList');
    calendarList.innerHTML = '';

    const calendars = Object.values(googleCalendar.calendarData.calendars);

    if (calendars.length === 0) {
      calendarList.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No calendars found</p>';
      return;
    }

    calendars.forEach(calendar => {
      const item = document.createElement('div');
      item.className = 'calendar-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = calendar.enabled;
      checkbox.addEventListener('change', async (e) => {
        await googleCalendar.toggleCalendar(calendar.id, e.target.checked);

        // Re-fetch events
        const startDate = this.dates[0];
        const endDate = this.dates[this.dates.length - 1];
        await googleCalendar.fetchEventsForDateRange(startDate, endDate);

        // Refresh calendar events in header
        this.renderDateHeader();

        // Refresh grid (force update to re-render calendar dots)
        this.updateVirtualGrid(true);

        // Refresh expanded view if open
        if (this.expandedViewType === 'cell' && this.selectedCell) {
          // Cell view doesn't show calendar events in domain-hour view
          // Only refresh if in day view mode
          if (this.viewMode === 'day') {
            const date = this.selectedCell.dataset.date;
            this.renderCalendarEventsForDate(date);
          }
        } else if (this.expandedViewType === 'day' && this.currentDate) {
          this.renderCalendarEventsForDate(this.currentDate);
        } else if (this.expandedViewType === 'hour' && this.currentHour) {
          this.renderCalendarEventsForHour(this.currentHour);
        }
      });

      const colorDiv = document.createElement('div');
      colorDiv.className = 'calendar-color';
      colorDiv.style.backgroundColor = calendar.backgroundColor;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'calendar-name';
      nameSpan.textContent = calendar.name;

      item.appendChild(checkbox);
      item.appendChild(colorDiv);
      item.appendChild(nameSpan);

      calendarList.appendChild(item);
    });
};

/**
 * Render calendar events for a specific date in expanded view
 */
BulletHistory.prototype.renderCalendarEventsForDate = function(dateStr) {
    const calendarSection = document.getElementById('calendarSection');
    const calendarEventsList = document.getElementById('calendarEventsList');

    // Get events for this date
    const events = googleCalendar.getEventsForDate(dateStr);
    const enabledEvents = events.filter(evt =>
      googleCalendar.calendarData.calendars[evt.calendarId]?.enabled
    );

    if (enabledEvents.length === 0) {
      calendarSection.style.display = 'none';
      return;
    }

    calendarSection.style.display = 'block';
    calendarEventsList.innerHTML = '';
    calendarEventsList.classList.remove('collapsed');

    // Group events: all-day first, then by time
    const allDayEvents = enabledEvents.filter(e => e.isAllDay);
    const timedEvents = enabledEvents.filter(e => !e.isAllDay)
      .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));

    // Render all-day events
    if (allDayEvents.length > 0) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'calendar-time-group';
      groupHeader.textContent = 'All Day';
      calendarEventsList.appendChild(groupHeader);

      allDayEvents.forEach(evt => {
        calendarEventsList.appendChild(this.createCalendarEventItem(evt));
      });
    }

    // Render timed events
    if (timedEvents.length > 0) {
      if (allDayEvents.length > 0) {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'calendar-time-group';
        groupHeader.textContent = 'Scheduled';
        calendarEventsList.appendChild(groupHeader);
      }

      timedEvents.forEach(evt => {
        calendarEventsList.appendChild(this.createCalendarEventItem(evt));
      });
    }
};

/**
 * Create a calendar event item element
 */
BulletHistory.prototype.createCalendarEventItem = function(event) {
    const item = document.createElement('div');
    item.className = 'calendar-event-item';
    item.style.borderLeftColor = event.backgroundColor;

    // Time
    const timeDiv = document.createElement('div');
    timeDiv.className = 'calendar-event-time';
    if (event.isAllDay) {
      timeDiv.className += ' all-day';
      timeDiv.textContent = 'All day';
    } else {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      timeDiv.textContent = this.formatTimeRange(start, end);
    }

    // Details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'calendar-event-details';

    const summary = document.createElement('div');
    summary.className = 'calendar-event-summary';
    summary.textContent = event.summary;

    const meta = document.createElement('div');
    meta.className = 'calendar-event-meta';

    // Calendar name with color
    const calendarInfo = document.createElement('div');
    calendarInfo.className = 'calendar-event-calendar';
    const colorIndicator = document.createElement('div');
    colorIndicator.className = 'calendar-color-indicator';
    colorIndicator.style.backgroundColor = event.backgroundColor;
    calendarInfo.appendChild(colorIndicator);
    calendarInfo.appendChild(document.createTextNode(event.calendarName));
    meta.appendChild(calendarInfo);

    // Location
    if (event.location) {
      const location = document.createElement('div');
      location.className = 'calendar-event-location';
      location.textContent = `📍 ${event.location}`;
      meta.appendChild(location);
    }

    detailsDiv.appendChild(summary);
    detailsDiv.appendChild(meta);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'calendar-event-actions';

    const viewLink = document.createElement('a');
    viewLink.className = 'calendar-event-link';
    viewLink.textContent = 'View';
    viewLink.href = event.htmlLink || `https://calendar.google.com/calendar/event?eid=${event.id}`;
    viewLink.target = '_blank';
    viewLink.rel = 'noopener noreferrer';
    actions.appendChild(viewLink);

    item.appendChild(timeDiv);
    item.appendChild(detailsDiv);
    item.appendChild(actions);

    return item;
};

/**
 * Format time range for display
 */
BulletHistory.prototype.formatTimeRange = function(start, end) {
    const startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${startTime} - ${endTime}`;
};

/**
 * Refresh calendar UI after background sync updates
 */
BulletHistory.prototype.refreshCalendarUI = async function() {
    // Reload calendar data from storage
    await googleCalendar.loadCalendarData();

    // Refresh date header to show new events
    this.renderDateHeader();

    // Refresh expanded view if it's showing calendar events
    if (this.expandedViewType === 'cell' && this.selectedCell) {
      // Cell view only shows calendar events in day view mode
      if (this.viewMode === 'day') {
        const date = this.selectedCell.dataset.date;
        this.renderCalendarEventsForDate(date);
      }
    } else if (this.expandedViewType === 'day' && this.currentDate) {
      this.renderCalendarEventsForDate(this.currentDate);
    } else if (this.expandedViewType === 'hour' && this.currentHour) {
      this.renderCalendarEventsForHour(this.currentHour);
    }
};

/**
 * Render calendar events for a specific date column in the header
 */
// Render calendar events for a specific hour (hour view)
BulletHistory.prototype.renderCalendarEventColumnForHour = function(eventColumn, hourStr) {
    // Only show events if calendar integration is available
    if (typeof googleCalendar === 'undefined') {
      return false;
    }

    // Parse hourStr like '2025-12-01T14'
    const [datePart, hourPart] = hourStr.split('T');
    const targetHour = parseInt(hourPart);

    const events = googleCalendar.getEventsForDate(datePart);

    // Filter to only enabled calendars AND events that occur during this hour
    const enabledEvents = events.filter(event => {
      const calendar = googleCalendar.calendarData.calendars[event.calendarId];
      if (!calendar || !calendar.enabled) return false;

      // All-day events appear in every hour
      if (event.isAllDay) return true;

      // Timed events: check if this hour falls within the event time
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const startHour = startTime.getHours();
      const endHour = endTime.getHours();

      // Event occurs during this hour if:
      // - Event starts in this hour, OR
      // - Event ends in this hour, OR
      // - Event spans across this hour
      return targetHour >= startHour && targetHour <= endHour;
    });

    if (enabledEvents.length === 0) {
      return false;
    }

    // Use the same rendering logic as renderCalendarEventColumn
    return this.renderCalendarEventDots(eventColumn, enabledEvents, datePart);
};

// Common method to render event dots
BulletHistory.prototype.renderCalendarEventDots = function(eventColumn, enabledEvents, dateStr) {
    // Sort events chronologically (all-day first, then by start time)
    const sortedEvents = [...enabledEvents].sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;

      const aTime = a.start.dateTime || a.start.date;
      const bTime = b.start.dateTime || b.start.date;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    // Function to position tooltip
    const positionTooltip = () => {
      const tooltip = document.getElementById('tooltip');
      if (!tooltip.classList.contains('visible')) return;

      const rect = eventColumn.getBoundingClientRect();
      tooltip.style.left = `${rect.left - tooltip.offsetWidth - 10}px`;
      tooltip.style.top = `${rect.top}px`;
    };

    // Add hover handler to show all events for this day
    eventColumn.addEventListener('mouseenter', (e) => {
      const tooltip = document.getElementById('tooltip');

      // Build tooltip content with all events using array join (faster than += concatenation)
      const tooltipParts = [];
      for (const event of sortedEvents) {
        const color = event.backgroundColor || '#039BE5';
        const dotStyle = `width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; flex-shrink: 0; margin-top: 4px;`;
        const eventStyle = `display: flex; gap: 8px; margin-bottom: 8px;`;

        if (event.isAllDay) {
          tooltipParts.push(`<div style="${eventStyle}"><div style="${dotStyle}"></div><div>All day<br>${event.summary}</div></div>`);
        } else {
          const start = new Date(event.start.dateTime);
          const end = new Date(event.end.dateTime);
          const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          tooltipParts.push(`<div style="${eventStyle}"><div style="${dotStyle}"></div><div>${startTime}-${endTime}<br>${event.summary}</div></div>`);
        }
      }

      tooltip.innerHTML = tooltipParts.join('');
      tooltip.style.whiteSpace = 'normal';
      tooltip.style.maxWidth = '200px';
      tooltip.classList.add('visible');

      // Wait for DOM to update with new content size, then position
      requestAnimationFrame(() => {
        positionTooltip();
      });

      // Store reference to this column for scroll repositioning
      eventColumn.dataset.tooltipActive = 'true';
    });

    eventColumn.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('tooltip');
      tooltip.classList.remove('visible');
      tooltip.style.whiteSpace = 'normal';
      delete eventColumn.dataset.tooltipActive;
    });

    // Add scroll handler to reposition tooltip (tracked for cleanup)
    const dateHeaderScroll = document.getElementById('dateHeader');
    const cellGridWrapper = document.getElementById('cellGridWrapper');
    const scrollHandler = () => {
      if (eventColumn.dataset.tooltipActive === 'true') {
        positionTooltip();
      }
    };
    // Store handlers for cleanup on next render
    this.calendarScrollHandlers.push(
      { element: dateHeaderScroll, handler: scrollHandler },
      { element: cellGridWrapper, handler: scrollHandler }
    );
    dateHeaderScroll.addEventListener('scroll', scrollHandler);
    cellGridWrapper.addEventListener('scroll', scrollHandler);

    // Calculate total rows needed (max 10 rows = 20 events)
    const totalRows = Math.min(Math.ceil(enabledEvents.length / 2), 10);

    // Set the grid to only have the rows we need
    eventColumn.style.gridTemplateRows = `repeat(${totalRows}, 7px)`;

    // Set height to match the grid content (rows * 7px + gap between rows + padding)
    const height = totalRows * 7 + (totalRows - 1) * 1 + 2; // 7px per row + 1px gap + 2px padding
    eventColumn.style.height = `${height}px`;
    eventColumn.style.alignSelf = 'end';

    // Render all events as dots in a 2-column grid, filling bottom-up, left-to-right
    for (let i = 0; i < enabledEvents.length; i++) {
      const event = enabledEvents[i];
      const dot = document.createElement('div');
      dot.className = 'calendar-event-dot-header';
      dot.style.backgroundColor = event.backgroundColor || '#039BE5';

      // Calculate grid position: fill bottom-up, left column first
      // Event 0 -> bottom row, col 1
      // Event 1 -> bottom row, col 2
      // Event 2 -> second from bottom, col 1
      // Event 3 -> second from bottom, col 2
      const rowFromBottom = Math.floor(i / 2);
      const actualRow = totalRows - rowFromBottom;  // Count from totalRows (bottom)
      const col = (i % 2) + 1;

      dot.style.gridRow = `${actualRow}`;
      dot.style.gridColumn = `${col}`;

      // Add click handler to show event details
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        // Find the corresponding day cell and trigger its click
        const colIndex = Array.from(eventColumn.parentElement.children).indexOf(eventColumn);
        const dayCell = document.querySelector(`.day-cell[data-col-index="${colIndex}"]`);
        if (dayCell) {
          dayCell.click();
        }
      });

      eventColumn.appendChild(dot);
    }

    return true; // Events were rendered
};

BulletHistory.prototype.renderCalendarEventColumn = function(eventColumn, dateStr) {
    // Only show events if calendar integration is available
    if (typeof googleCalendar === 'undefined') {
      return false;
    }

    const events = googleCalendar.getEventsForDate(dateStr);

    // Filter to only enabled calendars
    const enabledEvents = events.filter(event => {
      const calendar = googleCalendar.calendarData.calendars[event.calendarId];
      return calendar && calendar.enabled;
    });

    if (enabledEvents.length === 0) {
      return false;
    }

    return this.renderCalendarEventDots(eventColumn, enabledEvents, dateStr);
};
