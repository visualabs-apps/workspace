<script>
    import { predefinedServices } from "../lib/services.svelte.js";
    import { X, Search, Check, Globe } from "lucide-svelte";

    // Props
    let { onAppsSelect = null, onClose = null, groupName = "" } = $props();

    let searchQuery = $state("");
    let selectedApps = $state([]);
    let filteredServices = $derived(
        predefinedServices.filter((s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
    );

    // Custom app inline form state
    let showCustomForm = $state(false);
    let customUrl = $state("https://");
    let customName = $state("");
    let customUrlError = $state("");

    function close() {
        if (onClose) onClose();
    }

    function toggleApp(service) {
        if (service.name === "Custom") {
            showCustomForm = !showCustomForm;
            return;
        }
        const index = selectedApps.findIndex((s) => s.name === service.name);
        if (index > -1) {
            selectedApps = selectedApps.filter((s) => s.name !== service.name);
        } else {
            selectedApps = [...selectedApps, service];
        }
    }

    function confirmCustom() {
        customUrlError = "";
        let url = customUrl.trim();
        if (!url || url === "https://") {
            customUrlError = "Please enter a valid URL.";
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        const name = customName.trim() || "My App";
        const customService = predefinedServices.find(
            (s) => s.name === "Custom",
        );
        selectedApps = [
            ...selectedApps,
            { ...customService, customUrl: url, customName: name },
        ];
        showCustomForm = false;
        customUrl = "https://";
        customName = "";
    }

    function isSelected(service) {
        if (service.name === "Custom") {
            return selectedApps.some((s) => s.customUrl);
        }
        return selectedApps.some((s) => s.name === service.name);
    }

    function handleConfirm() {
        if (selectedApps.length > 0 && onAppsSelect) {
            onAppsSelect(selectedApps);
        }
        close();
    }
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
    onclick={close}
>
    <!-- Modal Content -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-gray-200"
        onclick={(e) => e.stopPropagation()}
    >
        <!-- Header -->
        <div
            class="p-6 border-b border-gray-100 flex items-center justify-between"
        >
            <div>
                <h2 class="text-2xl font-bold text-gray-800">
                    Select Apps for "{groupName}"
                </h2>
                <p class="text-sm text-gray-500 mt-1">
                    {#if selectedApps.length > 0}
                        {selectedApps.length} app{selectedApps.length > 1
                            ? "s"
                            : ""} selected
                    {:else}
                        Choose apps to add to this group
                    {/if}
                </p>
            </div>
            <button
                onclick={close}
                class="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={24} />
            </button>
        </div>

        <!-- Search -->
        <div class="p-6 pb-2">
            <div class="relative">
                <Search
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={20}
                />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search for an app..."
                    class="w-full bg-gray-50 text-gray-900 pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>
        </div>

        <!-- Custom app inline form -->
        {#if showCustomForm}
            <div
                class="mx-6 mb-2 p-4 rounded-xl border-2 border-indigo-400 bg-indigo-50 flex flex-col gap-3"
            >
                <p
                    class="text-sm font-semibold text-indigo-700 flex items-center gap-2"
                >
                    <Globe size={16} /> Add Custom App
                </p>
                <div class="flex gap-3">
                    <div class="flex-1">
                        <input
                            type="text"
                            bind:value={customName}
                            placeholder="App name (e.g. My Dashboard)"
                            class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div class="flex-[2]">
                        <input
                            type="text"
                            bind:value={customUrl}
                            placeholder="https://yourapp.com"
                            class="w-full bg-white text-gray-900 px-3 py-2 rounded-lg border {customUrlError
                                ? 'border-red-400'
                                : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        {#if customUrlError}
                            <p class="text-xs text-red-500 mt-1">
                                {customUrlError}
                            </p>
                        {/if}
                    </div>
                    <button
                        onclick={confirmCustom}
                        class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Add
                    </button>
                    <button
                        onclick={() => (showCustomForm = false)}
                        class="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        {/if}

        <!-- Grid -->
        <div
            class="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
            {#each filteredServices as service}
                {@const selected = isSelected(service)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <button
                    class="relative flex flex-col items-center justify-center p-6 rounded-xl transition-all group border-2 {selected
                        ? 'bg-indigo-50 border-indigo-500 shadow-md'
                        : service.name === 'Custom' && showCustomForm
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-gray-50 border-gray-100 hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50'}"
                    onclick={() => toggleApp(service)}
                >
                    <!-- Checkmark -->
                    {#if selected}
                        <div
                            class="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center"
                        >
                            <Check size={16} class="text-white" />
                        </div>
                    {/if}

                    <div
                        class="w-16 h-16 mb-4 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow border border-gray-100 overflow-hidden"
                    >
                        {#if service.icon}
                            <img
                                src={service.icon}
                                alt={service.name}
                                class="w-full h-full object-contain p-1"
                                onerror={(e) => {
                                    e.target.style.display = "none";
                                    e.target.nextElementSibling.style.display =
                                        "flex";
                                }}
                            />
                        {/if}
                        <!-- Fallback letter avatar (shown if icon fails) -->
                        <div
                            class="w-full h-full items-center justify-center text-white font-bold text-xl rounded-2xl"
                            style="display: none; background-color: {service.color};"
                        >
                            {service.name[0]}
                        </div>
                    </div>
                    <span
                        class="font-medium {selected
                            ? 'text-indigo-600'
                            : 'text-gray-700 group-hover:text-indigo-600'}"
                        >{service.name}</span
                    >
                    {#if service.name === "Custom"}
                        <span class="text-xs text-gray-400 mt-1"
                            >Enter your URL</span
                        >
                    {/if}
                </button>
            {/each}
        </div>

        <!-- Footer -->
        <div
            class="p-6 border-t border-gray-100 flex justify-between items-center"
        >
            <button
                onclick={close}
                class="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition-colors"
            >
                Cancel
            </button>
            <button
                onclick={handleConfirm}
                disabled={selectedApps.length === 0}
                class="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Add {selectedApps.length > 0
                    ? `${selectedApps.length} App${selectedApps.length > 1 ? "s" : ""}`
                    : "Apps"}
            </button>
        </div>
    </div>
</div>
