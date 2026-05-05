// Test Auth Store
export function createTestAuthStore() {
  let user = null;
  let isLoggedIn = false;
  let isLoading = false;
  let error = null;
  let isInitialized = false;

  return {
    get user() { return user; },
    set user(value) { user = value; },
    get isLoggedIn() { return isLoggedIn; },
    set isLoggedIn(value) { isLoggedIn = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get error() { return error; },
    set error(value) { error = value; },
    get isInitialized() { return isInitialized; },
    set isInitialized(value) { isInitialized = value; },

    async login(email, password) {
      isLoading = true;
      error = null;
      
      try {
        // Mock login logic - check credentials
        if (email === 'test@example.com' && password === 'password123') {
          // Mock successful login
          user = {
            id: 1,
            email,
            name: 'Test User'
          };
          isLoggedIn = true;
          isInitialized = true;
          return { success: true };
        } else {
          // Mock failed login
          error = 'Invalid credentials';
          return { success: false };
        }
      } catch (err) {
        error = err.message;
        return { success: false };
      } finally {
        isLoading = false;
      }
    },

    async logout() {
      user = null;
      isLoggedIn = false;
      isInitialized = false;
      error = null;
    },

    clearError() {
      error = null;
    }
  };
}

// Test Bookmark Store
export function createTestBookmarkStore() {
  let bookmarks = {};
  let isLoading = false;
  let error = null;
  let lastUpdate = Date.now();

  return {
    get bookmarks() { return bookmarks; },
    set bookmarks(value) { bookmarks = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get error() { return error; },
    set error(value) { error = value; },
    get lastUpdate() { return lastUpdate; },
    set lastUpdate(value) { lastUpdate = value; },

    async loadBookmarks(profileId) {
      isLoading = true;
      error = null;
      
      try {
        // Mock loading bookmarks with default data for testing
        if (!bookmarks[profileId]) {
          bookmarks[profileId] = [
            { id: 1, url: 'https://google.com', title: 'Google', favicon: '' },
            { id: 2, url: 'https://facebook.com', title: 'Facebook', favicon: '' }
          ];
        }
        lastUpdate = Date.now();
        return bookmarks[profileId];
      } catch (err) {
        error = err.message;
        return [];
      } finally {
        isLoading = false;
      }
    },

    async addBookmark(profileId, url, title, favicon) {
      if (!profileId || !url || !title) {
        return false;
      }

      if (!bookmarks[profileId]) {
        bookmarks[profileId] = [];
      }

      const bookmark = {
        id: Date.now(),
        url,
        title,
        favicon: favicon || ''
      };

      bookmarks[profileId].push(bookmark);
      lastUpdate = Date.now();
      return true;
    },

    async removeBookmark(profileId, url) {
      if (!profileId || !url || !bookmarks[profileId]) {
        return false;
      }

      const initialLength = bookmarks[profileId].length;
      bookmarks[profileId] = bookmarks[profileId].filter(b => b.url !== url);
      lastUpdate = Date.now();
      return bookmarks[profileId].length < initialLength;
    },

    async isBookmarked(profileId, url) {
      if (!profileId || !url || !bookmarks[profileId]) {
        return false;
      }
      return bookmarks[profileId].some(b => b.url === url);
    },

    async toggleBookmark(profileId, url, title, favicon) {
      if (!profileId || !url) {
        return false;
      }

      const isCurrentlyBookmarked = await this.isBookmarked(profileId, url);
      
      if (isCurrentlyBookmarked) {
        return await this.removeBookmark(profileId, url);
      } else {
        return await this.addBookmark(profileId, url, title, favicon);
      }
    },

    getProfileBookmarks(profileId) {
      return bookmarks[profileId] || [];
    },

    clearError() {
      error = null;
    }
  };
}

// Test Download Store
export function createTestDownloadStore() {
  let downloads = [];
  let isDownloadPanelOpen = false;
  let isLoaded = false;

  return {
    get downloads() { return downloads; },
    set downloads(value) { downloads = value; },
    get activeDownloads() {
      return downloads.filter(d => d.state === 'progressing' || d.state === 'paused');
    },
    get completedDownloads() {
      return downloads.filter(d => d.state === 'completed');
    },
    get isDownloadPanelOpen() { return isDownloadPanelOpen; },
    set isDownloadPanelOpen(value) { isDownloadPanelOpen = value; },
    get isLoaded() { return isLoaded; },
    set isLoaded(value) { isLoaded = value; },

    toggleDownloadPanel() {
      isDownloadPanelOpen = !isDownloadPanelOpen;
    },

    openDownloadPanel() {
      isDownloadPanelOpen = true;
    },

    closeDownloadPanel() {
      isDownloadPanelOpen = false;
    },

    addMockDownload(downloadData) {
      const download = {
        id: `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        filename: downloadData.filename || 'unknown',
        url: downloadData.url || '',
        totalBytes: downloadData.totalBytes || 0,
        receivedBytes: downloadData.receivedBytes || 0,
        state: downloadData.state || 'pending',
        startTime: Date.now(),
        endTime: null,
        ...downloadData
      };

      downloads.unshift(download);
      return download;
    },

    async updateDownload(id, updates) {
      const index = downloads.findIndex(d => d.id === id);
      if (index !== -1) {
        downloads[index] = { ...downloads[index], ...updates };
        return downloads[index];
      }
      return null;
    },

    async removeDownload(id) {
      const initialLength = downloads.length;
      downloads = downloads.filter(d => d.id !== id);
      return downloads.length < initialLength;
    },

    async clearCompleted(profileId = null) {
      const initialLength = downloads.length;
      if (profileId) {
        downloads = downloads.filter(d => d.state !== 'completed' || d.profileId !== profileId);
      } else {
        downloads = downloads.filter(d => d.state !== 'completed');
      }
      return downloads.length < initialLength;
    },

    // Get download by ID
    getDownload(id) {
      return downloads.find(d => d.id === id);
    }
  };
}

// Test History Store
export function createTestHistoryStore() {
  let history = [];
  let isLoading = false;
  let lastUpdate = Date.now();

  return {
    get history() { return history; },
    set history(value) { history = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get lastUpdate() { return lastUpdate; },
    set lastUpdate(value) { lastUpdate = value; },

    async addEntry(workspaceId, url, title, favicon) {
      if (!workspaceId || !url || !this.isValidUrl(url)) {
        return false;
      }

      const entry = {
        id: 'history-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        workspaceId,
        url: this.cleanUrl(url),
        title: title || url,
        favicon: favicon || null,
        visitTime: Date.now(),
        domain: this.extractDomain(url)
      };

      history.unshift(entry); // Add to beginning
      lastUpdate = Date.now();
      return true;
    },

    async removeEntry(entryId) {
      const initialLength = history.length;
      history = history.filter(entry => entry.id !== entryId);
      return history.length < initialLength;
    },

    async clearHistory(workspaceId) {
      if (workspaceId) {
        history = history.filter(entry => entry.workspaceId !== workspaceId);
      } else {
        history = [];
      }
      lastUpdate = Date.now();
      return true;
    },

    async searchHistory(workspaceId, query) {
      let filtered = workspaceId ? 
        history.filter(entry => entry.workspaceId === workspaceId) : 
        history;

      if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(entry => 
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.url.toLowerCase().includes(lowerQuery) ||
          entry.domain.toLowerCase().includes(lowerQuery)
        );
      }

      return filtered;
    },

    async getHistoryByDateRange(workspaceId, startDate, endDate) {
      let filtered = workspaceId ? 
        history.filter(entry => entry.workspaceId === workspaceId) : 
        history;

      if (startDate && endDate) {
        filtered = filtered.filter(entry => 
          entry.visitTime >= startDate.getTime() && 
          entry.visitTime <= endDate.getTime()
        );
      }

      return filtered;
    },

    async exportHistory(workspaceId) {
      const filtered = workspaceId ? 
        history.filter(entry => entry.workspaceId === workspaceId) : 
        history;
      
      return filtered.slice(0, 1000); // Limit to 1000 entries
    },

    isValidUrl(url) {
      if (!url || typeof url !== 'string') return false;
      
      // Filter out invalid URLs
      const invalidSchemes = ['about:', 'chrome:', 'chrome-extension:', 'file:', 'data:', 'blob:'];
      return !invalidSchemes.some(scheme => url.startsWith(scheme));
    },

    cleanUrl(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.href;
      } catch {
        return url;
      }
    },

    extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    }
  };
}

// Test Notifications Store
export function createTestNotificationStore() {
  let notifications = [];
  let isNotificationCenterOpen = false;

  return {
    get notifications() { return notifications; },
    set notifications(value) { notifications = value; },
    get isNotificationCenterOpen() { return isNotificationCenterOpen; },
    set isNotificationCenterOpen(value) { isNotificationCenterOpen = value; },

    get unreadNotifications() {
      return notifications.filter(n => !n.read);
    },

    get readNotifications() {
      return notifications.filter(n => n.read);
    },

    get unreadCount() {
      return notifications.filter(n => !n.read).length;
    },

    addNotification(notificationData) {
      // Generate a unique ID for each notification
      const id = `mock-notification-id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const notification = {
        id,
        title: notificationData.title,
        body: notificationData.body || '',
        icon: notificationData.icon || 'info',
        serviceId: notificationData.serviceId || null,
        serviceName: notificationData.serviceName || null,
        url: notificationData.url || null,
        read: false,
        isUrgent: notificationData.isUrgent || false,
        timestamp: Date.now(),
        ...notificationData
      };

      // Add to beginning (most recent first)
      notifications.unshift(notification);

      // Limit to 100 notifications
      if (notifications.length > 100) {
        notifications = notifications.slice(0, 100);
      }

      // Save to localStorage mock
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
      }

      return notification;
    },

    removeNotification(id) {
      const initialLength = notifications.length;
      notifications = notifications.filter(n => n.id !== id);
      
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
      }
      
      return notifications.length < initialLength;
    },

    markAsRead(id) {
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        notification.read = true;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
        }
      }
    },

    markAllAsRead() {
      notifications.forEach(n => n.read = true);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
      }
    },

    clearAll() {
      if (typeof window !== 'undefined' && window.confirm && !window.confirm('Clear all notifications?')) {
        return false;
      }
      
      notifications = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
      }
      return true;
    },

    clearRead() {
      notifications = notifications.filter(n => !n.read);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('visualbox_notifications', JSON.stringify(notifications));
      }
    },

    clickNotification(id) {
      const notification = notifications.find(n => n.id === id);
      if (notification) {
        this.markAsRead(id);
        
        // Open URL if provided
        if (notification.url && typeof window !== 'undefined') {
          window.open(notification.url, '_blank');
        }
        
        return notification;
      }
      return null;
    },

    toggleNotificationCenter() {
      isNotificationCenterOpen = !isNotificationCenterOpen;
    },

    openNotificationCenter() {
      isNotificationCenterOpen = true;
    },

    closeNotificationCenter() {
      isNotificationCenterOpen = false;
    }
  };
}

