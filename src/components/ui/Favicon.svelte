<script>
    let {
        url = '',
        size = 16,
        class: className = '',
        alt = 'Favicon'
    } = $props();
    
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
                faviconUrl = '/icon.png';
                hasError = true;
            }
        } catch (error) {
            console.warn('Failed to load favicon:', error);
            faviconUrl = '/icon.png';
            hasError = true;
        } finally {
            isLoading = false;
        }
    }
    
    function handleError(e) {
        // Prevent infinite retry loop
        e.target.onerror = null;
        // Set to default icon
        e.target.src = '/icon.png';
    }
</script>

{#if isLoading}
    <div 
        class="inline-block bg-gray-200 rounded animate-pulse {className}"
        style="width: {size}px; height: {size}px;"
    ></div>
{:else}
    <img
        src={faviconUrl}
        alt={alt}
        width={size}
        height={size}
        class="inline-block {className}"
        onerror={handleError}
        loading="lazy"
    />
{/if}
