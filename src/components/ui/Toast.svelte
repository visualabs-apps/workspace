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
                return 'bg-green-50 border-green-200 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    }

    function getIconColor(type) {
        switch (type) {
            case 'success':
                return 'text-green-600';
            case 'error':
                return 'text-red-600';
            case 'warning':
                return 'text-yellow-600';
            case 'info':
            default:
                return 'text-blue-600';
        }
    }
</script>

<!-- Toast Container -->
<div class="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
    {#each toasts as toast (toast.id)}
        <div
            in:fly={{ y: 20, duration: 200 }}
            out:fade={{ duration: 150 }}
            class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[400px] {getColors(toast.type)}"
        >
            <svelte:component this={getIcon(toast.type)} size={20} class="{getIconColor(toast.type)} shrink-0" />
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




