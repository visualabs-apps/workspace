<script>
    import { downloadStore } from "../../lib/stores/downloads.svelte.js";
    import {
        Download,
        X,
        Pause,
        Play,
        Trash2,
        FolderOpen,
        CheckCircle,
        AlertCircle,
    } from "lucide-svelte";

    let downloads = $derived(downloadStore.downloads);
    let activeDownloads = $derived(downloadStore.activeDownloads);
    let completedDownloads = $derived(downloadStore.completedDownloads);

    function formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    }

    function formatSpeed(bytesPerSecond) {
        return formatBytes(bytesPerSecond) + "/s";
    }

    function getProgress(download) {
        if (download.totalBytes === 0) return 0;
        return Math.round((download.receivedBytes / download.totalBytes) * 100);
    }

    function handlePauseResume(download) {
        if (download.state === "paused") {
            // Resume download
            if (window.api?.db?.resumeDownload) {
                window.api.db.resumeDownload(download.filename).then(result => {
                    if (result.success) {
                        downloadStore.updateDownload(download.id, { state: 'progressing' });
                    }
                }).catch(err => {
                    console.error('Failed to resume download:', err);
                });
            }
        } else {
            // Pause download
            if (window.api?.db?.pauseDownload) {
                window.api.db.pauseDownload(download.filename).then(result => {
                    if (result.success) {
                        downloadStore.updateDownload(download.id, { state: 'paused' });
                    }
                }).catch(err => {
                    console.error('Failed to pause download:', err);
                });
            }
        }
    }

    function handleCancel(download) {
        if (confirm("Cancel this download?")) {
            // Cancel via Electron IPC
            if (window.api?.db?.cancelDownload) {
                window.api.db.cancelDownload(download.filename).then(result => {
                    if (result.success) {
                        // Update local state
                        downloadStore.updateDownload(download.id, { 
                            state: 'cancelled',
                            endTime: Date.now()
                        });
                    }
                }).catch(err => {
                    console.error('Failed to cancel download:', err);
                });
            }
        }
    }

    function handleRemove(download) {
        downloadStore.removeDownload(download.id);
    }

    function handleOpenFile(download) {
        if (download.savePath) {
        }
    }

    function handleShowInFolder(download) {
        if (download.savePath) {
        }
    }

    function handleClearCompleted() {
        if (confirm("Clear all completed downloads?")) {
            downloadStore.clearCompleted();
        }
    }
</script>

<div
    class="fixed bottom-4 right-4 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 max-h-[600px] flex flex-col"
>
    <!-- Header -->
    <div
        class="px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-between"
    >
        <div class="flex items-center gap-2">
            <Download size={20} />
            <h3 class="font-semibold">Downloads</h3>
            {#if activeDownloads.length > 0}
                <span
                    class="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium"
                >
                    {activeDownloads.length} active
                </span>
            {/if}
        </div>
        <button
            onclick={() => downloadStore.closeDownloadPanel()}
            class="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
            <X size={18} />
        </button>
    </div>

    <!-- Downloads List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
        {#if activeDownloads.length === 0}
            <div class="p-8 text-center text-gray-400">
                <Download size={48} class="mx-auto mb-3 opacity-30" />
                <p class="text-sm">No active downloads</p>
            </div>
        {:else}
            <!-- Active Downloads Only -->
            <div class="p-3">
                {#each activeDownloads as download (download.id)}
                    <div class="mb-3 p-3 bg-gray-50 rounded-xl">
                        <div class="flex items-start gap-3">
                            <div
                                class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0"
                            >
                                <Download
                                    size={20}
                                    class="text-blue-600"
                                />
                            </div>
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-gray-900 truncate"
                                >
                                    {download.filename}
                                </p>
                                <p class="text-xs text-gray-500 truncate">
                                    {download.serviceName || 'Download'}
                                </p>

                                <!-- Progress Bar -->
                                <div class="mt-2 mb-1">
                                    <div
                                        class="h-1.5 bg-gray-200 rounded-full overflow-hidden"
                                    >
                                        <div
                                            class="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                                            style="width: {getProgress(
                                                download,
                                            )}%"
                                        ></div>
                                    </div>
                                </div>

                                <div
                                    class="flex items-center justify-between text-xs text-gray-500"
                                >
                                    <span
                                        >{formatBytes(
                                            download.receivedBytes,
                                        )} / {formatBytes(
                                            download.totalBytes,
                                        )}</span
                                    >
                                    <span>{getProgress(download)}%</span>
                                </div>
                                {#if download.speed > 0}
                                    <p class="text-xs text-gray-400 mt-1">
                                        {formatSpeed(download.speed)}
                                    </p>
                                {/if}
                            </div>
                            <div class="flex gap-1">
                                <button
                                    onclick={() =>
                                        handlePauseResume(download)}
                                    class="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                                    title={download.state === "paused"
                                        ? "Resume"
                                        : "Pause"}
                                >
                                    {#if download.state === "paused"}
                                        <Play
                                            size={14}
                                            class="text-gray-600"
                                        />
                                    {:else}
                                        <Pause
                                            size={14}
                                            class="text-gray-600"
                                        />
                                    {/if}
                                </button>
                                <button
                                    onclick={() => handleCancel(download)}
                                    class="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Cancel"
                                >
                                    <X size={14} class="text-red-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.1);
        border-radius: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.2);
    }
</style>
