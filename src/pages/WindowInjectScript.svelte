<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Code, Play, Save, Trash2, FileCode, FolderOpen, Download, BookOpen, Copy, Check, Terminal, Wand2, X, ClipboardCopy } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { workspaceStore } from "../lib/stores/workspaces.svelte.js";
    import CodeEditor from "../components/ui/CodeEditor.svelte";
    import { onMount } from "svelte";

    const WINDOW_ID = 'inject-script-window';

    // Tab state
    let activeTab = $state("editor"); // editor, console, docs

    let scriptName = $state("");
    let scriptDescription = $state("");
    let scriptCode = $state("");
    let urlPattern = $state("*");
    let autoRun = $state(false);
    let savedScripts = $state([]);
    let selectedScriptId = $state(null);
    let isExecuting = $state(false);
    let scriptsDirectory = $state("");
    let copiedSection = $state(null);
    let codeEditor = $state(null);
    
    // Console state
    let consoleLogs = $state([]);
    let copiedLogId = $state(null);
    
    // Copy single log line
    async function copyLogLine(log) {
        try {
            await navigator.clipboard.writeText(`[${log.timestamp}] ${log.level}: ${log.message}`);
            copiedLogId = log.id;
            setTimeout(() => {
                copiedLogId = null;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy log:', error);
        }
    }
    
    // Copy all logs
    async function copyAllLogs() {
        try {
            const allLogsText = consoleLogs
                .map(log => `[${log.timestamp}] ${log.level}: ${log.message}`)
                .join('\n');
            await navigator.clipboard.writeText(allLogsText);
            toastStore.success('All logs copied to clipboard');
        } catch (error) {
            console.error('Failed to copy all logs:', error);
            toastStore.error('Failed to copy logs');
        }
    }
    
    // Documentation state
    let copiedApi = $state(null);

    // Get active workspace
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    onMount(() => {
        loadSavedScripts();
        loadScriptsDirectory();
        
        const cleanupConsoleListener = setupConsoleListener();
        setupWebviewListeners();
        
        return () => {
            if (cleanupConsoleListener) {
                cleanupConsoleListener();
            }
        };
    });

    function setupConsoleListener() {
        window.__VBOX_ADD_CONSOLE_LOG__ = (level, message) => {
            consoleLogs = [...consoleLogs, {
                id: Date.now() + Math.random(),
                level,
                message,
                timestamp: new Date().toLocaleTimeString()
            }];
        };
        
        if (window.api?.onScriptConsole) {
            const removeListener = window.api.onScriptConsole((data) => {
                const { level, message } = data;
                consoleLogs = [...consoleLogs, {
                    id: Date.now() + Math.random(),
                    level: level || 'log',
                    message: message,
                    timestamp: new Date().toLocaleTimeString()
                }];
            });
            
            return removeListener;
        }
        
        return () => {};
    }
    
    function setupWebviewListeners() {
        // Listen for console messages from webviews
        const webviews = document.querySelectorAll('webview');
        webviews.forEach(webview => {
            webview.addEventListener('console-message', (e) => {
                const message = e.message;
                
                // Check if it's a VBox toast message
                if (message.includes('[VBox Toast]')) {
                    const match = message.match(/\[VBox Toast\]\s+(\w+)\s+:\s+(.+)/);
                    if (match) {
                        const type = match[1].toLowerCase();
                        const toastMessage = match[2];
                        
                        // Show toast
                        if (toastStore[type]) {
                            toastStore[type](toastMessage);
                        } else {
                            toastStore.info(toastMessage);
                        }
                    }
                }
                
                // Add to console
                const level = e.level === 0 ? 'log' : e.level === 1 ? 'warn' : 'error';
                window.__VBOX_ADD_CONSOLE_LOG__(level, e.message);
            });
        });
        
        // Listen for PowerPoint generation requests
        window.addEventListener('message', async (event) => {
            if (event.data.type === 'VBOX_GENERATE_PPT') {
                try {
                    toastStore.info('Generating PowerPoint...');
                    const result = await window.api.generatePowerPoint(event.data.data);
                    
                    if (result.success) {
                        toastStore.success(`PowerPoint saved: ${result.filename}`);
                        window.__VBOX_ADD_CONSOLE_LOG__('info', `PowerPoint generated: ${result.path}`);
                    } else {
                        toastStore.error(`Failed to generate PowerPoint: ${result.error}`);
                        if (window.__VBOX_ADD_CONSOLE_LOG__) {
                            window.__VBOX_ADD_CONSOLE_LOG__('error', `PowerPoint error: ${result.error}`);
                        }
                    }
                } catch (error) {
                    toastStore.error('Failed to generate PowerPoint');
                    console.error('PowerPoint generation error:', error);
                }
            }
        });
    }

    // Load scripts directory path
    async function loadScriptsDirectory() {
        try {
            const result = await window.api.scripts.getDirectory();
            if (result.success) {
                scriptsDirectory = result.path;
            }
        } catch (error) {
            console.error("Failed to load scripts directory:", error);
        }
    }

    // Load saved scripts from file system
    async function loadSavedScripts() {
        try {
            const result = await window.api.scripts.list();
            if (result.success) {
                savedScripts = result.scripts;
            }
        } catch (error) {
            console.error("Failed to load scripts:", error);
        }
    }

    // Save script to file system
    async function saveScript() {
        if (!scriptName.trim() || !scriptCode.trim()) {
            toastStore.error("Nama dan kode script harus diisi");
            return;
        }

        const scriptData = {
            id: selectedScriptId,
            name: scriptName.trim(),
            description: scriptDescription.trim(),
            code: scriptCode.trim(),
            urlPattern: urlPattern.trim() || "*",
            autoRun: autoRun,
        };

        try {
            const result = await window.api.scripts.save(scriptData);
            
            if (result.success) {
                toastStore.success("Script berhasil disimpan");
                await loadSavedScripts();
                
                // Reset form if new script
                if (!selectedScriptId) {
                    scriptName = "";
                    scriptDescription = "";
                    scriptCode = "";
                    urlPattern = "*";
                    autoRun = false;
                } else {
                    selectedScriptId = result.script.id;
                }
            } else {
                toastStore.error(`Gagal menyimpan script: ${result.error}`);
            }
        } catch (error) {
            console.error("Failed to save script:", error);
            toastStore.error("Gagal menyimpan script");
        }
    }

    // Delete script
    async function deleteScript(scriptId) {
        if (!confirm("Hapus script ini?")) return;

        try {
            const result = await window.api.scripts.delete(scriptId);
            
            if (result.success) {
                toastStore.success("Script dihapus");
                await loadSavedScripts();
                
                if (selectedScriptId === scriptId) {
                    clearForm();
                }
            } else {
                toastStore.error(`Gagal menghapus script: ${result.error}`);
            }
        } catch (error) {
            console.error("Failed to delete script:", error);
            toastStore.error("Gagal menghapus script");
        }
    }

    // Load script to editor
    function loadScript(script) {
        selectedScriptId = script.id;
        scriptName = script.name;
        scriptDescription = script.description || "";
        scriptCode = script.code;
        urlPattern = script.urlPattern || "*";
        autoRun = script.autoRun || false;
    }

    // Clear form
    function clearForm() {
        selectedScriptId = null;
        scriptName = "";
        scriptDescription = "";
        scriptCode = "";
        urlPattern = "*";
        autoRun = false;
    }

    // Execute script in active webview
    async function executeScript() {
        if (!selectedScriptId) {
            toastStore.error("Simpan script terlebih dahulu");
            return;
        }

        isExecuting = true;
        
        // Add log that script is starting
        consoleLogs = [...consoleLogs, {
            id: Date.now() + Math.random(),
            level: 'info',
            message: 'Executing script...',
            timestamp: new Date().toLocaleTimeString()
        }];
        
        // Switch to console tab
        activeTab = 'console';

        try {
            const result = await window.api.scripts.execute(selectedScriptId);
            
            if (result.success) {
                toastStore.success("Script berhasil dijalankan");
                
                // Add success log
                consoleLogs = [...consoleLogs, {
                    id: Date.now() + Math.random(),
                    level: 'log',
                    message: 'Script executed successfully',
                    timestamp: new Date().toLocaleTimeString()
                }];
                
                if (result.result !== undefined) {
                    // Add result to console
                    consoleLogs = [...consoleLogs, {
                        id: Date.now() + Math.random(),
                        level: 'log',
                        message: `Result: ${JSON.stringify(result.result, null, 2)}`,
                        timestamp: new Date().toLocaleTimeString()
                    }];
                    console.log("Script result:", result.result);
                }
                
                // Add console logs from script if available
                if (result.consoleLogs && Array.isArray(result.consoleLogs)) {
                    result.consoleLogs.forEach(log => {
                        consoleLogs = [...consoleLogs, {
                            id: Date.now() + Math.random(),
                            level: log.level || 'log',
                            message: log.message,
                            timestamp: new Date().toLocaleTimeString()
                        }];
                    });
                }
            } else {
                toastStore.error(`Gagal menjalankan script: ${result.error}`);
                
                // Add error log
                consoleLogs = [...consoleLogs, {
                    id: Date.now() + Math.random(),
                    level: 'error',
                    message: `Error: ${result.error}`,
                    timestamp: new Date().toLocaleTimeString()
                }];
            }
        } catch (error) {
            console.error("Failed to execute script:", error);
            toastStore.error("Gagal menjalankan script");
            
            // Add error log
            consoleLogs = [...consoleLogs, {
                id: Date.now() + Math.random(),
                level: 'error',
                message: `Exception: ${error.message}`,
                timestamp: new Date().toLocaleTimeString()
            }];
        } finally {
            isExecuting = false;
        }
    }

    // Open scripts folder
    function openScriptsFolder() {
        if (scriptsDirectory && window.api?.db?.openFileLocation) {
            window.api.db.openFileLocation(scriptsDirectory);
        }
    }

    // Download example script
    function downloadExample() {
        const exampleScript = `// VBox API is auto-injected, you can use 'vbox' directly
// Example: Generate PowerPoint Report with Template

// Get current page info
const pageInfo = vbox.getPageInfo();
console.log('Scraping page:', pageInfo.url);

// Scrape data
const links = vbox.scrapeLinks({ selector: 'a[href]' });
const images = vbox.scrapeImages({ minWidth: 100 });

console.log('Found', links.length, 'links');
console.log('Found', images.length, 'images');

// Define Professional Template (Blue theme)
const template = {
    background: { color: 'FFFFFF' },
    titleStyle: { fontSize: 44, bold: true, color: '1F4788' },
    subtitleStyle: { fontSize: 24, color: '5B9BD5' },
    headerStyle: { fontSize: 32, bold: true, color: '1F4788' }
};

// Create PowerPoint presentation with template
const ppt = vbox.ppt.create(template);

// Add title slide
ppt.addTitleSlide(
    'VBox Scraping Report',
    'Generated on ' + new Date().toLocaleDateString()
);

// Add summary slide
ppt.addSlide('Summary')
    .addText('Page URL: ' + pageInfo.url, { fontSize: 16 })
    .addText('Total Links: ' + links.length, { fontSize: 16 })
    .addText('Total Images: ' + images.length, { fontSize: 16 });

// Add links table
if (links.length > 0) {
    const tableData = [
        [{ text: 'No', options: { bold: true } }, { text: 'Link Text', options: { bold: true } }, { text: 'URL', options: { bold: true } }]
    ];
    
    links.slice(0, 10).forEach((link, i) => {
        tableData.push([
            (i + 1).toString(),
            link.text.substring(0, 50),
            link.url.substring(0, 50)
        ]);
    });
    
    ppt.addSlide('Top 10 Links')
        .addTable(tableData, { fontSize: 12 });
}

// Download PowerPoint
ppt.download('vbox-report-' + Date.now() + '.pptx');

vbox.toast('PowerPoint generated!', 'success');

return { success: true, links: links.length, images: images.length };`;

        scriptName = "Example - PowerPoint Report";
        scriptDescription = "Generate PowerPoint report from scraped data";
        scriptCode = exampleScript;
        urlPattern = "*";
        toastStore.info("Contoh script PowerPoint dimuat.");
    }

    // Format code
    function formatCode() {
        if (codeEditor) {
            codeEditor.format();
            toastStore.success("Code formatted");
        }
    }

    // Copy code to clipboard
    async function copyToClipboard(text, section) {
        try {
            await navigator.clipboard.writeText(text);
            copiedSection = section;
            setTimeout(() => {
                copiedSection = null;
            }, 2000);
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Code size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Script Injector</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Header with Tabs -->
        <div class="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <Code size={16} class="text-white" />
                    </div>
                    <div>
                        <h3 class="font-semibold text-sm text-gray-900">Inject Script</h3>
                        <p class="text-xs text-gray-500">Script berbasis file dengan VBox API</p>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button
                        onclick={openScriptsFolder}
                        class="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                        title="Buka folder scripts"
                    >
                        <FolderOpen size={14} />
                    </button>
                    <button
                        onclick={downloadExample}
                        class="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-600"
                        title="Muat contoh script"
                    >
                        <Download size={14} />
                    </button>
                </div>
            </div>
            
            <!-- Tabs -->
            <div class="flex items-center gap-1 border-t border-gray-200 -mx-6 px-6 pt-2">
                <button
                    onclick={() => activeTab = 'editor'}
                    class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors {activeTab === 'editor' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                >
                    <div class="flex items-center gap-2">
                        <Code size={14} />
                        Editor
                    </div>
                </button>
                <button
                    onclick={() => activeTab = 'console'}
                    class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors {activeTab === 'console' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                >
                    <div class="flex items-center gap-2">
                        <Terminal size={14} />
                        Console
                        {#if consoleLogs.length > 0}
                            <span class="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">{consoleLogs.length}</span>
                        {/if}
                    </div>
                </button>
                <button
                    onclick={() => activeTab = 'docs'}
                    class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors {activeTab === 'docs' ? 'bg-white text-blue-600 border-t-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                >
                    <div class="flex items-center gap-2">
                        <BookOpen size={14} />
                        API Docs
                    </div>
                </button>
            </div>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-hidden bg-white">
            {#if activeTab === 'editor'}
                <div class="flex gap-4 h-full p-6">
                <!-- Saved Scripts Sidebar -->
                <div class="w-64 border-r border-gray-200 flex flex-col bg-gray-50 -ml-6 -my-6 mr-0">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-sm font-semibold text-gray-700">
                            Script Tersimpan
                        </h3>
                    </div>
                    <div class="flex-1 overflow-y-auto p-2">
                    {#if savedScripts.length === 0}
                        <div class="text-center py-8 text-gray-400 text-sm">
                            <FileCode size={32} class="mx-auto mb-2 opacity-50" />
                            Belum ada script
                        </div>
                    {:else}
                        {#each savedScripts as script (script.id)}
                            <div
                                class="mb-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-purple-300 transition-colors cursor-pointer {selectedScriptId === script.id ? 'border-purple-500 bg-purple-50' : ''}"
                                onclick={() => loadScript(script)}
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex-1 min-w-0">
                                        <div class="font-medium text-sm text-gray-900 truncate">
                                            {script.name}
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">
                                            {new Date(script.createdAt).toLocaleDateString('id-ID')}
                                        </div>
                                    </div>
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            deleteScript(script.id);
                                        }}
                                        class="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Hapus"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>

            <!-- Editor -->
            <div class="flex-1 flex flex-col">
                <div class="p-4 border-b border-gray-200 space-y-3">
                    <input
                        type="text"
                        bind:value={scriptName}
                        placeholder="Nama script..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                    <input
                        type="text"
                        bind:value={scriptDescription}
                        placeholder="Deskripsi (opsional)..."
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                    <div class="flex items-center gap-3">
                        <input
                            type="text"
                            bind:value={urlPattern}
                            placeholder="URL Pattern (*, *.google.com, dll)"
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                        />
                        <label class="flex items-center gap-2 text-sm text-gray-900 font-medium">
                            <input
                                type="checkbox"
                                bind:checked={autoRun}
                                class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            Auto Run
                        </label>
                    </div>
                </div>
                <div class="flex-1 p-4 overflow-hidden flex flex-col gap-2 min-h-0">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-500">Code Editor (vbox is auto-injected)</span>
                        <button
                            onclick={formatCode}
                            class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1 transition-colors"
                            title="Format code"
                        >
                            <Wand2 size={12} />
                            Format
                        </button>
                    </div>
                    <div class="flex-1 overflow-hidden min-h-0">
                        <CodeEditor 
                            bind:this={codeEditor}
                            bind:value={scriptCode}
                            placeholder="// Write your script here...
// vbox is already available, no need to check!
console.log('Hello from VBox!');
vbox.toast('Script running', 'info');"
                            height="100%"
                        />
                    </div>
                </div>
            </div>
        </div>
            {:else if activeTab === 'console'}
                <!-- Console Tab -->
                <div class="flex flex-col h-full p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-semibold text-gray-900">Script Console</h3>
                        <div class="flex items-center gap-2">
                            <button
                                onclick={copyAllLogs}
                                disabled={consoleLogs.length === 0}
                                class="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Copy all logs"
                            >
                                <ClipboardCopy size={14} />
                                Copy All
                            </button>
                            <button
                                onclick={() => consoleLogs = []}
                                class="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                            >
                                <Trash2 size={14} />
                                Clear
                            </button>
                        </div>
                    </div>
                    <div class="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 font-mono text-sm">
                        {#if consoleLogs.length === 0}
                            <div class="text-gray-500 text-center py-8">No console output yet</div>
                        {:else}
                            {#each consoleLogs as log}
                                <div class="mb-2 flex items-start gap-2 group hover:bg-gray-800 px-2 py-1 rounded transition-colors">
                                    <div class="flex-1 {log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}">
                                        <span class="text-gray-500">[{log.timestamp}]</span>
                                        <span class="text-gray-400 ml-2">{log.level}:</span>
                                        <span class="ml-2">{log.message}</span>
                                    </div>
                                    <button
                                        onclick={() => copyLogLine(log)}
                                        class="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all text-gray-400 hover:text-white"
                                        title="Copy this line"
                                    >
                                        {#if copiedLogId === log.id}
                                            <Check size={14} class="text-green-400" />
                                        {:else}
                                            <Copy size={14} />
                                        {/if}
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            {:else if activeTab === 'docs'}
                <!-- API Documentation Tab -->
                <div class="flex flex-col h-full p-6 overflow-y-auto">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">VBox API Documentation</h3>
                    <div class="space-y-6">
                        <!-- Navigation API -->
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-900 mb-2">Navigation</h4>
                            <div class="space-y-3 text-sm">
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.navigate(url)</code>
                                    <p class="text-gray-600 mt-1">Navigate to a URL</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.back()</code>
                                    <p class="text-gray-600 mt-1">Go back in history</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.forward()</code>
                                    <p class="text-gray-600 mt-1">Go forward in history</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.reload()</code>
                                    <p class="text-gray-600 mt-1">Reload current page</p>
                                </div>
                            </div>
                        </div>

                        <!-- DOM Interaction -->
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-900 mb-2">DOM Interaction</h4>
                            <div class="space-y-3 text-sm">
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.click(selector)</code>
                                    <p class="text-gray-600 mt-1">Click an element</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.type(selector, text)</code>
                                    <p class="text-gray-600 mt-1">Type text into an input</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.getText(selector)</code>
                                    <p class="text-gray-600 mt-1">Get text content of an element</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.waitFor(selector, timeout)</code>
                                    <p class="text-gray-600 mt-1">Wait for an element to appear</p>
                                </div>
                            </div>
                        </div>

                        <!-- Utility -->
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-900 mb-2">Utility</h4>
                            <div class="space-y-3 text-sm">
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.sleep(ms)</code>
                                    <p class="text-gray-600 mt-1">Wait for specified milliseconds</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.toast(message, type)</code>
                                    <p class="text-gray-600 mt-1">Show toast notification (success, error, info, warning)</p>
                                </div>
                                <div>
                                    <code class="bg-gray-100 px-2 py-1 rounded">vbox.screenshot()</code>
                                    <p class="text-gray-600 mt-1">Take a screenshot</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">
                    Script disimpan sebagai file • Gunakan VBox API
                </div>
                <div class="flex items-center gap-2">
                    <button
                        onclick={clearForm}
                        class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
                    >
                        Baru
                    </button>
                    <button
                        onclick={saveScript}
                        class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <Save size={16} />
                        Simpan
                    </button>
                    <button
                        onclick={executeScript}
                        disabled={isExecuting || !selectedScriptId}
                        class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {#if isExecuting}
                            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            <Play size={16} />
                        {/if}
                        Jalankan
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
