// Link Routing Store
// Manages smart link routing rules

function createLinkRoutingStore() {
    // Load from localStorage
    let storedRules = [];
    try {
        const item = localStorage.getItem('visualbox_link_routing');
        if (item) storedRules = JSON.parse(item);
    } catch (e) {
        console.error('Failed to load link routing rules', e);
    }

    // Default rules
    const defaultRules = [
        { pattern: '*.zoom.us/*', action: 'external', enabled: true },
        { pattern: '*.meet.google.com/*', action: 'external', enabled: true },
        { pattern: '*.teams.microsoft.com/*', action: 'external', enabled: true },
    ];

    // State
    let rules = $state(storedRules.length > 0 ? storedRules : defaultRules);
    let defaultAction = $state('current-tab'); // current-tab, new-tab, external

    // Auto-save to localStorage
    $effect.root(() => {
        $effect(() => {
            localStorage.setItem('visualbox_link_routing', JSON.stringify(rules));
        });
    });

    return {
        get rules() { return rules; },
        get defaultAction() { return defaultAction; },

        setDefaultAction(action) {
            defaultAction = action;
        },

        // Add a new routing rule
        addRule(pattern, action) {
            rules = [...rules, {
                id: Date.now(),
                pattern,
                action, // current-tab, new-tab, external, specific-app
                targetAppId: null,
                enabled: true
            }];
        },

        // Update a rule
        updateRule(id, updates) {
            const index = rules.findIndex(r => r.id === id);
            if (index !== -1) {
                rules = [
                    ...rules.slice(0, index),
                    { ...rules[index], ...updates },
                    ...rules.slice(index + 1)
                ];
            }
        },

        // Remove a rule
        removeRule(id) {
            rules = rules.filter(r => r.id !== id);
        },

        // Toggle rule enabled/disabled
        toggleRule(id) {
            const index = rules.findIndex(r => r.id === id);
            if (index !== -1) {
                rules = [
                    ...rules.slice(0, index),
                    { ...rules[index], enabled: !rules[index].enabled },
                    ...rules.slice(index + 1)
                ];
            }
        },

        // Check if URL matches a pattern
        matchesPattern(url, pattern) {
            // Convert glob pattern to regex
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            const regex = new RegExp(`^${regexPattern}$`, 'i');
            return regex.test(url);
        },

        // Get routing action for a URL
        getRoutingAction(url) {
            // Check enabled rules in order
            for (const rule of rules) {
                if (rule.enabled && this.matchesPattern(url, rule.pattern)) {
                    return {
                        action: rule.action,
                        targetAppId: rule.targetAppId,
                        rule: rule
                    };
                }
            }
            // Return default action
            return {
                action: defaultAction,
                targetAppId: null,
                rule: null
            };
        },

        // Reset to default rules
        resetToDefaults() {
            rules = defaultRules;
            defaultAction = 'current-tab';
        }
    };
}

export const linkRoutingStore = createLinkRoutingStore();
