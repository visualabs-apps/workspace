// AI Chat Store - manages AI chat panel state and messages

function createAIChatStore() {
    let isOpen = $state(false);
    let messages = $state([]);
    let isProcessing = $state(false);

    return {
        get isOpen() { return isOpen; },
        get messages() { return messages; },
        get isProcessing() { return isProcessing; },

        toggle() {
            isOpen = !isOpen;
        },

        open() {
            isOpen = true;
        },

        close() {
            isOpen = false;
        },

        addMessage(role, content) {
            messages = [...messages, {
                id: Date.now(),
                role, // 'user' or 'assistant'
                content,
                timestamp: new Date()
            }];
        },

        setProcessing(state) {
            isProcessing = state;
        },

        clearMessages() {
            messages = [];
        }
    };
}

export const aiChatStore = createAIChatStore();
