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
                    returns: 'Promise<{ success: boolean, id?: string, name?: string, url?: string, error?: string }>',
                    note: 'Works in both main window and webview context. Use this to verify which profile/tab is active before running scripts.',
                    example: `const profile = await vbox.getActiveProfile();
if (profile.success) {
    console.log('Active Profile:', profile.name);
    console.log('Profile ID:', profile.id);
    console.log('Current URL:', profile.url);
} else {
    console.error('Error:', profile.error);
}`
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
                    description: 'Type text into element with optional delay',
                    params: [
                        { name: 'selector', type: 'string' },
                        { name: 'text', type: 'string' },
                        { name: 'options', type: '{ delay?: number, clear?: boolean }' }
                    ],
                    example: `vbox.type('#email', 'user@example.com');
await vbox.type('#search', 'query', { delay: 100 });`
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
            title: '📊 Data Extraction',
            apis: [
                {
                    name: 'vbox.scrapeLinks(options)',
                    description: 'Scrape all links from page with optional filter',
                    params: [{ name: 'options', type: '{ selector?: string, filter?: (url, el) => boolean }' }],
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
                    params: [{ name: 'options', type: '{ selector?: string, minWidth?: number, minHeight?: number }' }],
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
                    returns: '{ headers: string[], rows: string[][] }',
                    example: `const table = vbox.extractTable('table.data');
console.log('Headers:', table.headers);
ppt.addTable([table.headers, ...table.rows]);`
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
                    example: `// Wait for dashboard to update
await vbox.waitForChange('.dashboard', { 
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
                    example: `// Wait until element has specific text
await vbox.waitUntil('.status', (el) => {
    return el.textContent.includes('Complete');
}, { timeout: 30000 });

console.log('Status is complete!');`
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
                        { name: 'options', type: '{ x?: number, y?: number, w?: number, h?: number }' }
                    ],
                    returns: 'PPTBuilder',
                    note: 'Position in inches. Default: x=1, y=1.5, w=8, h=4',
                    example: `// Capture screenshot and add to PPT
const screenshot = await vbox.screenshot('.dashboard', 'dash.png');
ppt.addSlide('Dashboard');
ppt.addImage(screenshot.path, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 5
});`
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
                <p class="text-xs text-gray-500 truncate">Swagger-style API reference</p>
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
vbox.toast('Script running', 'info');</code></pre>
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
        </div>
    {/snippet}
    </div>
</div>
