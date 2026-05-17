const { ipcMain } = require('electron');
const https = require('https');
const { URL } = require('url');
const { getDatabase } = require('../database/index.cjs');

function registerFaviconHandler() {
    ipcMain.handle('get-favicon', async (event, url) => {
        if (!url) return null;
        
        const db = getDatabase();
        
        try {
            // Extract domain from URL
            let domain;
            try {
                const urlObj = new URL(url);
                domain = urlObj.hostname;
            } catch {
                domain = url.replace(/^https?:\/\//, '').split('/')[0];
            }
            
            // TTL: 7 days
            const TTL = 7 * 24 * 60 * 60 * 1000;
            
            // 1. Check cache in SQLite
            if (db) {
                const cached = db.prepare('SELECT icon, updated_at FROM favicons WHERE domain = ?').get(domain);
                
                if (cached && (Date.now() - cached.updated_at < TTL)) {
                    // Return cached favicon as base64
                    return `data:image/x-icon;base64,${cached.icon.toString('base64')}`;
                }
            }
            
            // 2. Try to fetch favicon.ico directly
            let iconBuffer = null;
            try {
                const directUrl = `https://${domain}/favicon.ico`;
                const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                    
                    https.get(directUrl, (res) => {
                        clearTimeout(timeout);
                        
                        if (res.statusCode !== 200) {
                            reject(new Error(`Status ${res.statusCode}`));
                            return;
                        }
                        
                        const chunks = [];
                        res.on('data', chunk => chunks.push(chunk));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                        res.on('error', reject);
                    }).on('error', reject);
                });
                
                iconBuffer = response;
            } catch (error) {
                // Favicon not available, will try Google fallback
            }
            
            // 3. Fallback to Google favicon service
            if (!iconBuffer) {
                try {
                    const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                    const response = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                        
                        https.get(googleUrl, (res) => {
                            clearTimeout(timeout);
                            
                            if (res.statusCode !== 200) {
                                reject(new Error(`Status ${res.statusCode}`));
                                return;
                            }
                            
                            const chunks = [];
                            res.on('data', chunk => chunks.push(chunk));
                            res.on('end', () => resolve(Buffer.concat(chunks)));
                            res.on('error', reject);
                        }).on('error', reject);
                    });
                    
                    iconBuffer = response;
                } catch (error) {
                    // Google favicon fallback also failed
                }
            }
            
            // 4. If still no icon, return null
            if (!iconBuffer || iconBuffer.length === 0) {
                return null;
            }
            
            // 5. Save to SQLite cache
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
            
            // 6. Return as base64 data URI
            const mimeType = iconBuffer[0] === 0x89 && iconBuffer[1] === 0x50 ? 'image/png' : 'image/x-icon';
            return `data:${mimeType};base64,${iconBuffer.toString('base64')}`;
            
        } catch (error) {
            console.error('Favicon fetch error:', error);
            return null;
        }
    });
}

module.exports = { registerFaviconHandler };
