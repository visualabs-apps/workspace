<script>
    import { authStore } from "../../lib/stores/auth.svelte.js";
    import { Loader2, Eye, EyeOff } from "lucide-svelte";
    import WindowControls from "../layout/WindowControls.svelte";
    import { onMount } from "svelte";

    let email = $state("");
    let password = $state("");
    let isLoading = $state(false);
    let errorMessage = $state("");
    let showPassword = $state(false);
    let emailInput = $state(null);

    onMount(() => {
        console.log('[LoginPage] Mounted. api exists:', !!window.api, 'resetWindowHitTest exists:', !!window.api?.resetWindowHitTest);
        // Fix input clickability by forcing Electron/Windows OS to re-evaluate hit-test regions
        window.api?.resetWindowHitTest?.();
        
        // Wait for rendering to completely settle, then focus the first input field
        setTimeout(() => {
            console.log('[LoginPage] Triggering secondary hit-test reset');
            window.api?.resetWindowHitTest?.();
            if (emailInput && !isLoading) {
                emailInput.focus();
                console.log('[LoginPage] Focused email input programmatically');
            }
        }, 400);
    });

    function forceFocus(event) {
        console.log('[LoginPage] Forcing input focus via mousedown event');
        // Let the default mousedown work but also call focus directly
        setTimeout(() => {
            event.target.focus();
        }, 10);
    }

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage = "";

        if (!email.trim()) {
            errorMessage = "Email wajib diisi";
            return;
        }
        if (!password.trim()) {
            errorMessage = "Password wajib diisi";
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            errorMessage = "Masukkan alamat email yang valid";
            return;
        }

        isLoading = true;
        try {
            const result = await authStore.login(email.trim(), password);
            if (!result.success) {
                errorMessage = result.error || "Login gagal";
            }
        } catch (error) {
            errorMessage = "Terjadi kesalahan yang tidak terduga";
        } finally {
            isLoading = false;
        }
    }
</script>

<div class="h-screen w-screen flex bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
    <!-- Draggable Header Region for frameless window -->
    <div class="absolute top-0 left-0 right-0 h-10 z-40" style="-webkit-app-region: drag"></div>

    <!-- Top-Right Window Controls -->
    <div class="absolute top-2 right-2 z-50" style="-webkit-app-region: no-drag">
        <WindowControls variant="dark" />
    </div>

    <!-- Left Side - Login Form -->
    <div class="w-full md:w-1/2 h-full flex items-center justify-center p-12 relative z-10">
        <div class="w-full max-w-sm">
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8">
                Selamat Datang di VisualBox
            </h1>

            {#if errorMessage}
                <div
                    class="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm"
                >
                    {errorMessage}
                </div>
            {/if}

            <form class="space-y-6" onsubmit={handleLogin}>
                <div>
                    <label
                        for="email"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >Email</label
                    >
                    <input
                        id="email"
                        type="email"
                        bind:this={emailInput}
                        bind:value={email}
                        disabled={isLoading}
                        onmousedown={forceFocus}
                        onclick={forceFocus}
                        class="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder="Email Anda"
                    />
                </div>

                <div>
                    <label
                        for="password"
                        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >Password</label
                    >
                    <div class="relative">
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            bind:value={password}
                            disabled={isLoading}
                            onmousedown={forceFocus}
                            onclick={forceFocus}
                            class="w-full pl-4 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Password Anda"
                        />
                        <button
                            type="button"
                            onclick={() => showPassword = !showPassword}
                            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                            {#if showPassword}
                                <EyeOff size={18} />
                            {:else}
                                <Eye size={18} />
                            {/if}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    class="w-full py-3 bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white font-medium rounded-lg text-sm"
                >
                    {isLoading ? "Masuk..." : "Masuk"}
                </button>
            </form>
        </div>
    </div>

    <!-- Right Side - Illustration -->
    <div class="hidden md:block w-1/2 h-full">
        <img
            src={`${import.meta.env.BASE_URL}login_img.png`}
            alt="Login illustration"
            class="w-full h-full object-cover"
        />
    </div>
</div>
