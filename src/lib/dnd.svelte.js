// Do Not Disturb Store
// Manages global DND mode and scheduling

function createDNDStore() {
    // Load from localStorage
    let storedSettings = {
        isEnabled: false,
        scheduleEnabled: false,
        scheduleStart: '22:00',
        scheduleEnd: '08:00',
        muteNotifications: true,
        hideBadges: false,
        allowUrgent: true
    };

    try {
        const item = localStorage.getItem('vleb_dnd');
        if (item) {
            storedSettings = { ...storedSettings, ...JSON.parse(item) };
        }
    } catch (e) {
        console.error('Failed to load DND settings', e);
    }

    // State
    let isEnabled = $state(storedSettings.isEnabled);
    let scheduleEnabled = $state(storedSettings.scheduleEnabled);
    let scheduleStart = $state(storedSettings.scheduleStart);
    let scheduleEnd = $state(storedSettings.scheduleEnd);
    let muteNotifications = $state(storedSettings.muteNotifications);
    let hideBadges = $state(storedSettings.hideBadges);
    let allowUrgent = $state(storedSettings.allowUrgent);

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('vleb_dnd', JSON.stringify({
                isEnabled,
                scheduleEnabled,
                scheduleStart,
                scheduleEnd,
                muteNotifications,
                hideBadges,
                allowUrgent
            }));
        });
    });

    // Check if currently in scheduled DND time
    function isInScheduledTime() {
        if (!scheduleEnabled) return false;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const start = scheduleStart;
        const end = scheduleEnd;

        // Handle overnight schedule (e.g., 22:00 to 08:00)
        if (start > end) {
            return currentTime >= start || currentTime < end;
        } else {
            return currentTime >= start && currentTime < end;
        }
    }

    // Update scheduled DND status every minute
    if (typeof window !== 'undefined') {
        setInterval(() => {
            if (scheduleEnabled && isInScheduledTime() && !isEnabled) {
                isEnabled = true;
            } else if (scheduleEnabled && !isInScheduledTime() && isEnabled) {
                isEnabled = false;
            }
        }, 60000); // Check every minute
    }

    return {
        get isEnabled() { return isEnabled; },
        get isActive() { return isEnabled || (scheduleEnabled && isInScheduledTime()); },
        get scheduleEnabled() { return scheduleEnabled; },
        get scheduleStart() { return scheduleStart; },
        get scheduleEnd() { return scheduleEnd; },
        get muteNotifications() { return muteNotifications; },
        get hideBadges() { return hideBadges; },
        get allowUrgent() { return allowUrgent; },

        toggle() {
            isEnabled = !isEnabled;
        },

        enable() {
            isEnabled = true;
        },

        disable() {
            isEnabled = false;
        },

        setScheduleEnabled(value) {
            scheduleEnabled = value;
        },

        setScheduleStart(time) {
            scheduleStart = time;
        },

        setScheduleEnd(time) {
            scheduleEnd = time;
        },

        setMuteNotifications(value) {
            muteNotifications = value;
        },

        setHideBadges(value) {
            hideBadges = value;
        },

        setAllowUrgent(value) {
            allowUrgent = value;
        },

        // Check if notification should be shown
        shouldShowNotification(isUrgent = false) {
            const active = this.isActive;
            if (!active) return true;
            if (isUrgent && allowUrgent) return true;
            return !muteNotifications;
        },

        // Check if badge should be shown
        shouldShowBadge() {
            const active = this.isActive;
            if (!active) return true;
            return !hideBadges;
        }
    };
}

export const dndStore = createDNDStore();
