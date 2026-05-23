<script>
    let {
        url = '',
        exactIconUrl = '',
        size = 16,
        class: className = '',
        alt = 'Favicon'
    } = $props();
    
    const FALLBACK_ICON = `${import.meta.env.BASE_URL}browser.png`;
    
    let faviconUrl = $state('');
    let hasError = $state(false);
    let isLoading = $state(true);
    
    // Load favicon via main process (no CORS issues)
    $effect(() => {
        if (url || exactIconUrl) {
            loadFavicon();
        }
    });
    
    async function loadFavicon() {
        isLoading = true;
        hasError = false;
        
        try {
            // If exactIconUrl is already a data: URI, use it directly — no IPC needed
            if (exactIconUrl && exactIconUrl.startsWith('data:')) {
                faviconUrl = exactIconUrl;
                isLoading = false;
                return;
            }
            
            // Call main process to fetch favicon (bypasses CORS)
            const result = await window.api.getFavicon(url, exactIconUrl);
            
            if (result) {
                faviconUrl = result;
            } else {
                // Fallback to default icon
                faviconUrl = FALLBACK_ICON;
                hasError = true;
            }
        } catch (error) {
            // Silently fallback - don't warn on every failed favicon
            faviconUrl = FALLBACK_ICON;
            hasError = true;
        } finally {
            isLoading = false;
        }
    }
    
    let fallbackAttempted = $state(false);

    function handleError(e) {
        // Prevent infinite retry loop
        e.target.onerror = null;
        if (!fallbackAttempted) {
            // Try fallback icon once
            fallbackAttempted = true;
            e.target.src = FALLBACK_ICON;
        } else {
            // If fallback also fails, hide the image completely (no more requests)
            e.target.style.display = 'none';
        }
    }
</script>

<div class="inline-block {className}" style="width: {size}px; height: {size}px;">
    {#if isLoading}
        <div
            class="w-full h-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
        ></div>
    {:else}
        <img
            src={faviconUrl}
            alt={alt}
            width={size}
            height={size}
            class="w-full h-full object-contain"
            onerror={handleError}
            loading="lazy"
        />
    {/if}
</div>




