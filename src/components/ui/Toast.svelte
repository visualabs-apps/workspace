<script>
    import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-svelte";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { fade, fly } from "svelte/transition";

    let toasts = $derived(toastStore.toasts);

    function getIcon(type) {
        switch (type) {
            case 'success':
                return CheckCircle;
            case 'error':
                return XCircle;
            case 'warning':
                return AlertTriangle;
            case 'info':
            default:
                return Info;
        }
    }

    function getColors(type) {
        switch (type) {
            case 'success':
                return 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300';
            case 'error':
                return 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
            case 'warning':
                return 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300';
            case 'info':
            default:
                return 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
        }
    }

    function getIconColor(type) {
        switch (type) {
            case 'success':
                return 'text-green-600 dark:text-green-400';
            case 'error':
                return 'text-red-600 dark:text-red-400';
            case 'warning':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'info':
            default:
                return 'text-blue-600 dark:text-blue-400';
        }
    }
</script>

<!-- Toast Container -->
<div class="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
    {#each toasts as toast (toast.id)}
        {@const ToastIcon = getIcon(toast.type)}
        <div
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[400px] {getColors(toast.type)}"
        >
            <ToastIcon size={20} class="{getIconColor(toast.type)} shrink-0" />
            <p class="flex-1 text-sm font-medium">{toast.message}</p>
            <button
                onclick={() => toastStore.remove(toast.id)}
                class="p-0.5 hover:bg-black/5 rounded transition-colors shrink-0"
            >
                <X size={16} />
            </button>
        </div>
    {/each}
</div>




