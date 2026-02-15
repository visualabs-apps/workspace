<script>
    import Sidebar from "./components/Sidebar.svelte";
    import TopToolbar from "./components/TopToolbar.svelte";
    import ServiceView from "./components/ServiceView.svelte";
    import AddServiceModal from "./components/AddServiceModal.svelte";
    import LoginPage from "./components/LoginPage.svelte";
    import DownloadPanel from "./components/DownloadPanel.svelte";
    import NotificationPanel from "./components/NotificationPanel.svelte";
    import TabBar from "./components/TabBar.svelte";
    import { serviceStore } from "./lib/services.svelte.js";
    import { authStore } from "./lib/auth.svelte.js";
    import { workspaceStore } from "./lib/workspaces.svelte.js";
    import { navigationStore } from "./lib/navigation.svelte.js";
    import { downloadStore } from "./lib/downloads.svelte.js";
    import { notificationStore } from "./lib/notifications.svelte.js";
    import { dndStore } from "./lib/dnd.svelte.js";
    import { tabStore } from "./lib/tabs.svelte.js";
    import { scraperService } from "./lib/scraperService.js";
    import { onMount } from "svelte";
    import { Loader2, Plus, Rocket } from "lucide-svelte";

    // Auth state
    let isLoggedIn = $derived(authStore.isLoggedIn);
    let isAuthLoading = $derived(authStore.isLoading);
    let isAuthInitialized = $derived(authStore.isInitialized);

    // Workspace state
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);

    // Service state
    let services = $derived(serviceStore.services);
    let activeServiceId = $derived(serviceStore.activeServiceId);
    let isAddModalOpen = $derived(serviceStore.isAddModalOpen);

    // Filter services based on active workspace
    let workspaceServices = $derived(
        services.filter((service) =>
            activeWorkspace?.apps?.includes(service.id),
        ),
    );

    let activeService = $derived(
        workspaceServices.find((s) => s.id === activeServiceId),
    );

    // Download state
    let isDownloadPanelOpen = $derived(downloadStore.isDownloadPanelOpen);
    let isNotificationCenterOpen = $derived(
        notificationStore.isNotificationCenterOpen,
    );

    // Initialize scraper service on app startup
    onMount(async () => {
        // Wait for auth to be initialized first
        await authStore.init();

        // Initialize scraper service (no auth required - endpoint is public)
        console.log("🚀 Initializing scraper service...");
        await scraperService.initialize();
    });

    // Re-initialize scraper when user logs in (in case it failed before)
    $effect(() => {
        if (isLoggedIn && isAuthInitialized && !scraperService.initialized) {
            console.log("🔄 Retrying scraper service initialization...");
            setTimeout(() => {
                scraperService.initialize();
            }, 500);
        }
    });

    // Auto-select first app if workspace has apps but none is active
    $effect(() => {
        if (workspaceServices.length > 0) {
            // Check if current active service is in workspace
            const isActiveInWorkspace = workspaceServices.some(
                (s) => s.id === activeServiceId,
            );

            if (!isActiveInWorkspace) {
                // Set first app as active
                serviceStore.setActive(workspaceServices[0].id);
            }
        }
    });

    // Initialize auth on mount
    onMount(() => {
        authStore.init();

        // Listen for deep link authentication success
        if (window.api?.onAuthSuccess) {
            window.api.onAuthSuccess(async ({ token, workspace }) => {
                console.log("✅ Authentication successful via deep link");

                // Set token and fetch user data
                await authStore.setLoggedIn(null, token, 3600);

                // Fetch real user data from server
                await authStore.fetchUser();
            });
        }

        // Listen for deep link authentication error
        if (window.api?.onAuthError) {
            window.api.onAuthError(({ error }) => {
                console.error("❌ Authentication error:", error);
                // You can show error notification here if needed
            });
        }
    });

    // Global keyboard shortcuts
    function handleKeydown(e) {
        // Ignore if typing in input/textarea
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
            return;

        // Ctrl/Cmd + number (1-9) - switch to app by index
        if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (workspaceServices[index]) {
                serviceStore.setActive(workspaceServices[index].id);
            }
        }

        // Ctrl/Cmd + R - reload current app
        if ((e.ctrlKey || e.metaKey) && e.key === "r") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    // Reload the active tab
                    window.location.reload();
                }
            }
        }

        // Ctrl/Cmd + W - close current tab
        if ((e.ctrlKey || e.metaKey) && e.key === "w") {
            e.preventDefault();
            if (activeService) {
                const activeTab = tabStore.getActiveTab(activeService.id);
                if (activeTab) {
                    tabStore.closeTab(activeService.id, activeTab.id);
                }
            }
        }

        // Ctrl/Cmd + 0 - reset zoom to 100%
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

        // Ctrl/Cmd + Plus - zoom in
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

        // Ctrl/Cmd + Minus - zoom out
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

        // Ctrl/Cmd + [ - go back
        if ((e.ctrlKey || e.metaKey) && e.key === "[") {
            e.preventDefault();
            navigationStore.goBack();
        }

        // Ctrl/Cmd + ] - go forward
        if ((e.ctrlKey || e.metaKey) && e.key === "]") {
            e.preventDefault();
            navigationStore.goForward();
        }

        // Ctrl/Cmd + N - add new app
        if ((e.ctrlKey || e.metaKey) && e.key === "n") {
            e.preventDefault();
            serviceStore.setAddModalOpen(true);
        }

        // Ctrl/Cmd + Tab - cycle through apps
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

        // Ctrl/Cmd + J - toggle download manager
        if ((e.ctrlKey || e.metaKey) && e.key === "j") {
            e.preventDefault();
            downloadStore.toggleDownloadPanel();
        }

        // Ctrl/Cmd + Shift + D - toggle DND
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
            e.preventDefault();
            dndStore.toggle();
        }

        // Escape - close modals and panels
        if (e.key === "Escape") {
            serviceStore.setAddModalOpen(false);
            if (isDownloadPanelOpen) downloadStore.closeDownloadPanel();
            if (isNotificationCenterOpen)
                notificationStore.closeNotificationCenter();
        }
    }

    // State for Add App popup
    let isAddAppPopupOpen = $state(false);

    function handleStartWithApp() {
        isAddAppPopupOpen = true;
    }

    function handleStartWithTab() {
        // Create a new app with Google as default
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
        ); // Pass workspace ID

        // Add to active workspace
        if (activeWorkspace && newService) {
            workspaceStore.addAppToWorkspace(activeWorkspace.id, newService.id);
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Show loading screen while checking auth -->
{#if !isAuthInitialized}
    <div
        class="flex h-screen w-screen items-center justify-center bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b]"
    >
        <div class="text-center">
            <Loader2
                class="w-12 h-12 text-pink-400 animate-spin mx-auto mb-4"
            />
            <p class="text-gray-300">Loading...</p>
        </div>
    </div>
{:else if !isLoggedIn}
    <!-- Show login page if not authenticated -->
    <LoginPage />
{:else}
    <!-- Show workspace if authenticated -->
    <div
        class="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b] text-gray-100 font-sans selection:bg-pink-500 selection:text-white"
    >
        <!-- Top Toolbar -->
        <TopToolbar service={activeService} />

        <!-- Main Content Area: Sidebar + (TabBar + Content) -->
        <div class="flex-1 flex relative h-full w-full overflow-hidden">
            <!-- Sidebar (vertical, left) -->
            <Sidebar />

            <!-- Right side: TabBar + Content -->
            <div class="flex-1 flex flex-col overflow-hidden">
                <!-- TabBar (horizontal) -->
                {#if activeService}
                    <TabBar service={activeService} />
                {/if}

                <!-- Content Area -->
                <div class="flex-1 relative overflow-hidden">
                    {#if workspaceServices.length === 0}
                        <!-- Empty State -->
                        <div
                            class="absolute inset-0 flex items-center justify-center p-8"
                        >
                            <div class="text-center">
                                <!-- Icon -->
                                <div class="mb-4 flex justify-center">
                                    <div
                                        class="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center"
                                    >
                                        <svg
                                            class="w-10 h-10 text-purple-400"
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
                                    class="text-xl font-semibold text-white mb-6"
                                >
                                    There's nothing here, yet.
                                </h2>

                                <!-- Buttons -->
                                <div class="flex gap-3 justify-center">
                                    <button
                                        onclick={handleStartWithApp}
                                        class="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        <Rocket
                                            size={16}
                                            class="group-hover:translate-y-[-2px] transition-transform"
                                        />
                                        Start with an app
                                    </button>
                                    <button
                                        onclick={handleStartWithTab}
                                        class="group flex items-center gap-2 px-5 py-2.5 bg-purple-500/80 hover:bg-purple-600/80 text-white text-sm rounded-lg font-medium transition-all hover:scale-105"
                                    >
                                        <Plus
                                            size={16}
                                            class="group-hover:rotate-90 transition-transform"
                                        />
                                        Start with a tab
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <!-- Render ALL services from ALL workspaces (keep alive) -->
                        <!-- Only show services from active workspace -->
                        {#each services as service (service.id)}
                            {@const isInActiveWorkspace =
                                activeWorkspace?.apps?.includes(service.id)}
                            {@const isActiveService =
                                activeServiceId === service.id}

                            <div
                                class="absolute inset-0 w-full h-full"
                                style:z-index={isActiveService ? 10 : 0}
                                style:visibility={isInActiveWorkspace &&
                                isActiveService
                                    ? "visible"
                                    : "hidden"}
                                style:pointer-events={isInActiveWorkspace &&
                                isActiveService
                                    ? "auto"
                                    : "none"}
                            >
                                <ServiceView
                                    {service}
                                    isActive={isActiveService}
                                />
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Modals -->
    {#if isAddModalOpen || isAddAppPopupOpen}
        <AddServiceModal
            onClose={() => {
                isAddAppPopupOpen = false;
            }}
        />
    {/if}

    <!-- Download Panel -->
    {#if isDownloadPanelOpen}
        <DownloadPanel />
    {/if}

    <!-- Notification Panel -->
    {#if isNotificationCenterOpen}
        <NotificationPanel />
    {/if}
{/if}

<style>
    @reference "tailwindcss";

    :global(body) {
        @apply bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b] text-gray-100 overflow-hidden m-0 p-0;
    }
</style>
