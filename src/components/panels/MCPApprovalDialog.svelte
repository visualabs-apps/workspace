<script>
    import { Check, X, AlertCircle } from "lucide-svelte";

    let { action, onApprove, onDecline } = $props();

    function formatParams(params) {
        return JSON.stringify(params, null, 2);
    }
</script>

<div class="mcp-approval-dialog bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 mb-2">
    <div class="flex items-start gap-2 mb-2">
        <AlertCircle size={18} class="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                AI wants to execute: <code class="bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded text-xs">{action.tool}</code>
            </p>
            {#if action.params && Object.keys(action.params).length > 0}
                <pre class="text-xs text-yellow-700 dark:text-yellow-400 mt-2 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded overflow-x-auto">{formatParams(action.params)}</pre>
            {/if}
        </div>
    </div>
    
    <div class="flex gap-2 justify-end">
        <button
            onclick={onDecline}
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
        >
            <X size={14} />
            <span>Decline</span>
        </button>
        
        <button
            onclick={onApprove}
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
            <Check size={14} />
            <span>Accept & Execute</span>
        </button>
    </div>
</div>

<style>
    .mcp-approval-dialog {
        animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
