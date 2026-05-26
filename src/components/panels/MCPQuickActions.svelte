<script>
    import { Eye, List, Navigation, Image, Code, MousePointer, Keyboard, Camera, Search, Clock } from "lucide-svelte";
    import { mcpService } from "../../lib/services/mcpService.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let { onActionResult } = $props();
    
    // Dialog state
    let showDialog = $state(false);
    let dialogTitle = $state('');
    let dialogAction = $state(null);
    let dialogInputs = $state([]);
    let dialogValues = $state({});

    async function handleGetPageInfo() {
        const result = await mcpService.getPageInfo();
        if (result.success) {
            onActionResult('get_page_info', result.data);
            toastStore.success('Page info retrieved');
        } else {
            toastStore.error('Failed to get page info');
        }
    }

    async function handleListTabs() {
        const result = await mcpService.listTabs();
        if (result.success) {
            onActionResult('list_tabs', result.data);
            toastStore.success('Tabs listed');
        } else {
            toastStore.error('Failed to list tabs');
        }
    }

    async function handleListProfiles() {
        const result = await mcpService.listProfiles();
        if (result.success) {
            onActionResult('list_profiles', result.data);
            toastStore.success('Profiles listed');
        } else {
            toastStore.error('Failed to list profiles');
        }
    }
    
    // Open dialog for tool with inputs
    function openDialog(title, action, inputs) {
        dialogTitle = title;
        dialogAction = action;
        dialogInputs = inputs;
        dialogValues = {};
        // Set default values
        inputs.forEach(input => {
            dialogValues[input.name] = input.default || '';
        });
        showDialog = true;
    }
    
    // Close dialog
    function closeDialog() {
        showDialog = false;
        dialogTitle = '';
        dialogAction = null;
        dialogInputs = [];
        dialogValues = {};
    }
    
    // Execute dialog action
    async function executeDialogAction() {
        if (!dialogAction) return;
        
        const params = { ...dialogValues };
        const result = await mcpService.executeTool(dialogAction, params);
        
        if (result.success) {
            onActionResult(dialogAction, result.data);
            toastStore.success(`${dialogAction} executed`);
            closeDialog();
        } else {
            toastStore.error(`Failed: ${result.error}`);
        }
    }
    
    // Quick actions with dialogs
    function handleClick() {
        openDialog('Click Element', 'click', [
            { name: 'selector', label: 'CSS Selector', type: 'text', placeholder: 'e.g., button.submit', required: true }
        ]);
    }
    
    function handleType() {
        openDialog('Type Text', 'type', [
            { name: 'selector', label: 'CSS Selector', type: 'text', placeholder: 'e.g., input#search', required: true },
            { name: 'text', label: 'Text to Type', type: 'text', placeholder: 'Enter text...', required: true }
        ]);
    }
    
    function handleQuery() {
        openDialog('Query Elements', 'query', [
            { name: 'selector', label: 'CSS Selector', type: 'text', placeholder: 'e.g., .product-title', required: true },
            { name: 'attribute', label: 'Attribute (optional)', type: 'text', placeholder: 'e.g., href, textContent' }
        ]);
    }
    
    function handleScreenshot() {
        openDialog('Take Screenshot', 'screenshot', [
            { name: 'selector', label: 'CSS Selector (optional)', type: 'text', placeholder: 'Leave empty for full page' },
            { name: 'filename', label: 'Filename (optional)', type: 'text', placeholder: 'e.g., screenshot.png' }
        ]);
    }
    
    function handleWaitFor() {
        openDialog('Wait For Element', 'waitFor', [
            { name: 'selector', label: 'CSS Selector', type: 'text', placeholder: 'e.g., .loading-complete', required: true }
        ]);
    }
</script>

<div class="mcp-quick-actions flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <!-- Info Tools -->
    <button
        onclick={handleGetPageInfo}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        title="Get current page information"
    >
        <Eye size={14} />
        <span>Page Info</span>
    </button>

    <button
        onclick={handleListTabs}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        title="List all open tabs"
    >
        <List size={14} />
        <span>List Tabs</span>
    </button>

    <button
        onclick={handleListProfiles}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        title="List all profiles"
    >
        <Code size={14} />
        <span>Profiles</span>
    </button>
    
    <!-- DOM Interaction Tools -->
    <button
        onclick={handleClick}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-blue-700 dark:text-blue-400"
        title="Click an element"
    >
        <MousePointer size={14} />
        <span>Click</span>
    </button>
    
    <button
        onclick={handleType}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-blue-700 dark:text-blue-400"
        title="Type text into input"
    >
        <Keyboard size={14} />
        <span>Type</span>
    </button>
    
    <button
        onclick={handleQuery}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-600 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-green-700 dark:text-green-400"
        title="Query elements from page"
    >
        <Search size={14} />
        <span>Query</span>
    </button>
    
    <button
        onclick={handleScreenshot}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-purple-700 dark:text-purple-400"
        title="Take screenshot"
    >
        <Camera size={14} />
        <span>Screenshot</span>
    </button>
    
    <button
        onclick={handleWaitFor}
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-600 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors text-orange-700 dark:text-orange-400"
        title="Wait for element to appear"
    >
        <Clock size={14} />
        <span>Wait For</span>
    </button>
</div>

<!-- Input Dialog -->
{#if showDialog}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={closeDialog}>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-96 max-w-[90%]" onclick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">{dialogTitle}</h3>
            
            <div class="space-y-3">
                {#each dialogInputs as input}
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {input.label}
                            {#if input.required}
                                <span class="text-red-500">*</span>
                            {/if}
                        </label>
                        <input
                            type={input.type || 'text'}
                            bind:value={dialogValues[input.name]}
                            placeholder={input.placeholder || ''}
                            class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-800 dark:text-gray-200"
                        />
                    </div>
                {/each}
            </div>
            
            <div class="flex gap-2 mt-4">
                <button
                    onclick={executeDialogAction}
                    class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    Execute
                </button>
                <button
                    onclick={closeDialog}
                    class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg transition-colors text-sm font-medium"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .mcp-quick-actions {
        user-select: none;
    }
</style>
