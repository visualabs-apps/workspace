<script>
    import { Download, FolderOpen, Trash2, FileText, AlertCircle, XCircle, Pause, Play, X } from "lucide-svelte";
    import { slide } from 'svelte/transition';
    import { workspaceStore } from "../../lib/stores/workspaces.svelte.js";
    import { downloadStore } from "../../lib/stores/downloads.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";
    import { onMount, onDestroy } from "svelte";
    import { useClickOutside } from "../../lib/utils/clickOutside.svelte.js";

    let { isOpen = $bindable(false) } = $props();

    let clickOutsideCleanup;

    onDestroy(() => {
        if (clickOutsideCleanup) {
            clickOutsideCleanup();
        }
    });

    // Setup click outside detection
    $effect(() => {
        if (isOpen) {
            clickOutsideCleanup = useClickOutside({
                elementSelector: '[data-download-panel]',
                onClickOutside: () => isOpen = false,
                enabled: true,
                includeEscape: true,
                includeBlur: true,
                includeResize: true
            });
        } else {
            if (clickOutsideCleanup) {
                clickOutsideCleanup();
                clickOutsideCleanup = null;
            }
        }
    });

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let downloads = $state([]);
    let allDownloads = $state([]); // Store all downloads for filtering
    let filterMode = $state('profile'); // 'profile' or 'global'
    let searchQuery = $state("");

    // Live update from download store
    $effect(() => {
        if (isOpen) {
            // Reload when downloads change
            const storeDownloads = downloadStore.downloads;
            if (storeDownloads.length > 0) {
                loadDownloads();
            }
        }
    });

    // Auto-reload every 1 second when panel is open
    let reloadInterval;
    let lastManualReload = $state(0);
    
    $effect(() => {
        if (isOpen) {
            loadDownloads();
            reloadInterval = setInterval(() => {
                // Skip auto-reload if manual reload happened recently (within 2 seconds)
                if (Date.now() - lastManualReload < 2000) {
                    return;
                }
                loadDownloads();
            }, 1000);
        } else {
            if (reloadInterval) {
                clearInterval(reloadInterval);
                reloadInterval = null;
            }
        }
        
        return () => {
            if (reloadInterval) {
                clearInterval(reloadInterval);
            }
        };
    });

    async function loadDownloads() {
        try {
            const profileId = filterMode === 'global' ? 'all' : activeWorkspace?.id;
            const result = await window.api.db.getDownloads(profileId);
            if (result.success) {
                // Check file existence only for completed downloads
                const downloadsWithStatus = await Promise.all(
                    result.downloads.map(async (download, index) => {
                        let fileExists = true;
                        let actualFilename = download.filename;
                        
                        // Only extract actual filename for completed downloads
                        if (download.state === 'completed' && download.save_path) {
                            // Extract actual filename from save_path
                            const pathParts = download.save_path.split(/[\\/]/);
                            actualFilename = pathParts[pathParts.length - 1];
                            
                            // Check file existence
                            const existsResult = await window.api.db.fileExists(download.save_path);
                            fileExists = existsResult.exists;
                        }
                        
                        return {
                            ...download,
                            displayFilename: actualFilename, // Use for display
                            // Ensure unique key - use id or generate from filename + start_time + index
                            _key: download.id || `${download.filename}-${download.start_time}-${index}`,
                            fileExists: fileExists
                        };
                    })
                );
                
                allDownloads = downloadsWithStatus;
                filterDownloads();
            }
        } catch (error) {
            console.error('Failed to load downloads:', error);
        }
    }

    function filterDownloads() {
        if (!searchQuery.trim()) {
            downloads = allDownloads;
            return;
        }

        const query = searchQuery.toLowerCase();
        downloads = allDownloads.filter(download => 
            download.filename?.toLowerCase().includes(query) ||
            download.displayFilename?.toLowerCase().includes(query) ||
            download.save_path?.toLowerCase().includes(query) ||
            download.url?.toLowerCase().includes(query)
        );
    }

    function handleSearchChange() {
        filterDownloads();
    }

    async function handleOpenFile(download) {
        if (!download.fileExists) {
            toastStore.warning('File has been deleted or moved');
            return;
        }
        
        try {
            await window.api.db.openFile(download.save_path);
        } catch (error) {
            console.error('Failed to open file:', error);
            toastStore.error('Failed to open file');
        }
    }

    async function handleShowInFolder(download) {
        if (!download.fileExists) {
            toastStore.warning('File has been deleted or moved');
            return;
        }
        
        try {
            await window.api.db.openFileLocation(download.save_path);
        } catch (error) {
            console.error('Failed to show in folder:', error);
            toastStore.error('Failed to show in folder');
        }
    }

    async function handleDeleteDownload(download, event) {
        event.stopPropagation();
        
        try {
            const result = await window.api.db.deleteDownload(download.id);
            if (result.success) {
                downloads = downloads.filter(d => d.id !== download.id);
                toastStore.success('Download removed from list');
            } else {
                toastStore.error('Failed to remove download');
            }
        } catch (error) {
            console.error('Failed to delete download:', error);
            toastStore.error('Failed to remove download');
        }
    }

    async function handleClearAll() {
        try {
            const profileId = filterMode === 'global' ? 'all' : activeWorkspace?.id;
            const result = await window.api.db.clearDownloads(profileId);
            if (result.success) {
                downloads = [];
                toastStore.success('All downloads cleared');
            } else {
                toastStore.error('Failed to clear downloads');
            }
        } catch (error) {
            console.error('Failed to clear downloads:', error);
            toastStore.error('Failed to clear downloads');
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp);
        
        // Validate date
        if (isNaN(date.getTime())) return 'Invalid date';
        
        // Format: DD/MM/YYYY, HH:MM
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}/${month}/${year}, ${hours}:${minutes}`;
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoExts = ['mp4', 'webm', 'avi', 'mov'];
        const docExts = ['pdf', 'doc', 'docx', 'txt'];
        
        if (imageExts.includes(ext)) return '🖼️';
        if (videoExts.includes(ext)) return '🎬';
        if (docExts.includes(ext)) return '📄';
        return '📁';
    }

    function getStateColor(state) {
        switch (state) {
            case 'completed':
                return 'text-green-600';
            case 'progressing':
                return 'text-blue-600';
            case 'paused':
                return 'text-orange-600';
            case 'failed':
            case 'cancelled':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    }

    function getStateText(state) {
        switch (state) {
            case 'completed':
                return 'Completed';
            case 'progressing':
                return 'Downloading...';
            case 'paused':
                return 'Paused';
            case 'failed':
                return 'Failed';
            case 'cancelled':
                return 'Cancelled';
            default:
                return state;
        }
    }

    async function handlePauseResume(download, event) {
        event.stopPropagation();
        
        if (download.state === 'paused') {
            // Resume
            try {
                const result = await window.api.db.resumeDownload(download.gid);
                
                if (result.success) {
                    await loadDownloads();
                    toastStore.success('Download resumed');
                } else {
                    toastStore.error(result.error || 'Failed to resume download');
                }
            } catch (error) {
                console.error('Failed to resume download:', error);
                toastStore.error('Failed to resume download');
            }
        } else if (download.state === 'progressing') {
            // Pause
            try {
                const result = await window.api.db.pauseDownload(download.gid);
                
                if (result.success) {
                    await loadDownloads();
                    toastStore.success('Download paused');
                } else {
                    toastStore.error(result.error || 'Failed to pause download');
                }
            } catch (error) {
                console.error('Failed to pause download:', error);
                toastStore.error('Failed to pause download');
            }
        }
    }

    async function handleCancelDownload(download, event) {
        event.stopPropagation();
        
        if (download.state !== 'progressing' && download.state !== 'paused') {
            console.log('Cannot cancel - invalid state:', download.state);
            return;
        }
        
        console.log('Cancelling download:', download.gid);
        
        try {
            const result = await window.api.db.cancelDownload(download.gid);
            console.log('Cancel result:', result);
            
            if (result.success) {
                // Cleanup partial file and .aria2 control file if exists
                if (download.save_path) {
                    try {
                        // Remove main file
                        console.log('Removing file:', download.save_path);
                        await window.api.db.removeDownloadFile(download.save_path);
                        // Remove .aria2 control file
                        console.log('Removing .aria2 file:', download.save_path + '.aria2');
                        await window.api.db.removeDownloadFile(download.save_path + '.aria2');
                    } catch (error) {
                        console.error('Failed to cleanup partial files:', error);
                    }
                }
                
                lastManualReload = Date.now();
                console.log('Reloading downloads...');
                await loadDownloads();
                toastStore.success('Download cancelled');
            } else {
                console.error('Cancel failed:', result.error);
                toastStore.error(result.error || 'Failed to cancel download');
            }
        } catch (error) {
            console.error('Failed to cancel download:', error);
            toastStore.error('Failed to cancel download');
        }
    }

    async function handleRemoveFile(download, event) {
        event.stopPropagation();
        
        if (!download.fileExists || !download.save_path) {
            toastStore.warning('File not found');
            return;
        }
        
        try {
            const result = await window.api.db.removeDownloadFile(download.save_path);
            if (result.success) {
                // Also remove from list
                await handleDeleteDownload(download, event);
                toastStore.success('File deleted');
            } else {
                toastStore.error('Failed to delete file');
            }
        } catch (error) {
            console.error('Failed to delete file:', error);
            toastStore.error('Failed to delete file');
        }
    }

    function formatSpeed(bytesPerSecond) {
        if (!bytesPerSecond || bytesPerSecond === 0) return '';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        return Math.round(bytesPerSecond / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
</script>

{#if isOpen}
    <!-- Panel - Full height from right with slide animation -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col z-50"
        data-download-panel
        transition:slide={{ duration: 300, axis: 'x' }}
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Download size={20} />
                    Downloads
                </h2>
                <button
                    onclick={() => isOpen = false}
                    class="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                    ✕
                </button>
            </div>

            <!-- Search -->
            <div class="relative mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                <input
                    type="text"
                    bind:value={searchQuery}
                    oninput={handleSearchChange}
                    placeholder="Search downloads..."
                    class="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
            </div>

            <!-- Filter Tabs -->
            <div class="flex gap-1 border-b border-gray-200 dark:border-gray-700">
                <button
                    onclick={() => { filterMode = 'profile'; loadDownloads(); }}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {filterMode === 'profile'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                >
                    This Profile
                </button>
                <button
                    onclick={() => { filterMode = 'global'; loadDownloads(); }}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {filterMode === 'global'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
                >
                    All Profiles
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
            {#if downloads.length === 0}
                <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Download size={48} class="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p class="mb-2">No downloads yet</p>
                    <p class="text-sm">Downloaded files will appear here</p>
                </div>
            {:else}
                {#each downloads as download (download._key)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-b-0 group"
                        onclick={() => handleOpenFile(download)}
                    >
                        <div class="flex items-start gap-3">
                            <!-- File Icon -->
                            <div class="text-2xl shrink-0 mt-0.5">
                                {#if download.state === 'progressing'}
                                    <Download size={20} class="text-blue-600 dark:text-blue-400" />
                                {:else if download.state === 'paused'}
                                    <Pause size={20} class="text-orange-600 dark:text-orange-400" />
                                {:else if download.state === 'completed'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600 dark:text-green-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                {:else if download.state === 'cancelled' || download.state === 'failed'}
                                    <XCircle size={20} class="text-red-600 dark:text-red-400" />
                                {:else}
                                    <FileText size={20} class="text-gray-400 dark:text-gray-500" />
                                {/if}
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {download.displayFilename || download.filename}
                                </div>

                                <!-- File path -->
                                {#if download.save_path}
                                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                        {download.save_path}
                                    </div>
                                {/if}

                                <!-- File info -->
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {#if download.state === 'progressing' || download.state === 'paused'}
                                        {formatFileSize(download.received_bytes)} / {formatFileSize(download.total_bytes)}
                                        • {download.total_bytes > 0 ? Math.round((download.received_bytes / download.total_bytes) * 100) : 0}%
                                        {#if download.state === 'progressing' && download.download_speed}
                                            • <span class="text-blue-600 dark:text-blue-400">{formatSpeed(download.download_speed)}</span>
                                        {/if}
                                    {:else}
                                        {formatFileSize(download.total_bytes)}
                                    {/if}
                                </div>

                                <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {formatDate(download.start_time)}
                                    • <span class="{getStateColor(download.state)}">{getStateText(download.state)}</span>
                                </div>

                                <!-- File status warning -->
                                {#if download.state === 'completed' && !download.fileExists}
                                    <div class="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 mt-1">
                                        <AlertCircle size={12} />
                                        <span>File deleted or moved</span>
                                    </div>
                                {/if}

                                <!-- Progress bar for active downloads -->
                                {#if download.state === 'progressing' || download.state === 'paused'}
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                                        <div
                                            class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all"
                                            style="width: {download.total_bytes > 0 ? (download.received_bytes / download.total_bytes) * 100 : 0}%"
                                        ></div>
                                    </div>
                                {/if}

                                <!-- Actions -->
                                <div class="flex items-center gap-2 mt-2">
                                    {#if download.state === 'progressing' || download.state === 'paused'}
                                        <button
                                            onclick={(e) => handlePauseResume(download, e)}
                                            class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                        >
                                            {download.state === 'paused' ? 'Resume' : 'Pause'}
                                        </button>
                                        <button
                                            onclick={(e) => handleCancelDownload(download, e)}
                                            class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    {/if}
                                    {#if download.fileExists && download.state === 'completed'}
                                        <button
                                            onclick={(e) => { e.stopPropagation(); handleShowInFolder(download); }}
                                            class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                        >
                                            Show in folder
                                        </button>
                                        <button
                                            onclick={(e) => handleRemoveFile(download, e)}
                                            class="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 px-2 py-1 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                                        >
                                            Remove file
                                        </button>
                                    {/if}
                                    <button
                                        onclick={(e) => handleDeleteDownload(download, e)}
                                        class="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    >
                                        Remove from list
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Footer with Clear All -->
        {#if downloads.length > 0}
            <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onclick={handleClearAll}
                    class="w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={16} />
                    Clear All Downloads
                </button>
            </div>
        {/if}
    </div>
{/if}

<style>
    /* Custom scrollbar */
    div::-webkit-scrollbar {
        width: 6px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
</style>




