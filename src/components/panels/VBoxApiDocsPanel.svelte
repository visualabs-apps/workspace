<script>
    /**
     * VBoxApiDocsPanel — Swagger UI-style API documentation panel
     * - Tag sections with colored header bars (collapsible)
     * - Flat endpoint rows with method badge + path + description
     * - Expandable detail: params table, returns, notes, example
     * - Copy as Markdown (full documentation)
     */
    import { BookOpen, Copy, Check, ChevronDown, ChevronRight, FileText, Expand, Shrink } from "lucide-svelte";
    import { apiSections, quickStartCode } from "../../lib/data/apiSections.js";

    let expandedSections = $state(new Set());
    let expandedApis = $state(new Set());
    let copiedSection = $state(null);
    let copiedMarkdown = $state(false);

    // Swagger UI method colors
    const methodStyles = {
        GET:    { bg: '#61affe', text: '#ffffff' },
        POST:   { bg: '#49cc90', text: '#ffffff' },
        PUT:    { bg: '#fca130', text: '#ffffff' },
        DELETE: { bg: '#f93e3e', text: '#ffffff' },
    };

    function getMethodStyle(method) {
        return methodStyles[method] || methodStyles.GET;
    }

    function toggleSection(idx) {
        const key = `section-${idx}`;
        const next = new Set(expandedSections);
        if (next.has(key)) {
            next.delete(key);
            if (typeof idx === 'number') {
                const section = apiSections[idx];
                if (section) section.apis.forEach((_, apiIdx) => next.delete(`api-${idx}-${apiIdx}`));
            }
        } else {
            next.add(key);
        }
        expandedSections = next;
    }

    function toggleApi(sectionIdx, apiIdx) {
        const key = `api-${sectionIdx}-${apiIdx}`;
        const next = new Set(expandedApis);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        expandedApis = next;
    }

    function expandAll() {
        const sections = new Set();
        const apis = new Set();
        apiSections.forEach((section, sIdx) => {
            sections.add(`section-${sIdx}`);
            section.apis.forEach((_, aIdx) => apis.add(`api-${sIdx}-${aIdx}`));
        });
        expandedSections = sections;
        expandedApis = apis;
    }

    function collapseAll() {
        expandedSections = new Set();
        expandedApis = new Set();
    }

    async function copyToClipboard(text, section) {
        try {
            await navigator.clipboard.writeText(text);
            copiedSection = section;
            setTimeout(() => { copiedSection = null; }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    // Generate full documentation as Markdown
    function generateMarkdown() {
        let md = `# VBox API Reference\n\n`;
        md += `Complete API reference for VBox Inject Scripts. All ${totalApis} APIs available.\n\n`;
        md += `## Quick Start\n\n\`\`\`javascript\n${quickStartCode}\n\`\`\`\n\n`;

        apiSections.forEach(section => {
            md += `## ${section.title}\n\n`;
            section.apis.forEach(api => {
                md += `### \`${api.name}\`\n\n`;
                md += `**Method:** ${api.method}\n\n`;
                md += `${api.description}\n\n`;
                if (api.params && api.params.length > 0) {
                    md += `**Parameters:**\n\n`;
                    md += `| Name | Type |\n|------|------|\n`;
                    api.params.forEach(param => {
                        md += `| \`${param.name}\` | \`${param.type}\` |\n`;
                    });
                    md += `\n`;
                }
                if (api.returns) {
                    md += `**Returns:** \`${api.returns}\`\n\n`;
                }
                if (api.note) {
                    md += `> **Note:** ${api.note}\n\n`;
                }
                md += `**Example:**\n\n\`\`\`javascript\n${api.example}\n\`\`\`\n\n`;
            });
        });

        return md;
    }

    async function copyAsMarkdown() {
        const md = generateMarkdown();
        try {
            await navigator.clipboard.writeText(md);
            copiedMarkdown = true;
            setTimeout(() => { copiedMarkdown = false; }, 2500);
        } catch (error) {
            console.error('Failed to copy markdown:', error);
        }
    }

    let totalApis = $derived(apiSections.reduce((sum, s) => sum + s.apis.length, 0));
</script>

<div class="h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- Top Bar -->
    <div class="border-b border-gray-200 dark:border-gray-700 px-5 py-3 bg-white dark:bg-gray-800">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <BookOpen size={16} class="text-white" />
                </div>
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-gray-100">VBox API Reference</h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{totalApis} APIs across {apiSections.length} categories</p>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button
                    onclick={expandAll}
                    class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 dark:text-gray-400"
                    title="Expand all"
                >
                    <Expand size={15} />
                </button>
                <button
                    onclick={collapseAll}
                    class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-gray-500 dark:text-gray-400"
                    title="Collapse all"
                >
                    <Shrink size={15} />
                </button>
                <div class="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button
                    onclick={copyAsMarkdown}
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors {copiedMarkdown ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'}"
                    title="Copy full documentation as Markdown"
                >
                    {#if copiedMarkdown}
                        <Check size={13} />
                        Copied!
                    {:else}
                        <FileText size={13} />
                        Copy as Markdown
                    {/if}
                </button>
            </div>
        </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto">
        <!-- Quick Start Section -->
        <div class="border-b border-gray-200 dark:border-gray-700">
            <button
                onclick={() => toggleSection('quickstart')}
                class="w-full flex items-center gap-2 px-5 py-3 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
            >
                {#if expandedSections.has('section-quickstart')}
                    <ChevronDown size={16} class="text-gray-400" />
                {:else}
                    <ChevronRight size={16} class="text-gray-400" />
                {/if}
                <span class="text-sm font-semibold text-white">Quick Start</span>
            </button>
            {#if expandedSections.has('section-quickstart')}
                <div class="px-5 py-3 bg-gray-50 dark:bg-gray-800">
                    <pre class="bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-300 p-4 rounded text-xs overflow-x-auto leading-relaxed"><code>{quickStartCode}</code></pre>
                </div>
            {/if}
        </div>

        <!-- API Tag Sections -->
        {#each apiSections as section, sIdx}
            {@const sectionKey = `section-${sIdx}`}
            {@const isSectionExpanded = expandedSections.has(sectionKey)}

            <div class="border-b border-gray-200 dark:border-gray-700">
                <!-- Tag Header Bar (Swagger style) -->
                <button
                    onclick={() => toggleSection(sIdx)}
                    class="w-full flex items-center gap-2 px-5 py-3 transition-colors"
                    style="background-color: {section.color}15;"
                >
                    {#if isSectionExpanded}
                        <ChevronDown size={16} class="text-gray-500 dark:text-gray-400" />
                    {:else}
                        <ChevronRight size={16} class="text-gray-500 dark:text-gray-400" />
                    {/if}
                    <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">{section.title}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-auto">{section.apis.length} endpoint{section.apis.length > 1 ? 's' : ''}</span>
                </button>

                <!-- Endpoints -->
                {#if isSectionExpanded}
                    <div class="bg-white dark:bg-gray-900">
                        {#each section.apis as api, aIdx}
                            {@const apiKey = `api-${sIdx}-${aIdx}`}
                            {@const isApiExpanded = expandedApis.has(apiKey)}
                            {@const mStyle = getMethodStyle(api.method)}

                            <!-- Endpoint Row -->
                            <div class="border-t border-gray-100 dark:border-gray-800">
                                <button
                                    onclick={() => toggleApi(sIdx, aIdx)}
                                    class="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                                >
                                    <!-- Method Badge -->
                                    <span
                                        class="text-[10px] font-bold px-2 py-0.5 rounded-sm min-w-[52px] text-center shrink-0"
                                        style="background-color: {mStyle.bg}; color: {mStyle.text};"
                                    >
                                        {api.method}
                                    </span>
                                    <!-- Path / Name -->
                                    <code class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{api.name}</code>
                                    <!-- Description -->
                                    <span class="text-xs text-gray-500 dark:text-gray-400 truncate hidden md:inline ml-1">{api.description}</span>
                                    <!-- Expand indicator -->
                                    {#if isApiExpanded}
                                        <ChevronDown size={14} class="text-gray-400 dark:text-gray-500 ml-auto shrink-0" />
                                    {:else}
                                        <ChevronRight size={14} class="text-gray-400 dark:text-gray-500 ml-auto shrink-0" />
                                    {/if}
                                </button>

                                <!-- Expanded Detail (Swagger operation detail) -->
                                {#if isApiExpanded}
                                    <div class="px-5 pb-4 pt-1 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                                        <div class="pl-16 space-y-3">
                                            <!-- Description -->
                                            <p class="text-sm text-gray-700 dark:text-gray-300">{api.description}</p>

                                            <!-- Parameters -->
                                            {#if api.params && api.params.length > 0}
                                                <div>
                                                    <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Parameters</h4>
                                                    <table class="w-full text-xs border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                                                        <thead>
                                                            <tr class="bg-gray-50 dark:bg-gray-800">
                                                                <th class="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Name</th>
                                                                <th class="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Type</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {#each api.params as param}
                                                                <tr class="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                                    <td class="px-3 py-1.5 font-mono text-blue-700 dark:text-blue-400">{param.name}</td>
                                                                    <td class="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-400">{param.type}</td>
                                                                </tr>
                                                            {/each}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            {/if}

                                            <!-- Returns -->
                                            {#if api.returns}
                                                <div>
                                                    <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Returns</h4>
                                                    <code class="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 px-2 py-1 rounded">{api.returns}</code>
                                                </div>
                                            {/if}

                                            <!-- Note -->
                                            {#if api.note}
                                                <div class="bg-amber-50 dark:bg-amber-900/20 border-l-3 border-amber-400 dark:border-amber-600 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 rounded-r">
                                                    <strong>Note:</strong> {api.note}
                                                </div>
                                            {/if}

                                            <!-- Example -->
                                            <div>
                                                <div class="flex items-center justify-between mb-1">
                                                    <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Example</h4>
                                                    <button
                                                        onclick={(e) => { e.stopPropagation(); copyToClipboard(api.example, `${sIdx}-${aIdx}`); }}
                                                        class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors {copiedSection === `${sIdx}-${aIdx}` ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}"
                                                    >
                                                        {#if copiedSection === `${sIdx}-${aIdx}`}
                                                            <Check size={10} />
                                                            Copied
                                                        {:else}
                                                            <Copy size={10} />
                                                            Copy
                                                        {/if}
                                                    </button>
                                                </div>
                                                <pre class="bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-300 p-3 rounded text-xs overflow-x-auto leading-relaxed"><code>{api.example}</code></pre>
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}

        <div class="h-8"></div>
    </div>
</div>
