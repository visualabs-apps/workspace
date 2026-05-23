/**
 * Password Store - Svelte State Management for Chrome-like Password Manager
 *
 * Provides reactive state management for password operations:
 *   - Load / save / delete credentials
 *   - Auto-fill detection and orchestration
 *   - Password generator
 *   - Password strength checking
 *   - "Never save" list management
 *   - Form detection state
 */

import { writable, derived, get } from 'svelte/store';

// ── Stores ──────────────────────────────────────────────

const passwordsStore = writable([]);
const isLoadingStore = writable(false);
const errorStore = writable(null);
const activeProfileIdStore = writable(null);

// Form detection state (for webview integration)
const formDetectionStore = writable({
    hasLoginForm: false,
    detectedOrigin: null,
    pendingCredential: null
});

// Auto-fill state
const autofillStore = writable({
    enabled: true,
    lastFilledOrigin: null,
    lastFilledAt: null
});

// Password generator state
const generatorStore = writable({
    length: 16,
    uppercase: true,
    numbers: true,
    symbols: true,
    lowercase: true,
    excludeChars: '',
    lastGenerated: null,
    lastStrength: null
});

// Save prompt state (shown when webview captures a login)
const savePromptStore = writable({
    visible: false,
    origin: '',
    username: '',
    password: '',
    title: '',
    url: '',
    isUpdate: false
});

// ── Password Store Class ────────────────────────────────

class PasswordStore {
    constructor() {
        this.passwords = passwordsStore;
        this.isLoading = isLoadingStore;
        this.error = errorStore;
        this.activeProfileId = activeProfileIdStore;
        this.formDetection = formDetectionStore;
        this.autofill = autofillStore;
        this.generator = generatorStore;
        this.savePrompt = savePromptStore;
    }

    // ── Profile ───────────────────────────────────────

    setActiveProfile(profileId) {
        activeProfileIdStore.set(profileId);
    }

    // ── Load ──────────────────────────────────────────

    async loadPasswords(profileId) {
        if (!profileId) {
            console.warn('[PasswordStore] No profileId provided');
            return;
        }

        isLoadingStore.set(true);
        errorStore.set(null);

        try {
            const result = await window.api.passwordManager.getAll(profileId);

            if (result.success) {
                passwordsStore.set(result.passwords || []);
            } else {
                errorStore.set(result.error || 'Failed to load passwords');
            }
        } catch (error) {
            console.error('[PasswordStore] Load error:', error);
            errorStore.set(error.message);
        } finally {
            isLoadingStore.set(false);
        }
    }

    // ── Save ──────────────────────────────────────────

