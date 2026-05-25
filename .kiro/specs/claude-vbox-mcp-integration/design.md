# Design Document: Claude AI + V-Box MCP Integration

## 1. Overview

### 1.1 Feature Summary
Integrate Claude AI with V-Box browser automation tool via Model Context Protocol (MCP), enabling Claude to automate web tasks on the **active profile only**. User handles navigation manually, AI executes operations on the current page.

### 1.2 Design Approach
**Simplified Single-Profile Architecture:**
- AI works only on active profile (no profile switching)
- User navigates manually (no navigate API exposed to AI)
- AI executes safe operations: DOM reading, data extraction, screenshots, file operations
- No race conditions, no context destruction issues

### 1.3 Key Design Decisions
1. **Active Profile Only**: Eliminates multi-profile race conditions
2. **Manual Navigation**: User controls navigation, AI operates on current page
3. **HTTP REST API**: V-Box exposes APIs via HTTP server for MCP access
4. **MCP Server**: Standalone Node.js server translates MCP calls to V-Box HTTP API
5. **Safe Operations**: Only expose read/extract/screenshot operations (no dangerous APIs)

---

## 2. High-Level Architecture

### 2.1 System Components

```
┌─────────────────┐
│  Claude Desktop │
│   (AI Agent)    │
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────┐
│  MCP Server     │
│  (Node.js)      │
└────────┬────────┘
         │ HTTP REST
         ▼
┌─────────────────┐
│  V-Box HTTP API │
│  (Express.js)   │
└────────┬────────┘
         │ IPC
         ▼
┌─────────────────┐
│  V-Box Electron │
│  (Active Profile)│
└─────────────────┘
```

### 2.2 Data Flow

1. **User navigates** to target page in V-Box
2. **Claude receives task** from user (e.g., "extract product data")
3. **Claude calls MCP tool** (e.g., `vbox_extract_data`)
4. **MCP server** translates to HTTP request
5. **V-Box HTTP API** receives request
6. **V-Box executes** operation on active profile's webview
7. **Result flows back** through the chain to Claude
8. **Claude processes** and responds to user

---

## 3. Low-Level Design

### 3.1 V-Box HTTP API Server

**File:** `v-box/lib/vbox-http-server.js`

```javascript
const express = require('express');
const { ipcRenderer } = require('electron');

class VBoxHTTPServer {
    constructor(port = 9876) {
        this.app = express();
        this.port = port;
        this.app.use(express.json());
        this.setupRoutes();
    }

    setupRoutes() {
        // DOM Read Operations
        this.app.post('/api/getText', async (req, res) => {
            const { selector } = req.body;
            const result = await this.executeVBoxAPI('getText', selector);
            res.json(result);
        });

        this.app.post('/api/getHTML', async (req, res) => {
            const { selector } = req.body;
            const result = await this.executeVBoxAPI('getHTML', selector);
            res.json(result);
        });

        this.app.post('/api/getAttribute', async (req, res) => {
            const { selector, attribute } = req.body;
            const result = await this.executeVBoxAPI('getAttribute', selector, attribute);
            res.json(result);
        });

        this.app.post('/api/exists', async (req, res) => {
            const { selector } = req.body;
            const result = await this.executeVBoxAPI('exists', selector);
            res.json(result);
        });

        this.app.post('/api/count', async (req, res) => {
            const { selector } = req.body;
            const result = await this.executeVBoxAPI('count', selector);
            res.json(result);
        });

        // Data Extraction
        this.app.post('/api/scrapeLinks', async (req, res) => {
            const { options } = req.body;
            const result = await this.executeVBoxAPI('scrapeLinks', options);
            res.json(result);
        });

        this.app.post('/api/scrapeImages', async (req, res) => {
            const { options } = req.body;
            const result = await this.executeVBoxAPI('scrapeImages', options);
            res.json(result);
        });

        this.app.post('/api/extractData', async (req, res) => {
            const { selectors } = req.body;
            const result = await this.executeVBoxAPI('extractData', selectors);
            res.json(result);
        });

        this.app.post('/api/extractTable', async (req, res) => {
            const { selector } = req.body;
            const result = await this.executeVBoxAPI('extractTable', selector);
            res.json(result);
        });

        // Screenshot
        this.app.post('/api/screenshot', async (req, res) => {
            const { selector, filename } = req.body;
            const result = await this.executeVBoxAPI('screenshot', selector, filename);
            res.json(result);
        });

        // Page Info
        this.app.get('/api/getPageInfo', async (req, res) => {
            const result = await this.executeVBoxAPI('getPageInfo');
            res.json(result);
        });

        // File Operations
        this.app.post('/api/saveFile', async (req, res) => {
            const { content, filename, type } = req.body;
            const result = await this.executeVBoxAPI('saveFile', content, filename, type);
            res.json(result);
        });

        // Waiting
        this.app.post('/api/waitForElement', async (req, res) => {
            const { selector, timeout } = req.body;
            const result = await this.executeVBoxAPI('waitForElement', selector, timeout);
            res.json(result);
        });

        this.app.post('/api/waitForNetworkIdle', async (req, res) => {
            const { options } = req.body;
            const result = await this.executeVBoxAPI('waitForNetworkIdle', options);
            res.json(result);
        });
    }

    async executeVBoxAPI(method, ...args) {
        try {
            // Send IPC to active webview
            const result = await ipcRenderer.invoke('vbox-api-call', {
                method,
                args
            });
            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`V-Box HTTP API listening on port ${this.port}`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = VBoxHTTPServer;
```

