<script>
    import { slide } from 'svelte/transition';
    import { X } from "lucide-svelte";
    import { useClickOutside } from "../../lib/utils/clickOutside.svelte.js";
    import { onDestroy } from "svelte";

    let {
        isOpen = $bindable(false),
        title = "",
        subtitle = "",
        position = "right", // left, right
        width = "w-96",
        showCloseButton = true,
        onClose = () => {},
        headerSlot,
        footerSlot,
        children
    } = $props();

    let clickOutsideCleanup;

    onDestroy(() => {
        if (clickOutsideCleanup) {
            clickOutsideCleanup();
        }
    });

    // Setup click outside detection
    $effect(() => {
        if (isOpen) {
            clickOutsideCleanup = useClickOutside({
                elementSelector: '[data-side-panel]',
                onClickOutside: () => isOpen = false,
                enabled: true,
                includeEscape: true,
                includeBlur: true,
                includeResize: true
            });
        } else {
            if (clickOutsideCleanup) {
                clickOutsideCleanup();
                clickOutsideCleanup = null;
            }
        }
    });

    function handleClose() {
        isOpen = false;
        onClose();
    }
</script>

{#if isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div 
        class="fixed {position === 'right' ? 'right-0' : 'left-0'} top-0 h-full {width} bg-white shadow-2xl border-{position === 'right' ? 'l' : 'r'} border-gray-200 flex flex-col z-50"
        data-side-panel
        transition:slide={{ duration: 300, axis: 'x' }}
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 shrink-0">
            {#if headerSlot}
                {@render headerSlot()}
            {:else}
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="text-lg font-semibold text-gray-900">{title}</h2>
                        {#if subtitle}
                            <p class="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                        {/if}
                    </div>
                    {#if showCloseButton}
                        <button
                            onclick={handleClose}
                            class="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        >
                            <X size={20} />
                        </button>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
            {#if children}
                {@render children()}
            {/if}
        </div>

        <!-- Footer -->
        {#if footerSlot}
            <div class="p-4 border-t border-gray-200 shrink-0">
                {@render footerSlot()}
            </div>
        {/if}
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
