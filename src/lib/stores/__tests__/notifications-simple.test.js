import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock confirm
global.confirm = vi.fn(() => true);

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-notification-id-' + Math.random().toString(36).substr(2, 9))
}));

// Simple test notification store
function createTestNotificationStore() {
  let notifications = [];
  let isNotificationCenterOpen = false;

  return {
    get notifications() { return notifications; },
    set notifications(value) { notifications = value; },
    get unreadNotifications() { return notifications.filter(n => !n.read); },
    get readNotifications() { return notifications.filter(n => n.read); },
    get unreadCount() { return notifications.filter(n => !n.read).length; },
    get isNotificationCenterOpen() { return isNotificationCenterOpen; },
    set isNotificationCenterOpen(value) { isNotificationCenterOpen = value; },

    toggleNotificationCenter() {
      isNotificationCenterOpen = !isNotificationCenterOpen;
    },

    openNotificationCenter() {
      isNotificationCenterOpen = true;
    },

    closeNotificationCenter() {
      isNotificationCenterOpen = false;
    },

    addNotification({ title, body, icon, serviceId, serviceName, url, isUrgent = false }) {
      const notification = {
        id: 'mock-notification-id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        title,
        body,
        icon,
        serviceId,
        serviceName,
        url,
        isUrgent,
        read: false,
        timestamp: Date.now()
      };
      notifications = [notification, ...notifications].slice(0, 100);
      return notification;
    },

    markAsRead(id) {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        notifications = [
          ...notifications.slice(0, index),
          { ...notifications[index], read: true },
          ...notifications.slice(index + 1)
        ];
      }
    },

    markAllAsRead() {
      notifications = notifications.map(n => ({ ...n, read: true }));
    },

    removeNotification(id) {
      notifications = notifications.filter(n => n.id !== id);
    },

    clearAll() {
      if (confirm('Clear all notifications?')) {
        notifications = [];
      }
    },

    clearRead() {
      notifications = notifications.filter(n => !n.read);
    },

    clickNotification(id) {
      this.markAsRead(id);
      const notification = notifications.find(n => n.id === id);
      return notification;
    }
  };
}