// Test Panels Store
export function createTestPanelStore() {
  let isHistoryPanelOpen = false;
  let isBookmarkPanelOpen = false;
  let isDownloadPanelOpen = false;

  return {
    get isHistoryPanelOpen() { return isHistoryPanelOpen; },
    set isHistoryPanelOpen(value) { isHistoryPanelOpen = value; },
    get isBookmarkPanelOpen() { return isBookmarkPanelOpen; },
    set isBookmarkPanelOpen(value) { isBookmarkPanelOpen = value; },
    get isDownloadPanelOpen() { return isDownloadPanelOpen; },
    set isDownloadPanelOpen(value) { isDownloadPanelOpen = value; },

    openHistory() {
      isHistoryPanelOpen = true;
    },

    closeHistory() {
      isHistoryPanelOpen = false;
    },

    toggleHistory() {
      isHistoryPanelOpen = !isHistoryPanelOpen;
    },

    openBookmarks() {
      isBookmarkPanelOpen = true;
    },

    closeBookmarks() {
      isBookmarkPanelOpen = false;
    },

    toggleBookmarks() {
      isBookmarkPanelOpen = !isBookmarkPanelOpen;
    },

    openDownloads() {
      isDownloadPanelOpen = true;
    },

    closeDownloads() {
      isDownloadPanelOpen = false;
    },

    toggleDownloads() {
      isDownloadPanelOpen = !isDownloadPanelOpen;
    }
  };
}

