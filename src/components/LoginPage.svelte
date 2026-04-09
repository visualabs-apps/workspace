<script>
    import { authStore } from "../lib/auth.svelte.js";
    import { ExternalLink, Loader2, RefreshCw, X } from "lucide-svelte";
    import WindowControls from "./WindowControls.svelte";
    import { onMount } from "svelte";

    // Get environment variable for Laravel URL
    const LARAVEL_URL = import.meta.env.VITE_LARAVEL_URL || "https://app.v-leb.local";

    let isWaitingForAuth = $state(false);
    let authCheckInterval = null;

    function openLoginUrl() {
        const loginUrl = `${LARAVEL_URL}/login?electron=1`;
        console.log('Opening login URL:', loginUrl);
        
        if (window.api?.openExternal) {
            window.api.openExternal(loginUrl);
        } else {
            window.open(loginUrl, "_blank");
        }
    }

    function handleLogin() {
        isWaitingForAuth = true;
        openLoginUrl();
        startAuthCheck();
    }

    function handleOpenAgain() {
        openLoginUrl();
    }

    function handleCancel() {
        isWaitingForAuth = false;
        stopAuthCheck();
    }

    // Handle authentication success from deep link
    async function handleAuthSuccess(data) {
        console.log('Deep link auth success received:', data);
        
        try {
            // Store the token first before trying to fetch user data
            if (data.token) {
                console.log('Storing token from deep link...');
                await authStore.setLoggedIn({ name: 'Loading...' }, data.token, 3600); // Temporary user data
                
                // Now fetch the actual user data
                const success = await authStore.fetchUser();
                if (success) {
                    console.log('User data fetched successfully');
                    isWaitingForAuth = false;
                    stopAuthCheck();
                } else {
                    console.error('Failed to fetch user data after storing token');
                    // Token was stored, so try to use it anyway
                    isWaitingForAuth = false;
                    stopAuthCheck();
                }
            } else {
                console.error('No token in deep link data');
                handleAuthError({ error: 'No token received' });
            }
        } catch (error) {
            console.error('Error handling auth success:', error);
            handleAuthError({ error: error.message });
        }
    }

    // Handle authentication error from deep link
    function handleAuthError(data) {
        console.error('Deep link auth error received:', data);
        isWaitingForAuth = false;
        stopAuthCheck();
    }

    // Fallback: Check authentication status periodically
    function startAuthCheck() {
        console.log('Starting authentication polling...');
        
        authCheckInterval = setInterval(async () => {
            try {
                // Check if user is authenticated by trying to fetch user data
                const success = await authStore.fetchUser();
                if (success) {
                    console.log('Authentication detected via polling');
                    isWaitingForAuth = false;
                    stopAuthCheck();
                }
            } catch (error) {
                // Continue checking - this is expected while not authenticated
            }
        }, 2000);
    }

    function stopAuthCheck() {
        if (authCheckInterval) {
            console.log('Stopping authentication polling');
            clearInterval(authCheckInterval);
            authCheckInterval = null;
        }
    }

    onMount(() => {
        console.log('LoginPage mounted, setting up auth listeners');
        
        // Listen for authentication events from Electron main process
        if (window.api?.onAuthSuccess) {
            console.log('Setting up deep link auth success listener');
            window.api.onAuthSuccess(handleAuthSuccess);
        } else {
            console.log('No deep link auth success handler available');
        }
        
        if (window.api?.onAuthError) {
            console.log('Setting up deep link auth error listener');
            window.api.onAuthError(handleAuthError);
        } else {
            console.log('No deep link auth error handler available');
        }

        // Cleanup on unmount
        return () => {
            stopAuthCheck();
        };
    });
</script>

<div class="min-h-screen w-full flex flex-col bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b] p-0">
    <!-- Custom Title Bar -->
    <div
        class="w-full h-[30px] shrink-0 flex items-center bg-transparent z-50 select-none"
        style="-webkit-app-region: drag"
    >
        <div class="flex-1"></div>
        <div style="-webkit-app-region: no-drag">
            <WindowControls variant="dark" />
        </div>
    </div>

    <!-- Login Content -->
    <div class="flex-1 flex items-center justify-center p-4">
        <div class="w-full max-w-md">
            <!-- Logo/Brand -->
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#9d8c6b] to-[#8b4a6b] mb-6 shadow-2xl shadow-black/50">
                    <svg
                        class="w-10 h-10 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                </div>
                <h1 class="text-4xl font-bold text-white mb-3">
                    V-LEB Workspace
                </h1>
                <p class="text-gray-300 text-lg">
                    Workspace Management Platform
                </p>
            </div>

            <!-- Login Card -->
            <div class="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-10 shadow-2xl">
                <div class="text-center space-y-6">
                    <div>
                        <h2 class="text-2xl font-semibold text-white mb-2">
                            Welcome Back
                        </h2>
                        <p class="text-gray-400">
                            Sign in securely through your browser
                        </p>
                    </div>

                    {#if isWaitingForAuth}
                        <!-- Waiting for browser auth -->
                        <div class="py-6 space-y-5">
                            <Loader2 class="w-12 h-12 animate-spin text-[#9d8c6b] mx-auto" />
                            <div class="space-y-1">
                                <p class="text-white font-medium">
                                    Waiting for authentication...
                                </p>
                                <p class="text-gray-400 text-sm">
                                    Complete the login in the browser window.
                                </p>
                                <p class="text-gray-500 text-xs">
                                    The app will automatically detect when you're logged in.
                                </p>
                            </div>

                            <!-- Re-open browser button -->
                            <button
                                onclick={handleOpenAgain}
                                class="flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm text-[#c4aa84] hover:text-white border border-[#9d8c6b]/40 hover:border-[#9d8c6b]/70 hover:bg-white/5 transition-all duration-200"
                            >
                                <RefreshCw class="w-3.5 h-3.5" />
                                Open browser again
                            </button>
                        </div>

                        <!-- Cancel button -->
                        <div class="border-t border-white/10 pt-4">
                            <button
                                onclick={handleCancel}
                                class="flex items-center justify-center gap-1.5 mx-auto text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200"
                            >
                                <X class="w-3 h-3" />
                                Cancel sign-in
                            </button>
                        </div>
                    {:else}
                        <!-- Initial login button -->
                        <button
                            onclick={handleLogin}
                            class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#9d8c6b] to-[#8b4a6b] hover:from-[#b09a7a] hover:to-[#9d5a7a] text-white font-semibold rounded-xl text-lg shadow-lg shadow-black/50 transition-all duration-200 transform hover:scale-105"
                        >
                            <ExternalLink class="w-6 h-6" />
                            <span>Login with V-LEB</span>
                        </button>

                        <div class="pt-4 border-t border-white/10">
                            <p class="text-gray-500 text-sm">
                                You will be redirected to your browser for secure authentication
                            </p>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Footer -->
            <p class="text-center text-gray-500 text-sm mt-6">
                V-LEB Workspace &copy; 2026 • Secure Authentication
            </p>
        </div>
    </div>
</div>