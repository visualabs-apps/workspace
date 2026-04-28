<script>
    import { Download, AlertCircle, FolderOpen } from "lucide-svelte";

    let { 
        isOpen = $bindable(false),
        url = "",
        suggestedFilename = "",
        onConfirm = (path, filename, replace) => {},
        onCancel = () => {}
    } = $props();

    let selectedPath = $state("");
    let filename = $state("");
    let fileExists = $state(false);
    let replaceFile = $state(false);

    // Initialize when dialog opens
    $effect(() => {
        if (isOpen) {
            console.log('🔔 DownloadDialog opened, initializing...');
            initializeDialog();
        }
    });

    async function initializeDialog() {
        // Get default downloads folder
        const result = await window.api.getDownloadsPath();
        selectedPath = result.path || '';
        
        // Set suggested filename
        filename = suggestedFilename || extractFilenameFromUrl(url);
        
        // Check if file exists
        await checkFileExists();
    }

    function extractFilenameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const parts = pathname.split('/');
            return parts[parts.length - 1] || 'download';
        } catch {
            return 'download';
        }
    }

    async function checkFileExists() {
        if (!selectedPath || !filename) {
            fileExists = false;
            return;
        }

        const fullPath = `${selectedPath}\\${filename}`;
        const result = await window.api.db.fileExists(fullPath);
        fileExists = result.exists;
    }

    async function handleBrowseFolder() {
        const result = await window.api.selectFolder();
        if (result.success && result.paths && result.paths.length > 0) {
            selectedPath = result.paths[0];
            await checkFileExists();
        }
    }

    async function handleFilenameChange() {
        await checkFileExists();
    }

    async function handleAutoRename() {
        if (!fileExists) return;

        const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
        const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
        
        let counter = 1;
        let newFilename = filename;
        
        while (true) {
            newFilename = `${baseName} (${counter})${ext}`;
            const fullPath = `${selectedPath}\\${newFilename}`;
            const result = await window.api.db.fileExists(fullPath);
            
            if (!result.exists) {
                filename = newFilename;
                fileExists = false;
                replaceFile = false;
                break;
            }
            counter++;
        }
    }

    function handleConfirm() {
        if (!selectedPath || !filename) return;
        
        onConfirm(selectedPath, filename, replaceFile);
        handleClose();
    }

    function handleClose() {
        isOpen = false;
        onCancel();
    }
</script>

{#if isOpen}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
        class="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" 
        onclick={handleClose}
        role="presentation"
    >
        <!-- Dialog -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
            onclick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-dialog-title"
            tabindex="-1"
        >
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center gap-3">
                    <Download size={24} class="text-blue-600 shrink-0" />
                    <div class="flex-1 min-w-0">
                        <h2 id="download-dialog-title" class="text-lg font-semibold text-gray-900">Simpan Download</h2>
                        <p class="text-sm text-gray-500 truncate">{url}</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="px-6 py-4 space-y-4">
                <!-- Location -->
                <div>
                    <label for="download-path" class="block text-sm font-medium text-gray-700 mb-2">
                        Simpan ke:
                    </label>
                    <div class="flex gap-2">
                        <input
                            id="download-path"
                            type="text"
                            value={selectedPath}
                            readonly
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                        />
                        <button
                            onclick={handleBrowseFolder}
                            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors shrink-0"
                        >
                            <FolderOpen size={16} />
                            Browse
                        </button>
                    </div>
                </div>

                <!-- Filename -->
                <div>
                    <label for="download-filename" class="block text-sm font-medium text-gray-700 mb-2">
                        Nama file:
                    </label>
                    <input
                        id="download-filename"
                        type="text"
                        bind:value={filename}
                        oninput={handleFilenameChange}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <!-- File exists warning -->
                {#if fileExists}
                    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <AlertCircle size={20} class="text-orange-600 shrink-0 mt-0.5" />
                            <div class="flex-1">
                                <p class="text-sm font-medium text-orange-900 mb-2">
                                    File dengan nama ini sudah ada
                                </p>
                                <div class="space-y-2">
                                    <button
                                        onclick={handleAutoRename}
                                        class="w-full px-3 py-2 bg-white hover:bg-gray-50 border border-orange-300 rounded-lg text-sm text-orange-900 transition-colors"
                                    >
                                        Rename otomatis
                                    </button>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            bind:checked={replaceFile}
                                            class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                        />
                                        <span class="text-sm text-orange-900">
                                            Ganti file yang ada
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                    onclick={handleClose}
                    class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Batal
                </button>
                <button
                    onclick={handleConfirm}
                    disabled={!selectedPath || !filename || (fileExists && !replaceFile)}
                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Download size={16} />
                    Download
                </button>
            </div>
        </div>
    </div>
{/if}
