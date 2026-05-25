(function() {
    // Console override is already handled by webview-preload.cjs
    // Do NOT override console here to avoid double IPC forwarding
    
    // If API already exists (from webview-preload.cjs), merge missing methods into it
    var existingApi = window.__VBOX_API__;
    
    if (existingApi) {
        // Merge methods that may be missing from the preload API
        if (!existingApi.watchChanges) {
            existingApi.watchChanges = function(selector, callback, options) {
                if (options === undefined) options = {};
                var target = document.querySelector(selector);
                if (!target) throw new Error('Element not found: ' + selector);
                
                var config = {
                    childList: options.childList !== false,
                    subtree: options.subtree !== false,
                    attributes: options.attributes || false,
                    characterData: options.characterData || false,
                    attributeOldValue: options.attributeOldValue || false,
                    characterDataOldValue: options.characterDataOldValue || false
                };
                
                var observer = new MutationObserver(function(mutations) {
                    callback(mutations, observer);
                });
                
                observer.observe(target, config);
                return observer;
            };
        }
        
        if (!existingApi.waitForChange) {
            existingApi.waitForChange = function(selector, options) {
                if (options === undefined) options = {};
                var timeout = options.timeout || 10000;
                var type = options.type || 'any';
                
                return new Promise(function(resolve, reject) {
                    var target = document.querySelector(selector);
                    if (!target) {
                        reject(new Error('Element not found: ' + selector));
                        return;
                    }
                    
                    var config = {
                        childList: type === 'any' || type === 'children',
                        subtree: true,
                        attributes: type === 'any' || type === 'attributes',
                        characterData: type === 'any' || type === 'text'
                    };
                    
                    var observer = new MutationObserver(function(mutations) {
                        observer.disconnect();
                        resolve({ changed: true, mutations: mutations });
                    });
                    
                    observer.observe(target, config);
                    
                    setTimeout(function() {
                        observer.disconnect();
                        reject(new Error('Timeout waiting for change'));
                    }, timeout);
                });
            };
        }
        
        if (!existingApi.waitUntil) {
            existingApi.waitUntil = function(selector, condition, options) {
                if (options === undefined) options = {};
                var timeout = options.timeout || 10000;
                var checkInterval = options.checkInterval || 100;
                
                return new Promise(function(resolve, reject) {
                    var target = document.querySelector(selector);
                    if (!target) {
                        reject(new Error('Element not found: ' + selector));
                        return;
                    }
                    
                    if (condition(target)) {
                        resolve(true);
                        return;
                    }
                    
                    var observer = new MutationObserver(function() {
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
                    
                    var intervalId = setInterval(function() {
                        if (condition(target)) {
                            observer.disconnect();
                            clearInterval(intervalId);
                            clearTimeout(timeoutId);
                            resolve(true);
                        }
                    }, checkInterval);
                    
                    var timeoutId = setTimeout(function() {
                        observer.disconnect();
                        clearInterval(intervalId);
                        reject(new Error('Timeout waiting for condition'));
                    }, timeout);
                });
            };
        }
        
        // Overwrite screenshot with IPC-based implementation if not already IPC-based
        if (!existingApi._screenshotIsIPC) {
            existingApi.screenshot = async function(selector, filename) {
                try {
                    console.log('[VBox] Taking screenshot of:', selector);
                    
                    var element = selector ? document.querySelector(selector) : document.body;
                    if (!element) {
                        throw new Error('Element not found: ' + selector);
                    }
                    
                    var rect = element.getBoundingClientRect();
                    console.log('[VBox] Element rect:', rect);
                    
                    if (typeof window.vboxScreenshot !== 'undefined') {
                        console.log('[VBox] Using webview screenshot API...');
                        
                        var result = await window.vboxScreenshot.capture({
                            selector: selector,
                            filename: filename || ('screenshot-' + Date.now() + '.png'),
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
            };
            existingApi._screenshotIsIPC = true;
        }
        
        // Add shouldDownload if missing
        if (!existingApi.shouldDownload) {
            existingApi.shouldDownload = async function(filepath, filename) {
                try {
                    if (!filename) {
                        filename = filepath.split(/[\\/]/).pop();
                    }
                    
                    console.log('[VBox] Adding to download manager:', filename);
                    
                    if (typeof window.vboxDownloads !== 'undefined') {
                        console.log('[VBox] Using webview IPC API...');
                        var result = await window.vboxDownloads.addToDownloads({ filepath: filepath, filename: filename });
                        
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
            };
        }
        
        // Add saveFile if missing
        if (!existingApi.saveFile) {
            existingApi.saveFile = async function(content, filename, type) {
                if (type === undefined) type = 'text/html';
                try {
                    console.log('[VBox] Saving file:', filename);
                    
                    if (typeof window.vboxFile !== 'undefined') {
                        console.log('[VBox] Using file save API...');
                        
                        var result = await window.vboxFile.save(content, filename, type);
                        
                        if (result.success) {
                            console.log('[VBox] File saved:', result.path);
                            var downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
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
            };
        }
        
        // Add openInput if missing
        if (!existingApi.openInput) {
            existingApi.openInput = async function(config) {
                try {
                    console.log('[VBox] Opening input window:', config);
                    
                    if (typeof window.vboxInput !== 'undefined') {
                        console.log('[VBox] In webview, calling window.vboxInput.open()');
                        var result = await window.vboxInput.open(config);
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
                    return null;
                }
            };
        }
        
        // Add getActiveProfile if missing
        if (!existingApi.getActiveProfile) {
            existingApi.getActiveProfile = async function() {
                try {
                    if (typeof window.vboxContext !== 'undefined') {
                        console.log('[VBox] Getting workspace info via IPC...');
                        var result = await window.vboxContext.getWorkspaceInfo();
                        return result;
                    }
                    
                    if (typeof window.workspaceStore !== 'undefined' && window.workspaceStore.activeWorkspace) {
                        var workspace = window.workspaceStore.activeWorkspace;
                        return {
                            success: true,
                            id: workspace.id,
                            name: workspace.name,
                            url: window.location.href,
                            title: document.title
                        };
                    }
                    
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
            };
        }
        
        // Fix type() to support modern frameworks (React, Vue, Svelte)
        existingApi.type = function(selector, text, options) {
            if (options === undefined) options = {};
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            var delay = options.delay || 0;
            var clear = options.clear !== false; // Default to true for consistency
            
            // Use native setter to trigger framework change detection
            var nativeInputValueSetter;
            try {
                nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value'
                ).set || Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                ).set;
            } catch(e) {
                nativeInputValueSetter = null;
            }
            
            function setValue(element, value) {
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(element, value);
                } else {
                    element.value = value;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            if (clear) {
                setValue(el, '');
            }
            
            if (delay > 0) {
                return new Promise(function(resolve) {
                    var i = 0;
                    var current = clear ? '' : el.value;
                    var interval = setInterval(function() {
                        if (i < text.length) {
                            current += text[i];
                            setValue(el, current);
                            i++;
                        } else {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, delay);
                });
            }
            
            var newValue = clear ? text : el.value + text;
            setValue(el, newValue);
            return true;
        };
        
        // Fix scrapeImages to handle unloaded images
        existingApi.scrapeImages = function(options) {
            if (options === undefined) options = {};
            var selector = options.selector || 'img[src]';
            var minWidth = options.minWidth || 0;
            var minHeight = options.minHeight || 0;
            var images = [];
            document.querySelectorAll(selector).forEach(function(el, i) {
                var src = el.getAttribute('src');
                if (!src) return;
                // Only filter by size if image has loaded (naturalWidth > 0)
                if (el.complete && el.naturalWidth > 0) {
                    if (el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
                }
                var url;
                try { url = new URL(src, window.location.href).href; } catch(e) { url = src; }
                images.push({
                    index: i,
                    url: url,
                    src: src,
                    alt: el.getAttribute('alt') || '',
                    width: el.naturalWidth || 0,
                    height: el.naturalHeight || 0,
                    loaded: el.complete && el.naturalWidth > 0
                });
            });
            return images;
        };
        
        // Fix autoScroll race condition — use recursive setTimeout
        existingApi.autoScroll = function(options) {
            if (options === undefined) options = {};
            var delay = options.delay || 1000;
            var maxScrolls = options.maxScrolls || 10;
            
            return new Promise(function(resolve) {
                var count = 0;
                var lastH = document.body.scrollHeight;
                
                function doScroll() {
                    window.scrollTo(0, document.body.scrollHeight);
                    count++;
                    
                    setTimeout(function() {
                        var newH = document.body.scrollHeight;
                        if (newH === lastH || count >= maxScrolls) {
                            resolve(count);
                        } else {
                            lastH = newH;
                            doScroll();
                        }
                    }, delay);
                }
                
                doScroll();
            });
        };
        
        // Fix extractTable to return consistent object format
        existingApi.extractTable = function(selector) {
            var table = document.querySelector(selector);
            if (!table) return null;
            var headerCells = table.querySelectorAll('thead th, thead td');
            var headers = Array.from(headerCells).map(function(c) { return c.textContent.trim(); });
            var rows = [];
            table.querySelectorAll('tbody tr').forEach(function(row) {
                var cells = Array.from(row.querySelectorAll('td, th'));
                var rowData = {};
                cells.forEach(function(cell, index) {
                    var header = headers[index] || ('column_' + index);
                    rowData[header] = cell.textContent.trim();
                });
                rows.push(rowData);
            });
            return { headers: headers, rows: rows };
        };
        
        // ─── Navigation APIs (IPC-based) ─────────────────────────
        if (!existingApi.navigate) {
            existingApi.navigate = async function(url) {
                try {
                    if (typeof window.vboxNavigation !== 'undefined') {
                        return await window.vboxNavigation.navigate(url);
                    }
                    return { success: false, error: 'Navigation API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.goBack) {
            existingApi.goBack = async function() {
                try {
                    if (typeof window.vboxNavigation !== 'undefined') {
                        return await window.vboxNavigation.goBack();
                    }
                    return { success: false, error: 'Navigation API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.goForward) {
            existingApi.goForward = async function() {
                try {
                    if (typeof window.vboxNavigation !== 'undefined') {
                        return await window.vboxNavigation.goForward();
                    }
                    return { success: false, error: 'Navigation API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.reload) {
            existingApi.reload = async function() {
                try {
                    if (typeof window.vboxNavigation !== 'undefined') {
                        return await window.vboxNavigation.reload();
                    }
                    return { success: false, error: 'Navigation API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        
        // ─── Keyboard API ────────────────────────────────────────
        if (!existingApi.press) {
            existingApi.press = function(key, options) {
                if (options === undefined) options = {};
                var target = options.selector
                    ? document.querySelector(options.selector)
                    : document.activeElement || document.body;
                if (!target && options.selector) throw new Error('Element not found: ' + options.selector);
                var eventInit = {
                    key: key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
                    bubbles: true, cancelable: true,
                    shiftKey: options.shift || false, ctrlKey: options.ctrl || false,
                    altKey: options.alt || false, metaKey: options.meta || false
                };
                target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
                if (key.length === 1) target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
                target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
                return true;
            };
        }
        
        // ─── Mouse APIs ──────────────────────────────────────────
        if (!existingApi.hover) {
            existingApi.hover = function(selector) {
                var el = document.querySelector(selector);
                if (!el) throw new Error('Element not found: ' + selector);
                var rect = el.getBoundingClientRect();
                var x = rect.left + rect.width / 2;
                var y = rect.top + rect.height / 2;
                var init = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
                el.dispatchEvent(new MouseEvent('pointerenter', init));
                el.dispatchEvent(new MouseEvent('mouseover', init));
                el.dispatchEvent(new MouseEvent('mousemove', init));
                return true;
            };
        }
        if (!existingApi.drag) {
            existingApi.drag = function(sourceSelector, targetSelector) {
                var source = document.querySelector(sourceSelector);
                var target = document.querySelector(targetSelector);
                if (!source) throw new Error('Source not found: ' + sourceSelector);
                if (!target) throw new Error('Target not found: ' + targetSelector);
                var sRect = source.getBoundingClientRect();
                var tRect = target.getBoundingClientRect();
                var dt = new DataTransfer();
                source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt, clientX: sRect.left + sRect.width/2, clientY: sRect.top + sRect.height/2 }));
                target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, clientX: tRect.left + tRect.width/2, clientY: tRect.top + tRect.height/2 }));
                target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, clientX: tRect.left + tRect.width/2, clientY: tRect.top + tRect.height/2 }));
                source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
                return true;
            };
        }
        
        // ─── Form API ────────────────────────────────────────────
        if (!existingApi.select) {
            existingApi.select = function(selector, value) {
                var el = document.querySelector(selector);
                if (!el) throw new Error('Element not found: ' + selector);
                if (el.tagName !== 'SELECT') throw new Error('Element is not a <select>: ' + selector);
                var found = false;
                for (var i = 0; i < el.options.length; i++) {
                    if (el.options[i].value === value || el.options[i].textContent.trim() === value) {
                        el.selectedIndex = i; found = true; break;
                    }
                }
                if (!found) throw new Error('Option not found: ' + value);
                var setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
                if (setter) setter.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            };
        }
        
        // ─── Cookie APIs (IPC-based) ─────────────────────────────
        if (!existingApi.getCookies) {
            existingApi.getCookies = async function(filter) {
                try {
                    if (typeof window.vboxCookies !== 'undefined') return await window.vboxCookies.get(filter || {});
                    return { success: false, error: 'Cookie API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.setCookie) {
            existingApi.setCookie = async function(cookie) {
                try {
                    if (typeof window.vboxCookies !== 'undefined') return await window.vboxCookies.set(cookie);
                    return { success: false, error: 'Cookie API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        
        // ─── Dialog API (IPC-based) ──────────────────────────────
        if (!existingApi.handleDialog) {
            existingApi.handleDialog = async function(options) {
                try {
                    if (typeof window.vboxDialog !== 'undefined') return await window.vboxDialog.handle(options || {});
                    return { success: false, error: 'Dialog API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.clearDialogHandler) {
            existingApi.clearDialogHandler = async function() {
                try {
                    if (typeof window.vboxDialog !== 'undefined') return await window.vboxDialog.clear();
                    return { success: false, error: 'Dialog API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        
        // ─── Network API ─────────────────────────────────────────
        if (!existingApi.waitForNetworkIdle) {
            existingApi.waitForNetworkIdle = function(options) {
                if (options === undefined) options = {};
                var timeout = options.timeout || 10000;
                var idleTime = options.idleTime || 1000;
                return new Promise(function(resolve) {
                    var lastRequestTime = Date.now();
                    var resolved = false;
                    var previousEntryCount = performance.getEntriesByType('resource').length;
                    var observer;
                    try {
                        observer = new PerformanceObserver(function(list) {
                            list.getEntries().forEach(function() { lastRequestTime = Date.now(); });
                        });
                        observer.observe({ entryTypes: ['resource'] });
                    } catch (e) {}
                    var checkInterval = setInterval(function() {
                        var current = performance.getEntriesByType('resource').length;
                        if (current > previousEntryCount) { lastRequestTime = Date.now(); previousEntryCount = current; }
                        if (Date.now() - lastRequestTime >= idleTime) {
                            if (!resolved) { resolved = true; clearInterval(checkInterval); clearTimeout(timeoutTimer); try { observer.disconnect(); } catch(e) {} resolve({ success: true, idleTime: idleTime }); }
                        }
                    }, 200);
                    var timeoutTimer = setTimeout(function() {
                        if (!resolved) { resolved = true; clearInterval(checkInterval); try { observer.disconnect(); } catch(e) {} resolve({ success: false, error: 'Network idle timeout' }); }
                    }, timeout);
                });
            };
        }
        
        // ─── iframe API ──────────────────────────────────────────
        if (!existingApi.getIFrameContent) {
            existingApi.getIFrameContent = function(selector) {
                var iframe = document.querySelector(selector);
                if (!iframe) throw new Error('Iframe not found: ' + selector);
                try {
                    var doc = iframe.contentDocument || iframe.contentWindow.document;
                    return { success: true, html: doc.documentElement.outerHTML, url: iframe.src, title: doc.title || '' };
                } catch (e) {
                    return { success: false, error: 'Cannot access cross-origin iframe: ' + e.message, url: iframe.src };
                }
            };
        }
        
        // ─── Tab/Profile Management APIs (IPC-based, MCP-ready) ──
        if (!existingApi.listProfiles) {
            existingApi.listProfiles = async function() {
                try {
                    if (typeof window.vboxTabs !== 'undefined') return await window.vboxTabs.listProfiles();
                    return { success: false, error: 'Tab management API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.listTabs) {
            existingApi.listTabs = async function() {
                try {
                    if (typeof window.vboxTabs !== 'undefined') return await window.vboxTabs.listTabs();
                    return { success: false, error: 'Tab management API not available' };
                } catch ( e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.switchTab) {
            existingApi.switchTab = async function(tabId) {
                try {
                    if (typeof window.vboxTabs !== 'undefined') return await window.vboxTabs.switchTab(tabId);
                    return { success: false, error: 'Tab management API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        if (!existingApi.getTabInfo) {
            existingApi.getTabInfo = async function(tabId) {
                try {
                    if (typeof window.vboxTabs !== 'undefined') return await window.vboxTabs.getPageInfo(tabId || null);
                    return { success: false, error: 'Tab management API not available' };
                } catch (e) { return { success: false, error: e.message }; }
            };
        }
        
        console.log('[VBox] API methods merged from inline injection');
        return;
    }
    
    // No existing API — create full implementation (fallback for non-preload contexts)
    window.__VBOX_API__ = {
        // Check if running in VBox environment
        isVBox: function() { return true; },
        
        // Get current page information
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
        
        // Click an element by selector (with visibility check)
        click: function(selector) {
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            
            // Check visibility
            if (el.offsetParent === null && el.tagName !== 'BODY') {
                throw new Error('Element is hidden: ' + selector);
            }
            if (el.disabled) {
                throw new Error('Element is disabled: ' + selector);
            }
            
            el.click();
            return true;
        },
        
        // Type text into an element (supports delay and clear options, framework-compatible)
        type: function(selector, text, options) {
            if (options === undefined) options = {};
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            var delay = options.delay || 0;
            var clear = options.clear !== false; // Default to true for consistency
            
            var nativeInputValueSetter;
            try {
                nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value'
                ).set || Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, 'value'
                ).set;
            } catch(e) {
                nativeInputValueSetter = null;
            }
            
            function setValue(element, value) {
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(element, value);
                } else {
                    element.value = value;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            if (clear) {
                setValue(el, '');
            }
            
            if (delay > 0) {
                return new Promise(function(resolve) {
                    var i = 0;
                    var current = clear ? '' : el.value;
                    var interval = setInterval(function() {
                        if (i < text.length) {
                            current += text[i];
                            setValue(el, current);
                            i++;
                        } else {
                            clearInterval(interval);
                            resolve(true);
                        }
                    }, delay);
                });
            }
            
            var newValue = clear ? text : el.value + text;
            setValue(el, newValue);
            return true;
        },
        
        // Scroll element into view
        scrollTo: function(selector, options) {
            if (options === undefined) options = {};
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            el.scrollIntoView({ behavior: options.behavior || 'smooth', block: options.block || 'center' });
            return true;
        },
        
        // Get/Set attributes
        getAttribute: function(selector, attr) {
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.getAttribute(attr);
        },
        
        setAttribute: function(selector, attr, value) {
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            el.setAttribute(attr, value);
            return true;
        },
        
        // Get text/HTML
        getText: function(selector) {
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.textContent.trim();
        },
        
        getHTML: function(selector) {
            var el = document.querySelector(selector);
            if (!el) throw new Error('Element not found: ' + selector);
            return el.innerHTML;
        },
        
        // Check existence and count
        exists: function(selector) { return document.querySelector(selector) !== null; },
        count: function(selector) { return document.querySelectorAll(selector).length; },
        
        // Scrape links
        scrapeLinks: function(options) {
            if (options === undefined) options = {};
            var selector = options.selector || 'a[href]';
            var filter = options.filter || null;
            var links = [];
            document.querySelectorAll(selector).forEach(function(el, i) {
                var href = el.getAttribute('href');
                if (!href) return;
                var url;
                try { url = new URL(href, window.location.href).href; } catch(e) { url = href; }
                if (filter && !filter(url, el)) return;
                links.push({ index: i, url: url, href: href, text: el.textContent.trim() });
            });
            return links;
        },
        
        // Scrape images (handles unloaded images)
        scrapeImages: function(options) {
            if (options === undefined) options = {};
            var selector = options.selector || 'img[src]';
            var minWidth = options.minWidth || 0;
            var minHeight = options.minHeight || 0;
            var images = [];
            document.querySelectorAll(selector).forEach(function(el, i) {
                var src = el.getAttribute('src');
                if (!src) return;
                if (el.complete && el.naturalWidth > 0) {
                    if (el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
                }
                var url;
                try { url = new URL(src, window.location.href).href; } catch(e) { url = src; }
                images.push({
                    index: i,
                    url: url,
                    src: src,
                    alt: el.getAttribute('alt') || '',
                    width: el.naturalWidth || 0,
                    height: el.naturalHeight || 0,
                    loaded: el.complete && el.naturalWidth > 0
                });
            });
            return images;
        },
        
        // Extract data from multiple selectors
        extractData: function(selectors) {
            var data = {};
            for (var key in selectors) {
                if (selectors.hasOwnProperty(key)) {
                    var el = document.querySelector(selectors[key]);
                    if (el) data[key] = el.textContent.trim();
                }
            }
            return data;
        },
        
        // Extract table data (consistent object format)
        extractTable: function(selector) {
            var table = document.querySelector(selector);
            if (!table) return null;
            var headerCells = table.querySelectorAll('thead th, thead td');
            var headers = Array.from(headerCells).map(function(c) { return c.textContent.trim(); });
            var rows = [];
            table.querySelectorAll('tbody tr').forEach(function(row) {
                var cells = Array.from(row.querySelectorAll('td, th'));
                var rowData = {};
                cells.forEach(function(cell, index) {
                    var header = headers[index] || ('column_' + index);
                    rowData[header] = cell.textContent.trim();
                });
                rows.push(rowData);
            });
            return { headers: headers, rows: rows };
        },
        
        // Wait for element to appear (with timeout)
        waitForElement: function(selector, timeout) {
            if (timeout === undefined) timeout = 5000;
            return new Promise(function(resolve, reject) {
                if (document.querySelector(selector)) return resolve(true);
                var observer = new MutationObserver(function() {
                    if (document.querySelector(selector)) {
                        observer.disconnect();
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                var timeoutId = setTimeout(function() { 
                    observer.disconnect(); 
                    reject(new Error('Timeout waiting for element: ' + selector)); 
                }, timeout);
            });
        },
        
        // Auto-scroll page (fixed: recursive setTimeout instead of nested setInterval+setTimeout)
        autoScroll: function(options) {
            if (options === undefined) options = {};
            var delay = options.delay || 1000;
            var maxScrolls = options.maxScrolls || 10;
            
            return new Promise(function(resolve) {
                var count = 0;
                var lastH = document.body.scrollHeight;
                
                function doScroll() {
                    window.scrollTo(0, document.body.scrollHeight);
                    count++;
                    
                    setTimeout(function() {
                        var newH = document.body.scrollHeight;
                        if (newH === lastH || count >= maxScrolls) {
                            resolve(count);
                        } else {
                            lastH = newH;
                            doScroll();
                        }
                    }, delay);
                }
                
                doScroll();
            });
        },
        
        // Watch for DOM changes with MutationObserver
        watchChanges: function(selector, callback, options) {
            if (options === undefined) options = {};
            var target = document.querySelector(selector);
            if (!target) throw new Error('Element not found: ' + selector);
            
            var config = {
                childList: options.childList !== false,
                subtree: options.subtree !== false,
                attributes: options.attributes || false,
                characterData: options.characterData || false,
                attributeOldValue: options.attributeOldValue || false,
                characterDataOldValue: options.characterDataOldValue || false
            };
            
            var observer = new MutationObserver(function(mutations) {
                callback(mutations, observer);
            });
            
            observer.observe(target, config);
            return observer;
        },
        
        // Wait for element to change
        waitForChange: function(selector, options) {
            if (options === undefined) options = {};
            var timeout = options.timeout || 10000;
            var type = options.type || 'any';
            
            return new Promise(function(resolve, reject) {
                var target = document.querySelector(selector);
                if (!target) {
                    reject(new Error('Element not found: ' + selector));
                    return;
                }
                
                var config = {
                    childList: type === 'any' || type === 'children',
                    subtree: true,
                    attributes: type === 'any' || type === 'attributes',
                    characterData: type === 'any' || type === 'text'
                };
                
                var observer = new MutationObserver(function(mutations) {
                    observer.disconnect();
                    resolve({ changed: true, mutations: mutations });
                });
                
                observer.observe(target, config);
                
                setTimeout(function() {
                    observer.disconnect();
                    reject(new Error('Timeout waiting for change'));
                }, timeout);
            });
        },
        
        // Monitor element until condition is met
        waitUntil: function(selector, condition, options) {
            if (options === undefined) options = {};
            var timeout = options.timeout || 10000;
            var checkInterval = options.checkInterval || 100;
            
            return new Promise(function(resolve, reject) {
                var target = document.querySelector(selector);
                if (!target) {
                    reject(new Error('Element not found: ' + selector));
                    return;
                }
                
                if (condition(target)) {
                    resolve(true);
                    return;
                }
                
                var observer = new MutationObserver(function() {
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
                
                var intervalId = setInterval(function() {
                    if (condition(target)) {
                        observer.disconnect();
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                }, checkInterval);
                
                var timeoutId = setTimeout(function() {
                    observer.disconnect();
                    clearInterval(intervalId);
                    reject(new Error('Timeout waiting for condition'));
                }, timeout);
            });
        },
        
        // REMOVED: evaluate() - Too dangerous for AI automation
        // Use specific APIs instead: getText(), getAttribute(), extractData(), etc.
        
        // Show toast notification in console
        toast: function(msg, type) {
            if (type === undefined) type = 'info';
            console.log('[VBox Toast]', type.toUpperCase(), ':', msg);
        },
        
        // Screenshot element and save to Downloads folder (IPC-based)
        _screenshotIsIPC: true,
        screenshot: async function(selector, filename) {
            try {
                console.log('[VBox] Taking screenshot of:', selector);
                
                var element = selector ? document.querySelector(selector) : document.body;
                if (!element) {
                    throw new Error('Element not found: ' + selector);
                }
                
                var rect = element.getBoundingClientRect();
                console.log('[VBox] Element rect:', rect);
                
                if (typeof window.vboxScreenshot !== 'undefined') {
                    console.log('[VBox] Using webview screenshot API...');
                    
                    var result = await window.vboxScreenshot.capture({
                        selector: selector,
                        filename: filename || ('screenshot-' + Date.now() + '.png'),
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
        shouldDownload: async function(filepath, filename) {
            try {
                if (!filename) {
                    filename = filepath.split(/[\\/]/).pop();
                }
                
                console.log('[VBox] Adding to download manager:', filename);
                
                if (typeof window.vboxDownloads !== 'undefined') {
                    console.log('[VBox] Using webview IPC API...');
                    var result = await window.vboxDownloads.addToDownloads({ filepath: filepath, filename: filename });
                    
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
            create: function() {
                return {
                    slides: [],
                    addTitleSlide: function(title, subtitle) {
                        this.slides.push({ type: 'title', title: title, subtitle: subtitle || '' });
                        return this;
                    },
                    addSlide: function(title) {
                        this.slides.push({ type: 'content', title: title, content: [] });
                        return this;
                    },
                    addText: function(text) {
                        var last = this.slides[this.slides.length - 1];
                        if (last) {
                            if (!last.content) last.content = [];
                            last.content.push({ type: 'text', text: text });
                        }
                        return this;
                    },
                    addTable: function(rows) {
                        var last = this.slides[this.slides.length - 1];
                        if (last) {
                            if (!last.content) last.content = [];
                            last.content.push({ type: 'table', rows: rows });
                        }
                        return this;
                    },
                    addImage: function(imagePath, options) {
                        if (options === undefined) options = {};
                        var last = this.slides[this.slides.length - 1];
                        if (last) {
                            if (!last.content) last.content = [];
                            last.content.push({ 
                                type: 'image', 
                                path: imagePath,
                                options: {
                                    x: options.x || 1,
                                    y: options.y || 1.5,
                                    w: options.w || 8,
                                    h: options.h || 4
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
                                
                                var result = await window.vboxPowerPoint.generate({
                                    slides: this.slides,
                                    filename: filename || 'report.pptx',
                                    title: 'VBox Report',
                                    author: 'VBox Script'
                                });
                                
                                console.log('[VBox PPT] Generation result:', result);
                                
                                if (result && result.success && result.path) {
                                    console.log('[VBox PPT] Adding to download manager...');
                                    var downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
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
                };
            },
            
            useTemplate: async function(templateName, variables, outputFilename) {
                console.log('[VBox PPT] Using template:', templateName);
                
                try {
                    if (typeof window.vboxPowerPoint !== 'undefined') {
                        console.log('[VBox PPT] Processing template via IPC...');
                        
                        var result = await window.vboxPowerPoint.processTemplate(
                            templateName,
                            variables,
                            outputFilename || ('report-' + Date.now() + '.pptx')
                        );
                        
                        console.log('[VBox PPT] Template result:', result);
                        
                        if (result && result.success && result.path) {
                            console.log('[VBox PPT] Adding to download manager...');
                            var downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
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
            
            listTemplates: async function() {
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
        
        sendToVBox: function(data) { console.log('[VBox]', data); return data; },
        
        // Save file to Downloads folder and add to download manager
        saveFile: async function(content, filename, type) {
            if (type === undefined) type = 'text/html';
            try {
                console.log('[VBox] Saving file:', filename);
                
                if (typeof window.vboxFile !== 'undefined') {
                    console.log('[VBox] Using file save API...');
                    
                    var result = await window.vboxFile.save(content, filename, type);
                    
                    if (result.success) {
                        console.log('[VBox] File saved:', result.path);
                        var downloadResult = await window.__VBOX_API__.shouldDownload(result.path, result.filename);
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
        
        // Open input window to collect user input
        openInput: async function(config) {
            try {
                console.log('[VBox] Opening input window:', config);
                
                if (typeof window.vboxInput !== 'undefined') {
                    console.log('[VBox] In webview, calling window.vboxInput.open()');
                    var result = await window.vboxInput.open(config);
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
                return null;
            }
        },
        
        // Get active workspace/profile info
        getActiveProfile: async function() {
            try {
                if (typeof window.vboxContext !== 'undefined') {
                    console.log('[VBox] Getting workspace info via IPC...');
                    var result = await window.vboxContext.getWorkspaceInfo();
                    return result;
                }
                
                if (typeof window.workspaceStore !== 'undefined' && window.workspaceStore.activeWorkspace) {
                    var workspace = window.workspaceStore.activeWorkspace;
                    return {
                        success: true,
                        id: workspace.id,
                        name: workspace.name,
                        url: window.location.href,
                        title: document.title
                    };
                }
                
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
    
    console.log('[VBox] API injected successfully (standalone)');
})();
