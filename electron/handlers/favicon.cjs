const { ipcMain, net } = require('electron');
const { URL } = require('url');
const { getDatabase } = require('../database/index.cjs');

// Helper to fetch using Electron's net module (handles redirects, proper UA)
async function fetchIconWithNet(iconUrl) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        const request = net.request({ url: iconUrl, redirect: 'follow' });
        
        request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        request.on('response', (response) => {
            if (response.statusCode !== 200) {
                clearTimeout(timeout);
                reject(new Error(`Status ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                clearTimeout(timeout);
                resolve(Buffer.concat(chunks));
            });
            response.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        request.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
        
        request.end();
    });
}

function registerFaviconHandler() {
    ipcMain.handle('get-favicon', async (event, args) => {
        let requestUrl, exactIconUrl;
        
        if (typeof args === 'string') {
            requestUrl = args;
        } else if (args && typeof args === 'object') {
            requestUrl = args.url;
            exactIconUrl = args.exactIconUrl;
        }
        
        // If no url but exactIconUrl exists, we can extract a faux requestUrl
        if (!requestUrl && exactIconUrl) {
            requestUrl = exactIconUrl;
        }
        
        if (!requestUrl) return null;
        
        console.log(`[Favicon] ------------------------------------------------`);
        console.log(`[Favicon] Request for URL: ${requestUrl}`);
        if (exactIconUrl) {
            console.log(`[Favicon] Provided Exact Icon: ${exactIconUrl.substring(0, 100)}...`);
        }
        
        const db = getDatabase();
        
        try {
            // Extract domain from URL
            let domain;
            try {
                const urlObj = new URL(requestUrl);
                domain = urlObj.hostname;
            } catch {
                domain = requestUrl.replace(/^https?:\/\//, '').split('/')[0];
            }
            
            // TTL: 7 days
            const TTL = 7 * 24 * 60 * 60 * 1000;
            
            // 1. Check cache in SQLite
            if (db) {
                const cached = db.prepare('SELECT icon, updated_at FROM favicons WHERE domain = ?').get(domain);
                
                if (cached && (Date.now() - cached.updated_at < TTL)) {
                    // Return cached favicon as base64
                    const iconBuf = cached.icon;
                    if (iconBuf && iconBuf.length > 0) {
                        console.log(`[Favicon] ✅ Loaded from SQLite cache for domain: ${domain}`);
                        let mime = 'image/x-icon';
                        if (iconBuf[0] === 0x89 && iconBuf[1] === 0x50) {
                            mime = 'image/png';
                        } else if (iconBuf[0] === 0x47 && iconBuf[1] === 0x49) {
                            mime = 'image/gif';
                        } else if (iconBuf.slice(0, 100).toString('utf8').toLowerCase().includes('<svg')) {
                            mime = 'image/svg+xml';
                        }
                        return `data:${mime};base64,${iconBuf.toString('base64')}`;
                    }
                }
            }
            
            let iconBuffer = null;
            
            // 2. Try the exactIconUrl first if provided (from page-favicon-updated)
            if (exactIconUrl && !exactIconUrl.startsWith('data:')) {
                try {
                    iconBuffer = await fetchIconWithNet(exactIconUrl);
                    console.log(`[Favicon] ✅ Successfully fetched exactIconUrl from network`);
                } catch (e) {
                    console.log(`[Favicon] ❌ Failed to fetch exactIconUrl: ${e.message}`);
                }
            }
            
            // 3. Try to fetch favicon.ico directly
            if (!iconBuffer) {
                try {
                    iconBuffer = await fetchIconWithNet(`https://${domain}/favicon.ico`);
                    console.log(`[Favicon] ✅ Successfully fetched fallback favicon.ico`);
                } catch (error) {
                    console.log(`[Favicon] ❌ Failed to fetch fallback favicon.ico`);
                }
            }
            
            // 4. Fallback to Google favicon service
            if (!iconBuffer) {
                try {
                    iconBuffer = await fetchIconWithNet(`https://www.google.com/s2/favicons?domain=${domain}&sz=32`);
                } catch (error) {
                    // Fall through
                }
            }
            
            // 5. If still no icon, return null
            if (!iconBuffer || iconBuffer.length === 0) {
                console.log(`[Favicon] ❌ No favicon found at all for ${domain}`);
                return null;
            }
            
            // 6. Save to SQLite cache
            if (db) {
                try {
                    const stmt = db.prepare(`
                        INSERT OR REPLACE INTO favicons (domain, icon, updated_at)
                        VALUES (?, ?, ?)
                    `);
                    stmt.run(domain, iconBuffer, Date.now());
                } catch (error) {
                    console.error('Failed to cache favicon:', error);
                }
            }
            
            // 7. Return as base64 data URI
            let mimeType = 'image/x-icon';
            if (iconBuffer[0] === 0x89 && iconBuffer[1] === 0x50) {
                mimeType = 'image/png';
            } else if (iconBuffer[0] === 0x47 && iconBuffer[1] === 0x49) {
                mimeType = 'image/gif';
            } else if (iconBuffer.slice(0, 100).toString('utf8').toLowerCase().includes('<svg')) {
                mimeType = 'image/svg+xml';
            }
            return `data:${mimeType};base64,${iconBuffer.toString('base64')}`;
            
        } catch (error) {
            console.error('Favicon fetch error:', error);
            return null;
        }
    });
}

module.exports = { registerFaviconHandler };
