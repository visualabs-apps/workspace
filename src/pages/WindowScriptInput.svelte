<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { FileInput } from "lucide-svelte";
    import { scriptInputStore } from "../lib/stores/scriptInputStore.svelte.js";
    import { onMount } from "svelte";
    
    const WINDOW_ID = 'script-input-window';
    
    // Initialize form data based on fields
    let formData = $state({});
    let lastFieldsLength = $state(0);
    
    onMount(() => {
        const cleanup = window.api?.onWindowData?.((data) => {
            if (data.title) {
                scriptInputStore.title = data.title;
            }
            if (data.fields && Array.isArray(data.fields)) {
                scriptInputStore.fields = data.fields;
                scriptInputStore.isOpen = true;
            }
        });
        
        return cleanup;
    });
    
    $effect(() => {
        const currentFieldsLength = scriptInputStore.fields.length;
        
        if (scriptInputStore.isOpen && currentFieldsLength > 0 && currentFieldsLength !== lastFieldsLength) {
            const initialData = {};
            scriptInputStore.fields.forEach(field => {
                if (field.type === 'daterange') {
                    initialData[field.name] = {
                        start: field.defaultValue?.start || '',
                        end: field.defaultValue?.end || ''
                    };
                } else {
                    initialData[field.name] = field.defaultValue || '';
                }
            });
            formData = initialData;
            lastFieldsLength = currentFieldsLength;
        }
    });
    
    function handleClose() {
        window.api?.sendToParent?.('script-input-response', { 
            success: false, 
            message: 'Cancelled', 
            data: null 
        });
        
        scriptInputStore.close();
        window.api?.childWindow?.close(WINDOW_ID);
    }
    
    function handleSubmit() {
        for (const field of scriptInputStore.fields) {
            if (field.required) {
                if (field.type === 'daterange') {
                    if (!formData[field.name]?.start || !formData[field.name]?.end) {
                        alert(`${field.label} is required`);
                        return;
                    }
                } else {
                    if (!formData[field.name]) {
                        alert(`${field.label} is required`);
                        return;
                    }
                }
            }
        }
        
        const serializableData = JSON.parse(JSON.stringify(formData));
        
        window.api?.sendToParent?.('script-input-response', { 
            success: true, 
            data: serializableData
        });
        
        scriptInputStore.submit(formData);
        window.api?.childWindow?.close(WINDOW_ID);
    }
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <FileInput size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Script Input</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
        <div class="space-y-4">
            {#each scriptInputStore.fields as field}
                <div class="space-y-2">
                    <label class="block text-sm font-semibold text-gray-900">
                        {field.label}
                        {#if field.required}
                            <span class="text-red-500">*</span>
                        {/if}
                    </label>
                    
                    {#if field.type === 'text'}
                        <input
                            type="text"
                            bind:value={formData[field.name]}
                            placeholder={field.placeholder || ''}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    
                    {:else if field.type === 'number'}
                        <input
                            type="number"
                            bind:value={formData[field.name]}
                            placeholder={field.placeholder || ''}
                            min={field.min}
                            max={field.max}
                            step={field.step || 1}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    
                    {:else if field.type === 'date'}
                        <input
                            type="date"
                            bind:value={formData[field.name]}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    
                    {:else if field.type === 'daterange'}
                        {#if formData[field.name]}
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs text-gray-500 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        bind:value={formData[field.name].start}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500 mb-1">End Date</label>
                                    <input
                                        type="date"
                                        bind:value={formData[field.name].end}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                    />
                                </div>
                            </div>
                        {/if}
                    
                    {:else if field.type === 'select'}
                        <select
                            bind:value={formData[field.name]}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                            <option value="">Select...</option>
                            {#each field.options || [] as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    
                    {:else if field.type === 'textarea'}
                        <textarea
                            bind:value={formData[field.name]}
                            placeholder={field.placeholder || ''}
                            rows={field.rows || 3}
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        ></textarea>
                    {/if}
                    
                    {#if field.description}
                        <p class="text-xs text-gray-500">{field.description}</p>
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div class="flex justify-end gap-2">
            <button
                onclick={() => window.api?.window?.close()}
                class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
                Cancel
            </button>
            <button
                onclick={handleSubmit}
                class="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
            >
                Submit
            </button>
        </div>
    </div>
</div>
