<script>
    import { onMount, onDestroy } from 'svelte';
    import { Download, RefreshCw, X, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-svelte';

    // ── State ────────────────────────────────────────────────────────────────
    let phase = $state('idle'); 
    // idle | available | downloading | ready | error | checking

    let updateInfo = $state({
        version: '',
        notes: '',
        downloadUrl: null,
        assetName: null,
        assetSize: 0,
    });

    let download = $state({ percent: 0, receivedBytes: 0, totalBytes: 0 });
    let installerPath = $state('');
    let errorMsg = $state('');
    let showNotes = $state(false);
    let dismissed = $state(false);
    let checkingManual = $state(false);

    // ── IPC cleanup refs ─────────────────────────────────────────────────────
    let removeVersionListener;
    let removeProgressListener;
    let removeCompleteListener;
    let removeErrorListener;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function formatBytes(bytes) {
        if (!bytes) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
    }

    async function startDownload() {
        if (!updateInfo.downloadUrl) {
            errorMsg = 'No installer download URL found in this release.';
            phase = 'error';
            return;
        }
        phase = 'downloading';
        download = { percent: 0, receivedBytes: 0, totalBytes: 0 };
        await window.api.update.startDownload({
            downloadUrl: updateInfo.downloadUrl,
            assetName:   updateInfo.assetName,
        });
    }

    async function installNow() {
        if (!installerPath) return;
        await window.api.update.installAndQuit({ installerPath });
    }

    async function checkManually() {
        checkingManual = true;
        try {
            const result = await window.api.update.checkNow();
            if (!result.success) {
                errorMsg = result.error || 'Check failed';
                phase = 'error';
            } else if (result.upToDate) {
                // briefly show "up to date" via toast if available
                window.api?.onShowToast?.({ type: 'success', message: `VisualBox v${result.currentVersion} is up to date` });
            } else {
                updateInfo = {
                    version: result.latestVersion,
                    notes:   result.notes,
                    downloadUrl: result.downloadUrl,
                    assetName:   result.assetName,
                    assetSize:   result.assetSize,
                };
                dismissed = false;
                phase = 'available';
            }
        } catch (e) {
            errorMsg = e.message;
            phase = 'error';
        } finally {
            checkingManual = false;
        }
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────
    onMount(() => {
        // Listen for background version check result
        if (window.api?.onNewVersionAvailable) {
            removeVersionListener = window.api.onNewVersionAvailable((info) => {
                updateInfo = {
                    version:     info.version,
                    notes:       info.notes,
                    downloadUrl: info.downloadUrl,
                    assetName:   info.assetName,
                    assetSize:   info.assetSize,
                };
                dismissed = false;
                phase = 'available';
            });
        }

        // Download progress — auto-activate banner even if triggered from Settings
        if (window.api?.update?.onProgress) {
            removeProgressListener = window.api.update.onProgress((data) => {
                download = data;
                if (phase === 'idle') {
                    dismissed = false;
                    phase = 'downloading';
                }
            });
        }

        // Download complete
        if (window.api?.update?.onComplete) {
            removeCompleteListener = window.api.update.onComplete((data) => {
                installerPath = data.path;
                dismissed = false;
                phase = 'ready';
            });
        }

        // Download error
        if (window.api?.update?.onError) {
            removeErrorListener = window.api.update.onError((data) => {
                errorMsg = data.error || 'Download failed';
                dismissed = false;
                phase = 'error';
            });
        }
    });

    onDestroy(() => {
        removeVersionListener?.();
        removeProgressListener?.();
        removeCompleteListener?.();
        removeErrorListener?.();
    });

    let visible = $derived(!dismissed && phase !== 'idle');
</script>

{#if visible}
    <!-- Backdrop blur overlay for "ready" state -->
    {#if phase === 'ready'}
        <div class="update-overlay" onclick={() => {}}></div>
    {/if}

    <div class="update-banner" class:update-banner--ready={phase === 'ready'} class:update-banner--error={phase === 'error'}>

        <!-- Header row -->
        <div class="ub-header">
            <div class="ub-icon-wrap" class:ub-icon-wrap--dl={phase === 'downloading'} class:ub-icon-wrap--ready={phase === 'ready'} class:ub-icon-wrap--err={phase === 'error'}>
                {#if phase === 'downloading'}
                    <Download size={16} class="ub-spin-dl" />
                {:else if phase === 'ready'}
                    <CheckCircle size={16} />
                {:else if phase === 'error'}
                    <AlertCircle size={16} />
                {:else}
                    <Zap size={16} />
                {/if}
            </div>

            <div class="ub-title-area">
                {#if phase === 'available'}
                    <span class="ub-label">Update tersedia</span>
                    <span class="ub-version">v{updateInfo.version}</span>
                {:else if phase === 'downloading'}
                    <span class="ub-label">Mengunduh update…</span>
                    <span class="ub-version">{download.percent}%</span>
                {:else if phase === 'ready'}
                    <span class="ub-label">Siap diinstall</span>
                    <span class="ub-version">v{updateInfo.version}</span>
                {:else if phase === 'error'}
                    <span class="ub-label ub-label--err">Gagal</span>
                    <span class="ub-version ub-version--err">{errorMsg}</span>
                {/if}
            </div>

            <!-- Release notes toggle -->
            {#if (phase === 'available' || phase === 'ready') && updateInfo.notes}
                <button class="ub-notes-btn" onclick={() => (showNotes = !showNotes)} title="Lihat catatan rilis">
                    {#if showNotes}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
                </button>
            {/if}

            <!-- Dismiss -->
            {#if phase !== 'downloading'}
                <button class="ub-close" onclick={() => (dismissed = true)} title="Tutup">
                    <X size={14} />
                </button>
            {/if}
        </div>

        <!-- Progress bar -->
        {#if phase === 'downloading'}
            <div class="ub-progress-track">
                <div class="ub-progress-fill" style="width: {download.percent}%"></div>
            </div>
            <div class="ub-progress-info">
                {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
            </div>
        {/if}

        <!-- Release notes -->
        {#if showNotes && updateInfo.notes}
            <div class="ub-notes">
                <pre class="ub-notes-text">{updateInfo.notes}</pre>
            </div>
        {/if}

        <!-- Action buttons -->
        <div class="ub-actions">
            {#if phase === 'available'}
                <button class="ub-btn ub-btn--primary" onclick={startDownload}>
                    <Download size={13} />
                    Update Sekarang
                    {#if updateInfo.assetSize}
                        <span class="ub-size">({formatBytes(updateInfo.assetSize)})</span>
                    {/if}
                </button>
                <button class="ub-btn ub-btn--ghost" onclick={() => (dismissed = true)}>
                    Nanti
                </button>
            {:else if phase === 'downloading'}
                <span class="ub-hint">Jangan tutup aplikasi saat mengunduh…</span>
            {:else if phase === 'ready'}
                <button class="ub-btn ub-btn--install" onclick={installNow}>
                    <RefreshCw size={13} />
                    Install &amp; Restart
                </button>
                <button class="ub-btn ub-btn--ghost" onclick={() => (dismissed = true)}>
                    Nanti
                </button>
            {:else if phase === 'error'}
                <button class="ub-btn ub-btn--primary" onclick={() => { phase = 'available'; errorMsg = ''; }}>
                    Coba Lagi
                </button>
                <button class="ub-btn ub-btn--ghost" onclick={() => (dismissed = true)}>
                    Tutup
                </button>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* ── Banner container ───────────────────────────────────────────────── */
    .update-banner {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        width: 340px;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border: 1px solid rgba(99, 179, 237, 0.25);
        border-radius: 16px;
        box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;
        padding: 16px;
        animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        backdrop-filter: blur(20px);
    }

    .update-banner--ready {
        border-color: rgba(52, 211, 153, 0.4);
        box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 30px rgba(52, 211, 153, 0.15);
    }

    .update-banner--error {
        border-color: rgba(239, 68, 68, 0.35);
    }

    .update-overlay {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(2px);
        animation: fadeIn 0.2s ease both;
    }

    @keyframes slideUp {
        from { opacity: 0; transform: translateY(24px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    @keyframes fadeIn {
        from { opacity: 0; } to { opacity: 1; }
    }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .ub-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
    }

    .ub-icon-wrap {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
    }
    .ub-icon-wrap--dl  { background: linear-gradient(135deg, #0ea5e9, #3b82f6); }
    .ub-icon-wrap--ready { background: linear-gradient(135deg, #10b981, #059669); }
    .ub-icon-wrap--err { background: linear-gradient(135deg, #ef4444, #dc2626); }

    .ub-title-area {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .ub-label {
        font-size: 12px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .ub-label--err { color: #fca5a5; }

    .ub-version {
        font-size: 14px;
        font-weight: 700;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .ub-version--err {
        font-size: 12px;
        font-weight: 500;
        color: #fca5a5;
    }

    .ub-notes-btn, .ub-close {
        flex-shrink: 0;
        background: none;
        border: none;
        cursor: pointer;
        color: #64748b;
        padding: 4px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        transition: color 0.15s, background 0.15s;
    }
    .ub-notes-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.06); }
    .ub-close:hover     { color: #f87171; background: rgba(239, 68, 68, 0.12); }

    /* ── Progress ───────────────────────────────────────────────────────── */
    .ub-progress-track {
        margin-top: 10px;
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 99px;
        overflow: hidden;
    }
    .ub-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #06b6d4);
        border-radius: 99px;
        transition: width 0.3s ease;
        box-shadow: 0 0 8px rgba(59, 130, 246, 0.7);
    }
    .ub-progress-info {
        margin-top: 5px;
        font-size: 11px;
        color: #64748b;
        text-align: right;
    }

    /* ── Release notes ──────────────────────────────────────────────────── */
    .ub-notes {
        margin-top: 10px;
        padding: 10px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        max-height: 140px;
        overflow-y: auto;
    }
    .ub-notes-text {
        font-size: 11.5px;
        color: #94a3b8;
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
        font-family: inherit;
        line-height: 1.6;
    }

    /* ── Action buttons ─────────────────────────────────────────────────── */
    .ub-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
    }

    .ub-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .ub-btn--primary {
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        color: #fff;
        box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
    }
    .ub-btn--primary:hover {
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        box-shadow: 0 4px 20px rgba(59, 130, 246, 0.6);
        transform: translateY(-1px);
    }

    .ub-btn--install {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .ub-btn--install:hover {
        background: linear-gradient(135deg, #059669, #047857);
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.6);
        transform: translateY(-1px);
    }

    .ub-btn--ghost {
        background: rgba(255,255,255,0.06);
        color: #94a3b8;
        border: 1px solid rgba(255,255,255,0.08);
    }
    .ub-btn--ghost:hover {
        background: rgba(255,255,255,0.1);
        color: #e2e8f0;
    }

    .ub-size {
        font-size: 11px;
        font-weight: 400;
        opacity: 0.75;
    }

    .ub-hint {
        font-size: 11.5px;
        color: #64748b;
        font-style: italic;
    }

    /* ── Download spinner animation ─────────────────────────────────────── */
    :global(.ub-spin-dl) {
        animation: pulse-dl 1.2s ease-in-out infinite;
    }
    @keyframes pulse-dl {
        0%, 100% { opacity: 1; transform: translateY(0); }
        50%       { opacity: 0.6; transform: translateY(2px); }
    }

    /* ── Scrollbar ─────────────────────────────────────────────────────── */
    .ub-notes::-webkit-scrollbar { width: 4px; }
    .ub-notes::-webkit-scrollbar-track { background: transparent; }
    .ub-notes::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
</style>
