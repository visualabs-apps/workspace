<script>
    import { onMount } from "svelte";

    let { service, isActive } = $props();

    let webview;
    let isLoading = $state(true);
    let canGoBack = $state(false);
    let canGoForward = $state(false);

    $effect(() => {
        if (webview) {
            // Handle zooming
            webview.setZoomLevel(service.zoom || 0);

            // Handle audio muting
            webview.setAudioMuted(service.isMuted);

            // Reload if needed? No, user handles reload.
        }
    });

    onMount(() => {
        if (!webview) return;

        const handleDomReady = () => {
            isLoading = false;
            canGoBack = webview.canGoBack();
            canGoForward = webview.canGoForward();
            // Inject custom CSS/JS here if needed
            // webview.insertCSS(...)
        };

        const handleDidStartLoading = () => {
            isLoading = true;
        };

        const handleDidStopLoading = () => {
            isLoading = false;
        };

        const handleNewWindow = (e) => {
            // Open in default browser
            const protocol = require("url").parse(e.url).protocol;
            if (protocol === "http:" || protocol === "https:") {
                // shell.openExternal(e.url)
                // We need to use IPC or remote to open external, but webview usually handles new-window event
                // Actually in recent electron, we use setWindowOpenHandler on the create creation,
                // but for webview tag, we listen to 'new-window' (deprecated) or use 'did-create-window' logic
                // For simplicity, let's just allow it in the webview for now or block popup.
                // Best practice: Open in user's default browser?
                // For now, let's just log it.
                console.log("New window requested:", e.url);
            }
        };

        webview.addEventListener("dom-ready", handleDomReady);
        webview.addEventListener("did-start-loading", handleDidStartLoading);
        webview.addEventListener("did-stop-loading", handleDidStopLoading);
        webview.addEventListener("new-window", handleNewWindow);

        return () => {
            if (webview) {
                webview.removeEventListener("dom-ready", handleDomReady);
                webview.removeEventListener("did-start-loading", handleDidStartLoading);
                webview.removeEventListener("did-stop-loading", handleDidStopLoading);
                webview.removeEventListener("new-window", handleNewWindow);
            }
        };
    });
</script>

<div class="w-full h-full flex flex-col relative" style:display={isActive ? "flex" : "none"}>
    <!-- Toolbar (Optional, hidden by default unless in 'dev' mode or specific setting) -->
    <!-- You might want a top bar here for navigation if it's the active service -->

    <div class="flex-1 relative bg-white">
        {#if isLoading}
            <div class="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 pointer-events-none opacity-50">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        {/if}

        <webview bind:this={webview} src={service.url} partition={service.partition} allowpopups="true" class="w-full h-full" useragent={service.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}></webview>
    </div>
</div>
