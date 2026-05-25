/**
 * VBox API Wrapper for MCP Integration
 * 
 * This wrapper normalizes all VBox API responses to a consistent format:
 * { success: boolean, data?: any, error?: string }
 * 
 * It also adds:
 * - Automatic error handling (try-catch)
 * - Timeout protection
 * - Retry logic for transient failures
 * - Request logging
 */

class VBoxAPIWrapper {
    constructor(vbox, options = {}) {
        this.vbox = vbox;
        this.defaultTimeout = options.timeout || 30000; // 30s default
        this.maxRetries = options.maxRetries || 2;
        this.retryDelay = options.retryDelay || 1000;
        this.logger = options.logger || console;
    }

    /**
     * Wrap a synchronous API call
     */
    wrapSync(fn, ...args) {
        try {
            const result = fn.apply(this.vbox, args);
            return { success: true, data: result };
        } catch (error) {
            this.logger.error('[VBox API Error]', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Wrap an async API call with timeout and retry
     */
    async wrapAsync(fn, args = [], options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const maxRetries = options.maxRetries !== undefined ? options.maxRetries : this.maxRetries;
        
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add timeout wrapper
                const result = await Promise.race([
                    fn.apply(this.vbox, args),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timeout')), timeout)
                    )
                ]);
                
                // Check if result is already in {success, ...} format
                if (result && typeof result === 'object' && 'success' in result) {
                    return result;
                }
                
                // Normalize to standard format
                return { success: true, data: result };
            } catch (error) {
                lastError = error;
                this.logger.warn(`[VBox API] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
                
                // Don't retry on certain errors
                if (this.isNonRetryableError(error)) {
                    break;
                }
                
                // Wait before retry
                if (attempt < maxRetries) {
                    await this.sleep(this.retryDelay);
                }
            }
        }
        
        return { success: false, error: lastError.message };
    }

    /**
     * Check if error should not be retried
     */
    isNonRetryableError(error) {
        const nonRetryablePatterns = [
            'not found',
            'is hidden',
            'is disabled',
            'invalid selector',
            'not available'
        ];
        
        const msg = error.message.toLowerCase();
        return nonRetryablePatterns.some(pattern => msg.includes(pattern));
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate CSS selector
     */
    validateSelector(selector) {
        if (!selector || typeof selector !== 'string') {
            throw new Error('Invalid selector: must be a non-empty string');
        }
        
        try {
            document.querySelector(selector);
        } catch (e) {
            throw new Error(`Invalid CSS selector: ${selector}`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Wrapped API Methods
    // ─────────────────────────────────────────────────────────────

    // Navigation
    async navigate(url) {
        if (!url || typeof url !== 'string') {
            return { success: false, error: 'Invalid URL' };
        }
        return this.wrapAsync(this.vbox.navigate, [url]);
    }

    async goBack() {
        return this.wrapAsync(this.vbox.goBack);
    }

    async goForward() {
        return this.wrapAsync(this.vbox.goForward);
    }

    async reload() {
        return this.wrapAsync(this.vbox.reload);
    }

    // DOM Interaction
    click(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.click, selector);
    }

    async type(selector, text, options = {}) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        
        if (typeof text !== 'string') {
            return { success: false, error: 'Text must be a string' };
        }
        
        return this.wrapAsync(this.vbox.type, [selector, text, options]);
    }

    press(key, options = {}) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid key' };
        }
        return this.wrapSync(this.vbox.press, key, options);
    }

    hover(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.hover, selector);
    }

    select(selector, value) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.select, selector, value);
    }

    drag(sourceSelector, targetSelector) {
        try {
            this.validateSelector(sourceSelector);
            this.validateSelector(targetSelector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.drag, sourceSelector, targetSelector);
    }

    scrollTo(selector, options = {}) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.scrollTo, selector, options);
    }

    // DOM Read
    getText(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.getText, selector);
    }

    getHTML(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.getHTML, selector);
    }

    getAttribute(selector, attribute) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.getAttribute, selector, attribute);
    }

    setAttribute(selector, attribute, value) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.setAttribute, selector, attribute, value);
    }

    exists(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.exists, selector);
    }

    count(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.count, selector);
    }

    // Data Extraction
    scrapeLinks(options = {}) {
        return this.wrapSync(this.vbox.scrapeLinks, options);
    }

    scrapeImages(options = {}) {
        return this.wrapSync(this.vbox.scrapeImages, options);
    }

    extractData(selectors) {
        if (!selectors || typeof selectors !== 'object') {
            return { success: false, error: 'Selectors must be an object' };
        }
        return this.wrapSync(this.vbox.extractData, selectors);
    }

    extractTable(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.extractTable, selector);
    }

    getIFrameContent(selector) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapSync(this.vbox.getIFrameContent, selector);
    }

    // Waiting
    async waitForElement(selector, timeout = 5000) {
        try {
            this.validateSelector(selector);
        } catch (e) {
            return { success: false, error: e.message };
        }
        return this.wrapAsync(this.vbox.waitForElement, [selector, timeout], { timeout: timeout + 1000 });
    }

    async waitForNetworkIdle(options = {}) {
        return this.wrapAsync(this.vbox.waitForNetworkIdle, [options]);
    }

    async autoScroll(options = {}) {
        return this.wrapAsync(this.vbox.autoScroll, [options]);
    }

    // Screenshot
    async screenshot(selector, filename) {
        if (selector) {
            try {
                this.validateSelector(selector);
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return this.wrapAsync(this.vbox.screenshot, [selector, filename]);
    }

    // Cookies
    async getCookies(filter = {}) {
        return this.wrapAsync(this.vbox.getCookies, [filter]);
    }

    async setCookie(cookie) {
        if (!cookie || !cookie.name || !cookie.value || !cookie.domain) {
            return { success: false, error: 'Cookie must have name, value, and domain' };
        }
        return this.wrapAsync(this.vbox.setCookie, [cookie]);
    }

    // Dialog
    async handleDialog(options = {}) {
        return this.wrapAsync(this.vbox.handleDialog, [options]);
    }

    async clearDialogHandler() {
        return this.wrapAsync(this.vbox.clearDialogHandler);
    }

    // File
    async saveFile(content, filename, type = 'text/html') {
        if (!content || !filename) {
            return { success: false, error: 'Content and filename are required' };
        }
        return this.wrapAsync(this.vbox.saveFile, [content, filename, type]);
    }

    // PowerPoint
    pptCreate() {
        return this.wrapSync(this.vbox.ppt.create);
    }

    async pptUseTemplate(templateName, variables, outputFilename) {
        if (!templateName || !variables || !outputFilename) {
            return { success: false, error: 'Template name, variables, and output filename are required' };
        }
        return this.wrapAsync(this.vbox.ppt.useTemplate, [templateName, variables, outputFilename]);
    }

    async pptListTemplates() {
        return this.wrapAsync(this.vbox.ppt.listTemplates);
    }

    // User Input
    async openInput(config) {
        if (!config || !config.title || !config.fields) {
            return { success: false, error: 'Config must have title and fields' };
        }
        return this.wrapAsync(this.vbox.openInput, [config]);
    }

    // Core
    getPageInfo() {
        return this.wrapSync(this.vbox.getPageInfo);
    }

    toast(message, type = 'info') {
        return this.wrapSync(this.vbox.toast, message, type);
    }
}

// Export for Node.js (MCP server)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VBoxAPIWrapper;
}

// Export for browser (if needed)
if (typeof window !== 'undefined') {
    window.VBoxAPIWrapper = VBoxAPIWrapper;
}
