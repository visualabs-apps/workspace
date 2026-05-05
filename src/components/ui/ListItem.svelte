<script>
    let {
        onclick = () => {},
        hoverable = true,
        selected = false,
        iconSlot,
        contentSlot,
        actionsSlot,
        class: className = ""
    } = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    {onclick}
    class="px-4 py-3 border-b border-gray-50 last:border-b-0 group transition-colors
        {hoverable ? 'hover:bg-gray-50 cursor-pointer' : ''}
        {selected ? 'bg-blue-50 border-l-2 border-blue-500' : ''}
        {className}"
>
    <div class="flex items-start gap-3">
        <!-- Icon -->
        {#if iconSlot}
            <div class="shrink-0 mt-0.5">
                {@render iconSlot()}
            </div>
        {/if}

        <!-- Content -->
        {#if contentSlot}
            <div class="flex-1 min-w-0">
                {@render contentSlot()}
            </div>
        {/if}

        <!-- Actions -->
        {#if actionsSlot}
            <div class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {@render actionsSlot()}
            </div>
        {/if}
    </div>
</div>




