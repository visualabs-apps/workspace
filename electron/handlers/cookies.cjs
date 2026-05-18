const { ipcMain, session } = require('electron');

function registerCookieHandlers() {
    ipcMain.handle('get-cookies-from-partition', async (event, partition) => {
        try {
            
            const targetSession = partition 
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            const cookies = await targetSession.cookies.get({});
            
            return cookies;
        } catch (error) {
            console.error('get-cookies-from-partition error:', error);
            throw error;
        }
    });

    ipcMain.handle('set-cookie-to-partition', async (event, partition, cookie) => {
        try {
            
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
            // sameSite logic: if secure and no sameSite specified, use 'no_restriction' (SameSite=None)
            // otherwise use the provided value or 'unspecified'
            const sameSiteValue = cookie.sameSite && cookie.sameSite !== 'unspecified'
                ? cookie.sameSite
                : (cookie.secure ? 'no_restriction' : 'unspecified');

            const cookieData = {
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: String(cookie.value || ''), // Ensure value is string
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false,
                sameSite: sameSiteValue
            };
            
            // Add expiration if provided and valid
            if (cookie.expirationDate && !cookie.session) {
                // Convert to seconds if needed
                const expiration = cookie.expirationDate > 10000000000 
                    ? cookie.expirationDate / 1000 
                    : cookie.expirationDate;
                cookieData.expirationDate = expiration;
            }
            
            // Delete existing cookie first to avoid EXCLUDE_OVERWRITE_HTTP_ONLY error
            // (Electron refuses to overwrite an HttpOnly cookie unless we remove it first)
            const cookieUrl = getCookieUrl(cookie);
            try {
                await targetSession.cookies.remove(cookieUrl, cookie.name);
            } catch (e) {
                // Cookie doesn't exist yet — that's fine
            }

            await targetSession.cookies.set(cookieData);
            
            // Flush cookie store
            await targetSession.cookies.flushStore();
            
            return { success: true };
        } catch (error) {
            console.error('❌ set-cookie-to-partition error:', error.message);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-cookie-from-partition', async (event, partition, name, domain, path, secure) => {
        try {
            
            const targetSession = partition
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            // Clean domain (remove leading dot)
            const cleanDomain = domain.startsWith('.') ? domain.substring(1) : domain;
            
            // Determine protocol from the cookie's own secure flag
            // If secure flag is explicitly provided, use it; otherwise try both
            if (typeof secure === 'boolean') {
                const protocol = secure ? 'https://' : 'http://';
                const url = protocol + cleanDomain;
                try {
                    await targetSession.cookies.remove(url, name);
                } catch (removeError) {
                    // If the determined protocol fails, try the opposite
                    const fallbackProtocol = secure ? 'http://' : 'https://';
                    const fallbackUrl = fallbackProtocol + cleanDomain;
                    try {
                        await targetSession.cookies.remove(fallbackUrl, name);
                    } catch (fallbackError) {
                        console.warn('🍪 Cookie not found for deletion:', name, domain);
                    }
                }
            } else {
                // No secure flag provided - try both protocols
                const urls = [`https://${cleanDomain}`, `http://${cleanDomain}`];
                let deleted = false;
                
                for (const url of urls) {
                    try {
                        await targetSession.cookies.remove(url, name);
                        deleted = true;
                        break;
                    } catch (removeError) {
                        continue;
                    }
                }
                
                if (!deleted) {
                    console.warn('🍪 Cookie not found for deletion:', name, domain);
                }
            }
            
            // Flush cookie store
            await targetSession.cookies.flushStore();
            
            return { success: true };
        } catch (error) {
            console.error('delete-cookie-from-partition error:', error);
            throw error;
        }
    });
}

module.exports = { registerCookieHandlers };
