const { ipcMain, session } = require('electron');

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
}

module.exports = { registerCookieHandlers };
