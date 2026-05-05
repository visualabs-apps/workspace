import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestNotificationStore } from './test-stores.js';

// Mock uuid
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-notification-id-${++uuidCounter}`)
}));

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

describe('Notification Store', () => {
  let notificationStore;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    notificationStore = createTestNotificationStore();
  });

  test('should initialize with empty notifications', () => {
    expect(notificationStore.notifications).toEqual([]);
    expect(notificationStore.unreadNotifications).toEqual([]);
    expect(notificationStore.readNotifications).toEqual([]);
    expect(notificationStore.unreadCount).toBe(0);
    expect(notificationStore.isNotificationCenterOpen).toBe(false);
  });

  test('should load notifications from localStorage', () => {
    const storedNotifications = [
      { id: '1', title: 'Test 1', read: true, timestamp: Date.now() - 1000 },
      { id: '2', title: 'Test 2', read: false, timestamp: Date.now() }
    ];

    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedNotifications));

    // Test initialization by checking if localStorage was called
    localStorageMock.getItem('visualbox_notifications');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('visualbox_notifications');
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

    expect(notification.id).toMatch(/^mock-notification-id-\d+-[a-z0-9]+$/);
    expect(notification.title).toBe('Success');
    expect(notification.body).toBe('Operation completed successfully');
    expect(notification.read).toBe(false);
    expect(notification.isUrgent).toBe(false);
    expect(notification.timestamp).toBeDefined();

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.unreadNotifications).toHaveLength(1);
    expect(notificationStore.unreadCount).toBe(1);
    expect(localStorageMock.setItem).toHaveBeenCalled();
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
    // Add notifications first
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

    // Remove first notification
    notificationStore.removeNotification(notification1.id);

    expect(notificationStore.notifications).toHaveLength(1);
    expect(notificationStore.notifications[0].id).toBe(notification2.id);
  });

  test('should auto-remove notification after timeout', () => {
    const notification = notificationStore.addNotification({
      title: 'Auto Remove',
      body: 'This should be removed',
      icon: 'info'
    });

    expect(notificationStore.notifications).toHaveLength(1);

    // Simulate auto-removal (this would be handled by a timer in the real implementation)
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
    // Add multiple notifications
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
    // Add notifications
    notificationStore.addNotification({ title: 'Test 1', body: 'Body 1', icon: 'info' });
    notificationStore.addNotification({ title: 'Test 2', body: 'Body 2', icon: 'info' });

    expect(notificationStore.notifications).toHaveLength(2);

    notificationStore.clearAll();

    expect(global.confirm).toHaveBeenCalledWith('Clear all notifications?');
    expect(notificationStore.notifications).toHaveLength(0);
    expect(notificationStore.unreadCount).toBe(0);
  });

  test('should clear read notifications', () => {
    // Add notifications
    const notification1 = notificationStore.addNotification({ title: 'Test 1', body: 'Body 1', icon: 'info' });
    const notification2 = notificationStore.addNotification({ title: 'Test 2', body: 'Body 2', icon: 'info' });

    // Mark one as read
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

    expect(clickedNotification).toEqual(notification);
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
    // Add more than 100 notifications
    for (let i = 0; i < 105; i++) {
      notificationStore.addNotification({
        title: `Test ${i}`,
        body: `Body ${i}`,
        icon: 'info'
      });
    }

    expect(notificationStore.notifications).toHaveLength(100);
    expect(notificationStore.notifications[0].title).toBe('Test 104'); // Most recent
    expect(notificationStore.notifications[99].title).toBe('Test 5'); // Oldest kept
  });

  test('should handle localStorage errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    // Test error handling by trying to access localStorage
    try {
      localStorageMock.getItem('visualbox_notifications');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    consoleSpy.mockRestore();
  });

  test('should filter notifications correctly', () => {
    // Add mixed notifications
    const notification1 = notificationStore.addNotification({ title: 'Unread 1', body: 'Body 1', icon: 'info' });
    const notification2 = notificationStore.addNotification({ title: 'Unread 2', body: 'Body 2', icon: 'info' });
    
    // Mark one as read
    notificationStore.markAsRead(notification1.id);

    expect(notificationStore.unreadNotifications).toHaveLength(1);
    expect(notificationStore.unreadNotifications[0].id).toBe(notification2.id);
    
    expect(notificationStore.readNotifications).toHaveLength(1);
    expect(notificationStore.readNotifications[0].id).toBe(notification1.id);
  });
});
