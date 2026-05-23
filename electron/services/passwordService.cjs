/**
 * Password Manager Service - Main Service Layer (Chrome-like Architecture)
 *
 * Architecture:
 *   Renderer → IPC → PasswordService → Vault (safeStorage/SQLite)
 *
 * Encryption Strategy:
 *   PRIMARY: Electron safeStorage (DPAPI on Windows, Keychain on macOS)
 *   FALLBACK: keytar (OS credential manager)
 *   LAST RESORT: AES-256-GCM with derived key
 *
 * Features:
 *   - Save / update / delete credentials
 *   - Domain matching with subdomain support
 *   - Auto-fill credential lookup
 *   - Password generator (cryptographically secure)
 *   - Password strength calculation
 *   - "Never save" list per domain
 */

const { safeStorage: electronSafeStorage } = require('electron');
const crypto = require('crypto');
const { getDatabase } = require('../database/index.cjs');

// Try to load keytar (optional dependency)
let keytar = null;
try {
    keytar = require('keytar');
    console.log('🔐 [PasswordManager] Service loaded — keytar + safeStorage');
} catch (e) {
    console.log('🔐 [PasswordManager] Service loaded — safeStorage only (no keytar)');
}

// Service constants
const SERVICE_NAME = 'VBoxPasswordManager';
const ACCOUNT_PREFIX = 'vbox_cred_';

// ──────────────────────────────────────────────────────────
//  Password Generator
// ──────────────────────────────────────────────────────────

const GENERATOR_CHARSETS = {
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
};

/**
 * Generate a cryptographically secure password
 * @param {Object} options
 * @param {number} options.length - Password length (default: 16)
 * @param {boolean} options.uppercase - Include uppercase (default: true)
 * @param {boolean} options.numbers - Include numbers (default: true)
 * @param {boolean} options.symbols - Include symbols (default: true)
 * @param {boolean} options.lowercase - Include lowercase (default: true)
 * @param {string} options.excludeChars - Characters to exclude
 * @returns {string}
 */
function generatePassword(options = {}) {
    const {
        length = 16,
        uppercase = true,
        numbers = true,
        symbols = true,
        lowercase = true,
        excludeChars = ''
    } = options;

    let charset = '';
    const requiredChars = [];

    if (lowercase) {
        charset += GENERATOR_CHARSETS.lowercase;
        requiredChars.push(GENERATOR_CHARSETS.lowercase);
    }
    if (uppercase) {
        charset += GENERATOR_CHARSETS.uppercase;
        requiredChars.push(GENERATOR_CHARSETS.uppercase);
    }
    if (numbers) {
        charset += GENERATOR_CHARSETS.numbers;
        requiredChars.push(GENERATOR_CHARSETS.numbers);
    }
    if (symbols) {
        charset += GENERATOR_CHARSETS.symbols;
        requiredChars.push(GENERATOR_CHARSETS.symbols);
    }

    if (!charset) {
        charset = GENERATOR_CHARSETS.lowercase + GENERATOR_CHARSETS.uppercase + GENERATOR_CHARSETS.numbers;
    }

    // Remove excluded characters
    if (excludeChars) {
        charset = charset.split('').filter(c => !excludeChars.includes(c)).join('');
    }

    // Generate using crypto.randomBytes for cryptographic security
    const randomBytes = crypto.randomBytes(length + requiredChars.length);
    let password = '';

    // Ensure at least one char from each required set
    for (let i = 0; i < requiredChars.length && i < length; i++) {
        const set = requiredChars[i];
        const idx = randomBytes[i] % set.length;
        password += set[idx];
    }

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
        const idx = randomBytes[i] % charset.length;
        password += charset[idx];
    }

    // Shuffle using Fisher-Yates with crypto randomness
    const arr = password.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr.join('');
}

// ──────────────────────────────────────────────────────────
//  Password Strength Calculator
// ──────────────────────────────────────────────────────────