// Test Tabs Store
export function createTestTabStore() {
  let serviceTabs = {};
  let isAnyTabDragging = false;

  return {
    get serviceTabs() { return serviceTabs; },
    set serviceTabs(value) { serviceTabs = value; },
    get isAnyTabDragging() { return isAnyTabDragging; },
    set isAnyTabDragging(value) { isAnyTabDragging = value; },

    addTab(serviceId, url, title) {
      if (!serviceTabs[serviceId]) {
        serviceTabs[serviceId] = [];
      }

      const newTab = {
        id: `mock-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title,
        url,
        favicon: null,
        isLoading: true,
        isActive: true
      };

      // Set all other tabs as inactive
      serviceTabs[serviceId].forEach(tab => tab.isActive = false);

      serviceTabs[serviceId].push(newTab);
      return newTab;
    },

    closeTab(serviceId, tabId) {
      if (!serviceTabs[serviceId]) return false;

      const tabs = serviceTabs[serviceId];
      const tabIndex = tabs.findIndex(tab => tab.id === tabId);
      
      if (tabIndex === -1) return false;

      const closingTab = tabs[tabIndex];
      const wasActive = closingTab.isActive;

      // Remove the tab
      tabs.splice(tabIndex, 1);

      // If we removed the active tab and there are other tabs, activate the last one
      if (wasActive && tabs.length > 0) {
        tabs[tabs.length - 1].isActive = true;
      }

      // If no tabs left, remove the service entry
      if (tabs.length === 0) {
        delete serviceTabs[serviceId];
      }

      return true;
    },

    setActiveTab(serviceId, tabId) {
      if (!serviceTabs[serviceId]) return false;

      const tabs = serviceTabs[serviceId];
      const tab = tabs.find(t => t.id === tabId);
      
      if (!tab) return false;

      // Set all tabs as inactive, then activate the selected one
      tabs.forEach(t => t.isActive = false);
      tab.isActive = true;

      return true;
    },

    initServiceTabs(serviceId, initialUrl, serviceName) {
      if (serviceTabs[serviceId]) {
        return; // Already initialized
      }

      serviceTabs[serviceId] = [{
        id: `mock-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: serviceName,
        url: initialUrl,
        favicon: null,
        isLoading: false,
        isActive: true
      }];
    },

    updateTab(serviceId, tabId, updates) {
      if (!serviceTabs[serviceId]) return null;

      const tabs = serviceTabs[serviceId];
      const tab = tabs.find(t => t.id === tabId);
      
      if (!tab) return null;

      Object.assign(tab, updates);
      return tab;
    },

    removeServiceTabs(serviceId) {
      delete serviceTabs[serviceId];
    },

    reorderTabs(serviceId, newOrder) {
      if (!serviceTabs[serviceId]) return;

      const tabs = serviceTabs[serviceId];
      const currentIds = new Set(tabs.map(t => t.id));
      const newIds = newOrder.map(t => t.id);

      // Check for duplicates or missing IDs
      if (newIds.length !== new Set(newIds).size) {
        if (typeof console !== 'undefined') {
          console.error('Duplicate tab IDs detected in reorder, skipping');
        }
        return; // Invalid reorder
      }

      if (!newIds.every(id => currentIds.has(id))) {
        if (typeof console !== 'undefined') {
          console.error('Invalid tab IDs in reorder, skipping');
        }
        return; // Invalid reorder
      }

      serviceTabs[serviceId] = newOrder;
    },

    setDragging(isDragging) {
      isAnyTabDragging = isDragging;
    },

    // Helper methods for testing
    getServiceTabs(serviceId) {
      return serviceTabs[serviceId] || [];
    },

    getActiveTabId(serviceId) {
      const tabs = serviceTabs[serviceId] || [];
      const activeTab = tabs.find(tab => tab.isActive);
      return activeTab ? activeTab.id : null;
    },

    getActiveTab(serviceId) {
      const tabs = serviceTabs[serviceId] || [];
      return tabs.find(tab => tab.isActive) || null;
    },

    getTab(serviceId, tabId) {
      const tabs = serviceTabs[serviceId] || [];
      return tabs.find(tab => tab.id === tabId) || null;
    }
  };
}

