<script>
    import { WifiOff, RefreshCw } from "lucide-svelte";
    
    let { isOnline = $bindable(true) } = $props();
    
    let isChecking = $state(false);
    
    // Resolve API base URL for connectivity check
    // local: http://localhost:2024  |  production: https://vims.dots.my.id
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:2024/api').replace(/\/api\/?$/, '');
    
    async function checkConnection() {
        isChecking = true;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            // Ping the actual API server instead of Google
            await fetch(apiBaseUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            isOnline = true;
        } catch (error) {
            console.error('Connection check failed:', error);
            isOnline = false;
        } finally {
            setTimeout(() => {
                isChecking = false;
            }, 500);
        }
    }
</script>

{#if !isOnline}
    <!-- Backdrop - cannot be closed -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <!-- Modal -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <!-- Icon -->
            <div class="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <WifiOff size={40} class="text-red-600 dark:text-red-400" />
            </div>

            <!-- Title -->
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                Tidak Ada Koneksi Internet
            </h2>

            <!-- Message -->
            <p class="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                Aplikasi ini memerlukan koneksi internet untuk berfungsi.
                Silakan periksa koneksi internet Anda dan coba lagi.
            </p>

            <!-- Status -->
            <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                <p class="text-sm text-red-800 dark:text-red-300 font-medium">
                    ⚠️ Aplikasi tidak dapat digunakan dalam mode offline
                </p>
            </div>

            <!-- Retry Button -->
            <button
                onclick={checkConnection}
                disabled={isChecking}
                class="w-full bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                {#if isChecking}
                    <RefreshCw size={20} class="animate-spin" />
                    <span>Memeriksa Koneksi...</span>
                {:else}
                    <RefreshCw size={20} />
                    <span>Coba Lagi</span>
                {/if}
            </button>

            <!-- Help Text -->
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Pastikan Anda terhubung ke internet dan server dapat diakses
            </p>
        </div>
    </div>
{/if}

<style>
    @keyframes pulse-ring {
        0% {
            transform: scale(0.95);
            opacity: 1;
        }
        50% {
            transform: scale(1.05);
            opacity: 0.7;
        }
        100% {
            transform: scale(0.95);
            opacity: 1;
        }
    }
    
    .bg-red-100 {
        animation: pulse-ring 2s ease-in-out infinite;
    }
</style>




