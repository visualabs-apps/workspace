<script>
    import { Mail, X } from "lucide-svelte";
    import { emailSuggestionsStore } from "../lib/emailSuggestions.svelte.js";

    let { 
        query = "", 
        isVisible = false, 
        onSelect = () => {}, 
        onClose = () => {} 
    } = $props();

    let suggestions = $derived(emailSuggestionsStore.getSuggestions(query));
    let selectedIndex = $state(-1);

    // Reset selected index when suggestions change
    $effect(() => {
        if (suggestions) {
            selectedIndex = -1;
        }
    });

    function handleSelect(email) {
        onSelect(email);
        onClose();
    }

    function handleRemove(email, e) {
        e.stopPropagation();
        emailSuggestionsStore.removeEmail(email);
    }

    function handleKeydown(e) {
        if (!isVisible || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }

    // Listen for keydown events on the document
    $effect(() => {
        if (isVisible) {
            document.addEventListener('keydown', handleKeydown);
            return () => {
                document.removeEventListener('keydown', handleKeydown);
            };
        }
    });
</script>

{#if isVisible && suggestions.length > 0}
    <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
        {#each suggestions as email, index}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors {selectedIndex === index ? 'bg-blue-50 border-l-2 border-blue-500' : ''}"
                onclick={() => handleSelect(email)}
                role="button"
                tabindex="0"
            >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <Mail size={14} class="text-gray-400 shrink-0" />
                    <span class="text-sm text-gray-700 truncate">{email}</span>
                </div>
                <button
                    onclick={(e) => handleRemove(email, e)}
                    class="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    title="Remove from suggestions"
                >
                    <X size={12} />
                </button>
            </div>
        {/each}
    </div>
{/if}

<style>
    /* Custom scrollbar */
    div::-webkit-scrollbar {
        width: 6px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
</style>