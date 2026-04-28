<script>
    import Sidebar from "./components/layout/Sidebar.svelte";
    import TopToolbar from "./components/layout/TopToolbar.svelte";
    import ServiceView from "./components/features/ServiceView.svelte";
    import AddServiceWindow from "./components/windows/AddServiceWindow.svelte";
    import LoginPage from "./components/features/LoginPage.svelte";
    import NotificationPanel from "./components/panels/NotificationPanel.svelte";
    import TabBar from "./components/layout/TabBar.svelte";
    import Toast from "./components/ui/Toast.svelte";
    import OfflineWarning from "./components/ui/OfflineWarning.svelte";
    import { serviceStore } from "./lib/stores/services.svelte.js";
    import { authStore } from "./lib/stores/auth.svelte.js";
    import { workspaceStore } from "./lib/stores/workspaces.svelte.js";
    import { navigationStore } from "./lib/managers/navigation.svelte.js";
    import { downloadStore } from "./lib/stores/downloads.svelte.js";
    import { historyStore } from "./lib/stores/history.svelte.js";
    import { notificationStore } from "./lib/stores/notifications.svelte.js";
    import { dndStore } from "./lib/utils/dnd.svelte.js";
    import { tabStore } from "./lib/stores/tabs.svelte.js";
    import { toastStore } from "./lib/managers/toast.svelte.js";
    import { panelStore } from "./lib/stores/panels.svelte.js";
    import { onMount } from "svelte";
    import { Loader2, Plus, Rocket } from "lucide-svelte";

    let isOnline = $state(navigator.onLine);

    let isTabDragging = $derived(tabStore.isAnyTabDragging);

    let isLoggedIn = $derived(authStore.isLoggedIn);
    let isAuthLoading = $derived(authStore.isLoading);
    let isAuthInitialized = $derived(authStore.isInitialized);

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let isLoadingWorkspaces = $derived(workspaceStore.isLoading);

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
    
    let currentLoadingMessage = $state(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);

    let services = $derived(serviceStore.services);
    let activeServiceId = $derived(serviceStore.activeServiceId);
    let isAddModalOpen = $derived(serviceStore.isAddModalOpen);

    let workspaceServices = $derived(
        services.filter((service) =>
            activeWorkspace?.apps?.includes(service.id),
        ),
    );

    let activeService = $derived(
        workspaceServices.find((s) => s.id === activeServiceId),
    );

    let isNotificationCenterOpen = $derived(
        notificationStore.isNotificationCenterOpen,
    );

    onMount(async () => {
        window.addEventListener("online", () => (isOnline = true));
        window.addEventListener("offline", () => (isOnline = false));

        await authStore.init();
        
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
            if (typeof removeShowToastListener === 'function') removeShowToastListener();
        };
    });

    $effect(() => {
        if (workspaceServices.length > 0) {
            const isActiveInWorkspace = workspaceServices.some(
                (s) => s.id === activeServiceId,
            );

            if (!isActiveInWorkspace) {
                serviceStore.setActive(workspaceServices[0].id);
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

    let previousActiveService = null;
    $effect(() => {
        if (activeService && activeWorkspace && isLoggedIn) {
            if (previousActiveService && previousActiveService.id !== activeService.id) {
                // App switched
            } else if (!previousActiveService) {
                // Initial app load
            }
            
            previousActiveService = activeService;
        }
    });

    onMount(() => {
        authStore.init();

        if (window.api?.onAuthError) {
            window.api.onAuthError(({ error }) => {
                console.error("❌ Authentication error:", error);
            });
        }
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
            if (workspaceServices[index]) {
                serviceStore.setActive(workspaceServices[index].id);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "r") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    navigationStore.reload();
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "w") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    tabStore.closeTab(activeService.id, activeTab.id);
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "0") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    tabStore.updateTab(activeService.id, activeTab.id, {
                        zoomLevel: 0,
                    });
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    const currentZoom = activeTab.zoomLevel ?? 0;
                    const currentPercent = Math.round(
                        Math.pow(1.2, currentZoom) * 100,
                    );
                    let newPercent = currentPercent + 10;
                    newPercent = Math.min(500, newPercent);
                    const newZoomLevel =
                        Math.log(newPercent / 100) / Math.log(1.2);
                    tabStore.updateTab(activeService.id, activeTab.id, {
                        zoomLevel: newZoomLevel,
                    });
                }
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "-") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    const currentZoom = activeTab.zoomLevel ?? 0;
                    const currentPercent = Math.round(
                        Math.pow(1.2, currentZoom) * 100,
                    );
                    let newPercent = currentPercent - 10;
                    newPercent = Math.max(25, newPercent);
                    const newZoomLevel =
                        Math.log(newPercent / 100) / Math.log(1.2);
                    tabStore.updateTab(activeService.id, activeTab.id, {
                        zoomLevel: newZoomLevel,
                    });
                }
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
            serviceStore.setAddModalOpen(true);
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "Tab") {
            e.preventDefault();
            const currentIndex = workspaceServices.findIndex(
                (s) => s.id === activeServiceId,
            );
            const nextIndex = e.shiftKey
                ? (currentIndex - 1 + workspaceServices.length) %
                  workspaceServices.length
                : (currentIndex + 1) % workspaceServices.length;
            if (workspaceServices[nextIndex]) {
                serviceStore.setActive(workspaceServices[nextIndex].id);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === "j") {
            e.preventDefault();
            panelStore.toggleDownloads();
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
            serviceStore.setAddModalOpen(false);
            if (isNotificationCenterOpen)
                notificationStore.closeNotificationCenter();
        }
    }

    let isAddAppPopupOpen = $state(false);

    function handleStartWithApp() {
        isAddAppPopupOpen = true;
    }

    function handleStartWithTab() {
        const newService = serviceStore.addService(
            {
                name: "Browser",
                url: "https://www.google.com",
                icon: "https://www.google.com/favicon.ico",
                color: "#4285f4",
            },
            null,
            null,
            null,
            activeWorkspace?.id,
        );

        if (activeWorkspace && newService) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Show loading screen while checking auth -->
{#if !isAuthInitialized}
    <div
        class="flex h-screen w-screen items-center justify-center bg-gradient-to-r from-gray-50 via-white to-gray-100"
    >
        <div class="text-center">
            <Loader2
                class="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4"
            />
            <p class="text-gray-600">Loading...</p>
        </div>
    </div>
{:else if !isLoggedIn}
    <!-- Show login page if not authenticated -->
    <LoginPage />
{:else}
    <!-- Show workspace if authenticated -->
    <div
        class="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-100 text-gray-900 font-sans selection:bg-blue-500 selection:text-white"
    >
        <!-- Top Toolbar -->
        <TopToolbar service={activeService} />

        <!-- Main Content Area: Sidebar + (TabBar + Content) -->
        <div class="flex-1 flex relative h-full w-full overflow-hidden">
            <!-- Sidebar (vertical, left) -->
            <Sidebar />

            <!-- Right side: TabBar + Content -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- TabBar (horizontal) - always show when workspace exists -->
                {#if activeWorkspace}
                    <TabBar service={activeService} />
                {/if}

                <!-- Content Area -->
                <div class="flex-1 relative overflow-hidden">
                    {#if isLoadingWorkspaces}
                        <!-- Loading workspaces state -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8 z-20"
                        >
                            <div class="text-center w-full max-w-md">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <Loader2
                                        class="w-16 h-16 text-blue-600 animate-spin"
                                    />
                                </div>

                                <!-- Text -->
                                <h2
                                    class="text-xl font-semibold text-gray-900 mb-2"
                                >
                                    {currentLoadingMessage}
                                </h2>
                                <p class="text-gray-500 text-sm">
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
                                        class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center shadow-lg"
                                    >
                                        <svg
                                            class="w-10 h-10 text-blue-600"
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
                                    class="text-xl font-semibold text-gray-900 mb-2"
                                >
                                    Selamat Datang di VisualBox
                                </h2>
                                <p class="text-gray-600 mb-6">
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
                    {:else if workspaceServices.length === 0}
                        <!-- Empty profile state (profile exists but no apps) -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8 z-20"
                        >
                            <div class="text-center w-full max-w-md">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <div
                                        class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center shadow-lg"
                                    >
                                        <svg
                                            class="w-10 h-10 text-blue-600"
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
                                    class="text-xl font-semibold text-gray-900 mb-6"
                                >
                                    Siap untuk memulai?
                                </h2>

                                <!-- Buttons -->
                                <div class="flex gap-3 justify-center">
                                    <button
                                        onclick={handleStartWithApp}
                                        class="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        <Rocket
                                            size={16}
                                            class="group-hover:translate-y-[-2px] transition-transform"
                                        />
                                        Mulai dengan aplikasi
                                    </button>
                                    <button
                                        onclick={handleStartWithTab}
                                        class="group flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg font-medium transition-all hover:scale-105"
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

                    <!-- Render services with STABLE DOM order to prevent webview reloads -->
                    {#if services.length > 0}
                        {@const serviceMap = new Map(services.map(s => [s.id, s]))}
                        {@const allServiceIds = Array.from(serviceMap.keys()).sort()}
                        
                        {#each allServiceIds as serviceId (serviceId)}
                            {@const service = serviceMap.get(serviceId)}
                            {@const isInActiveWorkspace =
                                activeWorkspace?.apps?.includes(service.id)}
                            {@const isActiveService =
                                activeServiceId === service.id}
                            {@const isVisible =
                                isInActiveWorkspace && isActiveService}

                            <div
                                class="absolute inset-0 w-full h-full"
                                style:z-index={isVisible ? 10 : 0}
                                style:visibility={isVisible ? "visible" : "hidden"}
                                style:pointer-events={isVisible ? "auto" : "none"}
                                data-service-id={service.id}
                            >
                                <ServiceView {service} isActive={isVisible} />
                            </div>
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
            </div>

        </div>
    </div>

    <!-- Modals -->
    {#if isAddModalOpen || isAddAppPopupOpen}
        <AddServiceWindow
            bind:isOpen={isAddModalOpen}
            onClose={() => {
                isAddAppPopupOpen = false;
            }}
        />
    {/if}

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


<!-- Toast Notifications -->
<Toast />