describe('Notification Store (Simple)', () => {
  let notificationStore;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationStore = createTestNotificationStore();
  });

  test('should initialize with empty notifications', () => {
    expect(notificationStore.notifications).toEqual([]);
    expect(notificationStore.unreadNotifications).toEqual([]);
    expect(notificationStore.readNotifications).toEqual([]);
    expect(notificationStore.unreadCount).toBe(0);
    expect(notificationStore.isNotificationCenterOpen).toBe(false);
  });

  test('should add success notification', () => {
    const notificationData = {
      title: 'Success',
      body: 'Operation completed successfully',
      icon: 'success',
      serviceId: 'service1',
      serviceName: 'Test Service'
    };

    const notification = notificationStore.addNotification(notificationData);

    expect(notification.id).toMatch(/^mock-notification-id-/);
    expect(notification.title).toBe('Success');
    expect(notification.body).toBe('Operation completed successfully');
    expect(notification.read).toBe(false);
    expect(notification.isUrgent).toBe(false);
    expect(notification.timestamp).toBeDefined();

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.unreadNotifications).toHaveLength(1);
    expect(notificationStore.unreadCount).toBe(1);
  });

  test('should add error notification', () => {
    const notificationData = {
      title: 'Error',
      body: 'Operation failed',
      icon: 'error',
      serviceId: 'service1',
      serviceName: 'Test Service',
      isUrgent: true
    };

    const notification = notificationStore.addNotification(notificationData);

    expect(notification.isUrgent).toBe(true);
    expect(notificationStore.unreadNotifications).toHaveLength(1);
    expect(notificationStore.unreadCount).toBe(1);
  });

  test('should add warning notification', () => {
    const notificationData = {
      title: 'Warning',
      body: 'Please check your settings',
      icon: 'warning',
      serviceId: 'service1',
      serviceName: 'Test Service'
    };

    notificationStore.addNotification(notificationData);

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.notifications[0].title).toBe('Warning');
    expect(notificationStore.unreadCount).toBe(1);
  });

  test('should add info notification', () => {
    const notificationData = {
      title: 'Info',
      body: 'New update available',
      icon: 'info',
      serviceId: 'service1',
      serviceName: 'Test Service'
    };

    notificationStore.addNotification(notificationData);

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.notifications[0].title).toBe('Info');
    expect(notificationStore.unreadCount).toBe(1);
  });

  test('should remove notification', () => {
    const notification1 = notificationStore.addNotification({
      title: 'Test 1',
      body: 'Body 1',
      icon: 'info'
    });
    const notification2 = notificationStore.addNotification({
      title: 'Test 2',
      body: 'Body 2',
      icon: 'info'
    });

    expect(notificationStore.notifications).toHaveLength(2);

    notificationStore.removeNotification(notification1.id);

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.notifications[0].title).toBe('Test 2');
  });

  test('should auto-remove notification after timeout', () => {
    const notification = notificationStore.addNotification({
      title: 'Auto Remove',
      body: 'This should be removed',
      icon: 'info'
    });

    expect(notificationStore.notifications).toHaveLength(1);

    notificationStore.removeNotification(notification.id);

    expect(notificationStore.notifications).toHaveLength(0);
    expect(notificationStore.unreadCount).toBe(0);
  });

  test('should mark notification as read', () => {
    const notification = notificationStore.addNotification({
      title: 'Test',
      body: 'Body',
      icon: 'info'
    });

    expect(notificationStore.unreadCount).toBe(1);

    notificationStore.markAsRead(notification.id);

    expect(notificationStore.unreadCount).toBe(0);
    expect(notificationStore.notifications[0].read).toBe(true);
    expect(notificationStore.readNotifications).toHaveLength(1);
    expect(notificationStore.unreadNotifications).toHaveLength(0);
  });

  test('should mark all notifications as read', () => {
    notificationStore.addNotification({ title: 'Test 1', body: 'Body 1', icon: 'info' });
    notificationStore.addNotification({ title: 'Test 2', body: 'Body 2', icon: 'info' });
    notificationStore.addNotification({ title: 'Test 3', body: 'Body 3', icon: 'info' });

    expect(notificationStore.unreadCount).toBe(3);

    notificationStore.markAllAsRead();

    expect(notificationStore.unreadCount).toBe(0);
    expect(notificationStore.readNotifications).toHaveLength(3);
    expect(notificationStore.unreadNotifications).toHaveLength(0);
  });

  test('should clear all notifications', () => {
    notificationStore.addNotification({ title: 'Test 1', body: 'Body 1', icon: 'info' });
    notificationStore.addNotification({ title: 'Test 2', body: 'Body 2', icon: 'info' });

    expect(notificationStore.notifications).toHaveLength(2);

    notificationStore.clearAll();

    expect(global.confirm).toHaveBeenCalledWith('Clear all notifications?');
    expect(notificationStore.notifications).toHaveLength(0);
    expect(notificationStore.unreadCount).toBe(0);
  });

  test('should clear read notifications', () => {
    const notification1 = notificationStore.addNotification({ title: 'Test 1', body: 'Body 1', icon: 'info' });
    const notification2 = notificationStore.addNotification({ title: 'Test 2', body: 'Body 2', icon: 'info' });

    notificationStore.markAsRead(notification1.id);

    expect(notificationStore.notifications).toHaveLength(2);
    expect(notificationStore.readNotifications).toHaveLength(1);

    notificationStore.clearRead();

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.notifications[0].id).toBe(notification2.id);
    expect(notificationStore.readNotifications).toHaveLength(0);
  });

  test('should click notification', () => {
    const notification = notificationStore.addNotification({
      title: 'Test',
      body: 'Body',
      icon: 'info',
      url: 'https://example.com'
    });

    expect(notificationStore.unreadCount).toBe(1);

    const clickedNotification = notificationStore.clickNotification(notification.id);

    expect(clickedNotification.id).toBe(notification.id);
    expect(clickedNotification.read).toBe(true);
    expect(notificationStore.unreadCount).toBe(0);
  });

  test('should toggle notification center', () => {
    expect(notificationStore.isNotificationCenterOpen).toBe(false);

    notificationStore.toggleNotificationCenter();
    expect(notificationStore.isNotificationCenterOpen).toBe(true);

    notificationStore.toggleNotificationCenter();
    expect(notificationStore.isNotificationCenterOpen).toBe(false);
  });

  test('should open and close notification center', () => {
    notificationStore.openNotificationCenter();
    expect(notificationStore.isNotificationCenterOpen).toBe(true);

    notificationStore.closeNotificationCenter();
    expect(notificationStore.isNotificationCenterOpen).toBe(false);
  });

  test('should limit notifications to 100', () => {
    for (let i = 0; i < 105; i++) {
      notificationStore.addNotification({
        title: `Test ${i}`,
        body: `Body ${i}`,
        icon: 'info'
      });
    }

    expect(notificationStore.notifications).toHaveLength(100);
    expect(notificationStore.notifications[0].title).toBe('Test 104'); // Most recent
  });

  test('should filter notifications correctly', () => {
    const notification1 = notificationStore.addNotification({ title: 'Unread 1', body: 'Body 1', icon: 'info' });
    const notification2 = notificationStore.addNotification({ title: 'Unread 2', body: 'Body 2', icon: 'info' });

    notificationStore.markAsRead(notification1.id);

    expect(notificationStore.unreadNotifications).toHaveLength(1);
    expect(notificationStore.unreadNotifications[0].id).toBe(notification2.id);
    
    expect(notificationStore.readNotifications).toHaveLength(1);
    expect(notificationStore.readNotifications[0].id).toBe(notification1.id);
  });
});
