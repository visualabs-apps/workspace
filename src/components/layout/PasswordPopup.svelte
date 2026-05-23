<script>
    import { Key, Check, X, Eye, EyeOff, RefreshCw, Globe } from "lucide-svelte";

    let {
        visible = false,
        origin = '',
        username = '',
        password = '',
        title = '',
        isUpdate = false,
        onSave = () => {},
        onNever = () => {},
        onCancel = () => {}
    } = $props();

    let showPassword = $state(false);
    let isSaving = $state(false);

    function getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url || 'Unknown';
        }
    }

    async function handleSave() {
        if (!password) return;
        isSaving = true;
        try {
            await onSave({ origin, username, password });
            onCancel();
        } finally {
            isSaving = false;
        }
    }

    function handleNever() {
        onNever(origin);
        onCancel();
    }

    function handleCancel() {
        onCancel();
    }
</script>

{#if visible}
    <div class="popup-toast">
        <!-- Header -->
        <div class="popup-header">
            <div class="popup-icon">
                <Key size={20} />
            </div>
            <div class="popup-title-group">
                <span class="popup-title">{isUpdate ? 'Update password' : 'Save password'} for</span>
                <span class="popup-domain">
                    <Globe size={12} />
                    {getDomain(origin)}
                </span>
            </div>
        </div>

        <!-- Body -->
        <div class="popup-body">
            <div class="field">
                <span class="field-label">Username</span>
                <span class="field-value">{username || '—'}</span>
            </div>
            <div class="field">
                <span class="field-label">Password</span>
                <div class="password-row">
                    <span class="field-value">{showPassword ? password : '••••••••'}</span>
                    <button type="button" class="toggle-btn" onclick={() => showPassword = !showPassword}>
                        {#if showPassword}
                            <EyeOff size={14} />
                        {:else}
                            <Eye size={14} />
                        {/if}
                    </button>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="popup-footer">
            <button type="button" class="btn btn-never" onclick={handleNever}>
                Never
            </button>
            <div class="btn-group">
                <button type="button" class="btn btn-cancel" onclick={handleCancel}>
                    <X size={16} />
                </button>
                <button
                    type="button"
                    class="btn btn-save"
                    onclick={handleSave}
                    disabled={isSaving || !password}
                >
                    {#if isSaving}
                        <RefreshCw size={14} class="animate-spin" />
                    {:else}
                        <Check size={14} />
                    {/if}
                    {isUpdate ? 'Update' : 'Save'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .popup-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;

        /* Compact card - not stretched horizontally */
        width: max-content;
        min-width: 320px;
        max-width: 400px;

        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        overflow: hidden;
    }

    @media (prefers-color-scheme: dark) {
        .popup-toast {
            background: #2d2d2d;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        }
    }

    :global(.dark) .popup-toast {
        background: #2d2d2d;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    /* Header */
    .popup-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: #f8f9fa;
        border-bottom: 1px solid #e8eaed;
    }

    @media (prefers-color-scheme: dark) {
        .popup-header {
            background: #333;
            border-bottom-color: #404040;
        }
    }

    :global(.dark) .popup-header {
        background: #333;
        border-bottom-color: #404040;
    }

    .popup-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: linear-gradient(135deg, #1a73e8, #4285f4);
        color: white;
        flex-shrink: 0;
    }

    .popup-title-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .popup-title {
        font-size: 12px;
        color: #5f6368;
    }

    .popup-domain {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        font-weight: 600;
        color: #202124;
    }

    @media (prefers-color-scheme: dark) {
        .popup-title {
            color: #9aa0a6;
        }
        .popup-domain {
            color: #e8eaed;
        }
    }

    :global(.dark) .popup-title {
        color: #9aa0a6;
    }
    :global(.dark) .popup-domain {
        color: #e8eaed;
    }

    /* Body */
    .popup-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
    }

    .field-label {
        font-size: 12px;
        color: #5f6368;
    }

    .field-value {
        font-size: 14px;
        color: #202124;
    }

    @media (prefers-color-scheme: dark) {
        .field-label {
            color: #9aa0a6;
        }
        .field-value {
            color: #e8eaed;
        }
    }

    :global(.dark) .field-label {
        color: #9aa0a6;
    }
    :global(.dark) .field-value {
        color: #e8eaed;
    }

    .password-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .toggle-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: none;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        color: #5f6368;
        transition: background 0.15s;
    }

    .toggle-btn:hover {
        background: #e8eaed;
    }

    @media (prefers-color-scheme: dark) {
        .toggle-btn {
            color: #9aa0a6;
        }
        .toggle-btn:hover {
            background: #404040;
        }
    }

    :global(.dark) .toggle-btn {
        color: #9aa0a6;
    }
    :global(.dark) .toggle-btn:hover {
        background: #404040;
    }

    /* Footer */
    .popup-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8f9fa;
        border-top: 1px solid #e8eaed;
    }

    @media (prefers-color-scheme: dark) {
        .popup-footer {
            background: #333;
            border-top-color: #404040;
        }
    }

    :global(.dark) .popup-footer {
        background: #333;
        border-top-color: #404040;
    }

    .btn-group {
        display: flex;
        gap: 6px;
    }

    .btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 7px 12px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
    }

    .btn-never {
        background: none;
        color: #5f6368;
        font-size: 12px;
    }

    .btn-never:hover {
        background: #e8eaed;
    }

    @media (prefers-color-scheme: dark) {
        .btn-never {
            color: #9aa0a6;
        }
        .btn-never:hover {
            background: #404040;
        }
    }

    :global(.dark) .btn-never {
        color: #9aa0a6;
    }
    :global(.dark) .btn-never:hover {
        background: #404040;
    }

    .btn-cancel {
        padding: 7px;
        background: none;
        color: #5f6368;
    }

    .btn-cancel:hover {
        background: #e8eaed;
    }

    @media (prefers-color-scheme: dark) {
        .btn-cancel {
            color: #9aa0a6;
        }
        .btn-cancel:hover {
            background: #404040;
        }
    }

    :global(.dark) .btn-cancel {
        color: #9aa0a6;
    }
    :global(.dark) .btn-cancel:hover {
        background: #404040;
    }

    .btn-save {
        background: #1a73e8;
        color: white;
    }

    .btn-save:hover {
        background: #1557b0;
    }

    .btn-save:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .animate-spin {
        animation: spin 1s linear infinite;
    }
</style>