// Notification Center Store
// Manages notification history and display

import { v4 as uuidv4 } from 'uuid';

function createNotificationStore() {
    // Load from localStorage (only recent notifications)
    let storedNotifications = [];
    try {
        const item = localStorage.getItem('vleb_notifications');
        if (item) {
            storedNotifications = JSON.parse(item);
            // Keep only last 100 notifications
            storedNotifications = storedNotifications.slice(0, 100);
        }
    } catch (e) {
        console.error('Failed to load notifications', e);
    }

    // State
    let notifications = $state(storedNotifications);
    let isNotificationCenterOpen = $state(false);
    let unreadCount = $derived(notifications.filter(n => !n.read).length);

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('vleb_notifications', JSON.stringify(notifications.slice(0, 100)));
        });
    });

    return {
        get notifications() { return notifications; },
        get unreadNotifications() { return notifications.filter(n => !n.read); },
        get readNotifications() { return notifications.filter(n => n.read); },
        get unreadCount() { return unreadCount; },
        get isNotificationCenterOpen() { return isNotificationCenterOpen; },

        toggleNotificationCenter() {
            isNotificationCenterOpen = !isNotificationCenterOpen;
        },

        openNotificationCenter() {
            isNotificationCenterOpen = true;
        },

        closeNotificationCenter() {
            isNotificationCenterOpen = false;
        },

        // Add a new notification
        addNotification({ title, body, icon, serviceId, serviceName, url, isUrgent = false }) {
            const notification = {
                id: uuidv4(),
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

        // Mark notification as read
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

        // Mark all as read
        markAllAsRead() {
            notifications = notifications.map(n => ({ ...n, read: true }));
        },

        // Remove notification
        removeNotification(id) {
            notifications = notifications.filter(n => n.id !== id);
        },

        // Clear all notifications
        clearAll() {
            if (confirm('Clear all notifications?')) {
                notifications = [];
            }
        },

        // Clear read notifications
        clearRead() {
            notifications = notifications.filter(n => !n.read);
        },

        // Click notification (mark as read and navigate)
        clickNotification(id) {
            this.markAsRead(id);
            const notification = notifications.find(n => n.id === id);
            return notification;
        }
    };
}

export const notificationStore = createNotificationStore();
