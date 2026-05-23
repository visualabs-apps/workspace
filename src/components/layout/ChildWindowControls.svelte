<script>
    import { Minus, Square, X } from "lucide-svelte";

    let { variant = "auto", windowId } = $props();

    async function minimize() {
        if (typeof window !== "undefined" && window.api?.childWindow?.minimize && windowId) {
            try {
                await window.api.childWindow.minimize(windowId);
            } catch (error) {
                console.error('Failed to minimize window:', error);
            }
        }
    }

    function maximize() {
        if (typeof window !== "undefined" && window.api) window.api.maximize();
    }

    function close() {
        if (typeof window !== "undefined" && window.api) window.api.close();
    }
</script>

<div
    class="flex items-center h-full mr-1 gap-1"
    style="-webkit-app-region: no-drag"
>
    {#if variant === "dark"}
        <button
            onclick={minimize}
            class="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Minimize"
        >
            <Minus size={16} strokeWidth={2} />
        </button>
        <button
            onclick={maximize}
            class="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Maximize"
        >
            <Square size={14} strokeWidth={2} />
        </button>
        <button
            onclick={close}
            class="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-lg text-gray-300 transition-colors"
            title="Close"
        >
            <X size={16} strokeWidth={2} />
        </button>
    {:else if variant === "light"}
        <button
            onclick={minimize}
            class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            title="Minimize"
        >
            <Minus size={16} strokeWidth={2} />
        </button>
        <button
            onclick={maximize}
            class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
            title="Maximize"
        >
            <Square size={14} strokeWidth={2} />
        </button>
        <button
            onclick={close}
            class="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-lg text-gray-500 transition-colors"
            title="Close"
        >
            <X size={16} strokeWidth={2} />
        </button>
    {:else}
        <!-- Auto (Adapts dynamically to theme) -->
        <button
            onclick={minimize}
            class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors"
            title="Minimize"
        >
            <Minus size={16} strokeWidth={2} />
        </button>
        <button
            onclick={maximize}
            class="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white transition-colors"
            title="Maximize"
        >
            <Square size={14} strokeWidth={2} />
        </button>
        <button
            onclick={close}
            class="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white rounded-lg text-gray-500 dark:text-gray-300 transition-colors"
            title="Close"
        >
            <X size={16} strokeWidth={2} />
        </button>
    {/if}
</div>