// Test Todos Store
export function createTestTodoStore() {
  let todos = [];
  let isLoading = false;
  let lastUpdate = Date.now();

  return {
    get todos() { return todos; },
    set todos(value) { todos = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get lastUpdate() { return lastUpdate; },
    set lastUpdate(value) { lastUpdate = value; },

    get activeTodos() {
      return todos.filter(todo => todo.status !== 3);
    },

    get completedTodos() {
      return todos.filter(todo => todo.status === 3);
    },

    async loadTodos() {
      isLoading = true;
      
      try {
        // Mock loading todos - in a real implementation this would call an API
        const mockUser = { id: 1, name: 'Test User' };
        
        if (!mockUser) {
          if (typeof console !== 'undefined') {
            console.warn('No user logged in');
          }
          return [];
        }

        // Mock API response
        const mockTodos = [
          { id: 1, title: 'Task 1', status: 0, assignedTo: 1 },
          { id: 2, title: 'Task 2', status: 1, assignedTo: 1 },
          { id: 3, title: 'Task 3', status: 3, assignedTo: 1 }
        ];

        todos = mockTodos;
        lastUpdate = Date.now();
        return mockTodos;
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.error('Error loading todos:', error);
        }
        return [];
      } finally {
        isLoading = false;
      }
    },

    async addTodo(todoData) {
      const newTodo = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        status: 0,
        createdBy: 1,
        createdAt: Date.now(),
        ...todoData
      };

      todos.unshift(newTodo);
      lastUpdate = Date.now();
      return newTodo;
    },

    async updateTodo(id, updates) {
      const index = todos.findIndex(todo => todo.id === id);
      if (index !== -1) {
        todos[index] = { ...todos[index], ...updates, updatedAt: Date.now() };
        lastUpdate = Date.now();
        return todos[index];
      }
      return null;
    },

    async deleteTodo(id) {
      const initialLength = todos.length;
      todos = todos.filter(todo => todo.id !== id);
      lastUpdate = Date.now();
      return todos.length < initialLength;
    },

    getTodosByStatus(status) {
      return todos.filter(todo => todo.status === status);
    },

    getTodosByPriority(priority) {
      return todos.filter(todo => todo.priority === priority);
    },

    searchTodos(query) {
      if (!query) return todos;
      
      const lowerQuery = query.toLowerCase();
      return todos.filter(todo => 
        todo.title.toLowerCase().includes(lowerQuery) ||
        (todo.description && todo.description.toLowerCase().includes(lowerQuery))
      );
    },

    getStatistics() {
      const total = todos.length;
      const completed = todos.filter(todo => todo.status === 3).length;
      const active = total - completed;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        active,
        completed,
        completionRate
      };
    },

    async exportTodos() {
      // Mock export - returns all todos
      return todos;
    },

    async markAsComplete(id) {
      return this.updateTodo(id, { status: 3 });
    },

    async assignTodo(id, userId) {
      return this.updateTodo(id, { assignedTo: userId });
    }
  };
}