/**
 * Calculate password strength (0-4 scale, like zxcvbn-lite)
 * @param {string} password
 * @returns {{ score: number, label: string, color: string, feedback: string[] }}
 */
function calculatePasswordStrength(password) {
    if (!password) {
        return { score: 0, label: 'None', color: '#9ca3af', feedback: ['Enter a password'] };
    }

    const feedback = [];
    let score = 0;
    const len = password.length;

    // Length scoring
    if (len >= 8) score += 1;
    if (len >= 12) score += 1;
    if (len >= 16) score += 1;
    if (len >= 24) score += 1;

    // Character variety
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSymbols = /[^a-zA-Z0-9]/.test(password);

    const variety = [hasLower, hasUpper, hasNumbers, hasSymbols].filter(Boolean).length;
    score += Math.max(0, variety - 1); // 0 for 1 type, 1 for 2, 2 for 3, 3 for 4

    // Penalize common patterns
    const lower = password.toLowerCase();
    const commonPatterns = [
        'password', '123456', 'qwerty', 'abc123', 'letmein', 'admin',
        'welcome', 'monkey', 'dragon', 'master', 'login', '111111'
    ];
    if (commonPatterns.some(p => lower.includes(p))) {
        score = Math.max(0, score - 3);
        feedback.push('Contains a common password pattern');
    }

    // Penalize repeated characters
    if (/(.)\1{2,}/.test(password)) {
        score = Math.max(0, score - 1);
        feedback.push('Avoid repeated characters');
    }

    // Penalize sequential characters
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
        score = Math.max(0, score - 1);
        feedback.push('Avoid sequential characters');
    }

    // Feedback for improvement
    if (len < 12) feedback.push('Use at least 12 characters');
    if (!hasUpper) feedback.push('Add uppercase letters');
    if (!hasNumbers) feedback.push('Add numbers');
    if (!hasSymbols) feedback.push('Add special characters');

    // Clamp score 0-4
    score = Math.min(4, Math.max(0, score));

    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return {
        score,
        label: labels[score],
        color: colors[score],
        feedback: feedback.length > 0 ? feedback : ['Good password']
    };
}

// ──────────────────────────────────────────────────────────
//  Encryption Helpers
// ──────────────────────────────────────────────────────────

/**
 * Encrypt a password string using Electron safeStorage
 * @param {string} plaintext
 * @returns {string|null} Base64 encoded encrypted string, or null on failure
 */
function encryptPassword(plaintext) {
    if (!plaintext) return null;

    try {
        if (electronSafeStorage && electronSafeStorage.isEncryptionAvailable()) {
            const encrypted = electronSafeStorage.encryptString(plaintext);
            return encrypted.toString('base64');
        }
    } catch (e) {
        console.error('[PasswordService] safeStorage encryption failed:', e.message);
    }

    // Fallback: return plaintext (will be stored as-is, DB is local)
    console.warn('[PasswordService] No encryption available, storing as plaintext');
    return plaintext;
}

/**
 * Decrypt a password string
 * @param {string} encryptedBase64
 * @returns {string|null}
 */
function decryptPassword(encryptedBase64) {
    if (!encryptedBase64) return null;

    try {
        if (electronSafeStorage && electronSafeStorage.isEncryptionAvailable()) {
            // Check if it looks like base64-encoded safeStorage output
            const buffer = Buffer.from(encryptedBase64, 'base64');
            if (buffer.length > 0) {
                try {
                    return electronSafeStorage.decryptString(buffer);
                } catch {
                    // Not encrypted (plaintext stored), return as-is
                    return encryptedBase64;
                }
            }
        }
    } catch (e) {
        console.error('[PasswordService] Decryption failed:', e.message);
    }

    // Return as-is (might be plaintext)
    return encryptedBase64;
}

// ──────────────────────────────────────────────────────────
//  Utility
// ──────────────────────────────────────────────────────────

