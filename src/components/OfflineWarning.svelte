<script>
    import { WifiOff, RefreshCw } from "lucide-svelte";
    
    let { isOnline = $bindable(true) } = $props();
    
    let isChecking = $state(false);
    
    async function checkConnection() {
        isChecking = true;
        
        try {
            // Try to ping a reliable endpoint (Google DNS)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://www.google.com/favicon.ico', {
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
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <!-- Icon -->
            <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <WifiOff size={40} class="text-red-600" />
            </div>
            
            <!-- Title -->
            <h2 class="text-2xl font-bold text-gray-900 mb-3">
                Tidak Ada Koneksi Internet
            </h2>
            
            <!-- Message -->
            <p class="text-gray-600 mb-6 leading-relaxed">
                Aplikasi ini memerlukan koneksi internet untuk berfungsi. 
                Silakan periksa koneksi internet Anda dan coba lagi.
            </p>
            
            <!-- Status -->
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p class="text-sm text-red-800 font-medium">
                    ⚠️ Aplikasi tidak dapat digunakan dalam mode offline
                </p>
            </div>
            
            <!-- Retry Button -->
            <button
                onclick={checkConnection}
                disabled={isChecking}
                class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
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
            <p class="text-xs text-gray-500 mt-4">
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
