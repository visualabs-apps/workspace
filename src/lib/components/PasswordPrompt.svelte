<script>
    /**
     * Password Prompt Component - Chrome-like "Save password?" bar
     *
     * Shows a floating bar when:
     *   - User logs in and "Save password?" prompt appears
     *   - User wants to update an existing password
     *   - Multiple accounts exist for a domain (account picker)
     *
     * Chrome-like UX:
     *   - Slides down from top of page
     *   - Shows key icon + domain
     *   - Save / Never / Dismiss actions
     *   - Password strength indicator
     */

    import { Key, Check, X, RefreshCw, Eye, EyeOff, Shield, AlertTriangle } from "lucide-svelte";
    import { onMount } from "svelte";

    let { visible = false, onSave, onNever, onCancel } = $props();

    // Prompt data
    let origin = $state('');
    let username = $state('');
    let password = $state('');
    let title = $state('');
    let showPassword = $state(false);
    let isSaving = $state(false);
    let passwordStrength = $state(null);

    // Available credentials for this origin
    let existingCredentials = $state([]);
    let selectedCredential = $state(null);
    let mode = $state('new'); // 'new', 'update', 'select'

    // Animation
    let isVisible = $state(false);

    /**
     * Show prompt with data
     */
    function show(data) {
        if (!data) return;

        origin = data.origin || '';
        username = data.username || '';
        password = data.password || '';
        title = data.title || '';
        existingCredentials = data.existingCredentials || [];
        selectedCredential = null;

        // Determine mode
        if (existingCredentials.length > 0) {
            const exactMatch = existingCredentials.find(c =>
                c.username === username
            );
            if (exactMatch) {
                mode = 'update';
                selectedCredential = exactMatch;
            } else {
                mode = 'select';
            }
        } else {
            mode = 'new';
        }

        // Check password strength
        checkPasswordStrength(password);

        visible = true;
        // Trigger animation
        requestAnimationFrame(() => { isVisible = true; });
    }

    /**
     * Hide prompt with animation
     */
    function hide() {
        isVisible = false;
        setTimeout(() => {
            visible = false;
            password = '';
            showPassword = false;
            passwordStrength = null;
        }, 200);
    }

    /**
     * Check password strength
     */
    async function checkPasswordStrength(pwd) {
        if (!pwd || !window.api?.passwordManager?.checkStrength) {
            passwordStrength = null;
            return;
        }
        try {
            passwordStrength = await window.api.passwordManager.checkStrength(pwd);
        } catch {
            passwordStrength = null;
        }
    }

    /**
     * Handle save action
     */
    async function handleSave() {
        if (!password) return;

        isSaving = true;
        try {
            await onSave({
                origin,
                username,
                password,
                title,
                credentialId: selectedCredential?.id
            });
            hide();
        } finally {
            isSaving = false;
        }
    }

    /**
     * Handle "Never save for this site" action
     */
    function handleNever() {
        onNever?.(origin);
        hide();
    }

    /**
     * Handle cancel/dismiss
     */
    function handleCancel() {
        onCancel?.();
        hide();
    }

    /**
     * Select existing credential for update
     */
    function selectCredential(cred) {
        selectedCredential = cred;
        username = cred.username;
        mode = 'update';
    }

    /**
     * Extract domain from origin
     */
    function getDomain(origin) {
        try {
            return new URL(origin).hostname;
        } catch {
            return origin;
        }
    }

    /**
     * Get strength bar width percentage
     */
    function getStrengthWidth(score) {
        return ((score || 0) + 1) * 20;
    }

    // Expose show method globally
    onMount(() => {
        if (typeof window !== 'undefined') {
            window.showPasswordPrompt = show;
        }
    });

    export { show, hide };
</script>

