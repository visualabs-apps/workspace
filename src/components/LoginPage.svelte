<script>
    import { authStore } from "../lib/auth.svelte.js";
    import { Loader2, Eye, EyeOff, AlertCircle, Mail, Lock } from "lucide-svelte";
    import WindowControls from "./WindowControls.svelte";
    import EmailSuggestionDropdown from "./EmailSuggestionDropdown.svelte";

    let email = $state('');
    let password = $state('');
    let showPassword = $state(false);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let errorType = $state('error');
    let showEmailSuggestions = $state(false);
    let isEmailFocused = $state(false);

    async function handleLogin(event) {
        event?.preventDefault();
        
        errorMessage = '';
        
        if (!email.trim()) {
            showError('Email wajib diisi', 'warning');
            return;
        }
        
        if (!password.trim()) {
            showError('Password wajib diisi', 'warning');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            showError('Masukkan alamat email yang valid', 'warning');
            return;
        }

        isLoading = true;

        try {
            const result = await authStore.login(email.trim(), password);
            if (!result.success) {
                const error = result.error || 'Login gagal';
                if (error.includes('Kredensial salah') || error.includes('wrong') || error.includes('invalid')) {
                    showError('Email atau password salah. Silakan periksa kredensial Anda dan coba lagi.', 'error');
                } else if (error.includes('network') || error.includes('connection')) {
                    showError('Kesalahan koneksi. Silakan periksa koneksi internet Anda dan coba lagi.', 'error');
                } else if (error.includes('timeout')) {
                    showError('Permintaan timeout. Silakan coba lagi.', 'error');
                } else {
                    showError(error, 'error');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Terjadi kesalahan yang tidak terduga. Silakan coba lagi.', 'error');
        } finally {
            isLoading = false;
        }
    }

    function showError(message, type = 'error') {
        errorMessage = message;
        errorType = type;
        
        if (type !== 'error') {
            setTimeout(() => {
                if (errorMessage === message) {
                    errorMessage = '';
                }
            }, 5000);
        }
    }

    function handleKeyPress(event) {
        // Don't submit form if suggestions are open and user is navigating
        if (showEmailSuggestions && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
            return; // Let EmailSuggestionDropdown handle these
        }
        
        if (event.key === 'Enter') {
            handleLogin();
        }
    }

    function togglePasswordVisibility() {
        showPassword = !showPassword;
    }

    function clearError() {
        errorMessage = '';
    }

    // Email suggestion handlers
    function handleEmailFocus() {
        isEmailFocused = true;
        showEmailSuggestions = true;
    }

    function handleEmailBlur() {
        // Delay hiding to allow click on dropdown
        setTimeout(() => {
            isEmailFocused = false;
            showEmailSuggestions = false;
        }, 150);
    }

    function handleEmailInput() {
        showEmailSuggestions = isEmailFocused;
        clearError();
    }

    function handleEmailSelect(selectedEmail) {
        email = selectedEmail;
        showEmailSuggestions = false;
        
        // Focus password field after email selection
        setTimeout(() => {
            const passwordInput = document.getElementById('password');
            if (passwordInput) {
                passwordInput.focus();
            }
        }, 100);
    }

    function handleSuggestionsClose() {
        showEmailSuggestions = false;
    }
</script>

<div class="h-screen w-screen flex bg-gray-50 overflow-hidden">
    <!-- Custom Title Bar -->
    <div
        class="absolute top-0 left-0 right-0 w-full h-[30px] shrink-0 flex items-center bg-transparent z-50 select-none"
        style="-webkit-app-region: drag"
    >
        <div class="flex-1"></div>
        <div style="-webkit-app-region: no-drag">
            <WindowControls variant="light" />
        </div>
    </div>

    <!-- Left Side - Login Form -->
    <div class="w-1/2 h-full flex items-center justify-center p-12 pt-20">
        <div class="w-full max-w-sm">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-2xl font-semibold text-gray-900 mb-8">
                    Selamat Datang di VisualBox
                </h1>
            </div>

            <!-- Error Message -->
            {#if errorMessage}
                <div class="mb-6 rounded-lg p-4 text-sm flex items-start gap-3 {
                    errorType === 'error' ? 'bg-red-50 border border-red-200 text-red-700' :
                    errorType === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' :
                    'bg-blue-50 border border-blue-200 text-blue-700'
                }">
                    <AlertCircle class="w-4 h-4 mt-0.5 shrink-0" />
                    <div class="flex-1">
                        <p>{errorMessage}</p>
                        {#if errorType === 'error'}
                            <button 
                                onclick={clearError}
                                class="text-xs text-red-600 hover:text-red-700 mt-1 underline"
                            >
                                Tutup
                            </button>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Login Form -->
            <form class="space-y-6" onsubmit={handleLogin}>
                <!-- Email Field -->
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                        Email
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail class="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            id="email"
                            type="email"
                            bind:value={email}
                            onkeypress={handleKeyPress}
                            onfocus={handleEmailFocus}
                            onblur={handleEmailBlur}
                            oninput={handleEmailInput}
                            disabled={isLoading}
                            class="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
                            placeholder="Silahkan masukkan alamat email Anda"
                            autocomplete="email"
                            required
                        />
                        
                        <!-- Email Suggestions Dropdown -->
                        <EmailSuggestionDropdown 
                            query={email}
                            isVisible={showEmailSuggestions}
                            onSelect={handleEmailSelect}
                            onClose={handleSuggestionsClose}
                        />
                    </div>
                </div>

                <!-- Password Field -->
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                        Password
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock class="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            bind:value={password}
                            onkeypress={handleKeyPress}
                            oninput={clearError}
                            disabled={isLoading}
                            class="w-full pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
                            placeholder="Silahkan masukkan password Anda"
                            autocomplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            onclick={togglePasswordVisibility}
                            disabled={isLoading}
                            class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        >
                            {#if showPassword}
                                <EyeOff class="w-4 h-4" />
                            {:else}
                                <Eye class="w-4 h-4" />
                            {/if}
                        </button>
                    </div>
                </div>

                <!-- Login Button -->
                <button
                    type="submit"
                    disabled={isLoading || !email.trim() || !password.trim()}
                    class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                    {#if isLoading}
                        <Loader2 class="w-4 h-4 animate-spin" />
                        <span>Masuk...</span>
                    {:else}
                        <span>Masuk</span>
                    {/if}
                </button>
            </form>
        </div>
    </div>

    <!-- Right Side - Illustration -->
    <div class="w-1/2 h-full relative overflow-hidden">
        <div class="w-full h-full rounded-tl-[6rem] overflow-hidden relative">
            <img 
                src="/login_img.png" 
                alt="Login illustration" 
                class="w-full h-full object-cover"
            />
            <!-- Smooth opacity overlay for bottom left -->
            <div class="absolute bottom-0 left-0 w-48 h-48 pointer-events-none">
                <div class="w-full h-full bg-gradient-radial-opacity"></div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Clean modern styling */
    input {
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    
    input:focus {
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    button[type="submit"] {
        transition: background-color 0.2s ease, transform 0.1s ease;
    }
    
    button[type="submit"]:hover:not(:disabled) {
        transform: translateY(-1px);
    }
    
    button[type="submit"]:active:not(:disabled) {
        transform: translateY(0px);
    }
    
    /* Custom radial gradient for smooth opacity effect */
    .bg-gradient-radial-opacity {
        background: radial-gradient(circle at bottom left, 
            rgba(255, 255, 255, 0.9) 0%, 
            rgba(255, 255, 255, 0.6) 30%, 
            rgba(255, 255, 255, 0.3) 60%, 
            transparent 100%);
    }
</style>