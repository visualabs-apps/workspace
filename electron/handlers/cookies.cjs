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
            
            const targetSession = partition 
                ? session.fromPartition(partition)
                : session.defaultSession;
            
            // Helper function to generate proper cookie URL
            const getCookieUrl = (cookie) => {
                const protocol = cookie.secure ? 'https://' : 'http://';
                const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
                return protocol + domain;
            };
            
            await targetSession.cookies.set({
                url: getCookieUrl(cookie),
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                expirationDate: cookie.expirationDate,
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false,
                sameSite: cookie.sameSite || 'unspecified'
            });
            
            // Flush cookie store
            await targetSession.cookies.flushStore();
            console.log('🍪 Cookie set successfully');
            
            return { success: true };
        } catch (error) {
            console.error('set-cookie-to-partition error:', error);
            throw error;
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