{#if visible}
    <!-- Chrome-like floating bar -->
    <div class="password-prompt-overlay" class:visible={isVisible}>
        <div class="password-prompt-bar">
            <!-- Left side: Key icon and domain -->
            <div class="prompt-left">
                <div class="prompt-icon">
                    <Key size={18} />
                </div>
                <div class="prompt-info">
                    <span class="prompt-title">
                        {#if mode === 'update'}
                            Update password for
                        {:else}
                            Save password for
                        {/if}
                    </span>
                    <span class="prompt-origin">{getDomain(origin)}</span>
                </div>
            </div>

            <!-- Center: Credential preview -->
            {#if mode === 'new' || mode === 'update'}
                <div class="prompt-credentials">
                    <div class="credential-field">
                        <span class="field-label">Username</span>
                        <span class="field-value">{username || '—'}</span>
                    </div>
                    <div class="credential-field">
                        <span class="field-label">Password</span>
                        <div class="password-value">
                            {#if showPassword}
                                <span class="field-value">{password}</span>
                            {:else}
                                <span class="field-value dots">••••••••</span>
                            {/if}
                            <button
                                type="button"
                                class="toggle-password"
                                onclick={() => showPassword = !showPassword}
                            >
                                {#if showPassword}
                                    <EyeOff size={14} />
                                {:else}
                                    <Eye size={14} />
                                {/if}
                            </button>
                        </div>
                        <!-- Password strength indicator -->
                        {#if passwordStrength}
                            <div class="strength-bar-container">
                                <div class="strength-bar">
                                    <div
                                        class="strength-bar-fill"
                                        style="width: {getStrengthWidth(passwordStrength.score)}%; background-color: {passwordStrength.color};"
                                    ></div>
                                </div>
                                <span class="strength-label" style="color: {passwordStrength.color}">
                                    {passwordStrength.label}
                                </span>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Right side: Actions -->
            <div class="prompt-actions">
                <button
                    type="button"
                    class="action-btn action-cancel"
                    onclick={handleCancel}
                    title="Dismiss"
                >
                    <X size={16} />
                </button>
                <button
                    type="button"
                    class="action-btn action-never"
                    onclick={handleNever}
                    title="Never save for this site"
                >
                    Never
                </button>
                <button
                    type="button"
                    class="action-btn action-save"
                    onclick={handleSave}
                    disabled={isSaving || !password}
                >
                    {#if isSaving}
                        <RefreshCw size={14} class="animate-spin" />
                        Saving...
                    {:else}
                        <Check size={14} />
                        {mode === 'update' ? 'Update' : 'Save'}
                    {/if}
                </button>
            </div>
        </div>

        <!-- Credential selector (if multiple accounts) -->
        {#if mode === 'select' && existingCredentials.length > 0}
            <div class="credential-selector">
                <span class="selector-label">Select account:</span>
                <div class="credential-list">
                    {#each existingCredentials as cred}
                        <button
                            type="button"
                            class="credential-item {selectedCredential?.id === cred.id ? 'selected' : ''}"
                            onclick={() => selectCredential(cred)}
                        >
                            <div class="cred-info">
                                <span class="cred-title">{cred.title}</span>
                                <span class="cred-username">{cred.username}</span>
                            </div>
                        </button>
                    {/each}
                    <button
                        type="button"
                        class="credential-item credential-new"
                        onclick={() => { mode = 'new'; selectedCredential = null; }}
                    >
                        <Key size={14} />
                        Save a new password
                    </button>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .password-prompt-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transform: translateY(-100%);
        transition: transform 0.2s ease-out;
    }

    
    .password-prompt-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 16px;
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        min-height: 48px;
    }

    @media (prefers-color-scheme: dark) {
        .password-prompt-bar {
            background: #2d2d2d;
            border-bottom-color: #404040;
        }
    }

    .prompt-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
    }

    .prompt-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f5f5f5;
        color: #666;
    }

    @media (prefers-color-scheme: dark) {
        .prompt-icon {
            background: #404040;
            color: #aaa;
        }
    }

    .prompt-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .prompt-title {
        font-size: 12px;
        color: #666;
    }

    @media (prefers-color-scheme: dark) {
        .prompt-title { color: #999; }
    }

    .prompt-origin {
        font-size: 14px;
        font-weight: 500;
        color: #333;
    }

    @media (prefers-color-scheme: dark) {
        .prompt-origin { color: #e0e0e0; }
    }

    .prompt-credentials {
        display: flex;
        gap: 24px;
        flex: 1;
        justify-content: center;
    }

    .credential-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .field-label {
        font-size: 11px;
        color: #999;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .field-value {
        font-size: 14px;
        color: #333;
    }

    .field-value.dots {
        color: #666;
        letter-spacing: 2px;
    }

    @media (prefers-color-scheme: dark) {
        .field-value { color: #e0e0e0; }
        .field-value.dots { color: #888; }
    }

    .password-value {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .toggle-password {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        border-radius: 4px;
    }

    .toggle-password:hover { background: #f0f0f0; }

    @media (prefers-color-scheme: dark) {
        .toggle-password { color: #aaa; }
        .toggle-password:hover { background: #404040; }
    }

    /* Password strength bar */
    .strength-bar-container {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
    }

    .strength-bar {
        flex: 1;
        height: 3px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
        max-width: 80px;
    }

    .strength-bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease, background-color 0.3s ease;
    }

    .strength-label {
        font-size: 10px;
        font-weight: 500;
    }

    .prompt-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
    }

    .action-cancel {
        padding: 6px;
        background: transparent;
        color: #666;
    }

    .action-cancel:hover { background: #f0f0f0; }

    @media (prefers-color-scheme: dark) {
        .action-cancel { color: #aaa; }
        .action-cancel:hover { background: #404040; }
    }

    .action-never {
        background: transparent;
        color: #666;
    }

    .action-never:hover { background: #f0f0f0; }

    @media (prefers-color-scheme: dark) {
        .action-never { color: #aaa; }
        .action-never:hover { background: #404040; }
    }

    .action-save {
        background: #4285f4;
        color: white;
    }

    .action-save:hover { background: #3367d6; }

    .action-save:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .animate-spin { animation: spin 1s linear infinite; }

    .credential-selector {
        padding: 12px 16px;
        background: #fafafa;
        border-bottom: 1px solid #e0e0e0;
    }

    @media (prefers-color-scheme: dark) {
        .credential-selector {
            background: #252525;
            border-bottom-color: #404040;
        }
    }

    .selector-label {
        font-size: 12px;
        color: #666;
        display: block;
        margin-bottom: 8px;
    }

    @media (prefers-color-scheme: dark) {
        .selector-label { color: #999; }
    }

    .credential-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .credential-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
    }

    .credential-item:hover { border-color: #4285f4; }

    .credential-item.selected {
        border-color: #4285f4;
        background: #e8f0fe;
    }

    @media (prefers-color-scheme: dark) {
        .credential-item {
            background: #333;
            border-color: #404040;
        }
        .credential-item:hover { border-color: #4285f4; }
        .credential-item.selected { background: #1a3a5c; }
    }

    .cred-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .cred-title {
        font-size: 13px;
        font-weight: 500;
        color: #333;
    }

    @media (prefers-color-scheme: dark) {
        .cred-title { color: #e0e0e0; }
    }

    .cred-username {
        font-size: 12px;
        color: #666;
    }

    @media (prefers-color-scheme: dark) {
        .cred-username { color: #888; }
    }

    .credential-new {
        color: #4285f4;
        border-style: dashed;
    }

    .credential-new:hover { background: #e8f0fe; }

    @media (prefers-color-scheme: dark) {
        .credential-new { color: #8ab4f8; }
        .credential-new:hover { background: #1a3a5c; }
    }
</style>
