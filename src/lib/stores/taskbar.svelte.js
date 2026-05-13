// Taskbar Store - Manage minimized windows like Windows XP
import { WINDOW_CONFIGS } from '../utils/childWindow.js';

class TaskbarStore {
    minimizedWindows = $state([]);

    addWindow(windowId, windowType) {
        const config = WINDOW_CONFIGS[windowType];
        if (!config) return;

        // Check if already exists
        const exists = this.minimizedWindows.find(w => w.id === windowId);
        if (exists) return;

        this.minimizedWindows.push({
            id: windowId,
            type: windowType,
            title: config.title,
            timestamp: Date.now(),
        });
    }

    removeWindow(windowId) {
        this.minimizedWindows = this.minimizedWindows.filter(w => w.id !== windowId);
    }

    clearAll() {
        this.minimizedWindows = [];
    }

    getWindow(windowId) {
        return this.minimizedWindows.find(w => w.id === windowId);
    }
}

export const taskbarStore = new TaskbarStore();