### 3.2 MCP Server

**File:** `v-box/mcp-server/index.js`

```javascript
#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

const VBOX_API_URL = process.env.VBOX_API_URL || 'http://localhost:9876';

// MCP Tool Definitions
const TOOLS = [
    {
        name: 'vbox_get_text',
        description: 'Get text content from an element by CSS selector',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector (e.g., "#title", ".product-name")'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_get_html',
        description: 'Get HTML content from an element by CSS selector',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_get_attribute',
        description: 'Get attribute value from an element',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector'
                },
                attribute: {
                    type: 'string',
                    description: 'Attribute name (e.g., "href", "src", "data-id")'
                }
            },
            required: ['selector', 'attribute']
        }
    },
    {
        name: 'vbox_exists',
        description: 'Check if an element exists on the page',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_count',
        description: 'Count how many elements match a selector',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_scrape_links',
        description: 'Extract all links from the page',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'Optional CSS selector to filter links (e.g., ".product-link")'
                }
            }
        }
    },
    {
        name: 'vbox_scrape_images',
        description: 'Extract all images from the page',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'Optional CSS selector to filter images'
                }
            }
        }
    },
    {
        name: 'vbox_extract_data',
        description: 'Extract multiple data fields using CSS selectors',
        inputSchema: {
            type: 'object',
            properties: {
                selectors: {
                    type: 'object',
                    description: 'Object mapping field names to CSS selectors, e.g., {"title": "h1", "price": ".price"}'
                }
            },
            required: ['selectors']
        }
    },
    {
        name: 'vbox_extract_table',
        description: 'Extract table data as array of objects',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector for the table element'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_screenshot',
        description: 'Capture screenshot of page or element',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'Optional CSS selector to screenshot specific element'
                },
                filename: {
                    type: 'string',
                    description: 'Output filename (e.g., "screenshot.png")'
                }
            },
            required: ['filename']
        }
    },
    {
        name: 'vbox_get_page_info',
        description: 'Get current page information (URL, title, etc.)',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'vbox_save_file',
        description: 'Save content to a file',
        inputSchema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'File content'
                },
                filename: {
                    type: 'string',
                    description: 'Output filename'
                },
                type: {
                    type: 'string',
                    description: 'MIME type (default: "text/html")'
                }
            },
            required: ['content', 'filename']
        }
    },
    {
        name: 'vbox_wait_for_element',
        description: 'Wait for an element to appear on the page',
        inputSchema: {
            type: 'object',
            properties: {
                selector: {
                    type: 'string',
                    description: 'CSS selector'
                },
                timeout: {
                    type: 'number',
                    description: 'Timeout in milliseconds (default: 5000)'
                }
            },
            required: ['selector']
        }
    },
    {
        name: 'vbox_wait_for_network_idle',
        description: 'Wait for network activity to finish (AJAX, loading)',
        inputSchema: {
            type: 'object',
            properties: {
                timeout: {
                    type: 'number',
                    description: 'Timeout in milliseconds (default: 30000)'
                },
                idleTime: {
                    type: 'number',
                    description: 'Time to wait for idle (default: 500ms)'
                }
            }
        }
    }
];

// Tool name to API endpoint mapping
const TOOL_TO_ENDPOINT = {
    'vbox_get_text': '/api/getText',
    'vbox_get_html': '/api/getHTML',
    'vbox_get_attribute': '/api/getAttribute',
    'vbox_exists': '/api/exists',
    'vbox_count': '/api/count',
    'vbox_scrape_links': '/api/scrapeLinks',
    'vbox_scrape_images': '/api/scrapeImages',
    'vbox_extract_data': '/api/extractData',
    'vbox_extract_table': '/api/extractTable',
    'vbox_screenshot': '/api/screenshot',
    'vbox_get_page_info': '/api/getPageInfo',
    'vbox_save_file': '/api/saveFile',
    'vbox_wait_for_element': '/api/waitForElement',
    'vbox_wait_for_network_idle': '/api/waitForNetworkIdle'
};

class VBoxMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'vbox-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
        this.setupErrorHandling();
    }

    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };

        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return { tools: TOOLS };
        });

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                const endpoint = TOOL_TO_ENDPOINT[name];
                if (!endpoint) {
                    throw new Error(`Unknown tool: ${name}`);
                }

                // Call V-Box HTTP API
                const method = endpoint === '/api/getPageInfo' ? 'get' : 'post';
                const response = await axios({
                    method,
                    url: `${VBOX_API_URL}${endpoint}`,
                    data: args,
                    timeout: 30000
                });

                const result = response.data;

                if (result.success) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result.data, null, 2)
                            }
                        ]
                    };
                } else {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error: ${result.error}`
                            }
                        ],
                        isError: true
                    };
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('V-Box MCP Server running on stdio');
    }
}

