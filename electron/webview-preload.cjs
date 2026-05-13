// Webview Preload Script
// This runs in webview context before any page loads

const { contextBridge, ipcRenderer } = require('electron');

console.log('[VBox Webview Preload] Loading...');

// Expose console logging to webview
contextBridge.exposeInMainWorld('vboxConsole', {
    log: (message) => {
        console.log(message); // Also log to webview console
        ipcRenderer.send('webview-console-log', { level: 'log', args: [message] });
    },
    error: (message) => {
        console.error(message);
        ipcRenderer.send('webview-console-log', { level: 'error', args: [message] });
    },
    warn: (message) => {
        console.warn(message);
        ipcRenderer.send('webview-console-log', { level: 'warn', args: [message] });
    },
    info: (message) => {
        console.info(message);
        ipcRenderer.send('webview-console-log', { level: 'info', args: [message] });
    }
});

// Expose PowerPoint API to webview
contextBridge.exposeInMainWorld('vboxPowerPoint', {
    generate: (pptData) => {
        console.log('[VBox Webview Preload] PowerPoint generate called');
        return ipcRenderer.invoke('generate-powerpoint', pptData);
    },
    processTemplate: (templateName, variables, outputFilename) => {
        console.log('[VBox Webview Preload] Template process called:', templateName);
        return ipcRenderer.invoke('ppt-process-template', { templateName, variables, outputFilename });
    },
    listTemplates: () => {
        console.log('[VBox Webview Preload] List templates called');
        return ipcRenderer.invoke('ppt-list-templates');
    }
});

// Expose download manager API to webview
contextBridge.exposeInMainWorld('vboxDownloads', {
    addToDownloads: (fileInfo) => {
        console.log('[VBox Webview Preload] addToDownloads called');
        return ipcRenderer.invoke('script-add-to-downloads', fileInfo);
    }
});

// Expose script input API to webview
contextBridge.exposeInMainWorld('vboxInput', {
    open: async (config) => {
        console.log('[VBox Webview Preload] Input window open called:', config);
        console.log('[VBox Webview Preload] Invoking script-open-input IPC...');
        
        try {
            // Serialize config to ensure it can be cloned through IPC
            const serializedConfig = JSON.parse(JSON.stringify(config));
            const result = await ipcRenderer.invoke('script-open-input', serializedConfig);
            console.log('[VBox Webview Preload] IPC Result:', result);
            return result; // Return the full result object { success, data }
        } catch (error) {
            console.error('[VBox Webview Preload] IPC Error:', error);
            return { success: false, message: error.message || 'IPC Error', data: null };
        }
    }
});

// Expose screenshot API to webview
contextBridge.exposeInMainWorld('vboxScreenshot', {
    capture: async (options) => {
        console.log('[VBox Webview Preload] Screenshot capture called:', options);
        
        try {
            const result = await ipcRenderer.invoke('webview-screenshot', options);
            console.log('[VBox Webview Preload] Screenshot result:', result);
            return result;
        } catch (error) {
            console.error('[VBox Webview Preload] Screenshot error:', error);
            return { success: false, error: error.message };
        }
    }
});

// Expose file save API to webview
contextBridge.exposeInMainWorld('vboxFile', {
    save: async (content, filename, type = 'text/html') => {
        console.log('[VBox Webview Preload] File save called:', filename);
        
        try {
            const result = await ipcRenderer.invoke('save-file', { content, filename, type });
            console.log('[VBox Webview Preload] File save result:', result);
            return result;
        } catch (error) {
            console.error('[VBox Webview Preload] File save error:', error);
            return { success: false, error: error.message };
        }
    }
});

// Expose workspace/profile context API to webview
contextBridge.exposeInMainWorld('vboxContext', {
    getWorkspaceInfo: async () => {
        console.log('[VBox Webview Preload] Getting workspace info...');
        
        try {
            const result = await ipcRenderer.invoke('get-workspace-context');
            console.log('[VBox Webview Preload] Workspace info:', result);
            return result;
        } catch (error) {
            console.error('[VBox Webview Preload] Get workspace info error:', error);
            return { success: false, error: error.message };
        }
    }
});

console.log('[VBox Webview Preload] APIs exposed successfully');
console.log('[VBox Webview Preload] window.vboxPowerPoint:', typeof window.vboxPowerPoint);
console.log('[VBox Webview Preload] window.vboxDownloads:', typeof window.vboxDownloads);
console.log('[VBox Webview Preload] window.vboxContext:', typeof window.vboxContext);

