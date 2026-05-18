<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Code, Play, Save, Trash2, FileCode, FolderOpen, Download, BookOpen, Copy, Check, Terminal, Wand2, X, Zap, FileUp } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { workspaceStore } from "../lib/stores/workspaces.svelte.js";
    import CodeEditor from "../components/ui/CodeEditor.svelte";
    import ScriptConsolePanel from "../components/panels/ScriptConsolePanel.svelte";
    import VBoxApiDocsPanel from "../components/panels/VBoxApiDocsPanel.svelte";
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
    let developerMode = $state(false);

    // Get active workspace
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    onMount(() => {
        loadSavedScripts();
        loadScriptsDirectory();
        loadDeveloperMode();
        
        const cleanupConsoleListener = setupConsoleListener();
        setupWebviewListeners();
        
        return () => {
            if (cleanupConsoleListener) {
                cleanupConsoleListener();
            }
        };
    });

    function setupConsoleListener() {
        // Console listener is now handled by ScriptConsolePanel component
        // via window.__VBOX_ADD_CONSOLE_LOG__ global
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

    // Load developer mode setting
    async function loadDeveloperMode() {
        try {
            const result = await window.api.settings.getDeveloperMode();
            if (result.success) {
                developerMode = result.enabled;
            }
        } catch (error) {
            console.error("Failed to load developer mode:", error);
        }
    }

    // Listen for settings changes
    $effect(() => {
        const handleSettingsUpdate = () => {
            loadDeveloperMode();
        };
        window.addEventListener('settings-updated', handleSettingsUpdate);
        return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
    });

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
    async function executeScript(scriptId) {
        const id = scriptId || selectedScriptId;
        if (!id) {
            toastStore.error("Pilih script terlebih dahulu");
            return;
        }

        isExecuting = true;
        
        // Add log that script is starting
        if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__('info', 'Executing script...');
        
        // Switch to console tab
        activeTab = 'console';

        try {
            const result = await window.api.scripts.execute(id);
            
            if (result.success) {
                toastStore.success("Script berhasil dijalankan");
                
                // Add success log
                if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__('log', 'Script executed successfully');
                
                if (result.result !== undefined) {
                    // Add result to console
                    if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__('log', 'Result: ' + JSON.stringify(result.result, null, 2));
                    console.log("Script result:", result.result);
                }
                
                // Add console logs from script if available
                if (result.consoleLogs && Array.isArray(result.consoleLogs)) {
                    result.consoleLogs.forEach(log => {
                        if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__(log.level || 'log', log.message);
                    });
                }
            } else {
                toastStore.error(`Gagal menjalankan script: ${result.error}`);
                
                // Add error log
                if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__('error', 'Error: ' + result.error);
            }
        } catch (error) {
            console.error("Failed to execute script:", error);
            toastStore.error("Gagal menjalankan script");
            
            // Add error log
            if (window.__VBOX_ADD_CONSOLE_LOG__) window.__VBOX_ADD_CONSOLE_LOG__('error', 'Exception: ' + error.message);
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
                {#if developerMode}
                <!-- DEVELOPER MODE: Full editor UI -->
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
                {:else}
                <!-- SIMPLIFIED MODE: Script list with run buttons -->
                <div class="h-full overflow-y-auto p-6">
                    <div class="max-w-2xl mx-auto">
                        {#if savedScripts.length === 0}
                            <div class="text-center py-16">
                                <FileCode size={48} class="mx-auto mb-4 text-gray-300" />
                                <h3 class="text-lg font-medium text-gray-500 mb-2">Belum ada script</h3>
                                <p class="text-sm text-gray-400 mb-6">Tambahkan script ke folder scripts atau nyalakan Developer Mode untuk membuat script baru</p>
                                <button
                                    onclick={openScriptsFolder}
                                    class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium inline-flex items-center gap-2"
                                >
                                    <FolderOpen size={16} />
                                    Buka Folder Scripts
                                </button>
                            </div>
                        {:else}
                            <div class="space-y-3">
                                {#each savedScripts as script (script.id)}
                                    <div class="p-4 rounded-xl border border-gray-200 bg-white hover:border-purple-200 hover:shadow-sm transition-all">
                                        <div class="flex items-center justify-between gap-4">
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                                        <Zap size={16} class="text-purple-600" />
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="font-medium text-sm text-gray-900 truncate">{script.name}</div>
                                                        {#if script.description}
                                                            <div class="text-xs text-gray-500 truncate">{script.description}</div>
                                                        {:else}
                                                            <div class="text-xs text-gray-400">{script.urlPattern || '*'}</div>
                                                        {/if}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-2 shrink-0">
                                                {#if script.autoRun}
                                                    <span class="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Auto</span>
                                                {/if}
                                                <button
                                                    onclick={() => executeScript(script.id)}
                                                    disabled={isExecuting}
                                                    class="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 transition-colors flex items-center gap-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {#if isExecuting && selectedScriptId === script.id}
                                                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    {:else}
                                                        <Play size={14} />
                                                    {/if}
                                                    Run
                                                </button>
                                                <button
                                                    onclick={() => deleteScript(script.id)}
                                                    class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
                {/if}
            {:else if activeTab === 'console'}
                <!-- Console Tab — uses shared ScriptConsolePanel -->
                <ScriptConsolePanel showHeader={true} />
            {:else if activeTab === 'docs'}
                <!-- API Documentation Tab — uses shared VBoxApiDocsPanel -->
                <VBoxApiDocsPanel />
            {/if}
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">
                    {#if developerMode}
                        Script disimpan sebagai file • Gunakan VBox API
                    {:else}
                        {savedScripts.length} script tersedia • Buka folder untuk menambahkan
                    {/if}
                </div>
                <div class="flex items-center gap-2">
                    {#if developerMode}
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
                            onclick={() => executeScript()}
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
                    {:else}
                        <button
                            onclick={openScriptsFolder}
                            class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 text-sm font-medium"
                        >
                            <FolderOpen size={16} />
                            Buka Folder
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
