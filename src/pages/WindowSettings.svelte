<script>
    import ChildWindowControls from "../components/layout/ChildWindowControls.svelte";
    import { Settings, User, Bell, Lock, Palette, Layers, Search } from "lucide-svelte";
    import { toastStore } from "../lib/managers/toast.svelte.js";
    import { tabLifetimeManager } from "../lib/managers/tabLifetime.svelte.js";

    const WINDOW_ID = 'settings-window';

    let activeTab = $state("general");
    
    // Settings state
    let tabLifetime = $state("30"); // minutes or "forever" for unlimited
    let defaultSearchEngine = $state("google");
    let launchOnStartup = $state(false);
    let minimizeToTray = $state(false);
    let showNotifications = $state(true);
    
    const tabs = [
        { id: "general", label: "General", icon: Settings },
        { id: "tabs", label: "Tabs", icon: Layers },
        { id: "search", label: "Search", icon: Search },
        { id: "account", label: "Account", icon: User },
        { id: "notifications", label: "Notifications", icon: Bell },
        { id: "privacy", label: "Privacy", icon: Lock },
        { id: "appearance", label: "Appearance", icon: Palette }
    ];
    
    const searchEngines = [
        { id: "google", name: "Google", url: "https://www.google.com/search?q=" },
        { id: "bing", name: "Bing", url: "https://www.bing.com/search?q=" },
        { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
        { id: "yahoo", name: "Yahoo", url: "https://search.yahoo.com/search?p=" }
    ];

    async function handleSave() {
        console.log('[WindowSettings] handleSave called');
        console.log('[WindowSettings] Current settings:', {
            launchOnStartup,
            minimizeToTray,
            showNotifications,
            tabLifetime,
            defaultSearchEngine
        });
        
        try {
            // Save general settings
            console.log('[WindowSettings] Saving launch on startup...');
            const launchResult = await window.api.settings.setLaunchOnStartup(launchOnStartup);
            console.log('[WindowSettings] Launch result:', launchResult);
            
            console.log('[WindowSettings] Saving minimize to tray...');
            const trayResult = await window.api.settings.setMinimizeToTray(minimizeToTray);
            console.log('[WindowSettings] Tray result:', trayResult);
            
            console.log('[WindowSettings] Saving show notifications...');
            const notifResult = await window.api.settings.setShowNotifications(showNotifications);
            console.log('[WindowSettings] Notif result:', notifResult);
            
            // Save tab lifetime setting
            console.log('[WindowSettings] Saving tab lifetime...');
            const lifetimeResult = await window.api.settings.setTabLifetime(tabLifetime);
            console.log('[WindowSettings] Lifetime result:', lifetimeResult);
            
            // Update tab lifetime manager with new setting
            tabLifetimeManager.setLifetime(tabLifetime);
            
            // Save default search engine
            console.log('[WindowSettings] Saving search engine...');
            const searchResult = await window.api.settings.setDefaultSearchEngine(defaultSearchEngine);
            console.log('[WindowSettings] Search result:', searchResult);
            
            // Dispatch event to notify other components about settings update
            window.dispatchEvent(new CustomEvent('settings-updated'));
            
            console.log('[WindowSettings] ✅ All settings saved successfully');
            
            // Close window
            console.log('[WindowSettings] Closing window...');
            window.api.close();
        } catch (error) {
            console.error('[WindowSettings] ❌ Failed to save settings:', error);
        }
    }
    
    // Load settings on mount
    $effect(() => {
        loadSettings();
    });
    
    async function loadSettings() {
        try {
            // Load general settings from electron
            const launchResult = await window.api.settings.getLaunchOnStartup();
            if (launchResult.success) {
                launchOnStartup = launchResult.enabled;
            }
            
            const trayResult = await window.api.settings.getMinimizeToTray();
            if (trayResult.success) {
                minimizeToTray = trayResult.enabled;
            }
            
            const notifResult = await window.api.settings.getShowNotifications();
            if (notifResult.success) {
                showNotifications = notifResult.enabled;
            }
            
            // Load tab lifetime setting
            const tabLifetimeResult = await window.api.settings.getTabLifetime();
            if (tabLifetimeResult.success) {
                const minutes = tabLifetimeResult.minutes;
                
                // Check if it's a predefined value
                const predefinedValues = ['0.5', '15', '30', '60', '120', 'forever'];
                if (predefinedValues.includes(minutes)) {
                    tabLifetime = minutes;
                } else {
                    // It's a custom value
                    tabLifetime = 'custom';
                    
                    // Try to load custom values
                    const customValueResult = await window.api.db.getSetting('customTimeValue');
                    const customUnitResult = await window.api.db.getSetting('customTimeUnit');
                    
                    if (customValueResult.success && customValueResult.value !== null) {
                        customTimeValue = customValueResult.value;
                    }
                    if (customUnitResult.success && customUnitResult.value !== null) {
                        customTimeUnit = customUnitResult.value;
                    }
                }
            }
            
            // Load default search engine
            const searchEngineResult = await window.api.settings.getDefaultSearchEngine();
            if (searchEngineResult.success) {
                defaultSearchEngine = searchEngineResult.engine;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
</script>

<div class="w-full h-screen flex flex-col bg-white">
    <!-- Custom Title Bar -->
    <div class="h-10 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-4" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
            <Settings size={16} class="text-blue-600" />
            <span class="text-sm font-medium text-gray-700">Settings</span>
        </div>
        <div style="-webkit-app-region: no-drag">
            <ChildWindowControls variant="light" windowId={WINDOW_ID} />
        </div>
    </div>
    
    <!-- Content -->
    <div class="flex-1 overflow-hidden flex flex-col">
        <div class="flex gap-6 h-full flex-1 overflow-hidden p-6">
            <!-- Sidebar -->
            <div class="w-52 shrink-0 border-r border-gray-200 pr-4">
                <nav class="space-y-1">
                    {#each tabs as tab}
                        {@const Icon = tab.icon}
                        <button
                            onclick={() => activeTab = tab.id}
                            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors {activeTab === tab.id 
                                ? 'bg-blue-50 text-blue-600 font-medium' 
                                : 'text-gray-700 hover:bg-gray-100'}"
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
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">General Settings</h3>
                            <p class="text-sm text-gray-500">Configure basic application behavior</p>
                        </div>
                        
                        <div class="space-y-4">
                            <label class="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    bind:checked={launchOnStartup}
                                />
                                <div>
                                    <div class="text-sm font-medium text-gray-900">Launch on startup</div>
                                    <div class="text-xs text-gray-500">Automatically start the application when you log in</div>
                                </div>
                            </label>
                            
                            <label class="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    bind:checked={minimizeToTray}
                                />
                                <div>
                                    <div class="text-sm font-medium text-gray-900">Minimize to tray</div>
                                    <div class="text-xs text-gray-500">Keep the app running in the system tray when minimized</div>
                                </div>
                            </label>
                            
                            <label class="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                                    bind:checked={showNotifications}
                                />
                                <div>
                                    <div class="text-sm font-medium text-gray-900">Show desktop notifications</div>
                                    <div class="text-xs text-gray-500">Display notifications for important events</div>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                {:else if activeTab === "tabs"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Tab Management</h3>
                            <p class="text-sm text-gray-500">Control tab behavior and memory usage</p>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <div class="block text-sm font-medium text-gray-900 mb-2">
                                    Tab Lifetime (Memory Management)
                                </div>
                                <p class="text-xs text-gray-500 mb-3">
                                    Tabs yang tidak aktif akan di-unload dari memori setelah waktu yang ditentukan untuk menghemat RAM. 
                                    Saat tab dibuka kembali, halaman akan dimuat ulang.
                                </p>
                                
                                <div class="space-y-2">
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="tabLifetime" 
                                            value="15"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span class="text-sm text-gray-700">15 minutes</span>
                                    </label>
                                    
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="tabLifetime" 
                                            value="30"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span class="text-sm text-gray-700">30 minutes (Recommended)</span>
                                    </label>
                                    
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="tabLifetime" 
                                            value="60"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span class="text-sm text-gray-700">1 hour</span>
                                    </label>
                                    
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="tabLifetime" 
                                            value="120"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span class="text-sm text-gray-700">2 hours</span>
                                    </label>
                                    
                                    <label class="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="tabLifetime" 
                                            value="forever"
                                            bind:group={tabLifetime}
                                            class="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span class="text-sm text-gray-700">Never unload (Keep in memory forever)</span>
                                    </label>
                                </div>
                                
                                <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p class="text-xs text-blue-800">
                                        <strong>Note:</strong> Tab tidak akan ditutup, hanya kontennya yang di-unload dari memori. 
                                        Tab akan tetap terlihat di tab bar dan akan reload otomatis saat diklik.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                {:else if activeTab === "search"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Search Engine</h3>
                            <p class="text-sm text-gray-500">Choose your default search engine</p>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <div class="block text-sm font-medium text-gray-900 mb-3">
                                    Default Search Engine
                                </div>
                                
                                <div class="space-y-2">
                                    {#each searchEngines as engine}
                                        <label class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors {defaultSearchEngine === engine.id ? 'border-blue-500 bg-blue-50' : ''}">
                                            <input 
                                                type="radio" 
                                                name="searchEngine" 
                                                value={engine.id}
                                                bind:group={defaultSearchEngine}
                                                class="text-blue-600 focus:ring-blue-500"
                                            />
                                            <div class="flex-1">
                                                <div class="text-sm font-medium text-gray-900">{engine.name}</div>
                                                <div class="text-xs text-gray-500">{engine.url}</div>
                                            </div>
                                        </label>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                {:else if activeTab === "account"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Account Settings</h3>
                            <p class="text-sm text-gray-500">Manage your account information</p>
                        </div>
                        <p class="text-sm text-gray-600">Account management features coming soon...</p>
                    </div>
                    
                {:else if activeTab === "notifications"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Notification Settings</h3>
                            <p class="text-sm text-gray-500">Configure how you receive notifications</p>
                        </div>
                        <p class="text-sm text-gray-600">Notification settings coming soon...</p>
                    </div>
                    
                {:else if activeTab === "privacy"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Privacy Settings</h3>
                            <p class="text-sm text-gray-500">Control your privacy and data</p>
                        </div>
                        <p class="text-sm text-gray-600">Privacy settings coming soon...</p>
                    </div>
                    
                {:else if activeTab === "appearance"}
                    <div class="space-y-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-1">Appearance Settings</h3>
                            <p class="text-sm text-gray-500">Customize the look and feel</p>
                        </div>
                        <p class="text-sm text-gray-600">Appearance settings coming soon...</p>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div class="flex justify-end gap-2">
                <button
                    onclick={() => {
                        console.log('[WindowSettings] Cancel clicked, closing window...');
                        window.api.close();
                    }}
                    class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onclick={handleSave}
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    Save Changes
                </button>
            </div>
        </div>
    </div>
</div>
