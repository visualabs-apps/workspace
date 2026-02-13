<script>
    import { authStore } from "../lib/auth.svelte.js";
    import { LogIn, Mail, Lock, AlertCircle, Loader2 } from "lucide-svelte";
    import WindowControls from "./WindowControls.svelte";
    import { 
        createAuthorizationUrl, 
        GOOGLE_OAUTH_CONFIG 
    } from "../lib/oauth-pkce.js";
    import { exchangeGoogleCode } from "../lib/api.js";

    let email = $state("");
    let password = $state("");
    let showPassword = $state(false);
    let isGoogleLoading = $state(false);
    let googleError = $state("");

    // Derived from store
    let isLoading = $derived(authStore.isLoading);
    let error = $derived(authStore.error);

    async function handleSubmit(e) {
        e.preventDefault();

        if (!email || !password) {
            return;
        }

        await authStore.login(email, password);
    }

    async function handleGoogleLogin() {
        isGoogleLoading = true;
        googleError = "";
        
        try {
            // Generate PKCE authorization URL
            const authUrl = await createAuthorizationUrl(GOOGLE_OAUTH_CONFIG);

            // Open OAuth URL in system browser
            if (window.api && window.api.openExternal) {
                window.api.openExternal(authUrl);
                
                // Listen for OAuth callback from Electron main process
                if (window.api.onOAuthCallback) {
                    window.api.onOAuthCallback(async (data) => {
                        try {
                            if (data.success && data.code) {
                                // Get stored code verifier
                                const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
                                
                                if (!codeVerifier) {
                                    googleError = "Code verifier not found. Please try again.";
                                    isGoogleLoading = false;
                                    return;
                                }

                                // Exchange code for token via backend
                                const result = await exchangeGoogleCode(
                                    data.code,
                                    codeVerifier,
                                    GOOGLE_OAUTH_CONFIG.redirectUri
                                );

                                if (result.success) {
                                    // Update auth store
                                    authStore.setToken(result.token);
                                    authStore.setUser(result.user);
                                    
                                    // Clean up
                                    sessionStorage.removeItem('oauth_code_verifier');
                                    sessionStorage.removeItem('oauth_state');
                                } else {
                                    googleError = result.error || "Authentication failed";
                                }

                                isGoogleLoading = false;
                            } else {
                                googleError = data.error || "Authentication cancelled";
                                isGoogleLoading = false;
                            }
                        } catch (err) {
                            console.error("Token exchange error:", err);
                            googleError = "Failed to complete authentication";
                            isGoogleLoading = false;
                        }
                    });
                }
            } else {
                // Fallback for development: open in new window
                window.open(authUrl, '_blank');
                googleError = "Please complete authentication in the browser window";
                isGoogleLoading = false;
            }
        } catch (err) {
            console.error("Google login error:", err);
            googleError = "Failed to start authentication";
            isGoogleLoading = false;
        }
    }

    function togglePasswordVisibility() {
        showPassword = !showPassword;
    }
</script>

<div
    class="min-h-screen w-full flex flex-col bg-gradient-to-r from-[#9d8c6b] via-black to-[#8b4a6b] p-0"
>
    <!-- Custom Title Bar for Login Page -->
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
            <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#9d8c6b] to-[#8b4a6b] mb-4 shadow-lg shadow-black/50"
            >
                <svg
                    class="w-8 h-8 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"
                    ></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-white mb-2">V-LEB Workspace</h1>
            <p class="text-gray-400">Sign in to access your services</p>
        </div>

        <!-- Login Card -->
        <div
            class="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl"
        >
            <form onsubmit={handleSubmit} class="space-y-6">
                <!-- Error Alert -->
                {#if error || googleError}
                    <div
                        class="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400"
                    >
                        <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p class="font-medium">Login Failed</p>
                            <p class="text-sm opacity-80">{error || googleError}</p>
                        </div>
                    </div>
                {/if}

                <!-- Email Field -->
                <div class="space-y-2">
                    <label
                        for="email"
                        class="block text-sm font-medium text-gray-300"
                    >
                        Email Address
                    </label>
                    <div class="relative">
                        <div
                            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"
                        >
                            <Mail class="w-5 h-5" />
                        </div>
                        <input
                            type="email"
                            id="email"
                            bind:value={email}
                            placeholder="you@example.com"
                            required
                            disabled={isLoading}
                            class="w-full pl-10 pr-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-500
                                   focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-all"
                        />
                    </div>
                </div>

                <!-- Password Field -->
                <div class="space-y-2">
                    <label
                        for="password"
                        class="block text-sm font-medium text-gray-300"
                    >
                        Password
                    </label>
                    <div class="relative">
                        <div
                            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500"
                        >
                            <Lock class="w-5 h-5" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            bind:value={password}
                            placeholder="••••••••"
                            required
                            disabled={isLoading}
                            class="w-full pl-10 pr-12 py-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-500
                                   focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-transparent
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   transition-all"
                        />
                        <button
                            type="button"
                            onclick={togglePasswordVisibility}
                            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            {#if showPassword}
                                <svg
                                    class="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                    />
                                </svg>
                            {:else}
                                <svg
                                    class="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                    />
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>

                <!-- Submit Button -->
                <button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    class="w-full flex items-center justify-center gap-2 px-4 py-3
                           bg-gradient-to-r from-[#9d8c6b] to-[#8b4a6b]
                           hover:from-[#b09a7a] hover:to-[#9d5a7a]
                           disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed
                           text-white font-medium rounded-lg
                           shadow-lg shadow-black/50
                           transition-all duration-200"
                >
                    {#if isLoading}
                        <Loader2 class="w-5 h-5 animate-spin" />
                        <span>Signing in...</span>
                    {:else}
                        <LogIn class="w-5 h-5" />
                        <span>Sign In</span>
                    {/if}
                </button>

                <!-- Divider -->
                <div class="relative my-6">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-white/10"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                        <span class="px-4 bg-black/40 text-gray-400"
                            >Or continue with</span
                        >
                    </div>
                </div>

                <!-- Google Login Button -->
                <button
                    type="button"
                    onclick={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading}
                    class="w-full flex items-center justify-center gap-3 px-4 py-3
                           bg-white hover:bg-gray-100
                           disabled:bg-gray-300 disabled:cursor-not-allowed
                           text-gray-800 font-medium rounded-lg
                           border border-gray-300
                           transition-all duration-200"
                >
                    {#if isGoogleLoading}
                        <Loader2 class="w-5 h-5 animate-spin text-gray-600" />
                        <span>Opening Google Sign In...</span>
                    {:else}
                        <svg class="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        <span>Continue with Google</span>
                    {/if}
                </button>
            </form>
        </div>

        <!-- Footer -->
        <p class="text-center text-gray-500 text-sm mt-6">
            V-LEB Workspace &copy; 2026
        </p>
    </div>
    </div>
</div>
