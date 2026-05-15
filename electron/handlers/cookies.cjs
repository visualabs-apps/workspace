const { ipcMain, session } = require('electron');
const crypto = require('crypto');

function registerCookieHandlers() {
    ipcMain.handle('get-cookies-from-partition', async (event, partition) => {
        try {
            console.log('🍪 Getting cookies from partition:', partition);
            
            const targetSession = partition 
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            const cookies = await targetSession.cookies.get({});
            console.log('🍪 Found', cookies.length, 'cookies');
            
            return cookies;
        } catch (error) {
            console.error('get-cookies-from-partition error:', error);
            throw error;
        }
    });

    ipcMain.handle('set-cookie-to-partition', async (event, partition, cookie) => {
        try {
            console.log('🍪 Setting cookie to partition:', partition, cookie.name);
            
            // Validate required fields
            if (!cookie.name || typeof cookie.name !== 'string') {
                throw new Error('Cookie must have a valid name');
            }
            
            if (cookie.value === undefined || cookie.value === null) {
                console.warn('⚠️ Cookie has no value, using empty string:', cookie.name);
                cookie.value = '';
            }
            
            if (!cookie.domain || typeof cookie.domain !== 'string') {
                throw new Error('Cookie must have a valid domain');
            }
            
            const targetSession = partition 
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            // Helper function to generate proper cookie URL
            const getCookieUrl = (cookie) => {
                const protocol = cookie.secure ? 'https://' : 'http://';
                const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                return protocol + domain;
            };
            
            // Prepare cookie data with defaults
            const cookieData = {
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: String(cookie.value || ''), // Ensure value is string
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false,
                sameSite: cookie.sameSite || 'unspecified'
            };
            
            // Add expiration if provided and valid
            if (cookie.expirationDate && !cookie.session) {
                // Convert to seconds if needed
                const expiration = cookie.expirationDate > 10000000000 
                    ? cookie.expirationDate / 1000 
                    : cookie.expirationDate;
                cookieData.expirationDate = expiration;
            }
            
            await targetSession.cookies.set(cookieData);
            
            // Flush cookie store
            await targetSession.cookies.flushStore();
            console.log('🍪 Cookie set successfully:', cookie.name);
            
            return { success: true };
        } catch (error) {
            console.error('❌ set-cookie-to-partition error:', error.message);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-cookie-from-partition', async (event, partition, name, domain, path) => {
        try {
            console.log('🍪 Deleting cookie from partition:', partition, name);
            
            const targetSession = partition 
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            // Helper function to generate proper cookie URL
            const protocol = 'https://';
            const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
            const url = protocol + cleanDomain;
            
            await targetSession.cookies.remove(url, name);
            
            // Flush cookie store
            await targetSession.cookies.flushStore();
            console.log('🍪 Cookie deleted successfully');
            
            return { success: true };
        } catch (error) {
            console.error('delete-cookie-from-partition error:', error);
            throw error;
        }
    });
    // Decrypt Cookie-Editor encrypted export (AES-256-GCM)
    ipcMain.handle('decrypt-cookie-export', async (event, encryptedDataBase64, password) => {
        try {
            const raw = Buffer.from(encryptedDataBase64, 'base64');

            // Cookie-Editor format: salt(16 bytes) + iv(12 bytes) + ciphertext + authTag(16 bytes)
            if (raw.length < 44) { // 16 + 12 + 16 minimum
                return { success: false, error: 'Encrypted data is too short or corrupted' };
            }

            const salt = raw.subarray(0, 16);
            const iv = raw.subarray(16, 28);
            const authTag = raw.subarray(raw.length - 16);
            const ciphertext = raw.subarray(28, raw.length - 16);

            // Derive key using PBKDF2 (same as Cookie-Editor: 100000 iterations, SHA-256)
            const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

            // Decrypt using AES-256-GCM
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            let decrypted;
            try {
                decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            } catch (decipherError) {
                return { success: false, error: 'Wrong password or corrupted data' };
            }

            const cookies = JSON.parse(decrypted.toString('utf8'));
            return { success: true, cookies };
        } catch (error) {
            console.error('decrypt-cookie-export error:', error.message);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { registerCookieHandlers };
