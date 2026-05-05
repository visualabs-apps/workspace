<script>
    import { Clock, Search, Globe, Star } from "lucide-svelte";
    import { historyStore } from "../../lib/stores/history.svelte.js";
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";

    let { 
        query = "", 
        isVisible = false, 
        onSelect = () => {}, 
        onClose = () => {} 
    } = $props();

    let selectedIndex = $state(0);
    let suggestions = $state([]);

    // Get current workspace
    let currentWorkspace = $derived(workspaceStore.activeWorkspace);

    // Update suggestions when query changes
    $effect(() => {
        if (!query || query.length < 1 || !currentWorkspace) {
            suggestions = [];
            return;
        }

        const workspaceId = currentWorkspace.id;
        
        // Get history suggestions
        const historySuggestions = historyStore.searchHistory(workspaceId, query, 5)
            .map(entry => ({
                type: 'history',
                url: entry.url,
                title: entry.title,
                favicon: entry.favicon,
                visitCount: entry.visitCount,
                id: entry.id // Use existing history entry ID
            }));

        // Add search suggestion
        const searchSuggestion = {
            type: 'search',
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            title: `Search for "${query}"`,
            favicon: 'https://www.google.com/favicon.ico',
            id: 'search-suggestion'
        };

        // Check if query looks like a URL
        const isUrl = query.includes('.') && !query.includes(' ');
        const urlSuggestion = isUrl ? {
            type: 'url',
            url: query.startsWith('http') ? query : `https://${query}`,
            title: `Go to ${query}`,
            favicon: null,
            id: 'url-suggestion'
        } : null;

        // Get Google suggestions (async)
        fetchGoogleSuggestions(query).then(googleSuggestions => {
            // Combine all suggestions
            suggestions = [
                ...(urlSuggestion ? [urlSuggestion] : []),
                searchSuggestion,
                ...googleSuggestions,
                ...historySuggestions
            ].slice(0, 8);
        });

        // Set initial suggestions without Google (for immediate display)
        suggestions = [
            ...(urlSuggestion ? [urlSuggestion] : []),
            searchSuggestion,
            ...historySuggestions
        ].slice(0, 8);

        selectedIndex = 0;
    });

    // Fetch Google Suggest API
    async function fetchGoogleSuggestions(query) {
        try {
            // Use Electron's native HTTP to bypass CORS
            if (window.api?.http) {
                const response = await window.api.http.request({
                    method: 'GET',
                    url: `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.data && response.data[1] && Array.isArray(response.data[1])) {
                    return response.data[1].slice(0, 4).map((suggestion, index) => ({
                        type: 'google',
                        url: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
                        title: suggestion,
                        favicon: 'https://www.google.com/favicon.ico',
                        id: `google-${index}`
                    }));
                }
            } else {
                // Fallback to regular fetch for web version
                const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data && data[1] && Array.isArray(data[1])) {
                    return data[1].slice(0, 4).map((suggestion, index) => ({
                        type: 'google',
                        url: `https://www.google.com/search?q=${encodeURIComponent(suggestion)}`,
                        title: suggestion,
                        favicon: 'https://www.google.com/favicon.ico',
                        id: `google-${index}`
                    }));
                }
            }
        } catch (error) {
            console.log('Google Suggest API not available, using fallback suggestions');
        }
        
        // Fallback: Generate common search suggestions based on query
        return generateFallbackSuggestions(query);
    }

    // Generate fallback suggestions when Google API is not available
    function generateFallbackSuggestions(query) {
        const commonSuffixes = [
            'tutorial',
            'download',
            'free',
            'online',
            'review',
            'price',
            'how to',
            'best'
        ];

        const suggestions = [];
        
        // Add query with common suffixes
        commonSuffixes.forEach((suffix, index) => {
            if (suggestions.length < 3) {
                const suggestionText = `${query} ${suffix}`;
                suggestions.push({
                    type: 'google',
                    url: `https://www.google.com/search?q=${encodeURIComponent(suggestionText)}`,
                    title: suggestionText,
                    favicon: 'https://www.google.com/favicon.ico',
                    id: `fallback-${index}`
                });
            }
        });

        return suggestions;
    }

    // Handle keyboard navigation
    function handleKeydown(e) {
        if (!isVisible || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    onSelect(suggestions[selectedIndex].url);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }

    // Handle mouse selection
    function handleSelect(suggestion) {
        onSelect(suggestion.url);
    }

    function handleMouseEnter(index) {
        selectedIndex = index;
    }

    function formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        } catch (e) {
            return url;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isVisible && suggestions.length > 0}
    <div 
        class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
        style="min-width: 400px;"
    >
        {#each suggestions as suggestion, index (suggestion.id)}
            {@const isSelected = index === selectedIndex}
            
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                    {isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}"
                onclick={() => handleSelect(suggestion)}
                onmouseenter={() => handleMouseEnter(index)}
            >
                <!-- Icon -->
                <div class="w-4 h-4 shrink-0 flex items-center justify-center">
                    {#if suggestion.type === 'history'}
                        {#if suggestion.favicon}
                            <img 
                                src={suggestion.favicon} 
                                alt="" 
                                class="w-4 h-4 object-contain"
                                onerror={(e) => e.target.style.display = 'none'}
                            />
                        {:else}
                            <Clock size={14} class="text-gray-400" />
                        {/if}
                    {:else if suggestion.type === 'search'}
                        <Search size={14} class="text-blue-500" />
                    {:else if suggestion.type === 'google'}
                        <Search size={14} class="text-gray-500" />
                    {:else if suggestion.type === 'url'}
                        <Globe size={14} class="text-green-500" />
                    {/if}
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 truncate">
                        {suggestion.title}
                    </div>
                    {#if suggestion.type === 'history'}
                        <div class="text-xs text-gray-500 truncate">
                            {formatUrl(suggestion.url)}
                            {#if suggestion.visitCount > 1}
                                <span class="ml-2 text-gray-400">• {suggestion.visitCount} visits</span>
                            {/if}
                        </div>
                    {:else if suggestion.type === 'url'}
                        <div class="text-xs text-gray-500 truncate">
                            {formatUrl(suggestion.url)}
                        </div>
                    {/if}
                </div>

                <!-- Type indicator -->
                {#if suggestion.type === 'history' && suggestion.visitCount > 5}
                    <Star size={12} class="text-yellow-500 shrink-0" />
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    /* Custom scrollbar for dropdown */
    div::-webkit-scrollbar {
        width: 6px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
</style>



