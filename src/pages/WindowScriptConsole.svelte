<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Terminal, Trash2, Copy, Check, Search, ChevronRight, ChevronDown } from "lucide-svelte";
    import { onMount, onDestroy } from "svelte";

    const WINDOW_ID = 'script-console-window';

    

    let logs = $state([]);
    let copiedIndex = $state(null);
    let searchQuery = $state('');
    let expandedLogs = $state(new Set());

    // Expose addLog globally so it can be called from anywhere
    onMount(() => {
        // Make addLog available globally
        if (typeof window !== 'undefined') {
            window.__VBOX_ADD_CONSOLE_LOG__ = addLog;
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            delete window.__VBOX_ADD_CONSOLE_LOG__;
        }
    });

    function parseLogData(args) {
        return args.map(arg => {
            // Try to parse as JSON if it's a string representation of object/array
            if (typeof arg === 'string') {
                // Check if it looks like an object or array
                if ((arg.startsWith('{') && arg.endsWith('}')) || 
                    (arg.startsWith('[') && arg.endsWith(']'))) {
                    try {
                        return JSON.parse(arg);
                    } catch (e) {
                        return arg;
                    }
                }
                // Check for [object Object] pattern
                if (arg === '[object Object]' || arg.startsWith('[object ')) {
                    return { _type: 'UnserializedObject', _display: arg };
                }
            }
            return arg;
        });
    }

    function addLog(level, ...args) {
        const timestamp = new Date().toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            fractionalSecondDigits: 3
        });
        
        const parsedData = parseLogData(args);
        
        logs = [...logs, {
            id: Date.now() + Math.random(),
            timestamp,
            level,
            data: parsedData,
            rawMessage: args.join(' ')
        }];

        // Auto scroll to bottom
        setTimeout(() => {
            const container = document.getElementById('console-logs');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 10);
    }

    function clearLogs() {
        logs = [];
        expandedLogs.clear();
    }

    function toggleExpand(logId) {
        if (expandedLogs.has(logId)) {
            expandedLogs.delete(logId);
        } else {
            expandedLogs.add(logId);
        }
        expandedLogs = new Set(expandedLogs);
    }

    async function copyLog(log) {
        try {
            await navigator.clipboard.writeText(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.rawMessage}`);
            copiedIndex = log.id;
            setTimeout(() => {
                copiedIndex = null;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    async function copyAllLogs() {
        try {
            const allText = logs.map(log => 
                `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.rawMessage}`
            ).join('\n');
            await navigator.clipboard.writeText(allText);
            copiedIndex = 'all';
            setTimeout(() => {
                copiedIndex = null;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    function getLevelIcon(level) {
        switch (level) {
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📝';
        }
    }

    function getLevelColor(level) {
        switch (level) {
            case 'error': return 'text-red-300';
            case 'warn': return 'text-yellow-300';
            case 'info': return 'text-cyan-300';
            default: return 'text-white';
        }
    }

    function isExpandable(value) {
        return typeof value === 'object' && value !== null;
    }

    function formatValue(value, depth = 0) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (typeof value === 'object') {
            if (value._type === 'UnserializedObject') {
                return value._display;
            }
            const keys = Object.keys(value);
            return `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`;
        }
        return String(value);
    }

    function renderObject(obj, depth = 0) {
        if (depth > 10) return '...'; // Prevent infinite recursion
        
        const indent = '  '.repeat(depth);
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            const items = obj.map((item, i) => {
                const value = isExpandable(item) ? renderObject(item, depth + 1) : formatValue(item);
                return `${indent}  ${i}: ${value}`;
            }).join('\n');
            return `[\n${items}\n${indent}]`;
        }
        
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        
        const items = keys.map(key => {
            const value = isExpandable(obj[key]) ? renderObject(obj[key], depth + 1) : formatValue(obj[key]);
            return `${indent}  ${key}: ${value}`;
        }).join('\n');
        return `{\n${items}\n${indent}}`;
    }

    // Filter logs based on search query
    let filteredLogs = $derived(
        searchQuery.trim() === '' 
            ? logs 
            : logs.filter(log => 
                log.rawMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.level.toLowerCase().includes(searchQuery.toLowerCase())
            )
    );
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Terminal size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Script Console</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-hidden">
{#snippet headerSlot()}
        <div class="flex items-center gap-3 flex-1">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shrink-0">
                <Terminal size={16} class="text-white" />
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-sm truncate text-gray-900">Script Console</h3>
                <p class="text-xs text-gray-500 truncate">
                    {filteredLogs.length} {filteredLogs.length !== logs.length ? `of ${logs.length}` : ''} log(s)
                </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button
                    onclick={copyAllLogs}
                    class="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                    title="Copy all logs"
                    disabled={logs.length === 0}
                >
                    {#if copiedIndex === 'all'}
                        <Check size={14} class="text-green-600" />
                    {:else}
                        <Copy size={14} />
                    {/if}
                </button>
                <button
                    onclick={clearLogs}
                    class="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                    title="Clear logs"
                    disabled={logs.length === 0}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    {/snippet}

    {#snippet children()}
        <div class="h-full -m-6 flex flex-col bg-[#012456]">
            <!-- Search bar -->
            <div class="p-3 border-b border-[#013a6b]">
                <div class="relative">
                    <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search logs..."
                        class="w-full pl-10 pr-4 py-2 bg-[#001a3d] border border-[#013a6b] rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                </div>
            </div>

            <!-- Logs container -->
            <div 
                id="console-logs"
                class="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1"
            >
                {#if filteredLogs.length === 0}
                    <div class="flex items-center justify-center h-full text-gray-400">
                        <div class="text-center">
                            <Terminal size={48} class="mx-auto mb-3 opacity-30" />
                            {#if logs.length === 0}
                                <p class="text-sm">No logs yet</p>
                                <p class="text-xs mt-1">Console logs from inject scripts will appear here</p>
                            {:else}
                                <p class="text-sm">No matching logs</p>
                                <p class="text-xs mt-1">Try a different search query</p>
                            {/if}
                        </div>
                    </div>
                {:else}
                    {#each filteredLogs as log (log.id)}
                        <div class="hover:bg-[#013a6b] p-2 rounded group">
                            <div class="flex items-start gap-2">
                                <span class="text-gray-400 text-xs shrink-0 font-normal">{log.timestamp}</span>
                                <span class="shrink-0">{getLevelIcon(log.level)}</span>
                                <div class="flex-1 {getLevelColor(log.level)}">
                                    {#each log.data as item, i}
                                        {#if isExpandable(item)}
                                            <button
                                                onclick={() => toggleExpand(log.id + '-' + i)}
                                                class="inline-flex items-center gap-1 hover:bg-[#013a6b] px-1 rounded"
                                            >
                                                {#if expandedLogs.has(log.id + '-' + i)}
                                                    <ChevronDown size={14} />
                                                {:else}
                                                    <ChevronRight size={14} />
                                                {/if}
                                                <span class="text-cyan-300">{formatValue(item)}</span>
                                            </button>
                                            {#if expandedLogs.has(log.id + '-' + i)}
                                                <pre class="ml-6 mt-1 text-gray-300 text-xs">{renderObject(item)}</pre>
                                            {/if}
                                        {:else}
                                            <span>{formatValue(item)}</span>
                                        {/if}
                                        {#if i < log.data.length - 1}
                                            <span class="text-gray-400"> </span>
                                        {/if}
                                    {/each}
                                </div>
                                <button
                                    onclick={() => copyLog(log)}
                                    class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#001a3d] rounded transition-all text-gray-400 hover:text-white shrink-0"
                                    title="Copy log"
                                >
                                    {#if copiedIndex === log.id}
                                        <Check size={12} class="text-green-400" />
                                    {:else}
                                        <Copy size={12} />
                                    {/if}
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/snippet}
    </div>
</div>