    async saveCredential(credential) {
        const { profileId, origin, username, password, title, url, notes } = credential;

        try {
            const result = await window.api.passwordManager.save({
                profileId,
                origin,
                username,
                password,
                title: title || origin,
                url: url || origin,
                notes: notes || ''
            });

            if (result.success) {
                await this.loadPasswords(profileId);
                return { success: true, credentialId: result.credentialId, updated: result.updated };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[PasswordStore] Save error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Delete ────────────────────────────────────────

    async deleteCredential(credentialId, profileId) {
        try {
            const result = await window.api.passwordManager.delete(credentialId);

            if (result.success) {
                passwordsStore.update(list => list.filter(p => p.id !== credentialId));
                return { success: true };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('[PasswordStore] Delete error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Get Credentials for Domain ────────────────────

    async getCredentialsForDomain(profileId, origin) {
        try {
            const result = await window.api.passwordManager.getForDomain(profileId, origin);

            if (result.success) {
                return { success: true, credentials: result.credentials || [] };
            } else {
                return { success: false, error: result.error, credentials: [] };
            }
        } catch (error) {
            console.error('[PasswordStore] getCredentialsForDomain error:', error);
            return { success: false, error: error.message, credentials: [] };
        }
    }

    // ── Get Single Credential (decrypted) ─────────────

    async getCredential(credentialId) {
        try {
            const result = await window.api.passwordManager.getCredential(credentialId);
            return result;
        } catch (error) {
            console.error('[PasswordStore] getCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Update ────────────────────────────────────────

    async updatePassword(credentialId, newPassword) {
        try {
            return await window.api.passwordManager.updatePassword(credentialId, newPassword);
        } catch (error) {
            console.error('[PasswordStore] updatePassword error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateCredential(credentialId, data) {
        try {
            return await window.api.passwordManager.update(credentialId, data);
        } catch (error) {
            console.error('[PasswordStore] updateCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Exists Check ──────────────────────────────────

    async hasCredential(profileId, origin, username) {
        try {
            const result = await window.api.passwordManager.exists(profileId, origin, username);
            return result.exists || false;
        } catch (error) {
            return false;
        }
    }

    // ── Password Generator ────────────────────────────

    async generatePassword(options = {}) {
        try {
            const genOptions = {
                length: options.length || get(generatorStore).length,
                uppercase: options.uppercase !== undefined ? options.uppercase : get(generatorStore).uppercase,
                numbers: options.numbers !== undefined ? options.numbers : get(generatorStore).numbers,
                symbols: options.symbols !== undefined ? options.symbols : get(generatorStore).symbols,
                lowercase: options.lowercase !== undefined ? options.lowercase : get(generatorStore).lowercase,
                excludeChars: options.excludeChars || get(generatorStore).excludeChars
            };

            const result = await window.api.passwordManager.generate(genOptions);

            if (result.success) {
                generatorStore.update(state => ({
                    ...state,
                    lastGenerated: result.password,
                    lastStrength: result.strength
                }));
                return { success: true, password: result.password, strength: result.strength };
            }

            return { success: false, error: result.error };
        } catch (error) {
            console.error('[PasswordStore] generatePassword error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Password Strength ─────────────────────────────

    async checkStrength(password) {
        try {
            const result = await window.api.passwordManager.checkStrength(password);
            if (result.success) {
                return result.strength;
            }
            return { score: 0, label: 'Unknown', color: '#9ca3af', feedback: [] };
        } catch (error) {
            return { score: 0, label: 'Unknown', color: '#9ca3af', feedback: [] };
        }
    }

    // ── Never Save ────────────────────────────────────

    async neverSave(profileId, origin) {
        try {
            return await window.api.passwordManager.neverSave(profileId, origin);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async isNeverSave(profileId, origin) {
        try {
            const result = await window.api.passwordManager.isNeverSave(profileId, origin);
            return result.isNeverSave || false;
        } catch {
            return false;
        }
    }

    async removeNeverSave(profileId, origin) {
        try {
            return await window.api.passwordManager.removeNeverSave(profileId, origin);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ── Form Detection ────────────────────────────────

    setFormDetected(origin, hasLoginForm) {
        formDetectionStore.set({
            hasLoginForm,
            detectedOrigin: origin,
            pendingCredential: null
        });
    }

    setPendingCredential(credential) {
        formDetectionStore.update(state => ({
            ...state,
            pendingCredential: credential
        }));
    }

    clearPendingCredential() {
        formDetectionStore.update(state => ({
            ...state,
            pendingCredential: null
        }));
    }

    // ── Save Prompt ───────────────────────────────────

    showSavePrompt(data) {
        savePromptStore.set({
            visible: true,
            origin: data.origin || '',
            username: data.username || '',
            password: data.password || '',
            title: data.title || '',
            url: data.url || '',
            isUpdate: data.isUpdate || false
        });
    }

    hideSavePrompt() {
        savePromptStore.update(state => ({
            ...state,
            visible: false,
            password: ''
        }));
    }

    // ── Statistics ────────────────────────────────────

    async getStats(profileId) {
        try {
            return await window.api.passwordManager.getStats(profileId);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ── Search ────────────────────────────────────────

    searchPasswords(query) {
        const q = query.toLowerCase().trim();
        if (!q) return get(passwordsStore);

        return get(passwordsStore).filter(p =>
            p.title?.toLowerCase().includes(q) ||
            p.origin?.toLowerCase().includes(q) ||
            p.url?.toLowerCase().includes(q) ||
            p.username?.toLowerCase().includes(q)
        );
    }

    // ── Auto-fill Toggle ──────────────────────────────

    toggleAutofill(enabled) {
        autofillStore.update(state => ({ ...state, enabled }));
    }

    recordAutofill(origin) {
        autofillStore.set({
            enabled: true,
            lastFilledOrigin: origin,
            lastFilledAt: Date.now()
        });
    }
}

// Export singleton instance
export const passwordStore = new PasswordStore();

// Export stores for direct access
export {
    passwordsStore,
    isLoadingStore,
    errorStore,
    formDetectionStore,
    autofillStore,
    generatorStore,
    savePromptStore
};
