// Scraper Service - Inject and execute scraping scripts from Laravel
import { API_BASE_URL } from './api';
import { VLEB_API_SCRIPT } from './vlebAPI';
import { secureStorage } from './secureStorage';

const fs = window.require ? window.require('fs') : null;
const path = window.require ? window.require('path') : null;
const { app } = window.require ? window.require('@electron/remote') : {};

class ScraperService {
    constructor() {
        this.scriptsDir = null;
        this.scripts = new Map(); // domain -> script content
        this.listeners = new Set();
        this.apiInjected = new Set();
        this.initialized = false;
    }

    /**
     * Initialize scraper service - download all scripts on app startup
     */
    async initialize() {
        if (this.initialized) {
            console.log('ScraperService already initialized');
            return;
        }

        try {
            // Setup scripts directory
            if (app) {
                const userDataPath = app.getPath('userData');
                this.scriptsDir = path.join(userDataPath, 'scraper-scripts');
                
                // Delete old scripts directory if exists
                if (fs.existsSync(this.scriptsDir)) {
                    console.log('🗑️ Deleting old scraper scripts...');
                    fs.rmSync(this.scriptsDir, { recursive: true, force: true });
                }
                
                // Create fresh directory
                fs.mkdirSync(this.scriptsDir, { recursive: true });
                console.log('📁 Created scraper scripts directory:', this.scriptsDir);
            }

            // Download all scripts from server
            await this.downloadAllScripts();
            
            this.initialized = true;
            console.log('✅ ScraperService initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize ScraperService:', error);
        }
    }

    /**
     * Download all scripts from Laravel API and save to local files
     */
    async downloadAllScripts() {
        try {
            console.log('📥 Downloading all scraper scripts from server...');

            // No authentication required - endpoint is public
            const response = await fetch(`${API_BASE_URL}/scraper/scripts`, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch scripts from server: ${response.status} ${response.statusText}`);
            }

            const allScripts = await response.json();
            console.log(`📦 Downloaded ${allScripts.length} scripts`);

            // Save each script to file and memory
            for (const script of allScripts) {
                if (!script.is_active) {
                    console.log(`⏭️ Skipping inactive script: ${script.domain}`);
                    continue;
                }

                // Store in memory
                this.scripts.set(script.domain, {
                    content: script.script_content,
                    version: script.version,
                    description: script.description
                });

                // Save to file if fs available
                if (fs && this.scriptsDir) {
                    const filename = `${script.domain.replace(/\./g, '_')}.js`;
                    const filepath = path.join(this.scriptsDir, filename);
                    
                    fs.writeFileSync(filepath, script.script_content, 'utf8');
                    console.log(`💾 Saved script: ${filename} (v${script.version})`);
                }
            }

            console.log(`✅ Successfully loaded ${this.scripts.size} active scripts`);
        } catch (error) {
            console.error('❌ Error downloading scripts:', error);
        }
    }

    /**
     * Get script for domain from memory (already loaded at startup)
     */
    getScript(domain) {
        // Try exact match first
        if (this.scripts.has(domain)) {
            return this.scripts.get(domain);
        }

        // Try partial match (e.g., shopee.co.id matches www.shopee.co.id)
        for (const [scriptDomain, scriptData] of this.scripts.entries()) {
            if (domain.includes(scriptDomain) || scriptDomain.includes(domain)) {
                return scriptData;
            }
        }

        return null;
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return null;
        }
    }

    /**
     * Inject VlebAPI helper library
     */
    async injectVlebAPI(webview) {
        const webviewId = webview.id || 'default';
        
        // Only inject once per webview
        if (this.apiInjected.has(webviewId)) {
            return true;
        }

        try {
            await webview.executeJavaScript(VLEB_API_SCRIPT);
            this.apiInjected.add(webviewId);
            console.log('✅ VlebAPI injected');
            return true;
        } catch (error) {
            console.error('❌ Error injecting VlebAPI:', error);
            return false;
        }
    }

    /**
     * Inject script from local memory (loaded at startup)
     */
    async injectScript(webview, url) {
        if (!this.initialized) {
            console.warn('⚠️ ScraperService not initialized yet');
            return null;
        }

        const domain = this.extractDomain(url);
        if (!domain) return null;

        // First, inject VlebAPI
        await this.injectVlebAPI(webview);

        // Get script from memory
        const scriptData = this.getScript(domain);
        if (!scriptData) {
            console.log(`ℹ️ No scraper script found for domain: ${domain}`);
            return null;
        }

        try {
            console.log(`🚀 Injecting scraper script for ${domain} (v${scriptData.version})`);
            
            // Execute script in webview
            const result = await webview.executeJavaScript(scriptData.content);
            
            console.log('✅ Scraper script executed successfully');
            return result;
        } catch (error) {
            console.error('❌ Error injecting scraper script:', error);
            return null;
        }
    }

    /**
     * Listen for scraper results from webview
     */
    addResultListener(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Handle message from webview
     */
    handleMessage(event) {
        if (event.data.type === 'SCRAPER_RESULT') {
            console.log('📊 Scraper result received:', event.data);
            
            // Notify all listeners
            this.listeners.forEach(callback => {
                try {
                    callback(event.data);
                } catch (error) {
                    console.error('Error in scraper listener:', error);
                }
            });
        } else if (event.data.type === 'SCRAPER_ERROR') {
            console.error('❌ Scraper error:', event.data.error);
        } else if (event.data.type === 'VLEB_API_READY') {
            console.log('✅ VlebAPI ready:', event.data.version);
        } else if (event.data.type === 'SCRAPER_BACKEND_SUCCESS') {
            console.log('✅ Data sent to backend successfully:', event.data);
            
            // Notify listeners about backend success
            this.listeners.forEach(callback => {
                try {
                    callback(event.data);
                } catch (error) {
                    console.error('Error in scraper listener:', error);
                }
            });
        } else if (event.data.type === 'SCRAPER_BACKEND_ERROR') {
            console.error('❌ Backend error:', event.data.error);
        }
    }

    /**
     * Send scraped data to Laravel API
     */
    async sendDataToServer(data) {
        try {
            const response = await fetch(`${API_BASE_URL}/scraper/data`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to send scraped data');
            }

            return await response.json();
        } catch (error) {
            console.error('Error sending scraped data:', error);
            throw error;
        }
    }

    /**
     * Reload scripts from server (manual refresh)
     */
    async reloadScripts() {
        console.log('🔄 Reloading scripts from server...');
        this.scripts.clear();
        this.initialized = false;
        await this.initialize();
    }
    
    /**
     * Clear API injection tracking (when webview is destroyed)
     */
    clearAPITracking(webviewId) {
        this.apiInjected.delete(webviewId);
    }
    
    /**
     * Get loaded scripts info
     */
    getLoadedScripts() {
        return Array.from(this.scripts.entries()).map(([domain, data]) => ({
            domain,
            version: data.version,
            description: data.description
        }));
    }
}

// Export singleton instance
export const scraperService = new ScraperService();

// Setup global message listener
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        scraperService.handleMessage(event);
    });
}


