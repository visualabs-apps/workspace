<script>
    import {
        ChevronLeft,
        ChevronRight,
        RotateCw,
        Home,
        Search,
        Square,
    } from "lucide-svelte";
    import { navigationStore } from "../lib/navigation.svelte.js";
    import WindowControls from "./WindowControls.svelte";

    let { service = null } = $props();

    let urlInput = $state(service?.url || "");
    let isUrlFocused = $state(false);

    // Derived from navigation store
    let canGoBack = $derived(navigationStore.canGoBack);
    let canGoForward = $derived(navigationStore.canGoForward);
    let isLoading = $derived(navigationStore.isLoading);
    let currentUrl = $derived(navigationStore.currentUrl);

    // Update URL input when current URL changes
    $effect(() => {
        if (currentUrl && !isUrlFocused) {
            urlInput = currentUrl;
        }
    });

    // Update URL input when service changes
    $effect(() => {
        if (service && !isUrlFocused) {
            urlInput = currentUrl || service.url;
        }
    });

    function handleUrlSubmit(e) {
        if (e.key === "Enter" && urlInput.trim()) {
            const input = urlInput.trim();
            
            // Check if it's a URL (contains . or starts with http/https)
            const isUrl = input.includes('.') || input.startsWith('http://') || input.startsWith('https://');
            
            if (isUrl) {
                // Navigate to URL
                let url = input;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                navigationStore.navigate(url);
            } else {
                // Search using Google
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
                navigationStore.navigate(searchUrl);
            }
            
            e.target.blur();
        }
    }
</script>

<div
    class="bg-[#2c4a4a] flex items-center shrink-0 h-12 px-1 gap-2"
    style="-webkit-app-region: drag"
>
    <!-- Navigation Buttons -->
    <div
        class="flex items-center gap-1 pl-2"
        style="-webkit-app-region: no-drag"
    >
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 transition-colors {canGoBack
                ? 'text-white hover:text-gray-100'
                : 'text-gray-500 cursor-not-allowed'}"
            title="Back"
            onclick={() => navigationStore.goBack()}
            disabled={!canGoBack}
        >
            <ChevronLeft size={18} />
        </button>
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 transition-colors {canGoForward
                ? 'text-white hover:text-gray-100'
                : 'text-gray-500 cursor-not-allowed'}"
            title="Forward"
            onclick={() => navigationStore.goForward()}
            disabled={!canGoForward}
        >
            <ChevronRight size={18} />
        </button>
        {#if isLoading}
            <button
                class="p-1.5 rounded-lg hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors"
                title="Stop"
                onclick={() => navigationStore.stop()}
            >
                <Square size={14} />
            </button>
        {:else}
            <button
                class="p-1.5 rounded-lg hover:bg-white/10 text-white hover:text-gray-100 transition-colors"
                title="Reload"
                onclick={() => navigationStore.reload()}
            >
                <RotateCw size={16} />
            </button>
        {/if}
        <button
            class="p-1.5 rounded-lg hover:bg-white/10 text-white hover:text-gray-100 transition-colors"
            title="Home"
            onclick={() => service && navigationStore.goHome(service.url)}
        >
            <Home size={16} />
        </button>
    </div>

    <!-- URL Input -->
    <div
        class="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-lg min-w-[200px] max-w-[500px] flex-1 {isUrlFocused
            ? 'ring-2 ring-pink-500/50 bg-black/40'
            : ''}"
        style="-webkit-app-region: no-drag"
    >
        {#if isLoading}
            <div
                class="w-3.5 h-3.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin shrink-0"
            ></div>
        {:else}
            <Search size={14} class="text-gray-400 shrink-0" />
        {/if}
        <input
            type="text"
            bind:value={urlInput}
            onfocus={() => (isUrlFocused = true)}
            onblur={() => (isUrlFocused = false)}
            onkeydown={handleUrlSubmit}
            placeholder="Search Google or type a URL"
            class="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none w-full"
        />
    </div>

    <div class="flex-1"></div>

    <!-- Window Controls -->
    <WindowControls variant="dark" />
</div>
