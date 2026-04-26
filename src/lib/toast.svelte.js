// Toast Store - manages toast notifications

function createToastStore() {
    let toasts = $state([]);
    let nextId = 0;

    return {
        get toasts() { return toasts; },

        // Show toast
        show(message, type = 'info', duration = 3000) {
            const id = nextId++;
            const toast = {
                id,
                message,
                type, // 'success', 'error', 'warning', 'info'
                duration
            };

            toasts = [...toasts, toast];

            // Auto remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    this.remove(id);
                }, duration);
            }

            return id;
        },

        // Shorthand methods
        success(message, duration = 3000) {
            return this.show(message, 'success', duration);
        },

        error(message, duration = 4000) {
            return this.show(message, 'error', duration);
        },

        warning(message, duration = 3500) {
            return this.show(message, 'warning', duration);
        },

        info(message, duration = 3000) {
            return this.show(message, 'info', duration);
        },

        // Remove toast
        remove(id) {
            toasts = toasts.filter(t => t.id !== id);
        },

        // Clear all toasts
        clear() {
            toasts = [];
        }
    };
}

export const toastStore = createToastStore();
