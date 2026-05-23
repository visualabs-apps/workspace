const { ipcMain, safeStorage } = require('electron');

// Initialize electron-store (lazy load to avoidance issues)
let Store;
let secureStore;

function getSecureStore() {
    if (!secureStore) {
        if (!Store) {
            Store = require('electron-store');
        }
        secureStore = new Store({ name: 'secure-storage' });
    }
    return secureStore;
}

function registerSafeStorageHandlers() {
    ipcMain.handle('safe-storage-set', async (event, key, value) => {
        try {
            if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
                throw new Error('Encryption not available');
            }
            const encrypted = safeStorage.encryptString(value);
            const store = getSecureStore();
            store.set(key, encrypted.toString('base64'));
            return { success: true };
        } catch (error) {
            console.error('safeStorage set error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('safe-storage-get', async (event, key) => {
        try {
            if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
                throw new Error('Encryption not available');
            }
            const store = getSecureStore();
            const encrypted = store.get(key);
            if (!encrypted) return { success: true, value: null };

            const buffer = Buffer.from(encrypted, 'base64');
            const decrypted = safeStorage.decryptString(buffer);
            return { success: true, value: decrypted };
        } catch (error) {
            console.error('safeStorage get error:', error);
            return { success: false, error: error.message, value: null };
        }
    });

    ipcMain.handle('safe-storage-remove', async (event, key) => {
        try {
            const store = getSecureStore();
            store.delete(key);
            return { success: true };
        } catch (error) {
            console.error('safeStorage remove error:', error);
            return { success: false, error: error.message };
        }
    });

    // Standalone encrypt (for passwords stored in passwords table)
    ipcMain.handle('safe-storage-encrypt', async (event, plainText) => {
        try {
            if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
                throw new Error('Encryption not available');
            }
            const encrypted = safeStorage.encryptString(plainText);
            return { success: true, value: encrypted.toString('base64') };
        } catch (error) {
            console.error('safeStorage encrypt error:', error);
            return { success: false, error: error.message, value: plainText };
        }
    });

    // Standalone decrypt (for passwords stored in passwords table)
    ipcMain.handle('safe-storage-decrypt', async (event, encryptedBase64) => {
        try {
            if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
                throw new Error('Encryption not available');
            }
            const buffer = Buffer.from(encryptedBase64, 'base64');
            const decrypted = safeStorage.decryptString(buffer);
            return { success: true, value: decrypted };
        } catch (error) {
            console.error('safeStorage decrypt error:', error);
            return { success: false, error: error.message, value: null };
        }
    });
}

module.exports = { registerSafeStorageHandlers, getSecureStore };