// Test Workspace Store
export function createTestWorkspaceStore() {
  let workspaces = [];
  let activeWorkspaceId = null;
  let isLoading = false;
  let isInitialized = false;

  return {
    get workspaces() { return workspaces; },
    set workspaces(value) { workspaces = value; },
    get activeWorkspaceId() { return activeWorkspaceId; },
    set activeWorkspaceId(value) { activeWorkspaceId = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get isInitialized() { return isInitialized; },
    set isInitialized(value) { isInitialized = value; },
    
    get activeWorkspace() {
      if (workspaces.length === 0) return null;
      return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
    },

    async init() {
      isLoading = true;
      
      try {
        // Mock user check
        const mockUser = { id: 1, name: 'Test User' };
        
        if (!mockUser) {
          workspaces = [];
          activeWorkspaceId = null;
          isInitialized = true;
          return;
        }

        // Mock API response
        const mockWorkspaces = [
          {
            id: 'workspace1',
            name: 'Default Workspace',
            userId: 1,
            customer: { profile: { name: 'Test Customer' } },
            apps: []
          }
        ];

        workspaces = mockWorkspaces;
        activeWorkspaceId = mockWorkspaces[0].id;
        isInitialized = true;
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.error('Error initializing workspaces:', error);
        }
      } finally {
        isLoading = false;
      }
    },

    async refresh() {
      // Mock refresh - add a new workspace
      const newWorkspace = {
        id: `workspace${Date.now()}`,
        name: `Test Workspace ${Date.now()}`,
        userId: 1,
        customer: { profile: { name: 'Test Customer' } },
        apps: []
      };

      workspaces.push(newWorkspace);
      return workspaces;
    },

    async setActiveWorkspace(workspaceId) {
      if (workspaces.find(w => w.id === workspaceId)) {
        activeWorkspaceId = workspaceId;
        return true;
      }
      return false;
    },

    async deleteWorkspace(workspaceId) {
      const initialLength = workspaces.length;
      workspaces = workspaces.filter(w => w.id !== workspaceId);
      
      if (activeWorkspaceId === workspaceId) {
        activeWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
      }
      
      return workspaces.length < initialLength;
    },

    async addAppToWorkspace(workspaceId, appId) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        if (!workspace.apps) {
          workspace.apps = [];
        }
        if (!workspace.apps.includes(appId)) {
          workspace.apps.push(appId);
        }
        return true;
      }
      return false;
    },

    async removeAppFromWorkspace(workspaceId, appId) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace && workspace.apps) {
        workspace.apps = workspace.apps.filter(app => app !== appId);
        return true;
      }
      return false;
    }
  };
}