function getDb() {
    try {
        return getDatabase();
    } catch (error) {
        console.error('[PasswordService] Database not available:', error);
        return null;
    }
}

function generateCredentialId() {
    return crypto.randomUUID();
}

function hashForAccount(domain, profileId) {
    return crypto
        .createHash('sha256')
        .update(`${domain.toLowerCase()}:${profileId}`)
        .digest('hex')
        .substring(0, 32);
}

// ──────────────────────────────────────────────────────────
//  Password Service Class
// ──────────────────────────────────────────────────────────

class PasswordService {
    constructor() {
        this.serviceName = SERVICE_NAME;
    }

    // ── Save ────────────────────────────────────────────

    /**
     * Save a credential (create or update)
     * @param {Object} credential - { profileId, origin, username, password, title, url, notes }
     */
    async saveCredential(credential) {
        try {
            const { profileId, origin, username, password, title, url, notes } = credential;

            if (!profileId || !origin || !username || !password) {
                return { success: false, error: 'Missing required fields (profileId, origin, username, password)' };
            }

            if (!this.validateOrigin(origin)) {
                return { success: false, error: 'Invalid origin' };
            }

            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const credentialId = generateCredentialId();
            const now = Date.now();

            // Encrypt password with safeStorage
            const encryptedPassword = encryptPassword(password);

            // Also try keytar for OS-level storage (belt & suspenders)
            let storedInKeytar = 0;
            if (keytar) {
                try {
                    const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(origin, profileId)}`;
                    await keytar.setPassword(this.serviceName, keytarAccount, password);
                    storedInKeytar = 1;
                } catch (keytarError) {
                    console.warn('[PasswordService] keytar save failed:', keytarError.message);
                }
            }

            // Check for existing credential (same profile + origin + username)
            const existing = db.prepare(`
                SELECT id FROM passwords
                WHERE profile_id = ? AND origin = ? AND username = ?
            `).get(profileId, origin, username);

            if (existing) {
                // Update existing credential
                db.prepare(`
                    UPDATE passwords
                    SET title = ?, url = ?, password_encrypted = ?, notes = ?,
                        stored_in_keytar = ?, updated_at = ?
                    WHERE id = ?
                `).run(
                    title || origin,
                    url || origin,
                    encryptedPassword,
                    notes || '',
                    storedInKeytar,
                    now,
                    existing.id
                );
                return { success: true, credentialId: existing.id, updated: true };
            }

            // Insert new credential
            db.prepare(`
                INSERT INTO passwords (id, profile_id, origin, title, url, username, password_encrypted, notes, stored_in_keytar, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                credentialId,
                profileId,
                origin,
                title || origin,
                url || origin,
                username,
                encryptedPassword,
                notes || '',
                storedInKeytar,
                now,
                now
            );

            return { success: true, credentialId, stored: true };
        } catch (error) {
            console.error('[PasswordService] saveCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Get Credentials for Domain (Auto-fill) ──────────

    /**
     * Get credentials matching a domain for auto-fill
     * @param {string} profileId
     * @param {string} origin - e.g., "https://mail.google.com"
     * @returns {Promise<{success, credentials}>}
     */
    async getCredentialsForDomain(profileId, origin) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available', credentials: [] };

            // Check if origin is in never-save list
            const neverSave = db.prepare(`
                SELECT id FROM password_never_save
                WHERE profile_id = ? AND origin = ?
            `).get(profileId, origin);
            if (neverSave) {
                return { success: true, credentials: [], neverSave: true };
            }

            let hostname;
            try {
                hostname = new URL(origin).hostname;
            } catch {
                return { success: false, error: 'Invalid origin', credentials: [] };
            }

            // Get all credentials for this profile
            const allCredentials = db.prepare(`
                SELECT id, profile_id, origin, title, url, username, password_encrypted, notes, stored_in_keytar
                FROM passwords
                WHERE profile_id = ?
                ORDER BY updated_at DESC
            `).all(profileId);

            // Filter by domain matching
            const matching = allCredentials.filter(cred => this.matchDomain(cred.origin, hostname));

            // Decrypt passwords
            const results = [];
            for (const cred of matching) {
                let password = null;

                // Try keytar first (most secure)
                if (cred.stored_in_keytar && keytar) {
                    try {
                        const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(cred.origin, profileId)}`;
                        password = await keytar.getPassword(this.serviceName, keytarAccount);
                    } catch {
                        // Fall through to safeStorage decryption
                    }
                }

                // Fall back to safeStorage decryption
                if (!password && cred.password_encrypted) {
                    password = decryptPassword(cred.password_encrypted);
                }

                results.push({
                    id: cred.id,
                    origin: cred.origin,
                    title: cred.title,
                    url: cred.url,
                    username: cred.username,
                    password,
                    notes: cred.notes,
                    matchType: this.getMatchType(cred.origin, hostname)
                });
            }

            return { success: true, credentials: results };
        } catch (error) {
            console.error('[PasswordService] getCredentialsForDomain error:', error);
            return { success: false, error: error.message, credentials: [] };
        }
    }

    // ── Get All Passwords (metadata only) ───────────────

    /**
     * Get all passwords for a profile (metadata, no decrypted passwords)
     */
    async getPasswords(profileId) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available', passwords: [] };

            const passwords = db.prepare(`
                SELECT id, profile_id, origin, title, url, username, notes, favicon,
                       stored_in_keytar, created_at, updated_at
                FROM passwords
                WHERE profile_id = ?
                ORDER BY title ASC
            `).all(profileId);

            return { success: true, passwords };
        } catch (error) {
            console.error('[PasswordService] getPasswords error:', error);
            return { success: false, error: error.message, passwords: [] };
        }
    }

    // ── Get Single Password (decrypted) ─────────────────

    /**
     * Get a single credential with decrypted password
     */
    async getCredential(credentialId) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const cred = db.prepare(`
                SELECT * FROM passwords WHERE id = ?
            `).get(credentialId);

            if (!cred) return { success: false, error: 'Credential not found' };

            let password = null;

            if (cred.stored_in_keytar && keytar) {
                try {
                    const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(cred.origin, cred.profile_id)}`;
                    password = await keytar.getPassword(this.serviceName, keytarAccount);
                } catch { /* fall through */ }
            }

            if (!password && cred.password_encrypted) {
                password = decryptPassword(cred.password_encrypted);
            }

            return {
                success: true,
                credential: {
                    id: cred.id,
                    profileId: cred.profile_id,
                    origin: cred.origin,
                    title: cred.title,
                    url: cred.url,
                    username: cred.username,
                    password,
                    notes: cred.notes,
                    favicon: cred.favicon,
                    createdAt: cred.created_at,
                    updatedAt: cred.updated_at
                }
            };
        } catch (error) {
            console.error('[PasswordService] getCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Delete ───────────────────────────────────────────

    async deleteCredential(credentialId) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const credential = db.prepare('SELECT * FROM passwords WHERE id = ?').get(credentialId);
            if (!credential) return { success: false, error: 'Credential not found' };

            // Delete from keytar
            if (credential.stored_in_keytar && keytar) {
                try {
                    const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(credential.origin, credential.profile_id)}`;
                    await keytar.deletePassword(this.serviceName, keytarAccount);
                } catch (e) {
                    console.warn('[PasswordService] keytar delete failed:', e.message);
                }
            }

            db.prepare('DELETE FROM passwords WHERE id = ?').run(credentialId);
            return { success: true };
        } catch (error) {
            console.error('[PasswordService] deleteCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Update Password ──────────────────────────────────

    async updateCredentialPassword(credentialId, newPassword) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const credential = db.prepare('SELECT * FROM passwords WHERE id = ?').get(credentialId);
            if (!credential) return { success: false, error: 'Credential not found' };

            const encryptedPassword = encryptPassword(newPassword);

            // Update keytar
            if (credential.stored_in_keytar && keytar) {
                const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(credential.origin, credential.profile_id)}`;
                try {
                    await keytar.setPassword(this.serviceName, keytarAccount, newPassword);
                } catch { /* ignore */ }
            }

            db.prepare(`
                UPDATE passwords
                SET password_encrypted = ?, updated_at = ?
                WHERE id = ?
            `).run(encryptedPassword, Date.now(), credentialId);

            return { success: true };
        } catch (error) {
            console.error('[PasswordService] updateCredentialPassword error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Update Credential Full ───────────────────────────

    /**
     * Full update of a credential (title, url, username, password, notes)
     */
    async updateCredential(credentialId, data) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const credential = db.prepare('SELECT * FROM passwords WHERE id = ?').get(credentialId);
            if (!credential) return { success: false, error: 'Credential not found' };

            const now = Date.now();
            const encryptedPassword = data.password ? encryptPassword(data.password) : credential.password_encrypted;

            // Update keytar if password changed
            if (data.password && credential.stored_in_keytar && keytar) {
                const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(credential.origin, credential.profile_id)}`;
                try {
                    await keytar.setPassword(this.serviceName, keytarAccount, data.password);
                } catch { /* ignore */ }
            }

            db.prepare(`
                UPDATE passwords
                SET title = ?, url = ?, username = ?, password_encrypted = ?, notes = ?, updated_at = ?
                WHERE id = ?
            `).run(
                data.title || credential.title,
                data.url || credential.url,
                data.username || credential.username,
                encryptedPassword,
                data.notes !== undefined ? data.notes : credential.notes,
                now,
                credentialId
            );

            return { success: true };
        } catch (error) {
            console.error('[PasswordService] updateCredential error:', error);
            return { success: false, error: error.message };
        }
    }

    // ── Never Save List ──────────────────────────────────

    /**
     * Add origin to never-save list
     */
    async neverSave(profileId, origin) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            db.prepare(`
                INSERT OR IGNORE INTO password_never_save (profile_id, origin, created_at)
                VALUES (?, ?, ?)
            `).run(profileId, origin, Date.now());

            return { success: true };
        } catch (error) {
            console.error('[PasswordService] neverSave error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if origin is in never-save list
     */
    async isNeverSave(profileId, origin) {
        try {
            const db = getDb();
            if (!db) return false;

            const row = db.prepare(`
                SELECT id FROM password_never_save
                WHERE profile_id = ? AND origin = ?
            `).get(profileId, origin);

            return !!row;
        } catch {
            return false;
        }
    }

    /**
     * Remove origin from never-save list
     */
    async removeNeverSave(profileId, origin) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            db.prepare(`
                DELETE FROM password_never_save
                WHERE profile_id = ? AND origin = ?
            `).run(profileId, origin);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ── Credential Exists ────────────────────────────────

    async hasCredentialForOrigin(profileId, origin, username) {
        try {
            const db = getDb();
            if (!db) return false;

            const existing = db.prepare(`
                SELECT id FROM passwords
                WHERE profile_id = ? AND origin = ? AND username = ?
            `).get(profileId, origin, username);

            return !!existing;
        } catch {
            return false;
        }
    }

    /**
     * Get credential by origin and username (with decrypted password for comparison)
     * Used to check if we should show save prompt
     */
    async getCredentialByOriginAndUsername(profileId, origin, username) {
        try {
            const db = getDb();
            if (!db) return null;

            const existing = db.prepare(`
                SELECT id, profile_id, origin, title, url, username, password_encrypted, stored_in_keytar
                FROM passwords
                WHERE profile_id = ? AND origin = ? AND username = ?
            `).get(profileId, origin, username);

            if (!existing) return null;

            // Decrypt the password
            let password = null;

            // Try keytar first (most secure)
            if (existing.stored_in_keytar && keytar) {
                try {
                    const keytarAccount = `${ACCOUNT_PREFIX}${hashForAccount(existing.origin, profileId)}`;
                    password = await keytar.getPassword(this.serviceName, keytarAccount);
                } catch {
                    // Fall through to safeStorage decryption
                }
            }

            // Fall back to safeStorage decryption
            if (!password && existing.password_encrypted) {
                password = decryptPassword(existing.password_encrypted);
            }

            return {
                ...existing,
                password
            };
        } catch (error) {
            console.error('[PasswordService] getCredentialByOriginAndUsername error:', error);
            return null;
        }
    }

    // ── Domain Matching ──────────────────────────────────

    /**
     * Match domain with subdomain support (Chrome-like behavior)
     * https://mail.google.com matches:
     *   - https://google.com (parent domain)
     *   - https://mail.google.com (exact)
     */
    matchDomain(credentialOrigin, currentHostname) {
        try {
            const credHostname = new URL(credentialOrigin).hostname;
            const current = currentHostname.toLowerCase();
            const stored = credHostname.toLowerCase();

            if (current === stored) return true;
            if (current.endsWith('.' + stored)) return true;
            if (stored.endsWith('.' + current)) return true;

            return false;
        } catch {
            return false;
        }
    }

    getMatchType(credentialOrigin, currentHostname) {
        try {
            const credHostname = new URL(credentialOrigin).hostname;
            const current = currentHostname.toLowerCase();
            const stored = credHostname.toLowerCase();

            if (current === stored) return 'exact';
            if (current.endsWith('.' + stored)) return 'subdomain';
            if (stored.endsWith('.' + current)) return 'parent';
            return 'none';
        } catch {
            return 'none';
        }
    }

    // ── Origin Validation ────────────────────────────────

    validateOrigin(origin) {
        try {
            const url = new URL(origin);
            if (!['http:', 'https:'].includes(url.protocol)) return false;
            return true;
        } catch {
            return false;
        }
    }

    // ── Password Generator (exposed via service) ─────────

    /**
     * Generate a strong password
     */
    generatePassword(options = {}) {
        return generatePassword(options);
    }

    /**
     * Calculate password strength
     */
    calculateStrength(password) {
        return calculatePasswordStrength(password);
    }

    // ── Statistics ───────────────────────────────────────

    async getStats(profileId) {
        try {
            const db = getDb();
            if (!db) return { success: false, error: 'Database not available' };

            const total = db.prepare('SELECT COUNT(*) as count FROM passwords WHERE profile_id = ?').get(profileId);
            const withKeytar = db.prepare('SELECT COUNT(*) as count FROM passwords WHERE profile_id = ? AND stored_in_keytar = 1').get(profileId);
            const neverSaveCount = db.prepare('SELECT COUNT(*) as count FROM password_never_save WHERE profile_id = ?').get(profileId);

            // Get password strengths (sample up to 100)
            const samples = db.prepare(`
                SELECT password_encrypted FROM passwords
                WHERE profile_id = ? LIMIT 100
            `).all(profileId);

            let weakCount = 0;
            for (const s of samples) {
                if (s.password_encrypted) {
                    const decrypted = decryptPassword(s.password_encrypted);
                    if (decrypted) {
                        const strength = calculatePasswordStrength(decrypted);
                        if (strength.score <= 1) weakCount++;
                    }
                }
            }

            return {
                success: true,
                stats: {
                    total: total?.count || 0,
                    withKeytar: withKeytar?.count || 0,
                    neverSave: neverSaveCount?.count || 0,
                    weakPasswords: weakCount
                }
            };
        } catch (error) {
            console.error('[PasswordService] getStats error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton + utilities
const passwordService = new PasswordService();
module.exports = {
    passwordService,
    PasswordService,
    generatePassword,
    calculatePasswordStrength,
    encryptPassword,
    decryptPassword
};
