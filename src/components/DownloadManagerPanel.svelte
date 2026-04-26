<script>
    import { X, Download, FolderOpen, Trash2, FileText, AlertCircle } from "lucide-svelte";
    import { clickOutside } from "../lib/clickOutside.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { toastStore } from "../lib/toast.svelte.js";

    let { isOpen = $bindable(false) } = $props();

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let downloads = $state([]);
    let isLoading = $state(false);
    let filterMode = $state('profile'); // 'profile' or 'global'

    // Load downloads when panel opens or filter changes
    $effect(() => {
        if (isOpen) {
            loadDownloads();
        }
    });

    $effect(() => {
        if (isOpen && filterMode) {
            loadDownloads();
        }
    });

    async function loadDownloads() {
        isLoading = true;
        try {
            const profileId = filterMode === 'global' ? 'all' : activeWorkspace?.id;
            const result = await window.api.db.getDownloads(profileId);
            if (result.success) {
                // Check file existence only for completed downloads
                const downloadsWithStatus = await Promise.all(
                    result.downloads.map(async (download) => {
                        let fileExists = true;
                        if (download.state === 'completed' && download.save_path) {
                            const existsResult = await window.api.db.fileExists(download.save_path);
                            fileExists = existsResult.exists;
                        }
                        return {
                            ...download,
                            fileExists: fileExists
                        };
                    })
                );
                downloads = downloadsWithStatus;
            }
        } catch (error) {
            console.error('Failed to load downloads:', error);
        } finally {
            isLoading = false;
        }
    }

    function handleClose() {
        isOpen = false;
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
        if (!confirm('Clear all downloads from list?')) return;
        
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
                const result = await window.api.db.resumeDownload(download.filename);
                if (result.success) {
                    await loadDownloads();
                    toastStore.success('Download resumed');
                } else {
                    toastStore.error('Failed to resume download');
                }
            } catch (error) {
                console.error('Failed to resume download:', error);
                toastStore.error('Failed to resume download');
            }
        } else if (download.state === 'progressing') {
            // Pause
            try {
                const result = await window.api.db.pauseDownload(download.filename);
                if (result.success) {
                    await loadDownloads();
                    toastStore.success('Download paused');
                } else {
                    toastStore.error('Failed to pause download');
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
            return;
        }
        
        if (!confirm('Cancel this download?')) return;
        
        try {
            const result = await window.api.db.cancelDownload(download.filename);
            if (result.success) {
                await loadDownloads();
                toastStore.success('Download cancelled');
            } else {
                toastStore.error('Failed to cancel download');
            }
        } catch (error) {
            console.error('Failed to cancel download:', error);
            toastStore.error('Failed to cancel download');
        }
    }
</script>

{#if isOpen}
    <div
        use:clickOutside={{ onClickOutside: handleClose, includeEscape: true }}
        class="fixed right-4 top-16 w-[500px] max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <div class="flex items-center gap-2">
                <Download size={18} class="text-blue-600" />
                <h3 class="font-semibold text-gray-900">Downloads</h3>
                <span class="text-xs text-gray-500">({downloads.length})</span>
            </div>
            <div class="flex items-center gap-2">
                {#if downloads.length > 0}
                    <button
                        onclick={handleClearAll}
                        class="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                        title="Clear all"
                    >
                        Clear all
                    </button>
                {/if}
                <button
                    onclick={handleClose}
                    class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close"
                >
                    <X size={18} class="text-gray-600" />
                </button>
            </div>
        </div>

        <!-- Filter Tabs -->
        <div class="flex border-b border-gray-200 px-4">
            <button
                onclick={() => filterMode = 'profile'}
                class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {filterMode === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}"
            >
                This Profile
            </button>
            <button
                onclick={() => filterMode = 'global'}
                class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {filterMode === 'global' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}"
            >
                All Profiles
            </button>
        </div>

        <!-- Downloads List -->
        <div class="flex-1 overflow-y-auto">
            {#if isLoading}
                <div class="flex items-center justify-center py-12">
                    <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else if downloads.length === 0}
                <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Download size={48} class="text-gray-300 mb-3" />
                    <p class="text-gray-600 font-medium mb-1">No downloads yet</p>
                    <p class="text-sm text-gray-500">
                        Downloaded files will appear here
                    </p>
                </div>
            {:else}
                <div class="divide-y divide-gray-100">
                    {#each downloads as download (download.id)}
                        <div class="px-4 py-3 hover:bg-gray-50 transition-colors group">
                            <div class="flex items-start gap-3">
                                <!-- File Icon -->
                                <div class="text-2xl shrink-0 mt-1">
                                    {#if download.state === 'progressing'}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    {:else if download.state === 'paused'}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-orange-600"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                    {:else if download.state === 'completed'}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                    {:else if download.state === 'cancelled' || download.state === 'failed'}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                    {:else}
                                        {getFileIcon(download.filename)}
                                    {/if}
                                </div>

                                <!-- Content -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-start justify-between gap-2 mb-1">
                                        <button
                                            onclick={() => handleOpenFile(download)}
                                            class="font-medium text-gray-900 text-sm truncate hover:text-blue-600 transition-colors text-left flex-1"
                                            disabled={!download.fileExists}
                                        >
                                            {download.filename}
                                        </button>
                                        <button
                                            onclick={(e) => handleDeleteDownload(download, e)}
                                            class="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all shrink-0"
                                            title="Remove from list"
                                        >
                                            <Trash2 size={14} class="text-red-600" />
                                        </button>
                                    </div>

                                    <!-- File info -->
                                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                        {#if download.state === 'progressing' || download.state === 'paused'}
                                            <span>{formatFileSize(download.received_bytes)} / {formatFileSize(download.total_bytes)}</span>
                                            <span>•</span>
                                            <span>{Math.round((download.received_bytes / download.total_bytes) * 100)}%</span>
                                        {:else}
                                            <span>{formatFileSize(download.total_bytes)}</span>
                                        {/if}
                                        <span>•</span>
                                        <span>{formatDate(download.start_time)}</span>
                                        <span>•</span>
                                        <span class="{getStateColor(download.state)}">{getStateText(download.state)}</span>
                                    </div>

                                    <!-- File status warning - only show for completed downloads -->
                                    {#if download.state === 'completed' && !download.fileExists}
                                        <div class="flex items-center gap-1.5 text-xs text-orange-600 mb-2">
                                            <AlertCircle size={12} />
                                            <span>File deleted or moved</span>
                                        </div>
                                    {/if}

                                    <!-- Actions -->
                                    <div class="flex items-center gap-2 mt-2">
                                        {#if download.state === 'progressing' || download.state === 'paused'}
                                            <button
                                                onclick={(e) => handlePauseResume(download, e)}
                                                class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                                            >
                                                {#if download.state === 'paused'}
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                                    <span>Resume</span>
                                                {:else}
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                                                    <span>Pause</span>
                                                {/if}
                                            </button>
                                            <button
                                                onclick={(e) => handleCancelDownload(download, e)}
                                                class="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                <span>Cancel</span>
                                            </button>
                                        {/if}
                                        {#if download.fileExists && download.state === 'completed'}
                                            <button
                                                onclick={() => handleShowInFolder(download)}
                                                class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                                            >
                                                <FolderOpen size={12} />
                                                <span>Show in folder</span>
                                            </button>
                                        {/if}
                                    </div>

                                    <!-- Progress bar for active downloads -->
                                    {#if download.state === 'progressing' || download.state === 'paused'}
                                        <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                            <div
                                                class="bg-blue-600 h-1.5 rounded-full transition-all"
                                                style="width: {(download.received_bytes / download.total_bytes) * 100}%"
                                            ></div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* Custom scrollbar */
    .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
    }

    .overflow-y-auto::-webkit-scrollbar-track {
        background: transparent;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.3);
        border-radius: 3px;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.5);
    }
</style>
