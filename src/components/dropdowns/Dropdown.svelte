<script>
    import { onMount, onDestroy } from 'svelte';
    import { dropdownManager } from '../../lib/managers/dropdownManager.svelte.js';
    import { useClickOutside } from '../../lib/utils/clickOutside.svelte.js';

    let { 
        isOpen = false, 
        onClose = () => {}, 
        position = 'right',
        width = 'w-56',
        zIndex = 'z-50',
        dropdownId = Math.random().toString(36).substr(2, 9),
        trigger,
        children
    } = $props();

    let closeHandler;
    let clickOutsideCleanup;

    onMount(() => {
        // Close event from dropdown manager
        closeHandler = (e) => {
            if (e.detail.except !== dropdownId && isOpen) {
                onClose();
            }
        };
        document.addEventListener('closeDropdown', closeHandler);
    });

    onDestroy(() => {
        if (closeHandler) {
            document.removeEventListener('closeDropdown', closeHandler);
        }
        if (clickOutsideCleanup) {
            clickOutsideCleanup();
        }
    });

    // Setup click outside detection when dropdown opens
    $effect(() => {
        if (isOpen) {
            dropdownManager.setActive(dropdownId);
            
            // Setup click outside detection
            clickOutsideCleanup = useClickOutside({
                elementSelector: `[data-dropdown-id="${dropdownId}"], [data-dropdown-menu="${dropdownId}"]`,
                onClickOutside: onClose,
                enabled: true,
                includeEscape: true,
                includeBlur: true,
                includeResize: true
            });
        } else {
            dropdownManager.close(dropdownId);
            
            // Cleanup click outside detection
            if (clickOutsideCleanup) {
                clickOutsideCleanup();
                clickOutsideCleanup = null;
            }
        }
    });
</script>

<div class="dropdown-container relative" style="-webkit-app-region: no-drag" data-dropdown-id={dropdownId}>
    <!-- Trigger -->
    {#if trigger}
        {@render trigger()}
    {/if}

    <!-- Dropdown Menu -->
    {#if isOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div 
            class="absolute top-full mt-2 {width} bg-white rounded-xl shadow-2xl border border-gray-200 py-2 {zIndex} {position === 'right' ? 'right-0' : 'left-0'}"
            data-dropdown-menu={dropdownId}
            onclick={(e) => e.stopPropagation()}
        >
            {#if children}
                {@render children()}
            {/if}
        </div>
    {/if}
</div>

<style>
    .dropdown-container {
        position: relative;
    }
</style>