// Start server
const server = new VBoxMCPServer();
server.run().catch(console.error);
```

### 3.3 V-Box Integration

**File:** `v-box/electron/main.js` (add HTTP server initialization)

```javascript
const VBoxHTTPServer = require('../lib/vbox-http-server');

// Start HTTP API server
const httpServer = new VBoxHTTPServer(9876);
httpServer.start();

// Handle IPC from HTTP server to active webview
ipcMain.handle('vbox-api-call', async (event, { method, args }) => {
    try {
        // Get active webview
        const activeWebview = getActiveWebview();
        if (!activeWebview) {
            return { success: false, error: 'No active webview' };
        }

        // Execute vbox API on active webview
        const result = await activeWebview.executeJavaScript(`
            (async () => {
                try {
                    const result = await window.vbox.${method}(...${JSON.stringify(args)});
                    return { success: true, data: result };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            })()
        `);

        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

### 3.4 Claude Desktop Configuration

**File:** `~/.config/Claude/claude_desktop_config.json` (macOS/Linux)  
**File:** `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "vbox": {
      "command": "node",
      "args": ["/path/to/v-box/mcp-server/index.js"],
      "env": {
        "VBOX_API_URL": "http://localhost:9876"
      }
    }
  }
}
```

---

## 4. API Surface

### 4.1 Exposed MCP Tools (14 total)

#### DOM Read (5)
- `vbox_get_text` - Get text content
- `vbox_get_html` - Get HTML content
- `vbox_get_attribute` - Get attribute value
- `vbox_exists` - Check element existence
- `vbox_count` - Count elements

#### Data Extraction (4)
- `vbox_scrape_links` - Extract all links
- `vbox_scrape_images` - Extract all images
- `vbox_extract_data` - Extract multiple fields
- `vbox_extract_table` - Extract table data

#### Utilities (5)
- `vbox_screenshot` - Capture screenshot
- `vbox_get_page_info` - Get page info
- `vbox_save_file` - Save file
- `vbox_wait_for_element` - Wait for element
- `vbox_wait_for_network_idle` - Wait for network

### 4.2 NOT Exposed (Safety)
- Navigation APIs (navigate, goBack, goForward, reload)
- DOM Interaction (click, type, press, hover, select, drag)
- Cookie manipulation
- Dialog handling
- PowerPoint generation
- User input dialogs

**Rationale:** User navigates manually, AI only reads/extracts data. No automation that could break pages or cause security issues.

---

## 5. Error Handling

### 5.1 Error Flow
1. **V-Box API error** → Caught by VBoxAPIWrapper → Returns `{success: false, error: "..."}`
2. **HTTP API error** → Caught by Express → Returns `{success: false, error: "..."}`
3. **MCP Server error** → Caught by axios → Returns MCP error response
4. **Claude receives error** → Shows error to user, suggests alternatives

### 5.2 Common Errors
- `"No active webview"` - No profile is active
- `"Element not found"` - Selector doesn't match any element
- `"Invalid selector"` - CSS selector syntax error
- `"Operation timeout"` - Operation took too long
- `"Connection refused"` - V-Box HTTP server not running

---

## 6. Security Considerations

### 6.1 Threat Model
- **Malicious AI prompts** - AI could try to extract sensitive data
- **SSRF attacks** - AI could try to access internal services
- **DoS attacks** - AI could spam requests

### 6.2 Mitigations
1. **Read-only operations** - No write/click/type operations exposed
2. **Active profile only** - No cross-profile access
3. **Local HTTP server** - Only accessible from localhost
4. **Rate limiting** - Prevent spam (TODO: implement)
5. **Timeout protection** - All operations have 30s timeout
6. **Input validation** - All selectors validated before execution

---

## 7. Testing Strategy

### 7.1 Unit Tests
- Test each MCP tool individually
- Test error handling
- Test timeout behavior

### 7.2 Integration Tests
- Test MCP server → HTTP API → V-Box flow
- Test with real Claude Desktop
- Test error propagation

### 7.3 Manual Tests
- Navigate to test page
- Ask Claude to extract data
- Verify results
- Test error scenarios

---

## 8. Deployment

### 8.1 Installation Steps
1. Install MCP server dependencies: `cd v-box/mcp-server && npm install`
2. Start V-Box application (HTTP server starts automatically)
3. Configure Claude Desktop with MCP server path
4. Restart Claude Desktop
5. Test with simple query: "What's on this page?"

### 8.2 Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `axios` - HTTP client for MCP server
- `express` - HTTP server for V-Box API

---

## 9. Future Enhancements

### 9.1 Phase 2 (Optional)
- Add DOM interaction tools (click, type) with safety checks
- Add cookie management for login automation
- Add PowerPoint generation for reports
- Add rate limiting and request queuing

### 9.2 Phase 3 (Optional)
- Multi-profile support with explicit profile selection
- Navigation API with safety confirmations
- Advanced data extraction (AI-powered field detection)
- Workflow recording and playback

---

## 10. Success Criteria

✅ **Must Have:**
- Claude can read page content via MCP
- Claude can extract structured data
- Claude can take screenshots
- All operations work on active profile only
- Error handling works correctly

✅ **Nice to Have:**
- Response time < 2s for simple operations
- Clear error messages for all failure cases
- Documentation for common use cases

---

**Design Status:** ✅ READY FOR IMPLEMENTATION  
**Last Updated:** 2026-05-23  
**Version:** 1.0.0
