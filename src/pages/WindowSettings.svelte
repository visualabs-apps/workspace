<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import {
        Settings,
        User,
        Bell,
        Lock,
        Palette,
        Layers,
        Search,
        Code,
        RefreshCw,
        CheckCircle,
        Download,
        AlertCircle,
        Database,
        Info,
        Moon,
        Sun,
    } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { tabLifetimeManager } from "../lib/managers/tabLifetime.svelte.js";
    import { dataSyncManager } from "../lib/managers/dataSync.svelte.js";

    const WINDOW_ID = "settings-window";

    let activeTab = $state("general");

    // Settings state
    let tabLifetime = $state("30");
    let defaultSearchEngine = $state("google");
    let showNotifications = $state(true);
    let autoStart = $state(false);
    let developerMode = $state(false);
    let theme = $state("light"); // 'light' | 'dark' | 'system'

    // Track original theme to revert on Cancel
    let originalTheme = $state("light");

    // Data Sync settings
    let dataSyncEnabled = $state(false);
    let dataSyncInterval = $state("30");

    // Hardware Acceleration
    let hardwareAcceleration = $state(true);

    // ── Update state ─────────────────────────────────────────────────────────
    let currentVersion = $state("");
    let updateStatus = $state("idle"); // idle | checking | upToDate | available | downloading | done | error
    let updateInfo = $state({
        version: "",
        notes: "",
        downloadUrl: null,
        assetName: null,
        assetSize: 0,
    });
    let updateError = $state("");

    async function checkUpdate() {
        updateStatus = "checking";
        updateError = "";
        try {
            const result = await window.api.update.checkNow();
            if (!result.success) {
                updateError = result.error || "Gagal memeriksa update";
                updateStatus = "error";
            } else if (result.upToDate) {
                updateStatus = "upToDate";
            } else {
                updateInfo = {
                    version: result.latestVersion,
                    notes: result.notes,
                    downloadUrl: result.downloadUrl,
                    assetName: result.assetName,
                    assetSize: result.assetSize,
                };
                updateStatus = "available";
            }
        } catch (e) {
            updateError = e.message;
            updateStatus = "error";
        }
    }

    async function startUpdate() {
        if (!updateInfo.downloadUrl) return;
        updateStatus = "downloading";
        const result = await window.api.update.startDownload({
            downloadUrl: updateInfo.downloadUrl,
            assetName: updateInfo.assetName,
        });

        if (result?.devMode) {
            // Dev mode: download blocked, show info message
            updateStatus = "devMode";
            return;
        }
        if (!result?.success) {
            updateError = result?.error || "Download gagal";
            updateStatus = "error";
            return;
        }
        // Download started — close settings so user sees the UpdateBanner
        window.api.close();
    }

    function formatBytes(bytes) {
        if (!bytes) return "";
        const mb = bytes / (1024 * 1024);
        return mb >= 1
            ? `${mb.toFixed(1)} MB`
            : `${(bytes / 1024).toFixed(0)} KB`;
    }

    const tabs = [
        { id: "general", label: "General", icon: Settings },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "tabs", label: "Tabs", icon: Layers },
        { id: "search", label: "Search", icon: Search },
        { id: "dataSync", label: "Data Sync", icon: Database },
        { id: "developer", label: "Developer", icon: Code },
        { id: "update", label: "About", icon: Info },
    ];

    const searchEngines = [
        {
            id: "google",
            name: "Google",
            url: "https://www.google.com/search?q=",
        },
        { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=" },
        {
            id: "duckduckgo",
            name: "DuckDuckGo",
            url: "https://duckduckgo.com/?q=",
        },
        {
            id: "yahoo",
            name: "Yahoo",
            url: "https://search.yahoo.com/search?p=",
        },
    ];

    async function handleSave() {
        console.log("[WindowSettings] handleSave called");
        console.log("[WindowSettings] Current settings:", {
            showNotifications,
            tabLifetime,
            defaultSearchEngine,
            autoStart,
        });

        try {
            // Save general settings
            console.log("[WindowSettings] Saving show notifications...");
            const notifResult =
                await window.api.settings.setShowNotifications(
                    showNotifications,
                );
            console.log("[WindowSettings] Notif result:", notifResult);

            // Save auto start setting
            console.log("[WindowSettings] Saving auto start...");
            const autoStartResult =
                await window.api.settings.setAutoStart(autoStart);
            console.log("[WindowSettings] Auto start result:", autoStartResult);

            // Save tab lifetime setting
            console.log("[WindowSettings] Saving tab lifetime...");
            const lifetimeResult =
                await window.api.settings.setTabLifetime(tabLifetime);
            console.log("[WindowSettings] Lifetime result:", lifetimeResult);

            // Update tab lifetime manager with new setting
            tabLifetimeManager.setLifetime(tabLifetime);

            // Save default search engine
            console.log("[WindowSettings] Saving search engine...");
            const searchResult =
                await window.api.settings.setDefaultSearchEngine(
                    defaultSearchEngine,
                );
            console.log("[WindowSettings] Search result:", searchResult);

            // Save developer mode
            console.log("[WindowSettings] Saving developer mode...");
            const devModeResult =
                await window.api.settings.setDeveloperMode(developerMode);
            console.log(
                "[WindowSettings] Developer mode result:",
                devModeResult,
            );

            // Save theme
            console.log("[WindowSettings] Saving theme...");
            await window.api.db.saveSetting('theme', theme);
            applyTheme(theme);

            // Save data sync settings
            await window.api.settings.setDataSyncEnabled(dataSyncEnabled);
            await window.api.settings.setDataSyncInterval(Number(dataSyncInterval));

            // Update data sync manager with new settings
            dataSyncManager.updateSettings({
                enabled: dataSyncEnabled,
                seconds: Number(dataSyncInterval),
            });

            // Save hardware acceleration (requires app restart to take effect)
            await window.api.settings.setHardwareAcceleration(hardwareAcceleration);

            // Dispatch event to notify other components about settings update
            window.dispatchEvent(new CustomEvent("settings-updated"));

            console.log("[WindowSettings] ✅ All settings saved successfully");

            // Close window
            console.log("[WindowSettings] Closing window...");
            window.api.close();
        } catch (error) {
            console.error(
                "[WindowSettings] ❌ Failed to save settings:",
                error,
            );
        }
    }

    // Load settings on mount
    $effect(() => {
        loadSettings();
        // Load current version
        window.api
            .getAppVersion?.()
            .then((v) => {
                currentVersion = v;
            })
            .catch(() => {});
    });

    // Apply theme to document
    function applyTheme(selectedTheme) {
        const root = document.documentElement;
        
        if (selectedTheme === 'system') {
            // Detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('dark', selectedTheme === 'dark');
        }
        
        // Dispatch event to notify main window via IPC
        if (window.api?.sendToParent) {
            window.api.sendToParent('theme-changed', { theme: selectedTheme });
        }
        
        // Also dispatch local event for this window
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: selectedTheme } }));
    }

    async function loadSettings() {
        try {
            // Load general settings from electron
            const notifResult =
                await window.api.settings.getShowNotifications();
            if (notifResult.success) {
                showNotifications = notifResult.enabled;
            }

            // Load auto start setting
            const autoStartResult = await window.api.settings.getAutoStart();
            if (autoStartResult.success) {
                autoStart = autoStartResult.enabled;
            }

            // Load tab lifetime setting
            const tabLifetimeResult =
                await window.api.settings.getTabLifetime();
            if (tabLifetimeResult.success) {
                const minutes = tabLifetimeResult.minutes;

                // Check if it's a predefined value
                const predefinedValues = [
                    "0.5",
                    "15",
                    "30",
                    "60",
                    "120",
                    "forever",
                ];
                if (predefinedValues.includes(minutes)) {
                    tabLifetime = minutes;
                } else {
                    // It's a custom value
                    tabLifetime = "custom";

                    // Try to load custom values
                    const customValueResult =
                        await window.api.db.getSetting("customTimeValue");
                    const customUnitResult =
                        await window.api.db.getSetting("customTimeUnit");

                    if (
                        customValueResult.success &&
                        customValueResult.value !== null
                    ) {
                        customTimeValue = customValueResult.value;
                    }
                    if (
                        customUnitResult.success &&
                        customUnitResult.value !== null
                    ) {
                        customTimeUnit = customUnitResult.value;
                    }
                }
            }

            // Load default search engine
            const searchEngineResult =
                await window.api.settings.getDefaultSearchEngine();
            if (searchEngineResult.success) {
                defaultSearchEngine = searchEngineResult.engine;
            }
            // Load developer mode
            const devModeResult = await window.api.settings.getDeveloperMode();
            if (devModeResult.success) {
                developerMode = devModeResult.enabled;
            }

            // Load data sync settings
            const syncEnabledResult = await window.api.settings.getDataSyncEnabled();
            if (syncEnabledResult.success) {
                dataSyncEnabled = syncEnabledResult.enabled;
            }
            const syncIntervalResult = await window.api.settings.getDataSyncInterval();
            if (syncIntervalResult.success) {
                dataSyncInterval = String(syncIntervalResult.seconds);
            }

            // Load hardware acceleration
            const hwAccelResult = await window.api.settings.getHardwareAcceleration();
            if (hwAccelResult.success) {
                hardwareAcceleration = hwAccelResult.enabled;
            }

            // Load theme
            const themeResult = await window.api.db.getSetting('theme');
            if (themeResult.success && themeResult.value) {
                theme = themeResult.value;
                originalTheme = themeResult.value;
                applyTheme(theme);
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Custom Title Bar -->
    <div
        class="h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4"
        style="-webkit-app-region: drag"
    >
        <div class="flex items-center gap-2">
            <Settings size={16} class="text-blue-600 dark:text-blue-400" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls windowId={WINDOW_ID} />
        </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
        <div class="flex gap-6 h-full flex-1 overflow-hidden p-6">
            <!-- Sidebar -->
            <div class="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
                <nav class="space-y-1">
                    {#each tabs as tab}
                        {@const Icon = tab.icon}
                        <button
                            onclick={() => (activeTab = tab.id)}
                            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {activeTab ===
                            tab.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}"
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    {/each}
                </nav>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto pr-4">
                {#if activeTab === "general"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                General Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Configure basic application behavior
                            </p>
                        </div>

                        <div class="space-y-4">
                            <label
                                class="flex items-start gap-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                    bind:checked={autoStart}
                                />
                                <div>
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                    >
                                        Start automatically when computer turns
                                        on
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        Launch VisualBox automatically when
                                        Windows starts up
                                    </div>
                                </div>
                            </label>

                            <label
                                class="flex items-start gap-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                    bind:checked={showNotifications}
                                />
                                <div>
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                    >
                                        Show desktop notifications
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        Display notifications for important
                                        events
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                {:else if activeTab === "tabs"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Tab Management
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Control tab behavior and memory usage
                            </p>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <div
                                    class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
                                >
                                    Tab Lifetime (Memory Management)
                                </div>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    Tabs yang tidak aktif akan di-unload dari
                                    memori setelah waktu yang ditentukan untuk
                                    menghemat RAM. Saat tab dibuka kembali,
                                    halaman akan dimuat ulang.
                                </p>

                                <div class="space-y-2">
                                    <label
                                        class="flex items-center gap-3 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="tabLifetime"
                                            value="15"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span class="text-sm text-gray-700 dark:text-gray-300"
                                            >15 minutes</span
                                        >
                                    </label>

                                    <label
                                        class="flex items-center gap-3 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="tabLifetime"
                                            value="30"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span class="text-sm text-gray-700 dark:text-gray-300"
                                            >30 minutes (Recommended)</span
                                        >
                                    </label>

                                    <label
                                        class="flex items-center gap-3 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="tabLifetime"
                                            value="60"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span class="text-sm text-gray-700 dark:text-gray-300"
                                            >1 hour</span
                                        >
                                    </label>

                                    <label
                                        class="flex items-center gap-3 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="tabLifetime"
                                            value="120"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span class="text-sm text-gray-700 dark:text-gray-300"
                                            >2 hours</span
                                        >
                                    </label>

                                    <label
                                        class="flex items-center gap-3 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="tabLifetime"
                                            value="forever"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                        <span class="text-sm text-gray-700 dark:text-gray-300"
                                            >Never unload (Keep in memory
                                            forever)</span
                                        >
                                    </label>
                                </div>

                                <div
                                    class="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg"
                                >
                                    <p class="text-xs text-blue-800 dark:text-blue-300">
                                        <strong>Note:</strong> Tab tidak akan ditutup,
                                        hanya kontennya yang di-unload dari memori.
                                        Tab akan tetap terlihat di tab bar dan akan
                                        reload otomatis saat diklik.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                {:else if activeTab === "appearance"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                Appearance
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Customize the look and feel of the application
                            </p>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <div class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                                    Theme
                                </div>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    Choose your preferred color theme
                                </p>

                                <div class="space-y-2">
                                    <label class="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors {theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="light"
                                            bind:group={theme}
                                            onchange={() => applyTheme(theme)}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div class="w-10 h-10 rounded-lg bg-white border-2 border-gray-300 flex items-center justify-center">
                                            <Sun size={20} class="text-yellow-500" />
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Light
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                                Bright and clean interface
                                            </div>
                                        </div>
                                    </label>

                                    <label class="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors {theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="dark"
                                            bind:group={theme}
                                            onchange={() => applyTheme(theme)}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div class="w-10 h-10 rounded-lg bg-gray-900 border-2 border-gray-700 flex items-center justify-center">
                                            <Moon size={20} class="text-blue-400" />
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                Dark
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                                Easy on the eyes in low light
                                            </div>
                                        </div>
                                    </label>

                                    <label class="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors {theme === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''}">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="system"
                                            bind:group={theme}
                                            onchange={() => applyTheme(theme)}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-white to-gray-900 border-2 border-gray-400 flex items-center justify-center">
                                            <Settings size={20} class="text-gray-600" />
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                System
                                            </div>
                                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                                Follow system preference
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p class="text-xs text-blue-800 dark:text-blue-300">
                                        <strong>Note:</strong> Theme changes will apply immediately. You may need to restart the app for all windows to update.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                {:else if activeTab === "search"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Search Engine
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Choose your default search engine
                            </p>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <div
                                    class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3"
                                >
                                    Default Search Engine
                                </div>

                                <div class="space-y-2">
                                    {#each searchEngines as engine}
                                        <label
                                            class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors {defaultSearchEngine ===
                                            engine.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                                : ''}"
                                        >
                                            <input
                                                type="radio"
                                                name="searchEngine"
                                                value={engine.id}
                                                bind:group={defaultSearchEngine}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <div class="flex-1">
                                                <div
                                                    class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                                >
                                                    {engine.name}
                                                </div>
                                                <div
                                                    class="text-xs text-gray-500 dark:text-gray-400"
                                                >
                                                    {engine.url}
                                                </div>
                                            </div>
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    </div>
                {:else if activeTab === "dataSync"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Data Sync
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Sinkronkan cookies dan data profil dari server secara otomatis
                            </p>
                        </div>

                        <div class="space-y-4">
                            <label
                                class="flex items-start gap-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                    bind:checked={dataSyncEnabled}
                                />
                                <div>
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                    >
                                        Aktifkan Data Sync
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        Sinkronkan cookies dari server dan refresh daftar profil secara berkala.
                                        Berguna ketika beberapa orang menggunakan akun yang sama.
                                    </div>
                                </div>
                            </label>

                            {#if dataSyncEnabled}
                                <div>
                                    <div
                                        class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2"
                                    >
                                        Sync Interval
                                    </div>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        Seberapa sering data disinkronkan dari server
                                    </p>

                                    <div class="space-y-2">
                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="10"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >10 detik</span
                                            >
                                        </label>

                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="15"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >15 detik</span
                                            >
                                        </label>

                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="30"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >30 detik (Default)</span
                                            >
                                        </label>

                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="60"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >1 menit</span
                                            >
                                        </label>

                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="120"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >2 menit</span
                                            >
                                        </label>

                                        <label
                                            class="flex items-center gap-3 cursor-pointer"
                                        >
                                            <input
                                                type="radio"
                                                name="dataSyncInterval"
                                                value="300"
                                                bind:group={dataSyncInterval}
                                                class="text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                            />
                                            <span class="text-sm text-gray-700 dark:text-gray-300"
                                                >5 menit</span
                                            >
                                        </label>
                                    </div>
                                </div>
                            {/if}

                            <div
                                class="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg"
                            >
                                <p class="text-xs text-blue-800 dark:text-blue-300">
                                    <strong>Data Sync</strong> akan menarik cookies terbaru dari server
                                    dan menerapkannya ke sesi lokal, serta memperbarui daftar profil.
                                    Ini memastikan perubahan yang dibuat oleh pengguna lain di akun
                                    yang sama langsung tersinkronisasi.
                                </p>
                            </div>
                        </div>
                    </div>
                {:else if activeTab === "developer"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Developer Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Configure developer features and advanced
                                options
                            </p>
                        </div>

                        <div class="space-y-4">
                            <label
                                class="flex items-start gap-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                    bind:checked={developerMode}
                                />
                                <div>
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                    >
                                        Developer Mode
                                    </div>
                                </div>
                            </label>

                            <label
                                class="flex items-start gap-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                    bind:checked={hardwareAcceleration}
                                />
                                <div>
                                    <div
                                        class="text-sm font-medium text-gray-900 dark:text-gray-100"
                                    >
                                        Hardware Acceleration
                                    </div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Enable GPU acceleration for WebGL and canvas rendering. Improves performance but may cause issues on some systems. Requires app restart.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                {:else if activeTab === "update"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Update Aplikasi
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Periksa dan install versi terbaru VisualBox
                            </p>
                        </div>

                        <!-- Current version -->
                        <div
                            class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                        >
                            <div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                                    Versi saat ini
                                </div>
                                <div
                                    class="text-sm font-semibold text-gray-900 dark:text-gray-100"
                                >
                                    {currentVersion
                                        ? `v${currentVersion}`
                                        : "Memuat..."}
                                </div>
                            </div>
                            <button
                                onclick={checkUpdate}
                                disabled={updateStatus === "checking" ||
                                    updateStatus === "downloading"}
                                class="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <RefreshCw
                                    size={14}
                                    class={updateStatus === "checking"
                                        ? "animate-spin"
                                        : ""}
                                />
                                {updateStatus === "checking"
                                    ? "Memeriksa..."
                                    : "Cek Update"}
                            </button>
                        </div>

                        <!-- Result -->
                        {#if updateStatus === "upToDate"}
                            <div
                                class="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl"
                            >
                                <CheckCircle
                                    size={20}
                                    class="text-green-500 shrink-0"
                                />
                                <div>
                                    <div
                                        class="text-sm font-semibold text-green-800 dark:text-green-300"
                                    >
                                        Versi terbaru sudah terinstall
                                    </div>
                                    <div class="text-xs text-green-600 dark:text-green-400">
                                        VisualBox v{currentVersion} adalah versi
                                        terbaru.
                                    </div>
                                </div>
                            </div>
                        {:else if updateStatus === "available"}
                            <div
                                class="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl space-y-3"
                            >
                                <div class="flex items-start gap-3">
                                    <Download
                                        size={20}
                                        class="text-blue-500 shrink-0 mt-0.5"
                                    />
                                    <div class="flex-1">
                                        <div
                                            class="text-sm font-semibold text-blue-900 dark:text-blue-300"
                                        >
                                            Ada versi baru tersedia — v{updateInfo.version}
                                        </div>
                                        <div
                                            class="text-xs text-blue-600 dark:text-blue-400 mt-0.5"
                                        >
                                            {updateInfo.assetName ||
                                                "Installer"}
                                            {#if updateInfo.assetSize}
                                                &nbsp;({formatBytes(
                                                    updateInfo.assetSize,
                                                )})
                                            {/if}
                                        </div>
                                        {#if updateInfo.notes}
                                            <pre
                                                class="mt-2 text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap font-sans max-h-28 overflow-y-auto">{updateInfo.notes}</pre>
                                        {/if}
                                    </div>
                                </div>
                                <button
                                    onclick={startUpdate}
                                    class="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                                >
                                    <Download size={15} />
                                    Update Sekarang
                                </button>
                            </div>
                        {:else if updateStatus === "downloading"}
                            <div
                                class="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl"
                            >
                                <RefreshCw
                                    size={20}
                                    class="text-indigo-500 shrink-0 animate-spin"
                                />
                                <div>
                                    <div
                                        class="text-sm font-semibold text-indigo-800 dark:text-indigo-300"
                                    >
                                        Mengunduh update…
                                    </div>
                                    <div class="text-xs text-indigo-600 dark:text-indigo-400">
                                        Lihat progress di jendela utama.
                                    </div>
                                </div>
                            </div>
                        {:else if updateStatus === "error"}
                            <div
                                class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl"
                            >
                                <AlertCircle
                                    size={20}
                                    class="text-red-500 shrink-0 mt-0.5"
                                />
                                <div>
                                    <div
                                        class="text-sm font-semibold text-red-800 dark:text-red-300"
                                    >
                                        Gagal
                                    </div>
                                    <div class="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                        {updateError}
                                    </div>
                                    <button
                                        onclick={() => {
                                            updateStatus = "idle";
                                            updateError = "";
                                        }}
                                        class="mt-2 text-xs text-red-700 dark:text-red-400 underline hover:no-underline"
                                        >Coba lagi</button
                                    >
                                </div>
                            </div>
                        {:else if updateStatus === "devMode"}
                            <div
                                class="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl"
                            >
                                <AlertCircle
                                    size={20}
                                    class="text-amber-500 shrink-0 mt-0.5"
                                />
                                <div>
                                    <div
                                        class="text-sm font-semibold text-amber-800 dark:text-amber-300"
                                    >
                                        Mode Development
                                    </div>
                                    <div class="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                        Download dinonaktifkan saat mode dev.
                                        Gunakan build produksi untuk melakukan
                                        update.
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else if activeTab === "account"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Account Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Manage your account information
                            </p>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Account management features coming soon...
                        </p>
                    </div>
                {:else if activeTab === "notifications"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Notification Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Configure how you receive notifications
                            </p>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Notification settings coming soon...
                        </p>
                    </div>
                {:else if activeTab === "privacy"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Privacy Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Control your privacy and data
                            </p>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Privacy settings coming soon...
                        </p>
                    </div>
                {:else if activeTab === "appearance"}
                    <div class="space-y-6">
                        <div>
                            <h3
                                class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1"
                            >
                                Appearance Settings
                            </h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                Customize the look and feel
                            </p>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Appearance settings coming soon...
                        </p>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800">
            <div class="flex justify-end gap-2">
                <button
                    onclick={() => {
                        console.log(
                            "[WindowSettings] Cancel clicked, reverting theme and closing window...",
                        );
                        // Revert theme preview to the original value before closing
                        if (theme !== originalTheme) {
                            applyTheme(originalTheme);
                        }
                        window.api.close();
                    }}
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onclick={handleSave}
                    class="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                >
                    Save Changes
                </button>
            </div>
        </div>
    </div>
</div>
