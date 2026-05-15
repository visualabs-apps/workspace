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

// Expose Navigation API to webview
contextBridge.exposeInMainWorld('vboxNavigation', {
    navigate: (url) => ipcRenderer.invoke('webview-navigate', url),
    goBack: () => ipcRenderer.invoke('webview-go-back'),
    goForward: () => ipcRenderer.invoke('webview-go-forward'),
    reload: () => ipcRenderer.invoke('webview-reload')
});

// Expose Cookie API to webview (session-based, not partition-based)
contextBridge.exposeInMainWorld('vboxCookies', {
    get: (filter) => ipcRenderer.invoke('webview-get-cookies', filter || {}),
    set: (cookie) => ipcRenderer.invoke('webview-set-cookie', cookie)
});

// Expose Dialog API to webview
contextBridge.exposeInMainWorld('vboxDialog', {
    handle: (options) => ipcRenderer.invoke('webview-handle-dialog', options || {}),
    clear: () => ipcRenderer.invoke('webview-clear-dialog-handler')
});

// Expose Tab/Profile Management API to webview
contextBridge.exposeInMainWorld('vboxTabs', {
    listProfiles: () => ipcRenderer.invoke('webview-list-profiles'),
    listTabs: () => ipcRenderer.invoke('webview-list-tabs'),
    switchTab: (tabId) => ipcRenderer.invoke('webview-switch-tab', tabId),
    getPageInfo: (tabId) => ipcRenderer.invoke('webview-get-page-info', tabId || null)
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
    
    // Helper: Use native input value setter for framework compatibility (React, Vue, Svelte)
    function getNativeValueSetter(element) {
        try {
            if (element.tagName === 'TEXTAREA') {
                return Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                ).set;
            }
            return Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            ).set;
        } catch(e) {
            return null;
        }
    }
    
    function setValueWithEvents(element, value) {
        const nativeSetter = getNativeValueSetter(element);
        if (nativeSetter) {
            nativeSetter.call(element, value);
        } else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
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
        
        // Type text into element (framework-compatible: React, Vue, Svelte)
        type: function(selector, text, options) {
            if (options === undefined) options = {};
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            
            const { delay = 0, clear = false } = options;
            
            if (clear) {
                setValueWithEvents(element, '');
            }
            
            if (delay > 0) {
                let index = 0;
                const current = clear ? '' : element.value;
                return new Promise((resolve) => {
                    const interval = setInterval(() => {
                        if (index < text.length) {
                            current += text[index];
                            setValueWithEvents(element, current);
                            index++;
                        } else {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, delay);
                });
            } else {
                const newValue = clear ? text : element.value + text;
                setValueWithEvents(element, newValue);
                return true;
            }
        },
        
        // Scroll to element
        scrollTo: function(selector, options) {
            if (options === undefined) options = {};
            const element = document.querySelector(selector);
            if (!element) {
                throw new Error('Element not found: ' + selector);
            }
            
            const { behavior = 'smooth', block = 'center' } = options;
            element.scrollIntoView({ behavior, block });
            return true;
        },
        
        // Screenshot element (IPC-based — works without html2canvas)
        _screenshotIsIPC: true,
        screenshot: async function(selector, filename) {
            try {
                const element = selector ? document.querySelector(selector) : document.body;
                if (!element) {
                    throw new Error('Element not found: ' + selector);
                }
                
                const rect = element.getBoundingClientRect();
                
                if (typeof window.vboxScreenshot !== 'undefined') {
                    const result = await window.vboxScreenshot.capture({
                        selector: selector,
                        filename: filename || ('screenshot-' + Date.now() + '.png'),
                        rect: {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                    return result;
                }
                
                return { success: false, error: 'Screenshot API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
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
        scrapeLinks: function(options) {
            if (options === undefined) options = {};
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
        
        // Scrape images (handles unloaded images gracefully)
        scrapeImages: function(options) {
            if (options === undefined) options = {};
            const { selector = 'img[src]', minWidth = 0, minHeight = 0 } = options;
            const images = [];
            const elements = document.querySelectorAll(selector);
            
            elements.forEach((el, index) => {
                const src = el.getAttribute('src');
                if (!src) return;
                
                // Only filter by size if image has loaded (naturalWidth > 0)
                if (el.complete && el.naturalWidth > 0) {
                    if (el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
                }
                
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
                    width: el.naturalWidth || 0,
                    height: el.naturalHeight || 0,
                    loaded: el.complete && el.naturalWidth > 0
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
        
        // Extract table data (consistent object format)
        extractTable: function(tableSelector) {
            const table = document.querySelector(tableSelector);
            if (!table) return null;
            
            const headerCells = table.querySelectorAll('thead th, thead td');
            const headers = Array.from(headerCells).map(cell => cell.textContent.trim());
            
            const rows = [];
            const bodyRows = table.querySelectorAll('tbody tr');
            bodyRows.forEach(row => {
                const cells = row.querySelectorAll('td, th');
                const rowData = {};
                
                cells.forEach((cell, index) => {
                    const header = headers[index] || ('column_' + index);
                    rowData[header] = cell.textContent.trim();
                });
                
                rows.push(rowData);
            });
            
            return { headers, rows };
        },
        
        // Wait for element
        waitForElement: function(selector, timeout) {
            if (timeout === undefined) timeout = 5000;
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(true);
                    return;
                }
                
                const observer = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        observer.disconnect();
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
        
        // Auto scroll (fixed: recursive setTimeout instead of nested setInterval+setTimeout)
        autoScroll: function(options) {
            if (options === undefined) options = {};
            const { delay = 1000, maxScrolls = 10, onScroll = null } = options;
            
            return new Promise((resolve) => {
                let scrollCount = 0;
                let lastHeight = document.body.scrollHeight;
                
                function doScroll() {
                    window.scrollTo(0, document.body.scrollHeight);
                    scrollCount++;
                    
                    if (onScroll) onScroll(scrollCount);
                    
                    setTimeout(() => {
                        const newHeight = document.body.scrollHeight;
                        
                        if (newHeight === lastHeight || scrollCount >= maxScrolls) {
                            resolve(scrollCount);
                        } else {
                            lastHeight = newHeight;
                            doScroll();
                        }
                    }, delay);
                }
                
                doScroll();
            });
        },
        
        // Evaluate code
        evaluate: function(code) {
            return eval(code);
        },
        
        // Toast notification
        toast: function(message, type) {
            if (type === undefined) type = 'info';
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
                    
                    addText: function(text, options) {
                        if (options === undefined) options = {};
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'text', text, options });
                        }
                        return this;
                    },
                    
                    addImage: function(imagePath, options) {
                        if (options === undefined) options = {};
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'image', path: imagePath, options });
                        }
                        return this;
                    },
                    
                    addTable: function(rows, options) {
                        if (options === undefined) options = {};
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'table', rows, options });
                        }
                        return this;
                    },
                    
                    addChart: function(type, data, options) {
                        if (options === undefined) options = {};
                        const lastSlide = this.slides[this.slides.length - 1];
                        if (lastSlide) {
                            if (!lastSlide.content) lastSlide.content = [];
                            lastSlide.content.push({ type: 'chart', chartType: type, data, options });
                        }
                        return this;
                    },
                    
                    download: async function(filename) {
                        console.log('[VBox PPT] Generating:', filename);
                        
                        try {
                            if (typeof window.vboxPowerPoint !== 'undefined') {
                                const result = await window.vboxPowerPoint.generate({
                                    title: this.title,
                                    author: this.author,
                                    slides: this.slides,
                                    template: this.template,
                                    filename: filename || 'vbox-report.pptx'
                                });
                                
                                if (result && result.success && result.path) {
                                    const downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                                    console.log('[VBox PPT] Download manager result:', downloadResult);
                                }
                                
                                return result;
                            }
                            
                            return { success: false, error: 'PowerPoint API not available' };
                        } catch (error) {
                            console.error('[VBox PPT] Error:', error);
                            return { success: false, error: error.message };
                        }
                    }
                };
            }
        },
        
        sendToVBox: function(data) {
            console.log('[VBox] Data:', data);
            return data;
        },
        
        // Add file to download manager
        shouldDownload: async function(filepath, filename) {
            try {
                if (!filename) {
                    filename = filepath.split(/[\\/]/).pop();
                }
                
                if (typeof window.vboxDownloads !== 'undefined') {
                    const result = await window.vboxDownloads.addToDownloads({ filepath, filename });
                    return result;
                }
                
                return { success: false, error: 'Download manager API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // Save file to Downloads folder
        saveFile: async function(content, filename, type) {
            if (type === undefined) type = 'text/html';
            try {
                if (typeof window.vboxFile !== 'undefined') {
                    const result = await window.vboxFile.save(content, filename, type);
                    
                    if (result.success) {
                        await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                    }
                    
                    return result;
                }
                
                return { success: false, error: 'File save API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // Open input window to collect user input
        openInput: async function(config) {
            try {
                if (typeof window.vboxInput !== 'undefined') {
                    return await window.vboxInput.open(config);
                } else if (typeof window.scriptInputStore !== 'undefined') {
                    return await window.scriptInputStore.open(config);
                }
                
                return null;
            } catch (error) {
                console.error('[VBox] openInput error:', error);
                return null;
            }
        },
        
        // Get active workspace/profile info
        getActiveProfile: async function() {
            try {
                if (typeof window.vboxContext !== 'undefined') {
                    return await window.vboxContext.getWorkspaceInfo();
                }
                
                if (typeof window.workspaceStore !== 'undefined' && window.workspaceStore.activeWorkspace) {
                    const workspace = window.workspaceStore.activeWorkspace;
                    return {
                        success: true,
                        id: workspace.id,
                        name: workspace.name,
                        url: window.location.href,
                        title: document.title
                    };
                }
                
                return { success: false, error: 'Profile info not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ─── Navigation APIs ─────────────────────────────────────────
        
        /**
         * Navigate to a URL. Note: this destroys the current JS context,
         * so any code after this call will NOT execute.
         * For sequential navigation, use MCP-level APIs.
         */
        navigate: async function(url) {
            try {
                if (typeof window.vboxNavigation !== 'undefined') {
                    return await window.vboxNavigation.navigate(url);
                }
                return { success: false, error: 'Navigation API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Go back in browser history
         */
        goBack: async function() {
            try {
                if (typeof window.vboxNavigation !== 'undefined') {
                    return await window.vboxNavigation.goBack();
                }
                return { success: false, error: 'Navigation API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Go forward in browser history
         */
        goForward: async function() {
            try {
                if (typeof window.vboxNavigation !== 'undefined') {
                    return await window.vboxNavigation.goForward();
                }
                return { success: false, error: 'Navigation API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Reload current page
         */
        reload: async function() {
            try {
                if (typeof window.vboxNavigation !== 'undefined') {
                    return await window.vboxNavigation.reload();
                }
                return { success: false, error: 'Navigation API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ─── Keyboard APIs ───────────────────────────────────────────
        
        /**
         * Dispatch keyboard event (Enter, Tab, Escape, ArrowDown, etc.)
         * @param {string} key - Key name (e.g. 'Enter', 'Tab', 'Escape', 'a')
         * @param {object} options - { selector?, shift?, ctrl?, alt?, meta? }
         */
        press: function(key, options) {
            if (options === undefined) options = {};
            const target = options.selector
                ? document.querySelector(options.selector)
                : document.activeElement || document.body;
            
            if (!target && options.selector) {
                throw new Error('Element not found: ' + options.selector);
            }
            
            const eventInit = {
                key: key,
                code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
                bubbles: true,
                cancelable: true,
                shiftKey: options.shift || false,
                ctrlKey: options.ctrl || false,
                altKey: options.alt || false,
                metaKey: options.meta || false
            };
            
            // Dispatch keydown, keypress (if printable), keyup
            target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
            
            if (key.length === 1) {
                target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
            }
            
            target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
            
            return true;
        },
        
        // ─── Mouse APIs ──────────────────────────────────────────────
        
        /**
         * Simulate mouse hover on element
         */
        hover: function(selector) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            
            const rect = element.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            const eventInit = {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                view: window
            };
            
            element.dispatchEvent(new MouseEvent('pointerenter', eventInit));
            element.dispatchEvent(new MouseEvent('mouseover', eventInit));
            element.dispatchEvent(new MouseEvent('mouseenter', Object.assign({}, eventInit, { bubbles: false })));
            element.dispatchEvent(new MouseEvent('mousemove', eventInit));
            
            return true;
        },
        
        /**
         * Drag element from source to target
         */
        drag: function(sourceSelector, targetSelector) {
            const source = document.querySelector(sourceSelector);
            const target = document.querySelector(targetSelector);
            if (!source) throw new Error('Source not found: ' + sourceSelector);
            if (!target) throw new Error('Target not found: ' + targetSelector);
            
            const sourceRect = source.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            
            const dataTransfer = new DataTransfer();
            
            const dragStartEvent = new DragEvent('dragstart', {
                bubbles: true,
                dataTransfer: dataTransfer,
                clientX: sourceRect.left + sourceRect.width / 2,
                clientY: sourceRect.top + sourceRect.height / 2
            });
            source.dispatchEvent(dragStartEvent);
            
            const dragOverEvent = new DragEvent('dragover', {
                bubbles: true,
                dataTransfer: dataTransfer,
                clientX: targetRect.left + targetRect.width / 2,
                clientY: targetRect.top + targetRect.height / 2
            });
            target.dispatchEvent(dragOverEvent);
            
            const dropEvent = new DragEvent('drop', {
                bubbles: true,
                dataTransfer: dataTransfer,
                clientX: targetRect.left + targetRect.width / 2,
                clientY: targetRect.top + targetRect.height / 2
            });
            target.dispatchEvent(dropEvent);
            
            const dragEndEvent = new DragEvent('dragend', {
                bubbles: true,
                dataTransfer: dataTransfer
            });
            source.dispatchEvent(dragEndEvent);
            
            return true;
        },
        
        // ─── Form APIs ────────────────────────────────────────────────
        
        /**
         * Select an option in a <select> element
         */
        select: function(selector, value) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            if (element.tagName !== 'SELECT') throw new Error('Element is not a <select>: ' + selector);
            
            // Find matching option
            const options = element.options;
            let found = false;
            
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === value || options[i].textContent.trim() === value) {
                    element.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                throw new Error('Option not found: ' + value);
            }
            
            // Use native setter for framework compatibility
            const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype, 'value'
            ).set;
            if (nativeSetter) {
                nativeSetter.call(element, value);
            }
            
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            return true;
        },
        
        // ─── Cookie APIs ─────────────────────────────────────────────
        
        /**
         * Get cookies from current webview session
         */
        getCookies: async function(filter) {
            try {
                if (typeof window.vboxCookies !== 'undefined') {
                    return await window.vboxCookies.get(filter || {});
                }
                return { success: false, error: 'Cookie API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Set a cookie in current webview session
         */
        setCookie: async function(cookie) {
            try {
                if (typeof window.vboxCookies !== 'undefined') {
                    return await window.vboxCookies.set(cookie);
                }
                return { success: false, error: 'Cookie API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ─── Dialog APIs ─────────────────────────────────────────────
        
        /**
         * Register auto-response for browser dialogs (alert, confirm, prompt)
         * Must be called BEFORE the dialog appears
         */
        handleDialog: async function(options) {
            try {
                if (typeof window.vboxDialog !== 'undefined') {
                    return await window.vboxDialog.handle(options || {});
                }
                return { success: false, error: 'Dialog API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Remove dialog handler (restore default behavior)
         */
        clearDialogHandler: async function() {
            try {
                if (typeof window.vboxDialog !== 'undefined') {
                    return await window.vboxDialog.clear();
                }
                return { success: false, error: 'Dialog API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        // ─── Network APIs ────────────────────────────────────────────
        
        /**
         * Wait for network to be idle (no requests for `idleTime` ms)
         */
        waitForNetworkIdle: function(options) {
            if (options === undefined) options = {};
            const { timeout = 10000, idleTime = 1000 } = options;
            
            return new Promise((resolve) => {
                let lastRequestTime = Date.now();
                let resolved = false;
                
                const cleanup = () => {
                    if (resolved) return;
                    resolved = true;
                    try { observer.disconnect(); } catch {}
                    clearInterval(checkInterval);
                    clearTimeout(timeoutTimer);
                };
                
                // Monitor resource timing entries
                let previousEntryCount = performance.getEntriesByType('resource').length;
                
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach(() => {
                        lastRequestTime = Date.now();
                    });
                });
                
                try {
                    observer.observe({ entryTypes: ['resource'] });
                } catch (e) {
                    // PerformanceObserver may not support 'resource' in all contexts
                }
                
                const checkInterval = setInterval(() => {
                    const currentEntries = performance.getEntriesByType('resource').length;
                    if (currentEntries > previousEntryCount) {
                        lastRequestTime = Date.now();
                        previousEntryCount = currentEntries;
                    }
                    
                    if (Date.now() - lastRequestTime >= idleTime) {
                        cleanup();
                        resolve({ success: true, idleTime: idleTime });
                    }
                }, 200);
                
                const timeoutTimer = setTimeout(() => {
                    cleanup();
                    resolve({ success: false, error: 'Network idle timeout' });
                }, timeout);
            });
        },
        
        // ─── iframe APIs ─────────────────────────────────────────────
        
        /**
         * Get content from an iframe
         */
        getIFrameContent: function(selector) {
            const iframe = document.querySelector(selector);
            if (!iframe) throw new Error('Iframe not found: ' + selector);
            
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                return {
                    success: true,
                    html: doc.documentElement.outerHTML,
                    url: iframe.src || iframe.contentWindow.location.href,
                    title: doc.title || ''
                };
            } catch (error) {
                // Cross-origin iframe
                return {
                    success: false,
                    error: 'Cannot access cross-origin iframe: ' + error.message,
                    url: iframe.src
                };
            }
        },
        
        // ─── Tab/Profile Management APIs (MCP-ready) ────────────────
        
        /**
         * List all workspace profiles
         */
        listProfiles: async function() {
            try {
                if (typeof window.vboxTabs !== 'undefined') {
                    return await window.vboxTabs.listProfiles();
                }
                return { success: false, error: 'Tab management API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * List all open tabs
         */
        listTabs: async function() {
            try {
                if (typeof window.vboxTabs !== 'undefined') {
                    return await window.vboxTabs.listTabs();
                }
                return { success: false, error: 'Tab management API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Switch to a specific tab by ID
         */
        switchTab: async function(tabId) {
            try {
                if (typeof window.vboxTabs !== 'undefined') {
                    return await window.vboxTabs.switchTab(tabId);
                }
                return { success: false, error: 'Tab management API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },
        
        /**
         * Get page info for a specific tab (or current active tab)
         */
        getTabInfo: async function(tabId) {
            try {
                if (typeof window.vboxTabs !== 'undefined') {
                    return await window.vboxTabs.getPageInfo(tabId || null);
                }
                return { success: false, error: 'Tab management API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
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