// Override console methods to forward to main process
(function() {
    const originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
    };
    
    // Helper to serialize arguments for IPC
    const serializeArgs = (args) => {
        return args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        });
    };
    
    console.log = function(...args) {
        originalConsole.log(...args);
        ipcRenderer.send('webview-console-log', { level: 'log', args: serializeArgs(args) });
    };
    
    console.error = function(...args) {
        originalConsole.error(...args);
        ipcRenderer.send('webview-console-log', { level: 'error', args: serializeArgs(args) });
    };
    
    console.warn = function(...args) {
        originalConsole.warn(...args);
        ipcRenderer.send('webview-console-log', { level: 'warn', args: serializeArgs(args) });
    };
    
    console.info = function(...args) {
        originalConsole.info(...args);
        ipcRenderer.send('webview-console-log', { level: 'info', args: serializeArgs(args) });
    };
    
    console.log('[VBox Webview Preload] Console methods overridden');
})();

// VBox API - Injected once via preload (no IPC size limits!)
(function() {
    // VBox API - Only available in VisualBox app
    if (typeof window.__VBOX_API__ !== 'undefined') {
        console.warn('VBox API already initialized');
        return;
    }
    
    window.__VBOX_API__ = {
        // App identifier
        APP_NAME: 'VisualBox',
        VERSION: '1.0.0',
        
        // Check if running in VBox
        isVBox: function() {
            return true;
        },
        
        // Get current page info
        getPageInfo: function() {
            return {
                url: window.location.href,
                title: document.title,
                domain: window.location.hostname,
                protocol: window.location.protocol,
                pathname: window.location.pathname,
                search: window.location.search,
                hash: window.location.hash
            };
        },
        
        // Click element
        click: function(selector) {
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            element.click();
            return true;
        },
        
        // Type text into element
        type: function(selector, text, options = {}) {
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            
            const { delay = 0, clear = false } = options;
            
            if (clear) {
                element.value = '';
            }
            
            if (delay > 0) {
                // Type with delay
                let index = 0;
                return new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (index < text.length) {
                            element.value += text[index];
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            index++;
                        } else {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, delay);
                });
            } else {
                // Type instantly
                element.value = clear ? text : element.value + text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        },
        
        // Scroll to element
        scrollTo: function(selector, options = {}) {
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            
            const { behavior = 'smooth', block = 'center' } = options;
            element.scrollIntoView({ behavior, block });
            return true;
        },
        
        // Screenshot element (returns base64)
        screenshot: async function(selector) {
            const element = selector ? document.querySelector(selector) : document.body;
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            
            // Use html2canvas if available
            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas not loaded. Screenshot feature requires html2canvas library.');
            }
            
            const canvas = await html2canvas(element);
            return canvas.toDataURL('image/png');
        },
        
        // Get/Set attributes
        getAttribute: function(selector, attribute) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            return element.getAttribute(attribute);
        },
        
        setAttribute: function(selector, attribute, value) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            element.setAttribute(attribute, value);
            return true;
        },
        
        // Get text/HTML
        getText: function(selector) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            return element.textContent.trim();
        },
        
        getHTML: function(selector) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            return element.innerHTML;
        },
        
        // Check existence
        exists: function(selector) {
            return document.querySelector(selector) !== null;
        },
        
        count: function(selector) {
            return document.querySelectorAll(selector).length;
        },
        
        // Scraping functions
        scrapeLinks: function(options = {}) {
            const {
                selector = 'a[href]',
                filter = null,
                includeText = true,
                includeAttributes = []
            } = options;
            
            const links = [];
            const elements = document.querySelectorAll(selector);
            
            elements.forEach((el, index) => {
                const href = el.getAttribute('href');
                if (!href) return;
                
                let absoluteUrl;
                try {
                    absoluteUrl = new URL(href, window.location.href).href;
                } catch (e) {
                    absoluteUrl = href;
                }
                
                if (filter && typeof filter === 'function') {
                    if (!filter(absoluteUrl, el)) return;
                }
                
                const linkData = { index, url: absoluteUrl, href };
                
                if (includeText) {
                    linkData.text = el.textContent.trim();
                }
                
                includeAttributes.forEach(attr => {
                    const value = el.getAttribute(attr);
                    if (value) linkData[attr] = value;
                });
                
                links.push(linkData);
            });
            
            return links;
        },
        
        scrapeImages: function(options = {}) {
            const { selector = 'img[src]', minWidth = 0, minHeight = 0 } = options;
            const images = [];
            const elements = document.querySelectorAll(selector);
            
            elements.forEach((el, index) => {
                const src = el.getAttribute('src');
                if (!src) return;
                
                if (el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
                
                let absoluteUrl;
                try {
                    absoluteUrl = new URL(src, window.location.href).href;
                } catch (e) {
                    absoluteUrl = src;
                }
                
                images.push({
                    index,
                    url: absoluteUrl,
                    src,
                    alt: el.getAttribute('alt') || '',
                    width: el.naturalWidth,
                    height: el.naturalHeight
                });
            });
            
            return images;
        },
        
        extractData: function(selectors) {
            const data = {};
            for (const [key, selector] of Object.entries(selectors)) {
                const element = document.querySelector(selector);
                if (element) {
                    data[key] = element.textContent.trim();
                }
            }
            return data;
        },
        
        extractTable: function(tableSelector) {
            const table = document.querySelector(tableSelector);
            if (!table) return null;
            
            const rows = [];
            const headerCells = table.querySelectorAll('thead th, thead td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
            
            const bodyRows = table.querySelectorAll('tbody tr');
            bodyRows.forEach(row => {
                const cells = row.querySelectorAll('td, th');
                const rowData = {};
                
                cells.forEach((cell, index) => {
                    const header = headers[index] || `column_${index}`;
                    rowData[header] = cell.textContent.trim();
                });
                
                rows.push(rowData);
            });
            
            return { headers, rows };
        },
        
        // Wait for element
        waitForElement: function(selector, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(true);
                    return;
                }
                
                const observer = new MutationObserver((mutations, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(true);
                    }
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
                
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error('Element not found: ' + selector));
                }, timeout);
            });
        },
        
        // Auto scroll
        autoScroll: function(options = {}) {
            const { delay = 1000, maxScrolls = 10, onScroll = null } = options;
            
            return new Promise((resolve) => {
                let scrollCount = 0;
                let lastHeight = document.body.scrollHeight;
                
                const scrollInterval = setInterval(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                    scrollCount++;
                    
                    if (onScroll) onScroll(scrollCount);
                    
                    setTimeout(() => {
                        const newHeight = document.body.scrollHeight;
                        
                        if (newHeight === lastHeight || scrollCount >= maxScrolls) {
                            clearInterval(scrollInterval);
                            resolve(scrollCount);
                        }
                        
                        lastHeight = newHeight;
                    }, delay);
                }, delay);
            });
        },
        
        // Evaluate code
        evaluate: function(code) {
            return eval(code);
        },
        
        // Toast notification
        toast: function(message, type = 'info') {
            console.log('[VBox Toast]', type.toUpperCase(), ':', message);
        },
        
        // PowerPoint helper
        ppt: {
            create: function(template) {
                return {
                    slides: [],
                    title: 'VBox Report',
                    author: 'VBox Script',
                    template: template || null,
                    
                    addTitleSlide: function(title, subtitle) {
                        this.slides.push({ type: 'title', title, subtitle: subtitle || '' });
                        return this;
                    },
                    
                    addSlide: function(title, content) {
                        this.slides.push({ type: 'content', title, content: content || [] });
                        return this;
                    },
                    
                    addText: function(text, options = {}) {
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'text', text, options });
                        }
                        return this;
                    },
                    
                    addImage: function(base64Data, options = {}) {
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'image', data: base64Data, options });
                        }
                        return this;
                    },
                    
                    addTable: function(rows, options = {}) {
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'table', rows, options });
                        }
                        return this;
                    },
                    
                    addChart: function(type, data, options = {}) {
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'chart', chartType: type, data, options });
                        }
                        return this;
                    },
                    
                    download: function(filename) {
                        console.log('[VBox PPT] Generating:', filename);
                        window.postMessage({
                            type: 'VBOX_GENERATE_PPT',
                            data: {
                                title: this.title,
                                author: this.author,
                                slides: this.slides,
                                template: this.template,
                                filename: filename || 'vbox-report.pptx'
                            }
                        }, '*');
                        return this;
                    }
                };
            }
        },
        
        sendToVBox: function(data) {
            console.log('[VBox] Data:', data);
            return data;
        }
    };
    
    // Function to run injected scripts
    window.runVBoxScript = async function(scriptCode) {
        console.log('[VBox] runVBoxScript called, code length:', scriptCode?.length);
        
        try {
            if (!window.__VBOX_API__) {
                console.error('[VBox] VBox API not available');
                return { success: false, error: 'VBox API not available' };
            }
            
            if (!scriptCode || typeof scriptCode !== 'string') {
                console.error('[VBox] Invalid script code');
                return { success: false, error: 'Invalid script code' };
            }
            
            const vbox = window.__VBOX_API__;
            
            console.log('[VBox] Executing user script...');
            
            // Execute user script with vbox in scope
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const userFunction = new AsyncFunction('vbox', scriptCode);
            const result = await userFunction(vbox);
            
            console.log('[VBox] Script executed successfully');
            
            // Try to serialize result
            try {
                const serialized = JSON.parse(JSON.stringify(result));
                return { success: true, result: serialized };
            } catch (e) {
                // If can't serialize, convert to string
                console.warn('[VBox] Could not serialize result, converting to string');
                return { success: true, result: String(result) };
            }
        } catch (error) {
            console.error('[VBox] Script execution error:', error);
            return { 
                success: false, 
                error: error.message || 'Unknown error',
                stack: error.stack,
                name: error.name
            };
        }
    };
    
    console.log('[VBox] Preload script initialized');
})();
