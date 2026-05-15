<script>
    let {
        url = '',
        size = 16,
        class: className = '',
        alt = 'Favicon'
    } = $props();
    
    const FALLBACK_ICON = `${import.meta.env.BASE_URL}visualbox_icon.png`;
    
    let faviconUrl = $state('');
    let hasError = $state(false);
    let isLoading = $state(true);
    
    // Load favicon via main process (no CORS issues)
    $effect(() => {
        if (url) {
            loadFavicon();
        }
    });
    
    async function loadFavicon() {
        isLoading = true;
        hasError = false;
        
        try {
            // Call main process to fetch favicon (bypasses CORS)
            const result = await window.api.getFavicon(url);
            
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
    
    function handleError(e) {
        // Prevent infinite retry loop
        e.target.onerror = null;
        // Set to default icon
        e.target.src = FALLBACK_ICON;
    }
</script>

<div class="inline-block {className}" style="width: {size}px; height: {size}px;">
    {#if isLoading}
        <div 
            class="w-full h-full bg-gray-200 rounded animate-pulse"
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




