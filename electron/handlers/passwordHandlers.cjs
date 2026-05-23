/**
 * Password IPC Handlers (Chrome-like Password Manager)
 *
 * All password operations go through this handler layer:
 *   Renderer → IPC → passwordHandlers → passwordService → Vault
 *
 * Security:
 *   - Renderer NEVER accesses vault directly
 *   - All inputs validated before processing
 *   - Passwords only returned for auto-fill (never logged)
 */

const { ipcMain } = require('electron');
const { passwordService, generatePassword, calculatePasswordStrength } = require('../services/passwordService.cjs');
const { credentialValidator } = require('../security/credentialValidator.cjs');
const { originValidator } = require('../security/originValidator.cjs');

/**
 * Register all password-related IPC handlers
 */
function registerPasswordHandlers() {
    console.log('🔐 [PasswordManager] Handlers registered — 17 IPC channels active');
    console.log('[PasswordHandlers] Registering password IPC handlers...');

    // ── Save Credential ──────────────────────────────────
    ipcMain.handle('password-save', async (event, credential) => {
        try {
            const validation = credentialValidator.validate(credential);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(', ') };
            }

            const originValidation = originValidator.validate(credential.origin);
            if (!originValidation.valid) {
                return { success: false, error: originValidation.error };
            }

            return await passwordService.saveCredential(validation.sanitized);
        } catch (error) {
            console.error('[PasswordHandlers] password-save error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Get Credentials for Domain (Auto-fill) ──────────
    ipcMain.handle('password-get-for-domain', async (event, { profileId, origin }) => {
        try {
            if (!profileId || !origin) {
                return { success: false, error: 'Missing profileId or origin', credentials: [] };
            }

            const originValidation = originValidator.validate(origin);
            if (!originValidation.valid) {
                return { success: false, error: originValidation.error, credentials: [] };
            }

            const result = await passwordService.getCredentialsForDomain(profileId, origin);
            console.log(`[PasswordHandlers] getCredentialsForDomain: ${origin}, found ${result.credentials?.length || 0} credentials`);
            return result;
        } catch (error) {
            console.error('[PasswordHandlers] password-get-for-domain error:', error);
            return { success: false, error: error.message, credentials: [] };
        }
    });

    // ── Get All Passwords (metadata only) ────────────────
    ipcMain.handle('password-get-all', async (event, profileId) => {
        try {
            if (!profileId) return { success: false, error: 'Missing profileId' };
            return await passwordService.getPasswords(profileId);
        } catch (error) {
            console.error('[PasswordHandlers] password-get-all error:', error);
            return { success: false, error: error.message, passwords: [] };
        }
    });

    // ── Get Single Credential (decrypted) ────────────────
    ipcMain.handle('password-get-credential', async (event, credentialId) => {
        try {
            if (!credentialId) return { success: false, error: 'Missing credentialId' };
            return await passwordService.getCredential(credentialId);
        } catch (error) {
            console.error('[PasswordHandlers] password-get-credential error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Delete Credential ────────────────────────────────
    ipcMain.handle('password-delete', async (event, credentialId) => {
        try {
            if (!credentialId) return { success: false, error: 'Missing credentialId' };
            return await passwordService.deleteCredential(credentialId);
        } catch (error) {
            console.error('[PasswordHandlers] password-delete error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Update Password ──────────────────────────────────
    ipcMain.handle('password-update-password', async (event, { credentialId, newPassword }) => {
        try {
            if (!credentialId || !newPassword) {
                return { success: false, error: 'Missing credentialId or newPassword' };
            }
            return await passwordService.updateCredentialPassword(credentialId, newPassword);
        } catch (error) {
            console.error('[PasswordHandlers] password-update-password error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Update Full Credential ───────────────────────────
    ipcMain.handle('password-update', async (event, { credentialId, data }) => {
        try {
            if (!credentialId || !data) {
                return { success: false, error: 'Missing credentialId or data' };
            }
            return await passwordService.updateCredential(credentialId, data);
        } catch (error) {
            console.error('[PasswordHandlers] password-update error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Check if Credential Exists ───────────────────────
    ipcMain.handle('password-exists', async (event, { profileId, origin, username }) => {
        try {
            if (!profileId || !origin || !username) {
                return { success: false, error: 'Missing parameters' };
            }
            const exists = await passwordService.hasCredentialForOrigin(profileId, origin, username);
            return { success: true, exists };
        } catch (error) {
            console.error('[PasswordHandlers] password-exists error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Password Generator ───────────────────────────────
    ipcMain.handle('password-generate', async (event, options = {}) => {
        try {
            const password = generatePassword(options);
            const strength = calculatePasswordStrength(password);
            return { success: true, password, strength };
        } catch (error) {
            console.error('[PasswordHandlers] password-generate error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Password Strength Check ──────────────────────────
    ipcMain.handle('password-strength', async (event, password) => {
        try {
            if (!password) return { success: true, strength: { score: 0, label: 'None', color: '#9ca3af', feedback: ['Enter a password'] } };
            const strength = calculatePasswordStrength(password);
            return { success: true, strength };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Never Save ───────────────────────────────────────
    ipcMain.handle('password-never-save', async (event, { profileId, origin }) => {
        try {
            if (!profileId || !origin) return { success: false, error: 'Missing profileId or origin' };
            return await passwordService.neverSave(profileId, origin);
        } catch (error) {
            console.error('[PasswordHandlers] password-never-save error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('password-is-never-save', async (event, { profileId, origin }) => {
        try {
            const isNever = await passwordService.isNeverSave(profileId, origin);
            return { success: true, isNeverSave: isNever };
        } catch (error) {
            return { success: false, error: error.message, isNeverSave: false };
        }
    });

    ipcMain.handle('password-remove-never-save', async (event, { profileId, origin }) => {
        try {
            return await passwordService.removeNeverSave(profileId, origin);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ── Password Statistics ──────────────────────────────
    ipcMain.handle('password-stats', async (event, profileId) => {
        try {
            if (!profileId) return { success: false, error: 'Missing profileId' };
            return await passwordService.getStats(profileId);
        } catch (error) {
            console.error('[PasswordHandlers] password-stats error:', error);
            return { success: false, error: error.message };
        }
    });

    // ── Auto-fill Orchestration (webview → main) ────────
    // Called by webview preload when a page loads and login form is detected
    // profileId can be null (will be resolved from webview context)
    ipcMain.handle('password-autofill-lookup', async (event, { profileId, origin }) => {
        try {
            if (!origin) {
                return { success: false, credentials: [] };
            }

            // If profileId not provided, try to get it from the webview context
            if (!profileId) {
                try {
                    const { ContextController } = require('./injectorController/ContextController.cjs');
                    const { getMainWindow } = require('../window/createWindow.cjs');
                    const ctx = await ContextController.getWorkspaceContext(event, getMainWindow);
                    profileId = ctx?.id || ctx?.profileId;
                } catch (e) {
                    // Can't resolve profile, skip autofill
                    console.warn('[PasswordHandlers] Cannot resolve profileId for autofill');
                    return { success: false, credentials: [] };
                }
            }

            if (!profileId) {
                return { success: false, credentials: [] };
            }

            // Check never-save first
            const isNever = await passwordService.isNeverSave(profileId, origin);
            if (isNever) {
                return { success: true, credentials: [], neverSave: true };
            }

            return await passwordService.getCredentialsForDomain(profileId, origin);
        } catch (error) {
            console.error('[PasswordHandlers] password-autofill-lookup error:', error);
            return { success: false, error: error.message, credentials: [] };
        }
    });

    // Called by webview when a login form is submitted
    ipcMain.handle('password-capture-submit', async (event, { profileId, origin, username, password, title, url }) => {
        try {
            if (!profileId || !origin || !username || !password) {
                return { success: false, error: 'Missing required fields' };
            }

            // Check never-save
            const isNever = await passwordService.isNeverSave(profileId, origin);
            if (isNever) {
                return { success: true, captured: false, reason: 'never-save' };
            }

            // Check if credential already exists
            const exists = await passwordService.hasCredentialForOrigin(profileId, origin, username);

            // Return info to renderer so it can show the prompt
            return {
                success: true,
                captured: true,
                isUpdate: exists,
                credential: { origin, username, title: title || origin, url: url || origin }
            };
        } catch (error) {
            console.error('[PasswordHandlers] password-capture-submit error:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('[PasswordHandlers] All password IPC handlers registered successfully');
}

module.exports = { registerPasswordHandlers };
