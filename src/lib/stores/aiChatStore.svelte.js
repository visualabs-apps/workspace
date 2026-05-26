// AI Chat Store - manages AI chat panel state and messages

let messageIdCounter = 0;

function createAIChatStore() {
    // Load approval mode from localStorage
    const savedApprovalMode = localStorage.getItem('ai_chat_approval_mode') || 'ask';
    
    let isOpen = $state(false);
    let messages = $state([]);
    let isProcessing = $state(false);
    let selectedModel = $state('claude-sonnet-4-6'); // Default model
    let availableModels = $state([]);
    let currentRequestId = $state(null);
    let pollStatus = $state(null); // { status, attempt, maxAttempts }
    let currentProfileId = $state(null);
    let automationMode = $state(false); // Toggle for automation mode
    let contextAware = $state(true); // Auto-inject page context
    let approvalMode = $state(savedApprovalMode); // 'ask' or 'auto'
    let pendingAction = $state(null); // Pending MCP action waiting for approval

    return {
        get isOpen() { return isOpen; },
        get messages() { return messages; },
        get isProcessing() { return isProcessing; },
        get selectedModel() { return selectedModel; },
        get availableModels() { return availableModels; },
        get currentRequestId() { return currentRequestId; },
        get pollStatus() { return pollStatus; },
        get automationMode() { return automationMode; },
        get contextAware() { return contextAware; },
        get approvalMode() { return approvalMode; },
        get pendingAction() { return pendingAction; },

        toggle() {
            isOpen = !isOpen;
        },

        open() {
            isOpen = true;
        },

        close() {
            isOpen = false;
        },

        setSelectedModel(model) {
            selectedModel = model;
        },

        setAvailableModels(models) {
            availableModels = models;
        },

        setAutomationMode(enabled) {
            automationMode = enabled;
        },

        setContextAware(enabled) {
            contextAware = enabled;
        },

        setApprovalMode(mode) {
            approvalMode = mode; // 'ask' or 'auto'
            // Save to localStorage
            localStorage.setItem('ai_chat_approval_mode', mode);
        },

        setPendingAction(action) {
            pendingAction = action;
        },

        setProfileId(profileId) {
            currentProfileId = profileId;
        },

        async loadMessages(profileId) {
            if (!window.api?.db?.getAiMessages) return;
            
            currentProfileId = profileId;
            const result = await window.api.db.getAiMessages(profileId);
            
            if (result.success && result.messages) {
                messages = result.messages;
                // Update counter to prevent ID conflicts
                if (messages.length > 0) {
                    const lastId = messages[messages.length - 1].id;
                    const match = lastId.match(/msg_(\d+)_/);
                    if (match) {
                        messageIdCounter = parseInt(match[1]);
                    }
                }
            }
        },

        addMessage(role, content, metadata = {}) {
            messageIdCounter++;
            const message = {
                id: `msg_${messageIdCounter}_${Date.now()}`,
                role, // 'user' or 'assistant'
                content,
                timestamp: new Date(),
                ...metadata
            };
            
            messages = [...messages, message];
            
            // Save to database if we have a profile ID and it's not a loading message
            if (currentProfileId && !metadata.isLoading && window.api?.db?.saveAiMessage) {
                window.api.db.saveAiMessage(currentProfileId, message).catch(err => {
                    console.error('[AI Chat Store] Save error:', err);
                });
            }
            
            return message;
        },

        updateLastMessage(updates) {
            if (messages.length > 0) {
                const lastIndex = messages.length - 1;
                const updatedMessage = { ...messages[lastIndex], ...updates };
                
                messages = [
                    ...messages.slice(0, lastIndex),
                    updatedMessage
                ];
                
                // Save to database if not a loading message
                if (currentProfileId && !updatedMessage.isLoading && window.api?.db?.saveAiMessage) {
                    window.api.db.saveAiMessage(currentProfileId, updatedMessage).catch(err => {
                        console.error('[AI Chat Store] Update error:', err);
                    });
                }
            }
        },

        setProcessing(state) {
            isProcessing = state;
        },

        setCurrentRequestId(requestId) {
            currentRequestId = requestId;
        },

        setPollStatus(status) {
            pollStatus = status;
        },

        async clearMessages() {
            if (currentProfileId && window.api?.db?.clearAiMessages) {
                await window.api.db.clearAiMessages(currentProfileId);
            }
            messages = [];
            messageIdCounter = 0;
        },

        reset() {
            isProcessing = false;
            currentRequestId = null;
            pollStatus = null;
        }
    };
}

export const aiChatStore = createAIChatStore();
