<script>
    import { Bot, X, Send, Trash2, History } from "lucide-svelte";
    import { aiChatStore } from "../../lib/stores/aiChatStore.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let isOpen = $derived(aiChatStore.isOpen);
    let messages = $derived(aiChatStore.messages);
    let isProcessing = $derived(aiChatStore.isProcessing);
    
    let inputText = $state("");
    let chatContainer;
    let showHistory = $state(false);

    function handleClose() {
        aiChatStore.close();
    }

    function handleClearChat() {
        aiChatStore.clearMessages();
        toastStore.info("Chat cleared");
    }

    function toggleHistory() {
        showHistory = !showHistory;
        // TODO: Implement history view
        toastStore.info("History feature coming soon");
    }

    async function handleSend() {
        if (!inputText.trim() || isProcessing) return;

        const userMessage = inputText.trim();
        inputText = "";

        // Add user message
        aiChatStore.addMessage("user", userMessage);
        
        // Scroll to bottom
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }, 50);

        // Set processing state
        aiChatStore.setProcessing(true);

        try {
            // TODO: Integrate with actual AI API
            // For now, simulate AI response
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const aiResponse = `I received your message: "${userMessage}". This is a placeholder response. Integration with AI API will be implemented here.`;
            aiChatStore.addMessage("assistant", aiResponse);
            
            // Scroll to bottom after AI response
            setTimeout(() => {
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }, 50);
        } catch (error) {
            toastStore.error("Failed to get AI response");
            console.error("AI Chat error:", error);
        } finally {
            aiChatStore.setProcessing(false);
        }
    }

    function handleKeydown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<!-- AI Chat Panel - Slides from right and pushes content -->
<div 
    class="ai-chat-panel h-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out"
    style="width: {isOpen ? '320px' : '0'}; min-width: {isOpen ? '320px' : '0'}; overflow: hidden;"
>
    <!-- Compact Header with History Icon -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <button
            onclick={toggleHistory}
            class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="View chat history"
        >
            <History size={18} class="text-gray-600 dark:text-gray-400" />
        </button>
        <button
            onclick={handleClose}
            class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
            <X size={18} class="text-gray-600 dark:text-gray-400" />
        </button>
    </div>

    <!-- Messages Container -->
    <div 
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar"
    >
        {#if messages.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-center px-3">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 flex items-center justify-center mb-3">
                    <Bot size={28} class="text-blue-600 dark:text-blue-400" />
                </div>
                <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    AI Assistant
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                    Ask me anything about browser automation and marketing tasks
                </p>
            </div>
        {:else}
            {#each messages as message (message.id)}
                <div class="flex gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                    {#if message.role === 'assistant'}
                        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <Bot size={16} class="text-white" />
                        </div>
                    {/if}
                    
                    <div class="flex flex-col max-w-[75%]">
                        <div class="px-3 py-2 rounded-2xl {message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}">
                            <p class="text-xs whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 {message.role === 'user' ? 'text-right' : 'text-left'}">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    {#if message.role === 'user'}
                        <div class="flex-shrink-0 w-7 h-7 rounded-full bg-gray-600 dark:bg-gray-700 flex items-center justify-center">
                            <span class="text-white text-[10px] font-semibold">U</span>
                        </div>
                    {/if}
                </div>
            {/each}

            {#if isProcessing}
                <div class="flex gap-2 justify-start">
                    <div class="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <Bot size={16} class="text-white" />
                    </div>
                    <div class="px-3 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800">
                        <div class="flex gap-1">
                            <div class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0ms;"></div>
                            <div class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 150ms;"></div>
                            <div class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 300ms;"></div>
                        </div>
                    </div>
                </div>
            {/if}
        {/if}
    </div>

    <!-- Input Area -->
    <div class="border-t border-gray-200 dark:border-gray-700 p-3">
        <div class="flex gap-2">
            <textarea
                bind:value={inputText}
                onkeydown={handleKeydown}
                placeholder="Ask AI..."
                class="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                rows="2"
                disabled={isProcessing}
            ></textarea>
            <button
                onclick={handleSend}
                disabled={!inputText.trim() || isProcessing}
                class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg transition-all disabled:cursor-not-allowed flex items-center justify-center"
            >
                <Send size={16} />
            </button>
        </div>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
            Enter to send • Shift+Enter for new line
        </p>
    </div>
</div>

<style>
    .ai-chat-panel {
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
    }

    /* Custom scrollbar - Modern rounded style */
    .custom-scrollbar::-webkit-scrollbar {
        width: 10px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 10px;
        min-height: 40px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    /* Dark mode scrollbar */
    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #5a5a5a;
    }

    :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #6e6e6e;
    }
</style>
