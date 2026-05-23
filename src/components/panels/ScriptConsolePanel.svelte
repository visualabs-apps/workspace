<script>
    /**
     * ScriptConsolePanel — Reusable console panel component
     * Used by both WindowScriptConsole.svelte (standalone) and WindowInjectScript.svelte (tab)
     * 
     * Props:
     *   - showHeader: boolean (default: true) — show toolbar with search/copy/clear
     *   - compact: boolean (default: false) — compact mode for embedded use
     */
    import { Terminal, Trash2, Copy, Check, Search, ChevronRight, ChevronDown } from "lucide-svelte";
    import { onMount, onDestroy } from "svelte";

    let { showHeader = true, compact = false } = $props();

    let logs = $state([]);
    let copiedIndex = $state(null);
    let searchQuery = $state('');
    let expandedLogs = $state(new Set());

    // Expose addLog globally so it can be called from anywhere
    onMount(() => {
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
            if (typeof arg === 'string') {
                if ((arg.startsWith('{') && arg.endsWith('}')) || 
                    (arg.startsWith('[') && arg.endsWith(']'))) {
                    try { return JSON.parse(arg); } catch { return arg; }
                }
                if (arg === '[object Object]' || arg.startsWith('[object ')) {
                    return { _type: 'UnserializedObject', _display: arg };
                }
            }
            return arg;
        });
    }

    function addLog(level, ...args) {
        const timestamp = new Date().toLocaleTimeString('id-ID', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
        });
        const parsedData = parseLogData(args);
        logs = [...logs, { id: Date.now() + Math.random(), timestamp, level, data: parsedData, rawMessage: args.join(' ') }];
        setTimeout(() => {
            const container = document.getElementById('console-logs');
            if (container) container.scrollTop = container.scrollHeight;
        }, 10);
    }

    function clearLogs() { logs = []; expandedLogs = new Set(); }

    function toggleExpand(logId) {
        const next = new Set(expandedLogs);
        if (next.has(logId)) next.delete(logId); else next.add(logId);
        expandedLogs = next;
    }

    async function copyLog(log) {
        try {
            await navigator.clipboard.writeText(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.rawMessage}`);
            copiedIndex = log.id;
            setTimeout(() => { copiedIndex = null; }, 2000);
        } catch (error) { console.error('Failed to copy:', error); }
    }

    async function copyAllLogs() {
        try {
            const allText = logs.map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.rawMessage}`).join('\n');
            await navigator.clipboard.writeText(allText);
            copiedIndex = 'all';
            setTimeout(() => { copiedIndex = null; }, 2000);
        } catch (error) { console.error('Failed to copy:', error); }
    }

    function getLevelIcon(level) {
        switch (level) { case 'error': return '❌'; case 'warn': return '⚠️'; case 'info': return 'ℹ️'; default: return '📝'; }
    }

    function getLevelColor(level) {
        switch (level) { case 'error': return 'text-red-300'; case 'warn': return 'text-yellow-300'; case 'info': return 'text-cyan-300'; default: return 'text-white'; }
    }

    function isExpandable(value) { return typeof value === 'object' && value !== null; }

    function formatValue(value, depth = 0) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return `"${value}"`;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return `Array(${value.length})`;
        if (typeof value === 'object') {
            if (value._type === 'UnserializedObject') return value._display;
            const keys = Object.keys(value);
            return `{${keys.length} ${keys.length === 1 ? 'key' : 'keys'}}`;
        }
        return String(value);
    }

    function renderObject(obj, depth = 0) {
        if (depth > 10) return '...';
        const indent = '  '.repeat(depth);
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            return `[\n${obj.map((item, i) => `${indent}  ${i}: ${isExpandable(item) ? renderObject(item, depth + 1) : formatValue(item)}`).join('\n')}\n${indent}]`;
        }
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        return `{\n${keys.map(key => `${indent}  ${key}: ${isExpandable(obj[key]) ? renderObject(obj[key], depth + 1) : formatValue(obj[key])}`).join('\n')}\n${indent}}`;
    }

    let filteredLogs = $derived(
        searchQuery.trim() === '' 
            ? logs 
            : logs.filter(log => log.rawMessage.toLowerCase().includes(searchQuery.toLowerCase()) || log.level.toLowerCase().includes(searchQuery.toLowerCase()))
    );
</script>

<div class="h-full flex flex-col bg-[#012456] dark:bg-gray-900">
    <!-- Toolbar -->
    {#if showHeader}
        <div class="p-3 border-b border-[#013a6b] dark:border-gray-700 flex items-center gap-3">
            <div class="relative flex-1">
                <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search logs..."
                    class="w-full pl-10 pr-4 py-2 bg-[#001a3d] dark:bg-gray-800 border border-[#013a6b] dark:border-gray-700 rounded-lg text-white dark:text-gray-100 text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
            </div>
            <button
                onclick={copyAllLogs}
                class="p-2 hover:bg-[#013a6b] dark:hover:bg-gray-700 rounded transition-colors text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200"
                title="Copy all logs"
                disabled={logs.length === 0}
            >
                {#if copiedIndex === 'all'}
                    <Check size={16} class="text-green-400" />
                {:else}
                    <Copy size={16} />
                {/if}
            </button>
            <button
                onclick={clearLogs}
                class="p-2 hover:bg-[#013a6b] dark:hover:bg-gray-700 rounded transition-colors text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200"
                title="Clear logs"
                disabled={logs.length === 0}
            >
                <Trash2 size={16} />
            </button>
        </div>
    {/if}

    <!-- Logs container -->
    <div
        id="console-logs"
        class="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1"
    >
        {#if filteredLogs.length === 0}
            <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
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
                <div class="hover:bg-[#013a6b] dark:hover:bg-gray-800 p-2 rounded group">
                    <div class="flex items-start gap-2">
                        <span class="text-gray-400 dark:text-gray-500 text-xs shrink-0 font-normal">{log.timestamp}</span>
                        <span class="shrink-0">{getLevelIcon(log.level)}</span>
                        <div class="flex-1 {getLevelColor(log.level)}">
                            {#each log.data as item, i}
                                {#if isExpandable(item)}
                                    <button
                                        onclick={() => toggleExpand(log.id + '-' + i)}
                                        class="inline-flex items-center gap-1 hover:bg-[#013a6b] dark:hover:bg-gray-700 px-1 rounded"
                                    >
                                        {#if expandedLogs.has(log.id + '-' + i)}
                                            <ChevronDown size={14} />
                                        {:else}
                                            <ChevronRight size={14} />
                                        {/if}
                                        <span class="text-cyan-300">{formatValue(item)}</span>
                                    </button>
                                    {#if expandedLogs.has(log.id + '-' + i)}
                                        <pre class="ml-6 mt-1 text-gray-300 dark:text-gray-400 text-xs">{renderObject(item)}</pre>
                                    {/if}
                                {:else}
                                    <span>{formatValue(item)}</span>
                                {/if}
                                {#if i < log.data.length - 1}
                                    <span class="text-gray-400 dark:text-gray-500"> </span>
                                {/if}
                            {/each}
                        </div>
                        <button
                            onclick={() => copyLog(log)}
                            class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#001a3d] dark:hover:bg-gray-700 rounded transition-all text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-gray-200 shrink-0"
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
