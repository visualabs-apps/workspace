// Shared API documentation data — used by both WindowVBoxApiDocumentation.svelte and WindowInjectScript.svelte

export const quickStartCode = `// vbox is already available — no imports needed
console.log('Hello from VBox!');
vbox.toast('Script running', 'info');

// Navigate to a page
await vbox.navigate('https://example.com');

// Wait for network to settle
await vbox.waitForNetworkIdle();

// Extract data
const title = vbox.getText('h1');
const links = vbox.scrapeLinks();

// Handle dialogs automatically
await vbox.handleDialog({ accept: true });

// List all tabs
const tabs = await vbox.listTabs();
console.log('Open tabs:', tabs);`;

export const apiSections = [
    {
        title: 'Navigation',
        color: '#f59e0b',
        apis: [
            {
                method: 'POST',
                name: 'vbox.navigate(url)',
                description: 'Navigates the current webview to the specified URL. Returns after navigation completes and page loads.',
                params: [{ name: 'url', type: 'string — full URL to navigate to' }],
                returns: 'Promise<{ success, url? }>',
                example: `// Navigate to a new page\nawait vbox.navigate('https://example.com');\nawait vbox.waitForNetworkIdle();`
            },
            {
                method: 'POST',
                name: 'vbox.goBack()',
                description: 'Navigates back in the browser history, equivalent to clicking the browser back button.',
                returns: 'Promise<{ success }>',
                example: `await vbox.goBack();\nawait vbox.waitForNetworkIdle();`
            },
            {
                method: 'POST',
                name: 'vbox.goForward()',
                description: 'Navigates forward in the browser history, equivalent to clicking the browser forward button.',
                returns: 'Promise<{ success }>',
                example: `await vbox.goForward();\nawait vbox.waitForNetworkIdle();`
            },
            {
                method: 'POST',
                name: 'vbox.reload()',
                description: 'Reloads the current page.',
                returns: 'Promise<{ success }>',
                example: `await vbox.reload();\nawait vbox.waitForNetworkIdle();`
            }
        ]
    },
    {
        title: 'Core APIs',
        color: '#6366f1',
        apis: [

            {
                method: 'GET',
                name: 'vbox.getPageInfo()',
                description: 'Returns an object with the current page URL, title, domain, protocol, pathname, query string, and hash fragment. Useful for conditional logic based on the current page.',
                returns: '{ url, title, domain, protocol, pathname, search, hash }',
                example: `const info = vbox.getPageInfo();\nconsole.log('URL:', info.url);\nconsole.log('Title:', info.title);`
            },
            {
                method: 'POST',
                name: 'vbox.toast(message, type)',
                description: 'Displays a toast notification in the VBox main window. The type determines the color: info (blue), success (green), warning (yellow), error (red). Useful for showing progress or results to the user.',
                params: [
                    { name: 'message', type: 'string — notification text' },
                    { name: 'type', type: "'info' | 'success' | 'warning' | 'error'" }
                ],
                example: `vbox.toast('Processing...', 'info');\nvbox.toast('Done!', 'success');\nvbox.toast('Something went wrong', 'error');`
            },


        ]
    },

    {
        title: 'DOM Manipulation',
        color: '#10b981',
        apis: [
            {
                method: 'POST',
                name: 'vbox.click(selector)',
                description: 'Simulates a real mouse click on the first element matching the CSS selector. Dispatches mousedown, mouseup, and click events in sequence. Triggers native click handlers, onclick attributes, and framework event listeners. Throws error if element not found.',
                params: [{ name: 'selector', type: 'string — CSS selector (e.g. "button.submit", "#login-btn")' }],
                returns: 'boolean — true if element was found and clicked',
                note: 'Best practice: Use vbox.waitForElement() first to ensure element exists',
                example: `// Safe pattern\nawait vbox.waitForElement('button.submit');\nvbox.click('button.submit');\n\n// Direct click\nvbox.click('#login-btn');`
            },
            {
                method: 'POST',
                name: 'vbox.type(selector, text, options)',
                description: 'Simulates typing text into an input field, textarea, or contenteditable element. Uses the native value setter to ensure compatibility with React, Vue, Svelte, and other frameworks that intercept input events. Supports character-by-character typing with configurable delay. Throws error if element not found.',
                params: [
                    { name: 'selector', type: 'string — CSS selector for the input element' },
                    { name: 'text', type: 'string — text to type' },
                    { name: 'options', type: '{ delay?: number (ms between chars), clear?: boolean (clear existing text first) }' }
                ],
                note: 'Framework-compatible: Triggers native setter + input/change events for React/Vue/Svelte',
                example: `// Simple type (replaces existing text by default)\nvbox.type('#email', 'user@example.com');\n\n// Type with delay (simulates human typing)\nawait vbox.type('#search', 'query', { delay: 100 });\n\n// Append without clearing\nawait vbox.type('#notes', ' more text', { clear: false });`
            },
            {
                method: 'POST',
                name: 'vbox.press(key, options)',
                description: 'Dispatches a keyboard event for the specified key. Supports all KeyboardEvent key values including Enter, Tab, Escape, ArrowDown, ArrowUp, etc. Can also combine modifier keys (Ctrl, Shift, Alt, Meta).',
                params: [
                    { name: 'key', type: 'string — key name (e.g. "Enter", "Tab", "Escape", "a")' },
                    { name: 'options', type: '{ selector?, shift?, ctrl?, alt?, meta? }' }
                ],
                returns: 'boolean',
                example: `// Press Enter to submit a form\nvbox.press('Enter');\n\n// Press Escape to close a modal\nvbox.press('Escape');\n\n// Press Ctrl+A to select all in an input\nvbox.press('a', { selector: '#input', ctrl: true });`
            },
            {
                method: 'POST',
                name: 'vbox.hover(selector)',
                description: 'Simulates a mouse hover (mouseenter + mouseover) on the element matching the selector. Useful for triggering dropdown menus, tooltips, or hover-revealed content.',
                params: [{ name: 'selector', type: 'string — CSS selector for the element to hover over' }],
                returns: 'boolean',
                example: `// Hover to open a dropdown menu\nvbox.hover('.dropdown-trigger');\nawait vbox.waitForElement('.dropdown-menu');\nvbox.click('.dropdown-menu li:first-child');`
            },
            {
                method: 'POST',
                name: 'vbox.select(selector, value)',
                description: 'Selects an option in a <select> dropdown element by its value attribute or visible text. Dispatches change events to ensure framework compatibility.',
                params: [
                    { name: 'selector', type: 'string — CSS selector for the <select> element' },
                    { name: 'value', type: 'string — option value or visible text to select' }
                ],
                returns: 'boolean',
                example: `// Select by value attribute\nvbox.select('#country', 'ID');\n\n// Select by visible text\nvbox.select('#country', 'Indonesia');`
            },
            {
                method: 'POST',
                name: 'vbox.drag(sourceSelector, targetSelector)',
                description: 'Simulates an HTML5 drag-and-drop operation from the source element to the target element. Dispatches dragstart, dragenter, dragover, drop, and dragend events.',
                params: [
                    { name: 'sourceSelector', type: 'string — CSS selector for the draggable element' },
                    { name: 'targetSelector', type: 'string — CSS selector for the drop target' }
                ],
                returns: 'boolean',
                example: `vbox.drag('.draggable-item', '.drop-zone');`
            },
            {
                method: 'POST',
                name: 'vbox.scrollTo(selector, options)',
                description: 'Scrolls the page so that the matching element becomes visible. Supports smooth and instant scrolling, with configurable alignment (top, center, bottom of viewport).',
                params: [
                    { name: 'selector', type: 'string — CSS selector for the element to scroll to' },
                    { name: 'options', type: '{ behavior?: "smooth"|"auto", block?: "start"|"center"|"end" }' }
                ],
                returns: 'boolean',
                example: `// Smooth scroll to footer\nvbox.scrollTo('#footer');\n\n// Instant scroll, center in viewport\nvbox.scrollTo('.section', { behavior: 'auto', block: 'center' });`
            },
            {
                method: 'GET',
                name: 'vbox.getText(selector)',
                description: 'Returns the trimmed text content of the first element matching the selector. Returns the combined text of all child nodes.',
                params: [{ name: 'selector', type: 'string — CSS selector' }],
                returns: 'string — trimmed text content',
                example: `const title = vbox.getText('h1');\nconst label = vbox.getText('label[for="email"]');`
            },
            {
                method: 'GET',
                name: 'vbox.getHTML(selector)',
                description: 'Returns the innerHTML of the first element matching the selector, including all child elements and their markup.',
                params: [{ name: 'selector', type: 'string — CSS selector' }],
                returns: 'string — HTML content',
                example: `const html = vbox.getHTML('.content');\nconsole.log(html);`
            },
            {
                method: 'GET',
                name: 'vbox.getAttribute(selector, attribute)',
                description: 'Returns the value of the specified HTML attribute on the first matching element. Returns null if the attribute does not exist.',
                params: [
                    { name: 'selector', type: 'string — CSS selector' },
                    { name: 'attribute', type: 'string — attribute name (e.g. "href", "class", "data-id")' }
                ],
                returns: 'string | null',
                example: `const href = vbox.getAttribute('a.login', 'href');\nconst dataId = vbox.getAttribute('#row', 'data-id');`
            },
            {
                method: 'POST',
                name: 'vbox.setAttribute(selector, attribute, value)',
                description: 'Sets an HTML attribute on the first matching element. Can be used to modify element properties like disabled, class, src, href, data-* attributes, etc.',
                params: [
                    { name: 'selector', type: 'string — CSS selector' },
                    { name: 'attribute', type: 'string — attribute name' },
                    { name: 'value', type: 'string — attribute value' }
                ],
                returns: 'boolean',
                example: `// Disable an input\nvbox.setAttribute('#input', 'disabled', 'true');\n\n// Change image source\nvbox.setAttribute('img.logo', 'src', 'new-logo.png');`
            },
            {
                method: 'GET',
                name: 'vbox.exists(selector)',
                description: 'Checks whether at least one element matching the selector exists in the DOM. Useful for conditional logic before performing actions.',
                params: [{ name: 'selector', type: 'string — CSS selector' }],
                returns: 'boolean',
                example: `if (vbox.exists('.modal')) {\n    vbox.click('.modal .close-btn');\n}`
            },
            {
                method: 'GET',
                name: 'vbox.count(selector)',
                description: 'Returns the number of elements matching the selector. Useful for verifying lists, tables, or repeated elements.',
                params: [{ name: 'selector', type: 'string — CSS selector' }],
                returns: 'number',
                example: `const itemCount = vbox.count('.product-item');\nconsole.log('Found', itemCount, 'products');`
            },
            {
                method: 'GET',
                name: 'vbox.waitForElement(selector, timeout)',
                description: 'Waits until an element matching the selector appears in the DOM. Uses MutationObserver for efficient detection. Essential for handling dynamically loaded content (AJAX, SPA renders, lazy loading). Rejects promise if timeout is reached.',
                params: [
                    { name: 'selector', type: 'string — CSS selector to wait for' },
                    { name: 'timeout', type: 'number — max wait time in ms (default: 5000)' }
                ],
                returns: 'Promise<boolean> — resolves true if found, rejects on timeout',
                note: 'Always use this before interacting with dynamic content',
                example: `// Wait up to 5 seconds for a modal\nawait vbox.waitForElement('.modal');\nvbox.click('.modal .close-btn');\n\n// Wait up to 10 seconds for search results\nawait vbox.waitForElement('#results', 10000);\nconst data = vbox.extractData({ title: '#results h1' });`
            },
            {
                method: 'POST',
                name: 'vbox.autoScroll(options)',
                description: 'Automatically scrolls the page to the bottom, useful for infinite-scroll pages (social media feeds, product listings). Stops when the page height stops increasing or maxScrolls is reached. Uses recursive setTimeout to avoid race conditions.',
                params: [{ name: 'options', type: '{ delay?: number (ms between scrolls, default: 1000), maxScrolls?: number (default: 10) }' }],
                returns: 'Promise<number> — total number of scrolls performed',
                note: 'Waits for page height to stabilize between scrolls',
                example: `// Scroll with 1 second delay, max 10 scrolls\nconst scrolls = await vbox.autoScroll({ delay: 1000, maxScrolls: 10 });\nconsole.log('Scrolled', scrolls, 'times');\n\n// Extract data after scrolling\nconst items = vbox.scrapeLinks({ selector: '.product-item a' });`
            }
        ]
    },
    {
        title: 'Cookies',
        color: '#ec4899',
        apis: [
            {
                method: 'GET',
                name: 'vbox.getCookies(filter?)',
                description: 'Retrieves cookies from the current webview session. Can optionally filter by URL, name, domain, or path. Cookies are scoped to the current workspace profile (session partition).',
                params: [{ name: 'filter', type: '{ url?, name?, domain?, path? } (optional)' }],
                returns: 'Promise<{ success, cookies? }>',
                example: `// Get all cookies\nconst result = await vbox.getCookies();\nconsole.log('Cookies:', result.cookies);\n\n// Filter by domain\nconst filtered = await vbox.getCookies({ domain: '.example.com' });`
            },
            {
                method: 'POST',
                name: 'vbox.setCookie(cookie)',
                description: 'Sets a cookie in the current webview session. The cookie is scoped to the current workspace profile. Required fields are name, value, and domain.',
                params: [{ name: 'cookie', type: '{ name, value, domain, path?, secure?, httpOnly? }' }],
                returns: 'Promise<{ success }>',
                example: `await vbox.setCookie({\n    name: 'session_id',\n    value: 'abc123',\n    domain: '.example.com',\n    path: '/',\n    secure: true\n});`
            }
        ]
    },
    {
        title: 'Dialog Handling',
        color: '#8b5cf6',
        apis: [
            {
                method: 'POST',
                name: 'vbox.handleDialog(options)',
                description: 'Registers an automatic response for browser dialogs (alert, confirm, prompt). Must be called BEFORE the dialog-triggering action. The dialog will be automatically accepted or dismissed without showing to the user.',
                params: [{ name: 'options', type: '{ accept?: boolean, text?: string }' }],
                returns: 'Promise<{ success }>',
                example: `// Auto-accept all dialogs\nawait vbox.handleDialog({ accept: true });\n\n// Auto-accept with text input (for prompt dialogs)\nawait vbox.handleDialog({ accept: true, text: 'my response' });\n\n// Auto-dismiss dialogs\nawait vbox.handleDialog({ accept: false });`
            },
            {
                method: 'DELETE',
                name: 'vbox.clearDialogHandler()',
                description: 'Removes the registered dialog handler, restoring default browser dialog behavior (dialogs will be shown to the user).',
                returns: 'Promise<{ success }>',
                example: `await vbox.clearDialogHandler();`
            }
        ]
    },
    {
        title: 'Data Extraction',
        color: '#06b6d4',
        apis: [
            {
                method: 'GET',
                name: 'vbox.scrapeLinks(options)',
                description: 'Extracts all links (<a> elements) from the page. Returns an array of objects with the link index, URL, href attribute, and visible text. Optionally filter by a CSS selector or URL pattern.',
                params: [{ name: 'options', type: '{ selector?, filter? }' }],
                returns: 'Array<{ index, url, href, text }>',
                example: `// Get all links\nconst links = vbox.scrapeLinks();\n\n// Get links only from a specific section\nconst navLinks = vbox.scrapeLinks({ selector: 'nav' });`
            },
            {
                method: 'GET',
                name: 'vbox.scrapeImages(options)',
                description: 'Extracts all images from the page with their source URL, alt text, and dimensions. Can filter by minimum width/height to skip icons and spacer images.',
                params: [{ name: 'options', type: '{ selector?, minWidth?, minHeight? }' }],
                returns: 'Array<{ index, url, src, alt, width, height }>',
                example: `// Get all images larger than 200px wide\nconst images = vbox.scrapeImages({ minWidth: 200 });\nconsole.log('Found', images.length, 'images');`
            },
            {
                method: 'GET',
                name: 'vbox.extractData(selectors)',
                description: 'Extracts data from multiple elements in a single call. Pass an object where keys are field names and values are CSS selectors. Returns an object with the same keys and the text content of each matched element.',
                params: [{ name: 'selectors', type: 'object — { fieldName: "css-selector", ... }' }],
                returns: 'object — { fieldName: "extracted text", ... }',
                example: `const data = vbox.extractData({\n    title: 'h1',\n    price: '.price',\n    description: '.description'\n});\nconsole.log(data.title, data.price);`
            },
            {
                method: 'GET',
                name: 'vbox.extractTable(selector)',
                description: 'Extracts data from an HTML <table> element into a structured format. Returns column headers and an array of row objects where each key is the column header.',
                params: [{ name: 'selector', type: 'string — CSS selector for the <table> element' }],
                returns: '{ headers: string[], rows: object[] }',
                example: `const table = vbox.extractTable('table.data');\nconsole.log('Headers:', table.headers);\ntable.rows.forEach(row => console.log(row));`
            },
            {
                method: 'GET',
                name: 'vbox.getIFrameContent(selector)',
                description: 'Reads the content of an iframe element (same-origin only). Returns the iframe HTML content, URL, and title. Useful for extracting data from embedded widgets or reports.',
                params: [{ name: 'selector', type: 'string — CSS selector for the <iframe> element' }],
                returns: '{ success, html?, url?, title? }',
                example: `const iframe = vbox.getIFrameContent('iframe#report');\nif (iframe.success) {\n    console.log('IFrame HTML:', iframe.html);\n}`
            }
        ]
    },
    {
        title: 'Network',
        color: '#f97316',
        apis: [
            {
                method: 'GET',
                name: 'vbox.waitForNetworkIdle(options)',
                description: 'Waits until network activity drops below a threshold, indicating that the page has finished loading dynamic content (AJAX requests, API calls, lazy-loaded resources). Essential for SPAs and pages that load data asynchronously.',
                params: [{ name: 'options', type: '{ timeout?: number (max wait ms), idleTime?: number (ms of quiet to consider idle) }' }],
                returns: 'Promise<{ success, idleTime? }>',
                example: `// Wait for network to be idle (default: 5s timeout, 500ms idle)\nawait vbox.waitForNetworkIdle();\n\n// Custom timeout and idle threshold\nawait vbox.waitForNetworkIdle({ timeout: 15000, idleTime: 2000 });\nconst data = vbox.extractData({ title: 'h1' });`
            }
        ]
    },
    {
        title: 'Screenshot',
        color: '#14b8a6',
        apis: [
            {
                method: 'GET',
                name: 'vbox.screenshot(selector, filename)',
                description: 'Captures a screenshot of the specified element (or the full page if selector matches body). The screenshot is saved as a PNG file in the VBox downloads directory. Uses native Electron desktopCapturer for high-quality captures.',
                params: [
                    { name: 'selector', type: 'string — CSS selector for the element to capture' },
                    { name: 'filename', type: 'string — output filename (e.g. "dashboard.png")' }
                ],
                returns: 'Promise<{ success, path, filename, size }>',
                example: `// Capture a specific element\nconst result = await vbox.screenshot('.dashboard', 'dashboard.png');\nconsole.log('Saved to:', result.path);`
            }
        ]
    },

    {
        title: 'User Input',
        color: '#a855f7',
        apis: [
            {
                method: 'POST',
                name: 'vbox.openInput(config)',
                description: 'Opens a modal dialog window to collect user input. Define a title and an array of fields with different types. The script pauses until the user submits or cancels. Returns null if cancelled.',
                params: [{ name: 'config', type: '{ title: string, fields: Array<{ name, label, type }> }' }],
                returns: 'Promise<object | null> — field values keyed by name, or null if cancelled',
                note: 'Field types: text, number, date, daterange, select, textarea',
                example: `const data = await vbox.openInput({\n    title: 'Generate Report',\n    fields: [\n        { name: 'client', label: 'Client Name', type: 'text' },\n        { name: 'month', label: 'Month', type: 'date' },\n        { name: 'format', label: 'Format', type: 'select', options: ['PDF', 'PPTX'] }\n    ]\n});\nif (data) {\n    console.log('Client:', data.client);\n}`
            }
        ]
    },
    {
        title: 'PowerPoint',
        color: '#ef4444',
        apis: [
            {
                method: 'POST',
                name: 'vbox.ppt.create()',
                description: 'Creates a new PowerPoint presentation builder object. Use the builder pattern to add slides, text, tables, and images, then download the finished file.',
                returns: 'PPTBuilder — chainable builder object',
                example: `const ppt = vbox.ppt.create();\nppt.addTitleSlide('Monthly Report', 'January 2026');\nppt.addSlide('Summary')\n    .addText('Total Revenue: $50,000', { fontSize: 16 })\n    .addText('Growth: +12%', { fontSize: 16 });\nawait ppt.download('report.pptx');`
            },
            {
                method: 'GET',
                name: 'vbox.ppt.listTemplates()',
                description: 'Lists all available PowerPoint templates in the templates directory. Returns template filenames that can be used with useTemplate().',
                returns: 'Promise<{ success, templates: string[] }>',
                example: `const result = await vbox.ppt.listTemplates();\nif (result.success) {\n    console.log('Templates:', result.templates);\n}`
            },
            {
                method: 'POST',
                name: 'vbox.ppt.useTemplate(name, vars, output)',
                description: 'Generates a PowerPoint file from a pre-existing template (.pptx) by replacing placeholder variables. Placeholders in the template use {{VariableName}} syntax.',
                params: [
                    { name: 'templateName', type: 'string — template filename (must exist in templates directory)' },
                    { name: 'variables', type: 'object — key-value pairs to replace in the template' },
                    { name: 'outputFilename', type: 'string — output filename' }
                ],
                returns: 'Promise<{ success, path, filename }>',
                example: `const result = await vbox.ppt.useTemplate(\n    'MonthlyReport.pptx',\n    { ClientName: 'Acme Corp', Total: '$50,000' },\n    'acme-report.pptx'\n);`
            }
        ]
    },
    {
        title: 'File & Downloads',
        color: '#64748b',
        apis: [
            {
                method: 'POST',
                name: 'vbox.saveFile(content, filename, type)',
                description: 'Saves text content to a file in the VBox Downloads directory. Supports any text-based content type (HTML, CSV, JSON, plain text, etc.).',
                params: [
                    { name: 'content', type: 'string — file content' },
                    { name: 'filename', type: 'string — output filename (e.g. "report.html")' },
                    { name: 'type', type: 'string — MIME type (e.g. "text/html", "application/json")' }
                ],
                returns: 'Promise<{ success, path? }>',
                example: `// Save an HTML report\nconst result = await vbox.saveFile(\n    '<h1>Report</h1><p>Data here</p>',\n    'report.html',\n    'text/html'\n);`
            },

        ]
    }
];
