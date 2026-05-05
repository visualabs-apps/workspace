<script>
    import { X, Maximize2, Minimize2 } from "lucide-svelte";
    import { windowManager } from "../../lib/managers/windowManager.svelte.js";
    import { onMount, onDestroy } from "svelte";

    let {
        isOpen = $bindable(false),
        windowId = "",
        title = "",
        subtitle = "",
        width = "600px",
        height = "auto",
        minWidth = "400px",
        minHeight = "300px",
        showCloseButton = true,
        showMaximizeButton = false,
        closeOnEscape = true,
        initialPosition = null,
        onClose = () => {},
        headerSlot,
        footerSlot,
        children
    } = $props();

    let windowElement = $state();
    let headerElement = $state();
    let isDragging = $state(false);
    let dragOffset = $state({ x: 0, y: 0 });
    let position = $state({ x: 100, y: 100 });
    let zIndex = $state(300);
    let isMaximized = $state(false);
    let savedPosition = $state(null);
    let savedSize = $state(null);

    // Initialize position from props
    $effect(() => {
        if (initialPosition) {
            position = initialPosition;
        }
    });

    // Register window on mount
    onMount(() => {
        if (isOpen && windowId) {
            const win = windowManager.registerWindow(windowId, position);
            zIndex = win.zIndex;
            position = win.position;
        }

        // Handle escape key
        if (closeOnEscape) {
            document.addEventListener('keydown', handleEscape);
        }
    });

    onDestroy(() => {
        if (windowId) {
            windowManager.unregisterWindow(windowId);
        }
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    });

    // Watch isOpen changes - only register when opened
    let isRegistered = $state(false);
    
    $effect(() => {
        if (isOpen && windowId && !isRegistered) {
            const win = windowManager.registerWindow(windowId, position);
            zIndex = win.zIndex;
            isRegistered = true;
        } else if (!isOpen && isRegistered) {
            isRegistered = false;
        }
    });

    // Watch window manager for z-index updates (use untrack to avoid loops)
    $effect(() => {
        if (windowId && isOpen && isRegistered) {
            const win = windowManager.getWindow(windowId);
            if (win && win.zIndex !== zIndex) {
                zIndex = win.zIndex;
            }
            if (win && win.isMaximized !== isMaximized) {
                isMaximized = win.isMaximized || false;
            }
        }
    });

    function handleClose() {
        isOpen = false;
        onClose();
    }

    function handleEscape(e) {
        if (e.key === 'Escape' && isOpen) {
            handleClose();
        }
    }

    function handleWindowClick() {
        if (windowId) {
            windowManager.bringToFront(windowId);
        }
    }

    function handleMouseDown(e) {
        // Only drag from header, not from buttons
        if (e.target.closest('button')) return;
        if (isMaximized) return;

        isDragging = true;
        dragOffset = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        handleWindowClick();
    }

    function handleMouseMove(e) {
        if (!isDragging) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Keep window within viewport
        const maxX = window.innerWidth - 100; // Keep at least 100px visible
        const maxY = window.innerHeight - 50; // Keep at least 50px visible

        position = {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
        };

        if (windowId) {
            windowManager.updatePosition(windowId, position);
        }
    }

    function handleMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    function handleMaximize() {
        if (!isMaximized) {
            // Save current position and size
            savedPosition = { ...position };
            savedSize = { width, height };
            isMaximized = true;
        } else {
            // Restore position and size
            if (savedPosition) {
                position = savedPosition;
            }
            isMaximized = false;
        }

        if (windowId) {
            windowManager.maximize(windowId);
        }
    }
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        bind:this={windowElement}
        class="fixed bg-white rounded-lg shadow-2xl border border-gray-300 flex flex-col overflow-hidden"
        class:maximized={isMaximized}
        style="
            left: {isMaximized ? '0' : position.x + 'px'};
            top: {isMaximized ? '0' : position.y + 'px'};
            width: {isMaximized ? '100vw' : width};
            height: {isMaximized ? '100vh' : height};
            min-width: {minWidth};
            min-height: {minHeight};
            z-index: {zIndex};
            cursor: {isDragging ? 'grabbing' : 'default'};
        "
        onclick={handleWindowClick}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <!-- Header / Title Bar -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            bind:this={headerElement}
            class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 text-gray-900 shrink-0 select-none"
            class:cursor-grab={!isDragging && !isMaximized}
            class:cursor-grabbing={isDragging}
            onmousedown={handleMouseDown}
            ondblclick={showMaximizeButton ? handleMaximize : null}
        >
            {#if headerSlot}
                {@render headerSlot()}
            {:else}
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-sm truncate text-gray-900">{title}</h3>
                    {#if subtitle}
                        <p class="text-xs text-gray-500 truncate">{subtitle}</p>
                    {/if}
                </div>
            {/if}
            
            <div class="flex items-center gap-1 ml-2 shrink-0">
                {#if showMaximizeButton}
                    <button
                        type="button"
                        onclick={handleMaximize}
                        class="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                        aria-label={isMaximized ? "Exit Fullscreen" : "Fullscreen"}
                        title={isMaximized ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {#if isMaximized}
                            <Minimize2 size={14} />
                        {:else}
                            <Maximize2 size={14} />
                        {/if}
                    </button>
                {/if}
                
                {#if showCloseButton}
                    <button
                        type="button"
                        onclick={handleClose}
                        class="p-1.5 hover:bg-red-100 hover:text-red-600 rounded transition-colors text-gray-600"
                        aria-label="Close"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                {/if}
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 bg-white">
            {#if children}
                {@render children()}
            {/if}
        </div>

        <!-- Footer -->
        {#if footerSlot}
            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
                {@render footerSlot()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .maximized {
        border-radius: 0 !important;
    }

    /* Custom scrollbar */
    div::-webkit-scrollbar {
        width: 8px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 4px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    /* Prevent text selection while dragging */
    .select-none {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
    }
</style>




