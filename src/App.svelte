<script>
    import Sidebar from "./components/layout/Sidebar.svelte";
    import RightFloatingSidebar from "./components/layout/RightFloatingSidebar.svelte";
    import TopToolbar from "./components/layout/TopToolbar.svelte";
    import ServiceView from "./components/features/ServiceView.svelte";
    import LoginPage from "./components/features/LoginPage.svelte";
    import NotificationPanel from "./components/panels/NotificationPanel.svelte";
    import TabBar from "./components/layout/TabBar.svelte";
    import Toast from "./components/ui/Toast.svelte";
    import OfflineWarning from "./components/ui/OfflineWarning.svelte";
    import Taskbar from "./components/layout/Taskbar.svelte";
    import UpdateBanner from "./components/ui/UpdateBanner.svelte";
    import PasswordPrompt from "./lib/components/PasswordPrompt.svelte";
    import PasswordPopup from "./components/layout/PasswordPopup.svelte";
    import { appStore } from "./lib/stores/apps.svelte.js";
    import { authStore } from "./lib/stores/auth.svelte.js";
    import { workspaceStore } from "./lib/stores/workspaces.svelte.js";
    import { navigationStore } from "./lib/managers/navigation.svelte.js";
    import { downloadStore } from "./lib/stores/downloads.svelte.js";
    import { historyStore } from "./lib/stores/history.svelte.js";
    import { notificationStore } from "./lib/stores/notifications.svelte.js";
    import { dndStore } from "./lib/utils/dnd.svelte.js";
    import { appStateStore } from "./lib/stores/appState.svelte.js";
    import { toastStore } from "./lib/managers/toast.svelte.js";
    import { panelStore } from "./lib/stores/panels.svelte.js";
    import { taskbarStore } from "./lib/stores/taskbar.svelte.js";
    import { scriptInputStore } from "./lib/stores/scriptInputStore.svelte.js";
    import { dataSyncManager } from "./lib/managers/dataSync.svelte.js";
    import { passwordStore } from "./lib/stores/passwordStore.svelte.js";
    import { openPredefinedWindow } from "./lib/utils/childWindow.js";
    import { onMount } from "svelte";
    import { Loader2, Plus, Rocket } from "lucide-svelte";

    import { aiChatStore } from "./lib/stores/aiChatStore.svelte.js";
    import AIChatPanel from "./components/panels/AIChatPanel.svelte";

    let isOnline = $state(navigator.onLine);

    // Password Manager popup state
    let passwordPopupData = $state({
        visible: false, // Only show when triggered by login
        origin: '',
        username: '',
        password: '',
        title: '',
        isUpdate: false
    });

    let isTabDragging = $derived(appStateStore.isAnyTabDragging);

    let isLoggedIn = $derived(authStore.isLoggedIn);
    let isAuthLoading = $derived(authStore.isLoading);
    let isAuthInitialized = $derived(authStore.isInitialized);

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let isLoadingWorkspaces = $derived(workspaceStore.isLoading);
    
    // Quick actions state
    let isTargetModalOpen = $state(false);
    
    // Search engine configurations
    const searchEngines = {
        google: { name: "Google", url: "https://www.google.com", icon: "https://www.google.com/favicon.ico", color: "#4285f4" },
        bing: { name: "Bing", url: "https://www.bing.com", icon: "https://www.bing.com/favicon.ico", color: "#008373" },
        duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com", icon: "https://duckduckgo.com/favicon.ico", color: "#de5833" },
        yahoo: { name: "Yahoo", url: "https://search.yahoo.com", icon: "https://www.yahoo.com/favicon.ico", color: "#5f01d1" }
    };
    
    let defaultSearchEngine = $state("google");

    // Random loading messages
    const loadingMessages = [
        "Memuat data profil Anda",
        "Menyiapkan workspace",
        "Mengambil data dari server",
        "Memproses informasi profil",
        "Menginisialisasi aplikasi",
        "Memuat konfigurasi",
        "Menyinkronkan data",
        "Mempersiapkan lingkungan kerja"
    ];
    
    $effect(() => {
        if (window.api?.onWindowMinimized) {
            const cleanup1 = window.api.onWindowMinimized((data) => {
                taskbarStore.addWindow(data.windowId, data.windowType);
            });
            const cleanup2 = window.api.onWindowRestored((data) => {
                taskbarStore.removeWindow(data.windowId);
            });
            return () => { cleanup1?.(); cleanup2?.(); };
        }
    });
    
    // Close all windows and clear taskbar when logged out
    $effect(() => {
        if (!isLoggedIn) {
            // Stop data sync
            dataSyncManager.destroy();
            
            // Close all child windows
            if (window.api?.childWindow?.closeAll) {
                window.api.childWindow.closeAll().catch(err => {
                    console.error('[App] Failed to close all windows:', err);
                });
            }
            
            // Clear taskbar
            taskbarStore.clearAll();
            
            // Clean up orphaned webviews from previous user session
            // This prevents memory leaks and stale sessions
            setTimeout(() => {
                if (globalThis.webviewRegistry) {
                    globalThis.webviewRegistry.clear();
                }
                if (globalThis.reloadTracker) {
                    globalThis.reloadTracker.clear();
                }
            }, 500);
        }
    });
    
    let currentLoadingMessage = $state(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);

    let apps = $derived(appStore.apps);
    let activeAppId = $derived(appStore.activeAppId);
    let isAddModalOpen = $derived(appStore.isAddModalOpen);

    let workspaceApps = $derived.by(() => {
        const workspace = activeWorkspace;
        if (!workspace?.apps) return [];
        const appMap = new Map(apps.map(a => [a.id, a]));
        return workspace.apps.map(id => appMap.get(id)).filter(Boolean);
    });

    let activeApp = $derived(
        workspaceApps.find((s) => s.id === activeAppId),
    );

    let isNotificationCenterOpen = $derived(
        notificationStore.isNotificationCenterOpen,
    );

    let isAIChatOpen = $derived(aiChatStore.isOpen);

    // Apply theme function
    function applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
        } else {
            root.classList.toggle('dark', theme === 'dark');
        }
    }

    // ── Password Manager: Handle save prompt from webview ──
    async function handlePasswordSave(data) {
        try {
            const profileId = activeWorkspace?.id;
            if (!profileId) {
                toastStore.error('No active workspace');
                return;
            }

            const result = await passwordStore.saveCredential({
                profileId,
                origin: data.origin,
                username: data.username,
                password: data.password,
                title: data.title || data.origin,
                url: data.url || data.origin
            });

            if (result.success) {
                toastStore.success(data.isUpdate ? 'Password updated' : 'Password saved');
            } else {
                toastStore.error(result.error || 'Failed to save password');
            }
        } catch (error) {
            toastStore.error('Failed to save password');
        }
    }

    function handlePasswordNever(origin) {
        const profileId = activeWorkspace?.id;
        if (profileId && origin) {
            passwordStore.neverSave(profileId, origin);
            toastStore.info('Password will not be saved for this site');
        }
    }

    onMount(async () => {
        window.addEventListener("online", () => (isOnline = true));
        window.addEventListener("offline", () => (isOnline = false));

        // Handle zoom shortcuts forwarded from webview (Ctrl+0/Ctrl++/Ctrl+-)
        // When focus is inside a webview, the main process intercepts these
        // shortcuts and relays them here so we can update the active app's zoom.
        const removeZoomListener = window.api?.onWebviewZoomShortcut?.(({ action }) => {
            if (!activeApp) return;
            if (action === 'reset') {
                appStore.updateApp(activeApp.id, { zoomLevel: 0 });
            } else if (action === 'in') {
                const currentZoom = activeApp.zoomLevel ?? 0;
                const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                const newPercent = Math.min(500, currentPercent + 10);
                const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                appStore.updateApp(activeApp.id, { zoomLevel: newZoomLevel });
            } else if (action === 'out') {
                const currentZoom = activeApp.zoomLevel ?? 0;
                const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                const newPercent = Math.max(25, currentPercent - 10);
                const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                appStore.updateApp(activeApp.id, { zoomLevel: newZoomLevel });
            }
        });

        await authStore.init();
        
        // Initialize data sync manager (loads settings, starts if enabled)
        dataSyncManager.init();

        // Listen for password save prompts from webview
        if (window.api?.onPasswordSavePrompt) {
            window.api.onPasswordSavePrompt((data) => {
                // Show popup
                passwordPopupData = {
                    visible: true,
                    origin: data.origin || '',
                    username: data.username || '',
                    password: data.password || '',
                    title: data.title || '',
                    isUpdate: data.isUpdate || false
                };
            });
        }
        
        // Cleanup orphaned downloads (no profile_id) on app start
        if (window.api?.cleanupOrphanDownloads) {
            window.api.cleanupOrphanDownloads();
        }
        
        // Expose stores to window for VBox API (ContextController needs these)
        window.scriptInputStore = scriptInputStore;
        window.workspaceStore = workspaceStore;
        window.appStore = appStore;
        
        // Load and apply theme
        try {
            const themeResult = await window.api.db.getSetting('theme');
            if (themeResult.success && themeResult.value) {
                applyTheme(themeResult.value);
            }
        } catch (error) {
            console.error('Failed to load theme:', error);
        }
        
        // Load default search engine setting
        try {
            const result = await window.api.settings.getDefaultSearchEngine();
            if (result.success && result.engine) {
                defaultSearchEngine = result.engine;
            }
        } catch (error) {
            console.error('Failed to load search engine setting:', error);
        }
        
        const handleThemeChangeFromChild = (data) => {
            applyTheme(data.theme);
        };
        const cleanupThemeListener = window.api?.onParentMessage?.('theme-changed', handleThemeChangeFromChild);

        const handleThemeChange = (event) => {
            applyTheme(event.detail.theme);
        };
        
        window.addEventListener('theme-changed', handleThemeChange);
        
        // Listen for system theme changes when theme is set to 'system'
        const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = async () => {
            try {
                const themeResult = await window.api.db.getSetting('theme');
                if (themeResult.success && themeResult.value === 'system') {
                    applyTheme('system');
                }
            } catch (error) {
                console.error('Failed to handle system theme change:', error);
            }
        };
        
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
        
        // Listen for settings updates
        const handleSettingsUpdate = async () => {
            try {
                const result = await window.api.settings.getDefaultSearchEngine();
                if (result.success && result.engine) {
                    defaultSearchEngine = result.engine;
                }
            } catch (error) {
                console.error('Failed to reload search engine setting:', error);
            }
        };
        
        window.addEventListener('settings-updated', handleSettingsUpdate);
        
        // Change loading message every 3 seconds
        const loadingInterval = setInterval(() => {
            if (isLoadingWorkspaces) {
                currentLoadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
            }
        }, 3000);
        
        // Global toast listener (only one instance)
        const handleShowToast = (data) => {
            const { type, message } = data;
            if (type === 'success') {
                toastStore.success(message);
            } else if (type === 'error') {
                toastStore.error(message);
            } else if (type === 'info') {
                toastStore.info(message);
            } else {
                toastStore.info(message);
            }
        };
        
        const removeShowToastListener = window.api?.onShowToast?.(handleShowToast);
        
        return () => {
            clearInterval(loadingInterval);
            window.removeEventListener('settings-updated', handleSettingsUpdate);
            window.removeEventListener('theme-changed', handleThemeChange);
            systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
            if (typeof removeShowToastListener === 'function') removeShowToastListener();
            if (typeof cleanupThemeListener === 'function') cleanupThemeListener();
            if (typeof removeZoomListener === 'function') removeZoomListener();
        };
    });

    $effect(() => {
        if (workspaceApps.length > 0) {
            const isActiveInWorkspace = workspaceApps.some(
                (s) => s.id === activeAppId,
            );

            if (!isActiveInWorkspace) {
                appStore.setActive(workspaceApps[0].id);
            }
        }
    });

    let previousWorkspace = null;
    $effect(() => {
        if (activeWorkspace && isLoggedIn) {
            if (previousWorkspace && previousWorkspace.id !== activeWorkspace.id) {
                // Workspace switched - load history for new workspace
                historyStore.loadHistory(activeWorkspace.id);
            } else if (!previousWorkspace) {
                // Initial workspace load - load history
                historyStore.loadHistory(activeWorkspace.id);
            }
            
            previousWorkspace = activeWorkspace;
        }
    });
    
    $effect(() => {
        if (scriptInputStore.isOpen) {
            const serializableData = {
                title: scriptInputStore.title,
                fields: JSON.parse(JSON.stringify(scriptInputStore.fields))
            };
            
            openPredefinedWindow('SCRIPT_INPUT', serializableData);
        }
    });

    let previousActiveApp = null;
    $effect(() => {
        if (activeApp && activeWorkspace && isLoggedIn) {
            if (previousActiveApp && previousActiveApp.id !== activeApp.id) {
                // App switched
            } else if (!previousActiveApp) {
                // Initial app load
            }
            
            previousActiveApp = activeApp;
        }
    });

    onMount(() => {
        authStore.init();

        const cleanup = window.api?.onParentMessage?.('script-input-response', (response) => {
            if (scriptInputStore.resolveCallback) {
                scriptInputStore.resolveCallback(response);
                scriptInputStore.resolveCallback = null;
            }
            scriptInputStore.isOpen = false;
        });

        // ✅ FIX: Listen for cookies-updated event from Cookie Manager
        const cleanupCookies = window.api?.onParentMessage?.('cookies-updated', (data) => {
            // Reload active webview to apply new cookies
            if (data.profileId && workspaceStore.activeWorkspace?.id === data.profileId) {
                toastStore.success('Cookies updated! Reloading page...');
                setTimeout(() => {
                    navigationStore.reload();
                }, 500);
            }
        });

        return () => {
            cleanup?.();
            cleanupCookies?.();
        };
    });

    $effect(() => {
        if (isLoggedIn && isAuthInitialized && !workspaceStore.isInitialized) {
            workspaceStore.init();
        }
    });

    function handleKeydown(e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
            return;

        if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (workspaceApps[index]) {
                appStore.setActive(workspaceApps[index].id);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "r") {
            e.preventDefault();
            if (activeApp) {
                const activeTab = appStateStore.getActiveTab(activeApp.id);
                if (activeTab) {
                    navigationStore.reload();
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "w") {
            e.preventDefault();
            if (activeApp) {
                const activeTab = appStateStore.getActiveTab(activeApp.id);
                if (activeTab) {
                    appStateStore.closeTab(activeApp.id, activeTab.id);
                }
            }
        }

        // Zoom: Ctrl+0 reset to 100%
        if ((e.ctrlKey || e.metaKey) && e.key === "0") {
            e.preventDefault();
            if (activeApp) {
                appStore.updateApp(activeApp.id, { zoomLevel: 0 });
            }
        }

        // Zoom: Ctrl++ zoom in
        if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
            e.preventDefault();
            if (activeApp) {
                const currentZoom = activeApp.zoomLevel ?? 0;
                const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                const newPercent = Math.min(500, currentPercent + 10);
                const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                appStore.updateApp(activeApp.id, { zoomLevel: newZoomLevel });
            }
        }

        // Zoom: Ctrl+- zoom out
        if ((e.ctrlKey || e.metaKey) && e.key === "-") {
            e.preventDefault();
            if (activeApp) {
                const currentZoom = activeApp.zoomLevel ?? 0;
                const currentPercent = Math.round(Math.pow(1.2, currentZoom) * 100);
                const newPercent = Math.max(25, currentPercent - 10);
                const newZoomLevel = Math.log(newPercent / 100) / Math.log(1.2);
                appStore.updateApp(activeApp.id, { zoomLevel: newZoomLevel });
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "[") {
            e.preventDefault();
            navigationStore.goBack();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "]") {
            e.preventDefault();
            navigationStore.goForward();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "n") {
            e.preventDefault();
            appStore.setAddModalOpen(true);
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
            e.preventDefault();
            const currentIndex = workspaceApps.findIndex(
                (s) => s.id === activeAppId,
            );
            const nextIndex = e.shiftKey
                ? (currentIndex - 1 + workspaceApps.length) %
                  workspaceApps.length
                : (currentIndex + 1) % workspaceApps.length;
            if (workspaceApps[nextIndex]) {
                appStore.setActive(workspaceApps[nextIndex].id);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "j") {
            e.preventDefault();
            panelStore.toggleDownloads();
            if (panelStore.isDownloadPanelOpen) {
                downloadStore.markAllViewed();
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "h") {
            e.preventDefault();
            panelStore.toggleHistory();
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "O") {
            e.preventDefault();
            panelStore.toggleBookmarks();
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
            e.preventDefault();
            dndStore.toggle();
        }

        if (e.key === "Escape") {
            appStore.setAddModalOpen(false);
            if (isNotificationCenterOpen)
                notificationStore.closeNotificationCenter();
        }
    }

    let isAddAppPopupOpen = $state(false);

    function handleStartWithApp() {
        isAddAppPopupOpen = true;
    }

    function handleStartWithTab() {
        // Get search engine config based on user setting
        const searchEngine = searchEngines[defaultSearchEngine] || searchEngines.google;
        
        const newApp = appStore.addApp(
            {
                name: searchEngine.name,
                url: searchEngine.url,
                icon: searchEngine.icon,
                color: searchEngine.color,
            },
            null,
            null,
            null,
            activeWorkspace?.id,
        );

        if (activeWorkspace && newApp) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newApp.id, appStore.activeAppId);
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Show loading screen while checking auth -->
{#if !isAuthInitialized}
    <div
        class="flex h-screen w-screen items-center justify-center bg-gradient-to-r from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
        <div class="text-center">
            <Loader2
                class="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4"
            />
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    </div>
{:else if !isLoggedIn}
    <!-- Show login page if not authenticated -->
    <LoginPage />
{:else}
    <!-- Show workspace if authenticated -->
    <div
        class="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-500 selection:text-white"
    >
        <!-- Top Toolbar + Password Popup Container -->
        <div class="relative">
            <TopToolbar app={activeApp} />

            <!-- Password Save Popup (floating at top, like Chrome toast) -->
            <PasswordPopup
                visible={passwordPopupData.visible}
                origin={passwordPopupData.origin}
                username={passwordPopupData.username}
                password={passwordPopupData.password}
                title={passwordPopupData.title}
                isUpdate={passwordPopupData.isUpdate}
                onSave={handlePasswordSave}
                onNever={handlePasswordNever}
                onCancel={() => { passwordPopupData.visible = false; }}
            />
        </div>

        <!-- Main Content Area: Sidebar + (TabBar + Content) -->
        <div class="flex-1 flex relative h-full w-full overflow-hidden">
            <!-- Sidebar (vertical, left) -->
            <Sidebar />

            <!-- Right side: TabBar + Content -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- TabBar (horizontal) - always show when workspace exists -->
                {#if activeWorkspace}
                    <TabBar app={activeApp} />
                {/if}

                <!-- Content Area: Webview Container + AI Chat Panel -->
                <div class="flex-1 flex relative overflow-hidden">
                    <!-- Webview Container - shrinks when AI chat is open -->
                    <div 
                        class="flex-1 relative overflow-hidden transition-all duration-300"
                        style="width: {isAIChatOpen ? 'calc(100% - 320px)' : '100%'};"
                    >
                    {#if isLoadingWorkspaces}
                        <!-- Loading workspaces state -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8 z-20"
                        >
                            <div class="text-center w-full max-w-md">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <Loader2
                                        class="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin"
                                    />
                                </div>

                                <!-- Text -->
                                <h2
                                    class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2"
                                >
                                    {currentLoadingMessage}
                                </h2>
                                <p class="text-gray-500 dark:text-gray-400 text-sm">
                                    Mohon tunggu sebentar...
                                </p>
                            </div>
                        </div>
                    {:else if !activeWorkspace}
                        <!-- No workspace state -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8 z-20"
                        >
                            <div class="text-center w-full max-w-md">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <div
                                        class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 flex items-center justify-center shadow-lg"
                                    >
                                        <svg
                                            class="w-10 h-10 text-blue-600 dark:text-blue-400"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.5"
                                        >
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                            <path d="M8 14h.01"></path>
                                            <path d="M12 14h.01"></path>
                                            <path d="M16 14h.01"></path>
                                        </svg>
                                    </div>
                                </div>

                                <!-- Text -->
                                <h2
                                    class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2"
                                >
                                    Selamat Datang di VisualBox
                                </h2>
                                <p class="text-gray-600 dark:text-gray-400 mb-6">
                                    Buat profil pertama Anda untuk mengatur proyek dan aplikasi
                                </p>

                                <!-- Button -->
                                <div class="flex justify-center">
                                    <button
                                        onclick={() => {
                                            // Trigger add profile popup in sidebar
                                            const addButton = document.querySelector('.popup-trigger-button');
                                            if (addButton) addButton.click();
                                        }}
                                        class="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        <Plus
                                            size={16}
                                            class="group-hover:rotate-90 transition-transform"
                                        />
                                        Buat Profil Pertama Anda
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else if workspaceApps.length === 0}
                        <!-- Empty profile state (profile exists but no apps) -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8 z-20"
                        >
                            <div class="text-center w-full max-w-md">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <div
                                        class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 flex items-center justify-center shadow-lg"
                                    >
                                        <svg
                                            class="w-10 h-10 text-blue-600 dark:text-blue-400"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.5"
                                        >
                                            <circle cx="12" cy="12" r="10"
                                            ></circle>
                                            <path d="M8 14s1.5 2 4 2 4-2 4-2"
                                            ></path>
                                            <line x1="9" y1="9" x2="9.01" y2="9"
                                            ></line>
                                            <line
                                                x1="15"
                                                y1="9"
                                                x2="15.01"
                                                y2="9"
                                            ></line>
                                        </svg>
                                    </div>
                                </div>

                                <!-- Text -->
                                <h2
                                    class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6"
                                >
                                    Siap untuk memulai?
                                </h2>

                                <!-- Buttons -->
                                <div class="flex gap-3 justify-center">
                                    <button
                                        onclick={handleStartWithTab}
                                        class="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        <Plus
                                            size={16}
                                            class="group-hover:rotate-90 transition-transform"
                                        />
                                        Mulai dengan tab
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- Render apps with STABLE DOM order to prevent webview reloads -->
                    {#if apps.length > 0}
                        {@const appMap = new Map(apps.map(s => [s.id, s]))}
                        {@const allAppIds = Array.from(appMap.keys()).sort()}
                        
                        {#each allAppIds as appId (appId)}
                            {@const app = appMap.get(appId)}
                            {#if app}
                                {@const isInActiveWorkspace =
                                    activeWorkspace?.apps?.includes(app.id)}
                                {@const isActiveApp =
                                    activeAppId === app.id}
                                {@const isVisible =
                                    isInActiveWorkspace && isActiveApp}

                                <div
                                    class="absolute inset-0 w-full h-full"
                                    style:z-index={isVisible ? 10 : 0}
                                    style:visibility={isVisible ? "visible" : "hidden"}
                                    style:pointer-events={isVisible ? "auto" : "none"}
                                    data-app-id={app.id}
                                >
                                    <ServiceView app={app} isActive={isVisible} />
                                </div>
                            {/if}
                        {/each}
                    {/if}

                    <!-- Global Webview Shield for Tab Drag & Drop -->
                    {#if isTabDragging}
                        <div
                            class="absolute inset-0 z-[100] cursor-grabbing"
                            style="pointer-events: auto;"
                        ></div>
                    {/if}
                    </div>

                    <!-- AI Chat Panel - inside content area -->
                    <AIChatPanel />
                </div>
            </div>

            <!-- Right Floating Sidebar -->
            {#if activeWorkspace}
                <RightFloatingSidebar
                    onOpenTarget={() => openPredefinedWindow('TARGET', { profileName: workspaceStore.activeWorkspace?.name || '' })}
                />
            {/if}
        </div>
    </div>

    <!-- Notification Panel -->
    {#if isNotificationCenterOpen}
        <NotificationPanel />
    {/if}
{/if}

<!-- Offline Warning Modal (Always visible, even before login) -->
<OfflineWarning bind:isOnline={isOnline} />

<style>
    :global(body) {
        background: linear-gradient(to right, #9d8c6b, #000000, #8b4a6b);
        color: #f3f4f6;
        overflow: hidden;
        margin: 0;
        padding: 0;
    }
</style>

<Toast />

<Taskbar />

<!-- Auto-update notification (always rendered, manages own visibility) -->
<UpdateBanner />