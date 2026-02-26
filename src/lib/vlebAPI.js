// VlebAPI - Helper library injected into webviews for scraper scripts
// This provides a consistent API for scraper scripts to interact with the browser

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://app.v-leb.local/api';

export const VLEB_API_SCRIPT = `
(function() {
    // Prevent multiple injections
    if (window.VlebAPI) {
        console.log('VlebAPI already initialized');
        return;
    }
    
    // VlebAPI namespace
    window.VlebAPI = {
        version: '1.0.0',
        
        /**
         * Get user profile from localStorage
         */
        getProfile: function() {
            try {
                const userStr = localStorage.getItem('user');
                return userStr ? JSON.parse(userStr) : null;
            } catch (error) {
                console.error('VlebAPI: Error getting profile', error);
                return null;
            }
        },
        
        /**
         * Get session token
         */
        getSession: function() {
            try {
                return {
                    token: localStorage.getItem('token'),
                    refreshToken: localStorage.getItem('refresh_token'),
                };
            } catch (error) {
                console.error('VlebAPI: Error getting session', error);
                return null;
            }
        },
        
        /**
         * Get all cookies
         */
        getCookies: function() {
            try {
                const cookies = {};
                document.cookie.split(';').forEach(cookie => {
                    const [name, value] = cookie.trim().split('=');
                    if (name) cookies[name] = decodeURIComponent(value);
                });
                return cookies;
            } catch (error) {
                console.error('VlebAPI: Error getting cookies', error);
                return {};
            }
        },
        
        /**
         * Get specific cookie
         */
        getCookie: function(name) {
            const cookies = this.getCookies();
            return cookies[name] || null;
        },
        
        /**
         * Get all localStorage data
         */
        getLocalStorage: function() {
            try {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                return data;
            } catch (error) {
                console.error('VlebAPI: Error getting localStorage', error);
                return {};
            }
        },
        
        /**
         * Get all sessionStorage data
         */
        getSessionStorage: function() {
            try {
                const data = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    data[key] = sessionStorage.getItem(key);
                }
                return data;
            } catch (error) {
                console.error('VlebAPI: Error getting sessionStorage', error);
                return {};
            }
        },
        
        /**
         * Send scraped data to parent window
         */
        sendData: function(data) {
            try {
                window.postMessage({
                    type: 'SCRAPER_RESULT',
                    source: window.location.hostname,
                    data: data,
                    timestamp: new Date().toISOString()
                }, '*');
                
                console.log('VlebAPI: Data sent successfully', data);
                return true;
            } catch (error) {
                console.error('VlebAPI: Error sending data', error);
                this.sendError(error.message);
                return false;
            }
        },
        
        /**
         * Send data directly to backend Laravel API
         * Usage: VlebAPI.sendToBackend({title: 'Product', price: 100}, 'products/scrape')
         */
        sendToBackend: async function(data, endpoint) {
            try {
                // Get token from localStorage
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('No authentication token found');
                }
                
                // Build full API URL from environment variable
                const baseUrl = '${API_BASE_URL}';
                const fullUrl = endpoint.startsWith('/') ? \`\${baseUrl}\${endpoint}\` : \`\${baseUrl}/\${endpoint}\`;
                
                this.log('Sending data to backend:', fullUrl);
                
                // Send POST request to Laravel API
                const response = await fetch(fullUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': \`Bearer \${token}\`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        source: window.location.hostname,
                        url: window.location.href,
                        data: data,
                        scrapedAt: new Date().toISOString()
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(\`Backend request failed: \${response.status} - \${errorText}\`);
                }
                
                const result = await response.json();
                this.log('Backend response:', result);
                
                // Also send to parent window for logging
                window.postMessage({
                    type: 'SCRAPER_BACKEND_SUCCESS',
                    source: window.location.hostname,
                    endpoint: endpoint,
                    result: result,
                    timestamp: new Date().toISOString()
                }, '*');
                
                return result;
            } catch (error) {
                console.error('VlebAPI: Error sending to backend', error);
                this.sendError(\`Backend error: \${error.message}\`);
                
                // Send error to parent window
                window.postMessage({
                    type: 'SCRAPER_BACKEND_ERROR',
                    source: window.location.hostname,
                    endpoint: endpoint,
                    error: error.message,
                    timestamp: new Date().toISOString()
                }, '*');
                
                throw error;
            }
        },
        
        /**
         * Send error to parent window
         */
        sendError: function(errorMessage) {
            try {
                window.postMessage({
                    type: 'SCRAPER_ERROR',
                    source: window.location.hostname,
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                }, '*');
            } catch (error) {
                console.error('VlebAPI: Error sending error message', error);
            }
        },
        
        /**
         * Console logging with VlebAPI prefix
         */
        log: function(...args) {
            console.log('[VlebAPI]', ...args);
        },
        
        /**
         * Wait for element to appear in DOM
         */
        waitForElement: function(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                
                const observer = new MutationObserver((mutations, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(element);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(\`Element \${selector} not found within \${timeout}ms\`));
                }, timeout);
            });
        },
        
        /**
         * Wait for multiple elements
         */
        waitForElements: function(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    resolve(Array.from(elements));
                    return;
                }
                
                const observer = new MutationObserver((mutations, obs) => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        obs.disconnect();
                        resolve(Array.from(elements));
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(\`Elements \${selector} not found within \${timeout}ms\`));
                }, timeout);
            });
        },
        
        /**
         * Extract all images from page
         */
        extractImages: function(options = {}) {
            const {
                minWidth = 0,
                minHeight = 0,
                includeBackground = false
            } = options;
            
            const images = [];
            
            // Get img tags
            document.querySelectorAll('img').forEach(img => {
                if (img.naturalWidth >= minWidth && img.naturalHeight >= minHeight) {
                    images.push({
                        src: img.src,
                        alt: img.alt,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        type: 'img'
                    });
                }
            });
            
            // Get background images if requested
            if (includeBackground) {
                document.querySelectorAll('*').forEach(el => {
                    const bg = window.getComputedStyle(el).backgroundImage;
                    if (bg && bg !== 'none') {
                        const match = bg.match(/url\\(["']?([^"']*)["']?\\)/);
                        if (match && match[1]) {
                            images.push({
                                src: match[1],
                                type: 'background'
                            });
                        }
                    }
                });
            }
            
            return images;
        },
        
        /**
         * Extract all links from page
         */
        extractLinks: function(options = {}) {
            const {
                internal = true,
                external = true,
                includeHash = false
            } = options;
            
            const links = [];
            const currentHost = window.location.hostname;
            
            document.querySelectorAll('a[href]').forEach(a => {
                try {
                    const url = new URL(a.href, window.location.href);
                    const isInternal = url.hostname === currentHost;
                    const hasHash = url.hash.length > 0;
                    
                    if ((isInternal && internal) || (!isInternal && external)) {
                        if (includeHash || !hasHash) {
                            links.push({
                                href: a.href,
                                text: a.textContent.trim(),
                                title: a.title,
                                isInternal: isInternal
                            });
                        }
                    }
                } catch (error) {
                    // Invalid URL, skip
                }
            });
            
            return links;
        },
        
        /**
         * Extract text content from element
         */
        extractText: function(selector) {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : null;
        },
        
        /**
         * Extract attribute from element
         */
        extractAttribute: function(selector, attribute) {
            const element = document.querySelector(selector);
            return element ? element.getAttribute(attribute) : null;
        },
        
        /**
         * Extract data from multiple elements
         */
        extractMultiple: function(selector, extractor) {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements).map(extractor);
        },
        
        /**
         * Scroll to bottom of page (useful for infinite scroll)
         */
        scrollToBottom: function() {
            window.scrollTo(0, document.body.scrollHeight);
        },
        
        /**
         * Scroll to element
         */
        scrollToElement: function(selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        },
        
        /**
         * Click element
         */
        clickElement: function(selector) {
            const element = document.querySelector(selector);
            if (element) {
                element.click();
                return true;
            }
            return false;
        },
        
        /**
         * Get page metadata
         */
        getPageMetadata: function() {
            return {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname,
                path: window.location.pathname,
                description: document.querySelector('meta[name="description"]')?.content || '',
                keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
                ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
                ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
            };
        },
        
        /**
         * Take screenshot (if supported)
         */
        takeScreenshot: async function() {
            try {
                // This would need to be implemented in the Electron side
                window.postMessage({
                    type: 'SCRAPER_SCREENSHOT_REQUEST',
                    timestamp: new Date().toISOString()
                }, '*');
                
                return true;
            } catch (error) {
                console.error('VlebAPI: Error requesting screenshot', error);
                return false;
            }
        }
    };
    
    console.log('VlebAPI initialized (v' + window.VlebAPI.version + ')');
    
    // Notify parent that API is ready
    window.postMessage({
        type: 'VLEB_API_READY',
        version: window.VlebAPI.version
    }, '*');
})();
`;
