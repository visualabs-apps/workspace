<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { BookOpen, Copy, Check } from "lucide-svelte";

    const WINDOW_ID = 'vbox-api-docs-window';

    
    
    let copiedSection = $state(null);

    async function copyToClipboard(text, section) {
        try {
            await navigator.clipboard.writeText(text);
            copiedSection = section;
            setTimeout(() => {
                copiedSection = null;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    const apiSections = [
        {
            title: '🔍 Core APIs',
            apis: [
                {
                    name: 'vbox.isVBox()',
                    description: 'Check if script is running in VBox environment',
                    returns: 'boolean',
                    example: `if (vbox.isVBox()) {
    console.log('Running in VBox!');
}`
                },
                {
                    name: 'vbox.getPageInfo()',
                    description: 'Get current page information',
                    returns: '{ url, title, domain, protocol, pathname, search, hash }',
                    example: `const info = vbox.getPageInfo();
console.log('URL:', info.url);
console.log('Title:', info.title);`
                },
                {
                    name: 'vbox.toast(message, type)',
                    description: 'Show toast notification in console',
                    params: [
                        { name: 'message', type: 'string' },
                        { name: 'type', type: "'info' | 'success' | 'warning' | 'error'" }
                    ],
                    example: `vbox.toast('Processing...', 'info');
vbox.toast('Success!', 'success');`
                },
                {
                    name: 'vbox.getActiveProfile()',
                    description: 'Get active workspace/profile information (async)',
                    returns: 'Promise<{ success, id?, name?, url?, error? }>',
                    note: 'Works in both main window and webview context.',
                    example: `const profile = await vbox.getActiveProfile();
if (profile.success) {
    console.log('Active Profile:', profile.name);
    console.log('Profile ID:', profile.id);
}`
                }
            ]
        },
        {
            title: '🧭 Navigation',
            apis: [
                {
                    name: 'vbox.navigate(url)',
                    description: 'Navigate to a URL. ⚠️ This destroys the current JS context — code after this call will NOT execute. For sequential flows, use MCP-level APIs.',
                    params: [{ name: 'url', type: 'string' }],
                    returns: 'Promise<{ success, url? }>',
                    example: `// Navigate to a new page
await vbox.navigate('https://example.com');
// ⚠️ Code here will NOT run — context is destroyed`
                },
                {
                    name: 'vbox.goBack()',
                    description: 'Go back in browser history',
                    returns: 'Promise<{ success }>',
                    example: `await vbox.goBack();`
                },
                {
                    name: 'vbox.goForward()',
                    description: 'Go forward in browser history',
                    returns: 'Promise<{ success }>',
                    example: `await vbox.goForward();`
                },
                {
                    name: 'vbox.reload()',
                    description: 'Reload current page',
                    returns: 'Promise<{ success }>',
                    example: `await vbox.reload();`
                }
            ]
        },
        {
            title: '🎯 DOM Manipulation',
            apis: [
                {
                    name: 'vbox.click(selector)',
                    description: 'Click element by CSS selector',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'boolean',
                    example: `vbox.click('button.submit');
vbox.click('#login-btn');`
                },
                {
                    name: 'vbox.type(selector, text, options)',
                    description: 'Type text into element with optional delay (framework-compatible: React, Vue, Svelte)',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'text', type: 'string' },
                        { name: 'options', type: '{ delay?: number, clear?: boolean }' }
                    ],
                    example: `vbox.type('#email', 'user@example.com');
await vbox.type('#search', 'query', { delay: 100 });`
                },
                {
                    name: 'vbox.press(key, options)',
                    description: 'Dispatch keyboard event. Supports Enter, Tab, Escape, ArrowDown, letter keys, etc.',
                    params: [
                        { name: 'key', type: 'string' },
                        { name: 'options', type: '{ selector?, shift?, ctrl?, alt?, meta? }' }
                    ],
                    returns: 'boolean',
                    example: `// Press Enter on active element
vbox.press('Enter');

// Press Escape
vbox.press('Escape');

// Press Tab
vbox.press('Tab');

// Press Ctrl+A on specific element
vbox.press('a', { selector: '#input', ctrl: true });`
                },
                {
                    name: 'vbox.hover(selector)',
                    description: 'Simulate mouse hover on element (dispatches pointerenter, mouseover, mousemove)',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'boolean',
                    example: `vbox.hover('.dropdown-trigger');
await vbox.waitForElement('.dropdown-menu');`
                },
                {
                    name: 'vbox.select(selector, value)',
                    description: 'Select an option in a <select> dropdown by value or text',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'value', type: 'string' }
                    ],
                    returns: 'boolean',
                    example: `// Select by value
vbox.select('#country', 'ID');

// Select by visible text
vbox.select('#country', 'Indonesia');`
                },
                {
                    name: 'vbox.drag(sourceSelector, targetSelector)',
                    description: 'Drag element from source to target using HTML5 Drag & Drop events',
                    params: [
                        { name: 'sourceSelector', type: 'string' },
                        { name: 'targetSelector', type: 'string' }
                    ],
                    returns: 'boolean',
                    example: `vbox.drag('.draggable-item', '.drop-zone');`
                },
                {
                    name: 'vbox.getText(selector)',
                    description: 'Get text content from element',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'string',
                    example: `const title = vbox.getText('h1');
const price = vbox.getText('.price');`
                },
                {
                    name: 'vbox.getHTML(selector)',
                    description: 'Get HTML content from element',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'string',
                    example: `const html = vbox.getHTML('.content');`
                },
                {
                    name: 'vbox.exists(selector)',
                    description: 'Check if element exists',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'boolean',
                    example: `if (vbox.exists('.modal')) {
    console.log('Modal is present');
}`
                },
                {
                    name: 'vbox.count(selector)',
                    description: 'Count elements matching selector',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: 'number',
                    example: `const itemCount = vbox.count('.product-item');
console.log('Found', itemCount, 'products');`
                },
                {
                    name: 'vbox.waitForElement(selector, timeout)',
                    description: 'Wait for element to appear in DOM',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'timeout', type: 'number (default: 5000ms)' }
                    ],
                    returns: 'Promise<boolean>',
                    example: `await vbox.waitForElement('.modal');
await vbox.waitForElement('#results', 10000);`
                },
                {
                    name: 'vbox.autoScroll(options)',
                    description: 'Auto scroll for infinite scroll pages',
                    params: [{ name: 'options', type: '{ delay?: number, maxScrolls?: number }' }],
                    returns: 'Promise<number>',
                    example: `const scrolls = await vbox.autoScroll({ delay: 1000, maxScrolls: 10 });
console.log('Scrolled', scrolls, 'times');`
                }
            ]
        },
        {
            title: '🍪 Cookies',
            apis: [
                {
                    name: 'vbox.getCookies(filter?)',
                    description: 'Get cookies from current webview session (IPC-based)',
                    params: [{ name: 'filter', type: '{ url?, name?, domain?, path? } (optional)' }],
                    returns: 'Promise<{ success, cookies? }>',
                    example: `// Get all cookies
const result = await vbox.getCookies();
console.log('Cookies:', result.cookies);

// Get cookies for specific domain
const result = await vbox.getCookies({ domain: '.example.com' });`
                },
                {
                    name: 'vbox.setCookie(cookie)',
                    description: 'Set a cookie in current webview session (IPC-based)',
                    params: [{ name: 'cookie', type: '{ name, value, domain, path?, secure?, httpOnly?, sameSite?, expirationDate? }' }],
                    returns: 'Promise<{ success }>',
                    example: `await vbox.setCookie({
    name: 'session_id',
    value: 'abc123',
    domain: '.example.com',
    path: '/',
    secure: true,
    sameSite: 'lax'
});`
                }
            ]
        },
        {
            title: '💬 Dialog Handling',
            apis: [
                {
                    name: 'vbox.handleDialog(options)',
                    description: 'Register auto-response for browser dialogs (alert, confirm, prompt). Must be called BEFORE the dialog appears.',
                    params: [{ name: 'options', type: '{ accept?: boolean, text?: string }' }],
                    returns: 'Promise<{ success }>',
                    note: 'For prompt dialogs, provide text. For confirm/alert, accept controls the response.',
                    example: `// Auto-accept all dialogs
await vbox.handleDialog({ accept: true });

// Auto-dismiss and provide text for prompts
await vbox.handleDialog({ accept: true, text: 'my response' });

// Auto-dismiss confirm with "Cancel"
await vbox.handleDialog({ accept: false });`
                },
                {
                    name: 'vbox.clearDialogHandler()',
                    description: 'Remove dialog handler and restore default browser dialog behavior',
                    returns: 'Promise<{ success }>',
                    example: `await vbox.clearDialogHandler();`
                }
            ]
        },
        {
            title: '📊 Data Extraction',
            apis: [
                {
                    name: 'vbox.scrapeLinks(options)',
                    description: 'Scrape all links from page with optional filter',
                    params: [{ name: 'options', type: '{ selector?, filter? }' }],
                    returns: 'Array<{ index, url, href, text }>',
                    example: `const links = vbox.scrapeLinks();
const productLinks = vbox.scrapeLinks({
    selector: 'a.product-link',
    filter: (url) => url.includes('/products/')
});`
                },
                {
                    name: 'vbox.scrapeImages(options)',
                    description: 'Scrape all images from page with size filter',
                    params: [{ name: 'options', type: '{ selector?, minWidth?, minHeight? }' }],
                    returns: 'Array<{ index, url, src, alt, width, height }>',
                    example: `const images = vbox.scrapeImages({ minWidth: 200 });
console.log('Found', images.length, 'images');`
                },
                {
                    name: 'vbox.extractData(selectors)',
                    description: 'Extract data from multiple selectors into object',
                    params: [{ name: 'selectors', type: 'object' }],
                    returns: 'object',
                    example: `const data = vbox.extractData({
    title: 'h1',
    price: '.price',
    description: '.desc'
});
console.log(data);`
                },
                {
                    name: 'vbox.extractTable(selector)',
                    description: 'Extract table data (headers and rows)',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: '{ headers: string[], rows: object[] }',
                    example: `const table = vbox.extractTable('table.data');
console.log('Headers:', table.headers);
ppt.addTable([table.headers, ...table.rows]);`
                },
                {
                    name: 'vbox.getIFrameContent(selector)',
                    description: 'Get content from an iframe (same-origin only)',
                    params: [{ name: 'selector', type: 'string' }],
                    returns: '{ success, html?, url?, title? }',
                    note: 'Cross-origin iframes will return success: false with an error message.',
                    example: `const iframe = vbox.getIFrameContent('iframe#report');
if (iframe.success) {
    console.log('Iframe title:', iframe.title);
    console.log('Iframe HTML length:', iframe.html.length);
}`
                }
            ]
        },
        {
            title: '👁️ MutationObserver',
            apis: [
                {
                    name: 'vbox.watchChanges(selector, callback, options)',
                    description: 'Monitor DOM changes with MutationObserver',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'callback', type: '(mutations, observer) => void' },
                        { name: 'options', type: '{ childList?, subtree?, attributes?, characterData? }' }
                    ],
                    returns: 'MutationObserver',
                    note: 'Call observer.disconnect() to stop watching',
                    example: `const observer = vbox.watchChanges('.dashboard', (mutations) => {
    console.log('Dashboard updated!');
    const data = vbox.extractData({ value: '.count' });
    console.log('New value:', data.value);
});

// Stop watching after 10 seconds
setTimeout(() => observer.disconnect(), 10000);`
                },
                {
                    name: 'vbox.waitForChange(selector, options)',
                    description: 'Wait for element to change (async)',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'options', type: "{ timeout?, type?: 'any' | 'children' | 'attributes' | 'text' }" }
                    ],
                    returns: 'Promise<{ changed: true, mutations }>',
                    example: `await vbox.waitForChange('.dashboard', { 
    type: 'text',
    timeout: 10000 
});
console.log('Dashboard updated!');`
                },
                {
                    name: 'vbox.waitUntil(selector, condition, options)',
                    description: 'Wait until condition is met (async)',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'condition', type: '(element) => boolean' },
                        { name: 'options', type: '{ timeout?, checkInterval? }' }
                    ],
                    returns: 'Promise<boolean>',
                    example: `await vbox.waitUntil('.status', (el) => {
    return el.textContent.includes('Complete');
}, { timeout: 30000 });

console.log('Status is complete!');`
                }
            ]
        },
        {
            title: '🌐 Network',
            apis: [
                {
                    name: 'vbox.waitForNetworkIdle(options)',
                    description: 'Wait for network activity to settle (no requests for idleTime ms)',
                    params: [{ name: 'options', type: '{ timeout?: number, idleTime?: number }' }],
                    returns: 'Promise<{ success, idleTime? }>',
                    note: 'Uses Performance API to monitor resource requests. Default idleTime: 1000ms, timeout: 10000ms.',
                    example: `// Wait for all API calls to finish
await vbox.waitForNetworkIdle({ timeout: 15000, idleTime: 2000 });
console.log('Network is idle, page fully loaded');

// Then extract data
const data = vbox.extractData({ title: 'h1', price: '.price' });`
                }
            ]
        },
        {
            title: '📸 Screenshot',
            apis: [
                {
                    name: 'vbox.screenshot(selector, filename)',
                    description: 'Capture screenshot of element and save to Downloads folder',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'filename', type: 'string' }
                    ],
                    returns: 'Promise<{ success, path, filename, size }>',
                    example: `const result = await vbox.screenshot('.dashboard', 'dashboard.png');
if (result.success) {
    console.log('Saved to:', result.path);
    vbox.toast('Screenshot saved!', 'success');
}`
                }
            ]
        },
        {
            title: '🗂️ Tab & Profile Management (MCP-Ready)',
            apis: [
                {
                    name: 'vbox.listProfiles()',
                    description: 'List all workspace profiles with their active status',
                    returns: 'Promise<{ success, profiles: Array<{ id, name, url, active }> }>',
                    note: 'MCP-ready: AI agents can use this to discover available profiles.',
                    example: `const result = await vbox.listProfiles();
if (result.success) {
    result.profiles.forEach(p => {
        console.log(p.name, p.active ? '(active)' : '', p.url);
    });
}`
                },
                {
                    name: 'vbox.listTabs()',
                    description: 'List all open tabs (webviews) with URLs and active status',
                    returns: 'Promise<{ success, tabs: Array<{ id, url, title, active }> }>',
                    note: 'MCP-ready: AI agents can use this to discover and target specific tabs.',
                    example: `const result = await vbox.listTabs();
if (result.success) {
    result.tabs.forEach(tab => {
        console.log(tab.id, tab.title, tab.url, tab.active ? '(active)' : '');
    });
}`
                },
                {
                    name: 'vbox.switchTab(tabId)',
                    description: 'Switch focus to a specific tab by its ID',
                    params: [{ name: 'tabId', type: 'string' }],
                    returns: 'Promise<{ success }>',
                    note: 'Use listTabs() to get tab IDs first.',
                    example: `const tabs = await vbox.listTabs();
const targetTab = tabs.tabs.find(t => t.url.includes('example.com'));
if (targetTab) {
    await vbox.switchTab(targetTab.id);
}`
                },
                {
                    name: 'vbox.getTabInfo(tabId?)',
                    description: 'Get page info for a specific tab (or current active tab if no tabId)',
                    params: [{ name: 'tabId', type: 'string (optional)' }],
                    returns: 'Promise<{ success, id?, url?, title?, canGoBack?, canGoForward? }>',
                    example: `// Get active tab info
const info = await vbox.getTabInfo();
console.log('Active tab:', info.title, info.url);

// Get specific tab info
const info = await vbox.getTabInfo('tab-123');`
                }
            ]
        },
        {
            title: '📝 User Input',
            apis: [
                {
                    name: 'vbox.openInput(config)',
                    description: 'Open input window to collect user data',
                    params: [{ name: 'config', type: '{ title, fields: Array<Field> }' }],
                    returns: 'Promise<object | null>',
                    note: 'Field types: text, number, date, daterange, select, textarea',
                    example: `const data = await vbox.openInput({
    title: 'Monthly Report',
    fields: [
        {
            name: 'clientName',
            label: 'Client Name',
            type: 'text',
            required: true
        },
        {
            name: 'dateRange',
            label: 'Report Period',
            type: 'daterange',
            required: true,
            defaultValue: {
                start: '2026-05-01',
                end: '2026-05-31'
            }
        }
    ]
});

if (!data) {
    return { success: false, message: 'Cancelled' };
}

console.log('Client:', data.clientName);
console.log('Period:', data.dateRange);`
                }
            ]
        },
        {
            title: '📊 PowerPoint Generation',
            apis: [
                {
                    name: 'vbox.ppt.create()',
                    description: 'Create PowerPoint from scratch with builder pattern',
                    returns: 'PPTBuilder',
                    note: 'Methods: addTitleSlide, addSlide, addText, addTable, addImage, download',
                    example: `const ppt = vbox.ppt.create();
ppt.addTitleSlide('Monthly Report', 'January 2026');
ppt.addSlide('Summary');
ppt.addText('Total Sales: $50,000');
ppt.addTable([
    ['Product', 'Sales'],
    ['Product A', '$30,000'],
    ['Product B', '$20,000']
]);
await ppt.download('report.pptx');`
                },
                {
                    name: 'ppt.addImage(imagePath, options)',
                    description: 'Add image to current slide from file path',
                    params: [
                        { name: 'imagePath', type: 'string' },
                        { name: 'options', type: '{ x?, y?, w?, h? }' }
                    ],
                    returns: 'PPTBuilder',
                    note: 'Position in inches. Default: x=1, y=1.5, w=8, h=4',
                    example: `const screenshot = await vbox.screenshot('.dashboard', 'dash.png');
ppt.addSlide('Dashboard');
ppt.addImage(screenshot.path, { x: 0.5, y: 1.5, w: 9, h: 5 });`
                },
                {
                    name: 'vbox.ppt.useTemplate(templateName, variables, outputFilename)',
                    description: 'Generate PowerPoint from template with variable replacement',
                    params: [
                        { name: 'templateName', type: 'string' },
                        { name: 'variables', type: 'object' },
                        { name: 'outputFilename', type: 'string' }
                    ],
                    returns: 'Promise<{ success, path, filename, size }>',
                    note: 'Variables replace {{Name}}, {{dateRange}}, etc in template',
                    example: `const result = await vbox.ppt.useTemplate(
    'MonthlyReport.pptx',
    {
        Name: 'Acme Corp',
        dateRange: '2026-05-01 to 2026-05-31',
        generatedDate: new Date().toLocaleDateString()
    },
    'Acme-Report-May-2026.pptx'
);

if (result.success) {
    vbox.toast('Report generated!', 'success');
}`
                },
                {
                    name: 'vbox.ppt.listTemplates()',
                    description: 'List all available PowerPoint templates',
                    returns: 'Promise<{ success, templates: Array<{ name, path, size }> }>',
                    example: `const result = await vbox.ppt.listTemplates();
console.log('Available templates:', result.templates);`
                }
            ]
        },
        {
            title: '📁 File & Downloads',
            apis: [
                {
                    name: 'vbox.saveFile(content, filename, type)',
                    description: 'Save content to a file in Downloads folder',
                    params: [
                        { name: 'content', type: 'string' },
                        { name: 'filename', type: 'string' },
                        { name: 'type', type: "string (default: 'text/html')" }
                    ],
                    returns: 'Promise<{ success, path?, filename? }>',
                    example: `const html = '<h1>Report</h1><p>Data here</p>';
const result = await vbox.saveFile(html, 'report.html', 'text/html');
console.log('Saved to:', result.path);`
                },
                {
                    name: 'vbox.shouldDownload(filepath, filename)',
                    description: 'Add file to download manager',
                    params: [
                        { name: 'filepath', type: 'string' },
                        { name: 'filename', type: 'string' }
                    ],
                    returns: 'Promise<{ success }>',
                    example: `await vbox.shouldDownload('/path/to/file.pdf', 'report.pdf');`
                }
            ]
        }
    ];
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <BookOpen size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">VBox API Documentation</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-hidden">
    {#snippet headerSlot()}
        <div class="flex items-center gap-3 flex-1">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <BookOpen size={16} class="text-white" />
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-sm truncate text-gray-900">VBox API Documentation</h3>
                <p class="text-xs text-gray-500 truncate">Complete API reference for VBox Inject Scripts</p>
            </div>
        </div>
    {/snippet}

    {#snippet children()}
        <div class="space-y-6">
            <!-- Introduction -->
            <section>
                <h2 class="text-lg font-semibold text-gray-900 mb-3">Introduction</h2>
                <p class="text-sm text-gray-600 mb-3">
                    VBox Inject Scripts adalah fitur untuk menjalankan JavaScript kustom di halaman web. 
                    Script menggunakan VBox API yang hanya tersedia di VisualBox untuk keamanan.
                </p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p class="text-sm text-blue-800">
                        <strong>MCP-Ready:</strong> Semua API dirancang agar bisa digunakan oleh AI Agent melalui 
                        Model Context Protocol (MCP). Tab & Profile management APIs memungkinkan AI mengelola 
                        browser secara penuh.
                    </p>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p class="text-sm text-yellow-800">
                        <strong>Keamanan:</strong> Script hanya bisa dijalankan di VisualBox. 
                        Jika dijalankan di browser lain, akan gagal karena <code class="bg-black text-white px-2 py-0.5 rounded">window.__VBOX_API__</code> tidak tersedia.
                    </p>
                </div>
            </section>

            <!-- Quick Start -->
            <section>
                <h2 class="text-lg font-semibold text-gray-900 mb-3">Quick Start</h2>
                <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto"><code>// vbox is already available, no need to check!
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
console.log('Open tabs:', tabs);</code></pre>
            </section>

            <!-- API Sections -->
            {#each apiSections as section}
                <section>
                    <h3 class="text-base font-semibold text-gray-900 mb-4">{section.title}</h3>
                    
                    {#each section.apis as api, idx}
                        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
                            <!-- API Header -->
                            <div class="flex items-start justify-between mb-2">
                                <div class="flex-1">
                                    <code class="text-sm font-semibold bg-black text-white px-2 py-1 rounded">{api.name}</code>
                                    <p class="text-xs text-gray-600 mt-1">{api.description}</p>
                                </div>
                                <button
                                    onclick={() => copyToClipboard(api.example, `${section.title}-${idx}`)}
                                    class="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 ml-2"
                                    title="Copy example"
                                >
                                    {#if copiedSection === `${section.title}-${idx}`}
                                        <Check size={14} class="text-green-600" />
                                    {:else}
                                        <Copy size={14} />
                                    {/if}
                                </button>
                            </div>

                            <!-- Parameters -->
                            {#if api.params && api.params.length > 0}
                                <div class="bg-blue-50 border border-blue-100 rounded p-2 text-xs space-y-1 mb-2">
                                    <div class="font-medium text-blue-900 mb-1">Parameters:</div>
                                    {#each api.params as param}
                                        <div class="flex items-start gap-2">
                                            <span class="text-blue-800">{param.name}:</span>
                                            <code class="bg-black text-white px-2 py-0.5 rounded">{param.type}</code>
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            <!-- Returns -->
                            {#if api.returns}
                                <div class="bg-green-50 border border-green-100 rounded p-2 text-xs mb-2">
                                    <span class="text-green-800">Returns:</span>
                                    <code class="bg-black text-white px-2 py-0.5 rounded ml-1">{api.returns}</code>
                                </div>
                            {/if}

                            <!-- Note -->
                            {#if api.note}
                                <div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-800 mb-2">
                                    <strong>Note:</strong> {api.note}
                                </div>
                            {/if}

                            <!-- Example -->
                            <div class="mt-2">
                                <div class="text-xs text-gray-500 mb-1">Example:</div>
                                <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto"><code>{api.example}</code></pre>
                            </div>
                        </div>
                    {/each}
                </section>
            {/each}

            <!-- MCP Integration Guide -->
            <section>
                <h2 class="text-lg font-semibold text-gray-900 mb-3">🤖 MCP Integration Guide</h2>
                <p class="text-sm text-gray-600 mb-3">
                    VBox Script Injector dirancang untuk mendukung Model Context Protocol (MCP). 
                    Berikut adalah panduan untuk mengintegrasikan dengan AI Agent:
                </p>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                    <div>
                        <h4 class="text-sm font-semibold text-gray-800 mb-2">1. Discover Environment</h4>
                        <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto"><code>// Get all profiles and tabs
const profiles = await vbox.listProfiles();
const tabs = await vbox.listTabs();</code></pre>
                    </div>
                    <div>
                        <h4 class="text-sm font-semibold text-gray-800 mb-2">2. Target Specific Tab</h4>
                        <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto"><code>// Switch to a specific tab
await vbox.switchTab('tab-id-here');

// Or get info about active tab
const info = await vbox.getTabInfo();</code></pre>
                    </div>
                    <div>
                        <h4 class="text-sm font-semibold text-gray-800 mb-2">3. Handle Dialogs & Navigate</h4>
                        <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto"><code>// Auto-handle any dialog
await vbox.handleDialog({ accept: true });

// Navigate (note: destroys current context)
await vbox.navigate('https://target-site.com');</code></pre>
                    </div>
                    <div>
                        <h4 class="text-sm font-semibold text-gray-800 mb-2">4. Extract & Interact</h4>
                        <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto"><code>// Wait for page to fully load
await vbox.waitForNetworkIdle({ idleTime: 2000 });

// Interact with page
vbox.type('#search', 'query');
vbox.press('Enter');

// Wait for results
await vbox.waitForElement('.results');

// Extract data
const data = vbox.extractData({
    title: 'h1.result-title',
    price: '.price-tag'
});</code></pre>
                    </div>
                </div>
            </section>
        </div>
    {/snippet}
    </div>
</div>
