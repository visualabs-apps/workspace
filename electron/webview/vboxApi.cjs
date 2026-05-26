function initVBoxApi() {
    if (typeof window.__VBOX_API__ !== 'undefined') {
        return;
    }

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
        APP_NAME: 'VisualBox',
        VERSION: '1.0.0',

        isVBox: function() {
            return true;
        },

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

        click: function(selector) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            element.click();
            return true;
        },

        type: function(selector, text, options) {
            if (options === undefined) options = {};
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);

            const { delay = 0, clear = false } = options;

            if (clear) {
                setValueWithEvents(element, '');
            }

            if (delay > 0) {
                let index = 0;
                let current = clear ? '' : element.value;
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

        scrollTo: function(selector, options) {
            if (options === undefined) options = {};
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);

            const { behavior = 'smooth', block = 'center' } = options;
            element.scrollIntoView({ behavior, block });
            return true;
        },

        _screenshotIsIPC: true,
        screenshot: async function(selector, filename) {
            try {
                const element = selector ? document.querySelector(selector) : document.body;
                if (!element) throw new Error('Element not found: ' + selector);

                const rect = element.getBoundingClientRect();

                if (typeof window.vboxScreenshot !== 'undefined') {
                    return await window.vboxScreenshot.capture({
                        selector: selector,
                        filename: filename || ('screenshot-' + Date.now() + '.png'),
                        rect: {
                            x: rect.x,
                            y: rect.y,
                            width: rect.width,
                            height: rect.height
                        }
                    });
                }

                return { success: false, error: 'Screenshot API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

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

        exists: function(selector) {
            return document.querySelector(selector) !== null;
        },

        count: function(selector) {
            return document.querySelectorAll(selector).length;
        },

        query: function(selector, attribute) {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                return [];
            }

            const results = [];
            elements.forEach((el, index) => {
                const item = {
                    index: index,
                    tag: el.tagName.toLowerCase(),
                    text: el.textContent.trim().substring(0, 200)
                };

                if (attribute) {
                    item[attribute] = el.getAttribute(attribute);
                } else {
                    if (el.id) item.id = el.id;
                    if (el.className) item.class = el.className;
                    if (el.href) item.href = el.href;
                    if (el.src) item.src = el.src;
                    if (el.value !== undefined) item.value = el.value;
                }

                results.push(item);
            });

            return results;
        },

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

        scrapeImages: function(options) {
            if (options === undefined) options = {};
            const { selector = 'img[src]', minWidth = 0, minHeight = 0 } = options;
            const images = [];
            const elements = document.querySelectorAll(selector);

            elements.forEach((el, index) => {
                const src = el.getAttribute('src');
                if (!src) return;

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

        evaluate: function(code) {
            return eval(code);
        },

        toast: function(message, type) {
            // Toast notification silently handled
        },

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
                                    await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                                }

                                return result;
                            }

                            return { success: false, error: 'PowerPoint API not available' };
                        } catch (error) {
                            return { success: false, error: error.message };
                        }
                    }
                };
            }
        },

        sendToVBox: function(data) {
            return data;
        },

        shouldDownload: async function(filepath, filename) {
            try {
                if (!filename) {
                    filename = filepath.split(/[\\/]/).pop();
                }

                if (typeof window.vboxDownloads !== 'undefined') {
                    return await window.vboxDownloads.addToDownloads({ filepath, filename });
                }

                return { success: false, error: 'Download manager API not available' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        },

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

        openInput: async function(config) {
            try {
                if (typeof window.vboxInput !== 'undefined') {
                    return await window.vboxInput.open(config);
                } else if (typeof window.scriptInputStore !== 'undefined') {
                    return await window.scriptInputStore.open(config);
                }

                return null;
            } catch (error) {
                return null;
            }
        },

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

            target.dispatchEvent(new KeyboardEvent('keydown', eventInit));

            if (key.length === 1) {
                target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
            }

            target.dispatchEvent(new KeyboardEvent('keyup', eventInit));

            return true;
        },

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

        select: function(selector, value) {
            const element = document.querySelector(selector);
            if (!element) throw new Error('Element not found: ' + selector);
            if (element.tagName !== 'SELECT') throw new Error('Element is not a <select>: ' + selector);

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

                let previousEntryCount = performance.getEntriesByType('resource').length;

                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach(() => {
                        lastRequestTime = Date.now();
                    });
                });

                try {
                    observer.observe({ entryTypes: ['resource'] });
                } catch (e) {}

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
                return {
                    success: false,
                    error: 'Cannot access cross-origin iframe: ' + error.message,
                    url: iframe.src
                };
            }
        },

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

    window.runVBoxScript = async function(scriptCode) {
        try {
            if (!window.__VBOX_API__) {
                return { success: false, error: 'VBox API not available' };
            }

            if (!scriptCode || typeof scriptCode !== 'string') {
                return { success: false, error: 'Invalid script code' };
            }

            const vbox = window.__VBOX_API__;

            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const userFunction = new AsyncFunction('vbox', scriptCode);
            const result = await userFunction(vbox);

            try {
                const serialized = JSON.parse(JSON.stringify(result));
                return { success: true, result: serialized };
            } catch (e) {
                return { success: true, result: String(result) };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Unknown error',
                stack: error.stack,
                name: error.name
            };
        }
    };
}

module.exports = { init: initVBoxApi };
