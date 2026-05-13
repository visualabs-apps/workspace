(function() {
    if (typeof window.__VBOX_API__ !== 'undefined') {
        return;
    }
    
    // Store original console methods
    const originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
    };
    
    // Helper to serialize arguments for better display
    const serializeArgs = (...args) => {
        return args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
    };
    
    // Override console to forward to main process
    function overrideConsole() {
        console.log = function(...args) {
            originalConsole.log(...args);
            // Forward to main process if in webview context
            if (typeof window.vboxConsole !== 'undefined') {
                try {
                    const message = serializeArgs(...args);
                    window.vboxConsole.log(message);
                } catch (e) {
                    originalConsole.error('[VBox] Console forward error:', e);
                }
            }
        };
        
        console.error = function(...args) {
            originalConsole.error(...args);
            if (typeof window.vboxConsole !== 'undefined') {
                try {
                    const message = serializeArgs(...args);
                    window.vboxConsole.error(message);
                } catch (e) {}
            }
        };
        
        console.warn = function(...args) {
            originalConsole.warn(...args);
            if (typeof window.vboxConsole !== 'undefined') {
                try {
                    const message = serializeArgs(...args);
                    window.vboxConsole.warn(message);
                } catch (e) {}
            }
        };
        
        console.info = function(...args) {
            originalConsole.info(...args);
            if (typeof window.vboxConsole !== 'undefined') {
                try {
                    const message = serializeArgs(...args);
                    window.vboxConsole.info(message);
                } catch (e) {}
            }
        };
    }
    
    // Apply console override
    overrideConsole();
    
    window.__VBOX_API__ = {
        // Check if running in VBox environment
        isVBox: () => true,
        
        // Get current page information (URL, title, domain, etc)
        getPageInfo: () => ({
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            protocol: window.location.protocol,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
        }),
        
        // Click an element by selector
        click: (selector) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            el.click();
            return true;
        },
        
        // Type text into an element (supports delay and clear options)
        type: (selector, text, options = {}) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            const { delay = 0, clear = false } = options;
            if (clear) el.value = '';
            if (delay > 0) {
                return new Promise((resolve) => {
                    let i = 0;
                    const interval = setInterval(() => {
                        if (i < text.length) {
                            el.value += text[i];
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            i++;
                        } else {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, delay);
                });
            }
            el.value = clear ? text : el.value + text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        },
        
        // Scroll element into view
        scrollTo: (selector, options = {}) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            el.scrollIntoView({ behavior: options.behavior || 'smooth', block: options.block || 'center' });
            return true;
        },
        
        // Get attribute value from element
        getAttribute: (selector, attr) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.getAttribute(attr);
        },
        
        // Set attribute value on element
        setAttribute: (selector, attr, value) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            el.setAttribute(attr, value);
            return true;
        },
        
        // Get text content from element
        getText: (selector) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.textContent.trim();
        },
        
        // Get HTML content from element
        getHTML: (selector) => {
            const el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.innerHTML;
        },
        
        // Check if element exists
        exists: (selector) => document.querySelector(selector) !== null,
        
        // Count elements matching selector
        count: (selector) => document.querySelectorAll(selector).length,
        
        // Scrape all links from page with optional filter
        scrapeLinks: (options = {}) => {
            const { selector = 'a[href]', filter = null } = options;
            const links = [];
            document.querySelectorAll(selector).forEach((el, i) => {
                const href = el.getAttribute('href');
                if (!href) return;
                let url;
                try { url = new URL(href, window.location.href).href; } catch { url = href; }
                if (filter && !filter(url, el)) return;
                links.push({ index: i, url, href, text: el.textContent.trim() });
            });
            return links;
        },
        
        // Scrape all images from page with size filter
        scrapeImages: (options = {}) => {
            const { selector = 'img[src]', minWidth = 0, minHeight = 0 } = options;
            const images = [];
            document.querySelectorAll(selector).forEach((el, i) => {
                const src = el.getAttribute('src');
                if (!src || el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
                let url;
                try { url = new URL(src, window.location.href).href; } catch { url = src; }
                images.push({
                    index: i,
                    url,
                    src,
                    alt: el.getAttribute('alt') || '',
                    width: el.naturalWidth,
                    height: el.naturalHeight
                });
            });
            return images;
        },
        
        // Extract data from multiple selectors into object
        extractData: (selectors) => {
            const data = {};
            for (const [key, selector] of Object.entries(selectors)) {
                const el = document.querySelector(selector);
                if (el) data[key] = el.textContent.trim();
            }
            return data;
        },
        
        // Extract table data (headers and rows)
        extractTable: (selector) => {
            const table = document.querySelector(selector);
            if (!table) return null;
            const headers = Array.from(table.querySelectorAll('thead th, thead td')).map(c => c.textContent.trim());
            const rows = [];
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = Array.from(row.querySelectorAll('td, th'));
                rows.push(cells.map(c => c.textContent.trim()));
            });
            return { headers, rows };
        },
        
        // Wait for element to appear (with timeout)
        waitForElement: (selector, timeout = 5000) => {
            return new Promise((resolve, reject) => {
                if (document.querySelector(selector)) return resolve(true);
                const observer = new MutationObserver(() => {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); reject(new Error('Timeout')); }, timeout);
            });
        },
        
        // Auto-scroll page to load infinite scroll content
        autoScroll: (options = {}) => {
            const { delay = 1000, maxScrolls = 10 } = options;
            return new Promise((resolve) => {
                let count = 0, lastH = document.body.scrollHeight;
                const interval = setInterval(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                    count++;
                    setTimeout(() => {
                        const newH = document.body.scrollHeight;
                        if (newH === lastH || count >= maxScrolls) {
                            clearInterval(interval);
                            resolve(count);
                        }
                        lastH = newH;
                    }, delay);
                }, delay);
            });
        },
        
        // Watch for DOM changes with MutationObserver
        watchChanges: (selector, callback, options = {}) => {
            const target = document.querySelector(selector);
            if (!target) throw new Error('Element not found: ' + selector);
            
            const config = {
                childList: options.childList !== false,
                subtree: options.subtree !== false,
                attributes: options.attributes || false,
                characterData: options.characterData || false,
                attributeOldValue: options.attributeOldValue || false,
                characterDataOldValue: options.characterDataOldValue || false
            };
            
            const observer = new MutationObserver((mutations) => {
                callback(mutations, observer);
            });
            
            observer.observe(target, config);
            
            return observer;
        },
        
        // Wait for element to change (text, attributes, children)
        waitForChange: (selector, options = {}) => {
            const { timeout = 10000, type = 'any' } = options;
            
            return new Promise((resolve, reject) => {
                const target = document.querySelector(selector);
                if (!target) {
                    reject(new Error('Element not found: ' + selector));
                    return;
                }
                
                const config = {
                    childList: type === 'any' || type === 'children',
                    subtree: true,
                    attributes: type === 'any' || type === 'attributes',
                    characterData: type === 'any' || type === 'text'
                };
                
                const observer = new MutationObserver((mutations) => {
                    observer.disconnect();
                    resolve({ changed: true, mutations });
                });
                
                observer.observe(target, config);
                
                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error('Timeout waiting for change'));
                }, timeout);
            });
        },
        
        // Monitor element until condition is met
        waitUntil: (selector, condition, options = {}) => {
            const { timeout = 10000, checkInterval = 100 } = options;
            
            return new Promise((resolve, reject) => {
                const target = document.querySelector(selector);
                if (!target) {
                    reject(new Error('Element not found: ' + selector));
                    return;
                }
                
                // Check immediately
                if (condition(target)) {
                    resolve(true);
                    return;
                }
                
                // Use MutationObserver for efficiency
                const observer = new MutationObserver(() => {
                    if (condition(target)) {
                        observer.disconnect();
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                });
                
                observer.observe(target, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    characterData: true
                });
                
                // Fallback polling in case mutation doesn't trigger
                const intervalId = setInterval(() => {
                    if (condition(target)) {
                        observer.disconnect();
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                }, checkInterval);
                
                const timeoutId = setTimeout(() => {
                    observer.disconnect();
                    clearInterval(intervalId);
                    reject(new Error('Timeout waiting for condition'));
                }, timeout);
            });
        },
        
        // Evaluate arbitrary JavaScript code
        evaluate: (code) => eval(code),
        
        // Show toast notification in console
        toast: (msg, type = 'info') => console.log('[VBox Toast]', type.toUpperCase(), ':', msg),
        
        // Screenshot element and save to Downloads folder
        screenshot: async (selector, filename) => {
            try {
                console.log('[VBox] Taking screenshot of:', selector);
                
                const element = selector ? document.querySelector(selector) : document.body;
                if (!element) {
                    throw new Error('Element not found: ' + selector);
                }
                
                const rect = element.getBoundingClientRect();
                console.log('[VBox] Element rect:', rect);
                
                if (typeof window.vboxScreenshot !== 'undefined') {
                    console.log('[VBox] Using webview screenshot API...');
                    
                    const result = await window.vboxScreenshot.capture({
                        selector: selector,
                        filename: filename || `screenshot-${Date.now()}.png`,
                        rect: {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                    
                    console.log('[VBox] Screenshot result:', result);
                    return result;
                }
                
                console.error('[VBox] Screenshot API not available');
                return { 
                    success: false, 
                    error: 'Screenshot API not available. Make sure webview preload is configured correctly.' 
                };
            } catch (error) {
                console.error('[VBox] Screenshot error:', error);
                return { success: false, error: error.message };
            }
        },
        
        // Add file to download manager
        shouldDownload: async (filepath, filename) => {
            try {
                if (!filename) {
                    filename = filepath.split(/[\\/]/).pop();
                }
                
                console.log('[VBox] Adding to download manager:', filename);
                
                if (typeof window.vboxDownloads !== 'undefined') {
                    console.log('[VBox] Using webview IPC API...');
                    const result = await window.vboxDownloads.addToDownloads({ filepath, filename });
                    
                    if (result.success) {
                        console.log('[VBox] File added to download manager');
                    } else {
                        console.error('[VBox] Failed to add to download manager:', result.error);
                    }
                    
                    return result;
                }
                
                console.error('[VBox] Download manager API not available');
                return { 
                    success: false, 
                    error: 'Download manager API not available. Make sure webview preload is configured correctly.' 
                };
            } catch (error) {
                console.error('[VBox] shouldDownload error:', error);
                return { success: false, error: error.message };
            }
        },
        
        // PowerPoint generation APIs
        ppt: {
            // Create PowerPoint from scratch with slides
            create: () => ({
                slides: [],
                addTitleSlide: function(title, subtitle) {
                    this.slides.push({ type: 'title', title, subtitle: subtitle || '' });
                    return this;
                },
                addSlide: function(title) {
                    this.slides.push({ type: 'content', title, content: [] });
                    return this;
                },
                addText: function(text) {
                    const last = this.slides[this.slides.length - 1];
                    if (last) {
                        if (!last.content) last.content = [];
                        last.content.push({ type: 'text', text });
                    }
                    return this;
                },
                addTable: function(rows) {
                    const last = this.slides[this.slides.length - 1];
                    if (last) {
                        if (!last.content) last.content = [];
                        last.content.push({ type: 'table', rows });
                    }
                    return this;
                },
                addImage: function(imagePath, options = {}) {
                    const last = this.slides[this.slides.length - 1];
                    if (last) {
                        if (!last.content) last.content = [];
                        last.content.push({ 
                            type: 'image', 
                            path: imagePath,
                            options: {
                                x: options.x || 1,
                                y: options.y || 1.5,
                                w: options.w || 8,
                                h: options.h || 4,
                                ...options
                            }
                        });
                    }
                    return this;
                },
                download: async function(filename) {
                    console.log('[VBox PPT] Generating:', filename);
                    console.log('[VBox PPT] Slides:', this.slides.length);
                    
                    try {
                        if (typeof window.vboxPowerPoint !== 'undefined') {
                            console.log('[VBox PPT] Using webview IPC API...');
                            
                            const result = await window.vboxPowerPoint.generate({
                                slides: this.slides,
                                filename: filename || 'report.pptx',
                                title: 'VBox Report',
                                author: 'VBox Script'
                            });
                            
                            console.log('[VBox PPT] Generation result:', result);
                            
                            if (result && result.success && result.path) {
                                console.log('[VBox PPT] Adding to download manager...');
                                const downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                                console.log('[VBox PPT] Download manager result:', downloadResult);
                            }
                            
                            return result;
                        }
                        
                        console.error('[VBox PPT] PowerPoint API not available in this context');
                        return { 
                            success: false, 
                            error: 'PowerPoint API not available. Make sure webview preload is configured correctly.' 
                        };
                    } catch (error) {
                        console.error('[VBox PPT] Error:', error);
                        return { success: false, error: error.message };
                    }
                }
            }),
            
            // Generate PowerPoint from template with variable replacement
            useTemplate: async (templateName, variables, outputFilename) => {
                console.log('[VBox PPT] Using template:', templateName);
                console.log('[VBox PPT] Variables:', variables);
                
                try {
                    if (typeof window.vboxPowerPoint !== 'undefined') {
                        console.log('[VBox PPT] Processing template via IPC...');
                        
                        const result = await window.vboxPowerPoint.processTemplate(
                            templateName,
                            variables,
                            outputFilename || `report-${Date.now()}.pptx`
                        );
                        
                        console.log('[VBox PPT] Template result:', result);
                        
                        if (result && result.success && result.path) {
                            console.log('[VBox PPT] Adding to download manager...');
                            const downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                            console.log('[VBox PPT] Download manager result:', downloadResult);
                        }
                        
                        return result;
                    }
                    
                    console.error('[VBox PPT] PowerPoint API not available');
                    return { 
                        success: false, 
                        error: 'PowerPoint API not available. Make sure webview preload is configured correctly.' 
                    };
                } catch (error) {
                    console.error('[VBox PPT] Template error:', error);
                    return { success: false, error: error.message };
                }
            },
            
            // List available PowerPoint templates
            listTemplates: async () => {
                try {
                    if (typeof window.vboxPowerPoint !== 'undefined') {
                        return await window.vboxPowerPoint.listTemplates();
                    }
                    return { success: false, error: 'PowerPoint API not available' };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
        },
        
        sendToVBox: (data) => { console.log('[VBox]', data); return data; },
        
        // Save file to Downloads folder and add to download manager
        saveFile: async (content, filename, type = 'text/html') => {
            try {
                console.log('[VBox] Saving file:', filename);
                
                if (typeof window.vboxFile !== 'undefined') {
                    console.log('[VBox] Using file save API...');
                    
                    const result = await window.vboxFile.save(content, filename, type);
                    
                    if (result.success) {
                        console.log('[VBox] File saved:', result.path);
                        
                        // Add to download manager
                        const downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                        console.log('[VBox] Added to download manager:', downloadResult);
                    }
                    
                    return result;
                }
                
                console.error('[VBox] File save API not available');
                return { 
                    success: false, 
                    error: 'File save API not available. Make sure webview preload is configured correctly.' 
                };
            } catch (error) {
                console.error('[VBox] saveFile error:', error);
                return { success: false, error: error.message };
            }
        },
        
        // Open input window to collect user input (text, number, date, daterange, select, textarea)
        openInput: async (config) => {
            try {
                console.log('[VBox] Opening input window:', config);
                console.log('[VBox] window.vboxInput:', typeof window.vboxInput);
                console.log('[VBox] window.scriptInputStore:', typeof window.scriptInputStore);
                
                if (typeof window.vboxInput !== 'undefined') {
                    console.log('[VBox] In webview, calling window.vboxInput.open()');
                    const result = await window.vboxInput.open(config);
                    console.log('[VBox] vboxInput.open() result:', result);
                    return result;
                } else if (typeof window.scriptInputStore !== 'undefined') {
                    console.log('[VBox] In main window, calling scriptInputStore.open()');
                    return await window.scriptInputStore.open(config);
                }
                
                console.error('[VBox] Input API not available');
                return null;
            } catch (error) {
                console.error('[VBox] openInput error:', error);
                console.error('[VBox] openInput error stack:', error.stack);
                return null;
            }
        },
        
        // Get active workspace/profile info (works in both main window and webview)
        getActiveProfile: async () => {
            try {
                // In webview context, use IPC to get workspace info from main process
                if (typeof window.vboxContext !== 'undefined') {
                    console.log('[VBox] Getting workspace info via IPC...');
                    const result = await window.vboxContext.getWorkspaceInfo();
                    return result;
                }
                
                // In main window context, use workspaceStore directly
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
                
                // Fallback: not available
                console.warn('[VBox] Active profile info not available');
                return {
                    success: false,
                    error: 'Profile info not available'
                };
            } catch (error) {
                console.error('[VBox] getActiveProfile error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    };
    
    window.vbox = window.__VBOX_API__;
    
    console.log('[VBox] API injected successfully');
    console.log('[VBox] window.vbox:', typeof window.vbox);
    console.log('[VBox] window.vbox.openInput:', typeof window.vbox.openInput);
})();
