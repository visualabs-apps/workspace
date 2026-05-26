// MCP Service - Wrapper for V-Box MCP API
// Provides browser automation capabilities to AI

class MCPService {
    constructor() {
        this.api = window.api?.mcp;
    }

    /**
     * Check if MCP API is available
     */
    isAvailable() {
        return !!this.api;
    }

    /**
     * Get current page information
     */
    async getPageInfo(tabId = null) {
        try {
            const result = await this.api.getPageInfo(tabId);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] Get page info error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * List all profiles
     */
    async listProfiles() {
        try {
            const result = await this.api.listProfiles();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] List profiles error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * List all tabs
     */
    async listTabs() {
        try {
            const result = await this.api.listTabs();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] List tabs error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Switch to a specific tab
     */
    async switchTab(tabId) {
        try {
            const result = await this.api.switchTab(tabId);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] Switch tab error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a new tab with URL
     */
    async createTab(url, title = 'New Tab') {
        try {
            const result = await this.api.createTab(url, title);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] Create tab error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Navigate to URL and wait for load
     */
    async navigateAndWait(params) {
        try {
            const result = await this.api.navigateAndWait(params);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('[MCP] Navigate and wait error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute VBox API method
     */
    async executeVBoxAPI(method, params = [], tabId = null) {
        try {
            const result = await this.api.executeVBoxAPI({ method, params, tabId });
            return {
                success: result.success,
                data: result.data,
                error: result.error
            };
        } catch (error) {
            console.error('[MCP] Execute VBox API error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get available MCP tools/capabilities
     */
    getAvailableTools() {
        return [
            // Basic Info
            {
                name: 'get_page_info',
                description: 'Get information about the current page (title, URL, content)',
                parameters: { tabId: 'optional - specific tab ID' }
            },
            {
                name: 'list_profiles',
                description: 'List all browser profiles',
                parameters: {}
            },
            {
                name: 'list_tabs',
                description: 'List all open tabs',
                parameters: {}
            },
            {
                name: 'switch_tab',
                description: 'Switch to a specific tab',
                parameters: { tabId: 'required - ID of the tab' }
            },
            {
                name: 'create_tab',
                description: 'Create a new tab with URL',
                parameters: { url: 'required - URL to open', title: 'optional - tab title' }
            },
            {
                name: 'navigate',
                description: 'Navigate to a URL',
                parameters: { url: 'required - URL to navigate to', tabId: 'optional' }
            },
            
            // DOM Queries
            {
                name: 'query',
                description: 'Query element(s) from page using CSS selector',
                parameters: { selector: 'required - CSS selector', attribute: 'optional - attribute to get' }
            },
            {
                name: 'getText',
                description: 'Get text content from element',
                parameters: { selector: 'required - CSS selector' }
            },
            {
                name: 'getAttribute',
                description: 'Get attribute value from element',
                parameters: { selector: 'required', attribute: 'required' }
            },
            
            // Actions
            {
                name: 'click',
                description: 'Click an element',
                parameters: { selector: 'required - CSS selector' }
            },
            {
                name: 'type',
                description: 'Type text into an input field',
                parameters: { selector: 'required', text: 'required', options: 'optional' }
            },
            {
                name: 'select',
                description: 'Select option in dropdown',
                parameters: { selector: 'required', value: 'required' }
            },
            {
                name: 'hover',
                description: 'Hover over an element',
                parameters: { selector: 'required' }
            },
            {
                name: 'press',
                description: 'Press keyboard key',
                parameters: { key: 'required', options: 'optional' }
            },
            
            // Data Extraction
            {
                name: 'extractTable',
                description: 'Extract data from HTML table',
                parameters: { selector: 'required - table CSS selector' }
            },
            {
                name: 'scrapeImages',
                description: 'Get all images from page',
                parameters: { options: 'optional - {selector, includeDataUri}' }
            },
            {
                name: 'scrape',
                description: 'Scrape data using custom selector mapping',
                parameters: { mapping: 'required - object with selectors' }
            },
            
            // Screenshot
            {
                name: 'screenshot',
                description: 'Take screenshot of element or full page',
                parameters: { selector: 'optional - element selector', filename: 'optional' }
            },
            
            // Waiting
            {
                name: 'waitFor',
                description: 'Wait for element to appear',
                parameters: { selector: 'required', options: 'optional - {timeout}' }
            },
            {
                name: 'waitForNetworkIdle',
                description: 'Wait for network requests to finish',
                parameters: { options: 'optional - {timeout, idleTime}' }
            },
            
            // Scrolling
            {
                name: 'autoScroll',
                description: 'Auto scroll page to load lazy content',
                parameters: { options: 'optional - {delay, maxScrolls}' }
            },
            {
                name: 'scrollTo',
                description: 'Scroll to specific position or element',
                parameters: { target: 'required - selector or {x, y}' }
            },
            
            // Cookies
            {
                name: 'getCookies',
                description: 'Get cookies from current page',
                parameters: { filter: 'optional - cookie filter' }
            },
            {
                name: 'setCookie',
                description: 'Set a cookie',
                parameters: { cookie: 'required - cookie object' }
            },
            
            // Navigation
            {
                name: 'goBack',
                description: 'Go back in browser history',
                parameters: {}
            },
            {
                name: 'goForward',
                description: 'Go forward in browser history',
                parameters: {}
            },
            {
                name: 'reload',
                description: 'Reload current page',
                parameters: {}
            }
        ];
    }

    /**
     * Execute MCP tool by name
     */
    async executeTool(toolName, params = {}) {
        // Basic MCP tools (IPC-based)
        switch (toolName) {
            case 'get_page_info':
                return await this.getPageInfo(params.tabId);
            
            case 'list_profiles':
                return await this.listProfiles();
            
            case 'list_tabs':
                return await this.listTabs();
            
            case 'switch_tab':
                if (!params.tabId) {
                    return { success: false, error: 'tabId is required' };
                }
                return await this.switchTab(params.tabId);
            
            case 'create_tab':
                if (!params.url) {
                    return { success: false, error: 'url is required' };
                }
                return await this.createTab(params.url, params.title);
            
            case 'navigate':
            case 'navigate_and_wait':
                if (!params.url) {
                    return { success: false, error: 'url is required' };
                }
                // Only pass serializable properties
                return await this.navigateAndWait({
                    url: params.url,
                    tabId: params.tabId || null,
                    timeout: params.timeout || 30000
                });
        }

        // VBox API tools (execute in webview)
        const vboxMethods = {
            // DOM Queries
            'query': ['query', [params.selector, params.attribute]],
            'getText': ['getText', [params.selector]],
            'getAttribute': ['getAttribute', [params.selector, params.attribute]],
            
            // Actions
            'click': ['click', [params.selector]],
            'type': ['type', [params.selector, params.text, params.options]],
            'select': ['select', [params.selector, params.value]],
            'hover': ['hover', [params.selector]],
            'press': ['press', [params.key, params.options]],
            
            // Data Extraction
            'extractTable': ['extractTable', [params.selector]],
            'scrapeImages': ['scrapeImages', [params.options]],
            'scrape': ['extractData', [params.mapping]],
            
            // Screenshot
            'screenshot': ['screenshot', [params.selector, params.filename]],
            
            // Waiting
            'waitFor': ['waitForElement', [params.selector, params.timeout]],
            'waitForNetworkIdle': ['waitForNetworkIdle', [params.options]],
            
            // Scrolling
            'autoScroll': ['autoScroll', [params.options]],
            'scrollTo': ['scrollTo', [params.target]],
            
            // Cookies
            'getCookies': ['getCookies', [params.filter]],
            'setCookie': ['setCookie', [params.cookie]],
            
            // Navigation
            'goBack': ['goBack', []],
            'goForward': ['goForward', []],
            'reload': ['reload', []]
        };

        if (vboxMethods[toolName]) {
            const [method, methodParams] = vboxMethods[toolName];
            // Filter out undefined params
            const cleanParams = methodParams.filter(p => p !== undefined);
            return await this.executeVBoxAPI(method, cleanParams, params.tabId);
        }

        return {
            success: false,
            error: `Unknown tool: ${toolName}`
        };
    }

    /**
     * Get tools in native Claude API format
     * This is the format Claude expects for tool calling
     */
    getToolsForAPI() {
        return [
            // Tab Management
            {
                name: "create_tab",
                description: "Create a new browser tab and navigate to a URL",
                input_schema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "The URL to open in the new tab"
                        },
                        title: {
                            type: "string",
                            description: "Optional title for the tab"
                        }
                    },
                    required: ["url"]
                }
            },
            {
                name: "list_tabs",
                description: "List all currently open browser tabs",
                input_schema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "switch_tab",
                description: "Switch to a specific browser tab",
                input_schema: {
                    type: "object",
                    properties: {
                        tabId: {
                            type: "string",
                            description: "The ID of the tab to switch to"
                        }
                    },
                    required: ["tabId"]
                }
            },
            {
                name: "navigate",
                description: "Navigate current tab to a URL",
                input_schema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "The URL to navigate to"
                        },
                        tabId: {
                            type: "string",
                            description: "Optional tab ID, defaults to current tab"
                        }
                    },
                    required: ["url"]
                }
            },
            {
                name: "get_page_info",
                description: "Get information about the current page (title, URL, content)",
                input_schema: {
                    type: "object",
                    properties: {
                        tabId: {
                            type: "string",
                            description: "Optional tab ID, defaults to current tab"
                        }
                    }
                }
            },
            // DOM Interaction
            {
                name: "click",
                description: "Click an element on the page",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for the element to click"
                        }
                    },
                    required: ["selector"]
                }
            },
            {
                name: "type",
                description: "Type text into an input field",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for the input field"
                        },
                        text: {
                            type: "string",
                            description: "Text to type"
                        }
                    },
                    required: ["selector", "text"]
                }
            },
            {
                name: "query",
                description: "Query elements from page using CSS selector",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector to query"
                        },
                        attribute: {
                            type: "string",
                            description: "Optional attribute to get from elements"
                        }
                    },
                    required: ["selector"]
                }
            },
            {
                name: "getText",
                description: "Get text content from an element",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for the element"
                        }
                    },
                    required: ["selector"]
                }
            },
            {
                name: "screenshot",
                description: "Take a screenshot of the page or specific element",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "Optional CSS selector for specific element, omit for full page"
                        },
                        filename: {
                            type: "string",
                            description: "Optional filename for the screenshot"
                        }
                    }
                }
            },
            {
                name: "waitFor",
                description: "Wait for an element to appear on the page before interacting with it. MUST be used before click, type, or other DOM interactions.",
                input_schema: {
                    type: "object",
                    properties: {
                        selector: {
                            type: "string",
                            description: "CSS selector for the element to wait for"
                        },
                        timeout: {
                            type: "number",
                            description: "Optional timeout in milliseconds (default: 5000)"
                        }
                    },
                    required: ["selector"]
                }
            },
            {
                name: "press",
                description: "Press a keyboard key (e.g., Enter, Escape, Tab)",
                input_schema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Key to press (e.g., 'Enter', 'Escape', 'Tab')"
                        }
                    },
                    required: ["key"]
                }
            }
        ];
    }

    /**
     * Format MCP tools for AI context (fallback for non-native tool support)
     */
    getToolsContext() {
        const tools = this.getAvailableTools();
        return `You are V-Box AI Assistant with browser automation capabilities.

AVAILABLE TOOLS (${tools.length}):

${tools.map(tool => {
    const params = Object.entries(tool.parameters || {})
        .map(([name, desc]) => `  - ${name}: ${desc}`)
        .join('\n');
    return `• ${tool.name}\n  ${tool.description}\n${params ? params + '\n' : ''}`;
}).join('\n')}

USAGE:
When user requests browser actions, respond with JSON in this format:
{"tool_calls": [{"tool": "tool_name", "params": {...}}], "message": "Doing action..."}

⚠️ CRITICAL RULES - MUST FOLLOW:
1. **ALWAYS use waitFor before ANY DOM interaction** (click, type, getText, etc.)
   - After navigate: MUST waitFor before interact
   - After create_tab: MUST waitFor before interact
   - Before click: MUST waitFor to ensure element exists
   - Before type: MUST waitFor to ensure input exists

2. **Use URL query parameters for search when possible** (more efficient than typing)
   - Google: https://www.google.com/search?q=your+search+query
   - YouTube: https://www.youtube.com/results?search_query=your+search
   - Wikipedia: https://en.wikipedia.org/wiki/Article_Name
   - Amazon: https://www.amazon.com/s?k=product+name
   - GitHub: https://github.com/search?q=repository+name
   - Twitter/X: https://twitter.com/search?q=search+term
   - Reddit: https://www.reddit.com/search/?q=search+term
   - Stack Overflow: https://stackoverflow.com/search?q=your+question
   
   Choose between URL query vs element interaction based on:
   ✅ Use URL query: When you know the website's search URL pattern
   ✅ Use element interaction: When URL pattern is unknown or complex forms

3. **Use specific CSS selectors** (prefer ID > class > tag)
   - YouTube search box: "input#search"
   - YouTube video links: "a#video-title"
   - Google search: "input[name='q']"

4. **Sequential tool execution**:
   - Step 1: navigate/create_tab
   - Step 2: waitFor (MANDATORY!)
   - Step 3: interact (click/type/etc)

5. **Common mistakes to AVOID**:
   ❌ navigate → click (WRONG - page not loaded yet)
   ✅ navigate → waitFor → click (CORRECT)
   
   ❌ create_tab → type (WRONG - element not ready)
   ✅ create_tab → waitFor → type (CORRECT)

EXAMPLES:
- Search YouTube using URL query (EFFICIENT):
  {"tool_calls": [
    {"tool": "create_tab", "params": {"url": "https://www.youtube.com/results?search_query=horror+podcast", "title": "YouTube Search"}}
  ], "message": "Searching YouTube for horror podcast..."}

- Search Google using URL query (EFFICIENT):
  {"tool_calls": [
    {"tool": "create_tab", "params": {"url": "https://www.google.com/search?q=javascript+tutorial", "title": "Google Search"}}
  ], "message": "Searching Google..."}

- Search using element interaction (when URL pattern unknown):
  {"tool_calls": [
    {"tool": "create_tab", "params": {"url": "https://youtube.com", "title": "YouTube"}},
    {"tool": "waitFor", "params": {"selector": "input#search", "timeout": 10000}},
    {"tool": "type", "params": {"selector": "input#search", "text": "javascript tutorial"}},
    {"tool": "press", "params": {"key": "Enter"}}
  ], "message": "Opening YouTube and searching..."}

- Click first video:
  {"tool_calls": [
    {"tool": "waitFor", "params": {"selector": "a#video-title", "timeout": 10000}},
    {"tool": "click", "params": {"selector": "a#video-title"}}
  ], "message": "Clicking first video..."}

- Navigate and fill form:
  {"tool_calls": [
    {"tool": "navigate", "params": {"url": "https://example.com/login"}},
    {"tool": "waitFor", "params": {"selector": "input[name='username']"}},
    {"tool": "type", "params": {"selector": "input[name='username']", "text": "user123"}},
    {"tool": "waitFor", "params": {"selector": "input[name='password']"}},
    {"tool": "type", "params": {"selector": "input[name='password']", "text": "pass123"}},
    {"tool": "click", "params": {"selector": "button[type='submit']"}}
  ], "message": "Logging in..."}

Use tools when user requests browser automation. Respond in user's language.`;
    }
}

export const mcpService = new MCPService();
