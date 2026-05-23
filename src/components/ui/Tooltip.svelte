<script>
    /**
     * Reusable Tooltip Component
     * Best practice: Single tooltip instance, positioned dynamically
     */
    
    let { 
        show = false,
        content = '',
        targetElement = null,
        placement = 'right', // 'top' | 'right' | 'bottom' | 'left'
        offset = 8,
        delay = 300
    } = $props();

    let tooltipElement = $state(null);
    let position = $state({ x: 0, y: 0 });
    let showDelayed = $state(false);
    let timeoutId = null;

    // Calculate position based on target element
    function calculatePosition() {
        if (!targetElement || !tooltipElement) return;

        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        let x = 0;
        let y = 0;

        switch (placement) {
            case 'right':
                x = targetRect.right + offset;
                y = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'left':
                x = targetRect.left - tooltipRect.width - offset;
                y = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'top':
                x = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                y = targetRect.top - tooltipRect.height - offset;
                break;
            case 'bottom':
                x = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                y = targetRect.bottom + offset;
                break;
        }

        // Prevent overflow
        if (x + tooltipRect.width > viewport.width) {
            x = viewport.width - tooltipRect.width - 8;
        }
        if (x < 8) x = 8;
        if (y + tooltipRect.height > viewport.height) {
            y = viewport.height - tooltipRect.height - 8;
        }
        if (y < 8) y = 8;

        position = { x, y };
    }

    // Handle show with delay
    $effect(() => {
        if (show) {
            timeoutId = setTimeout(() => {
                showDelayed = true;
                // Calculate position after render
                requestAnimationFrame(calculatePosition);
            }, delay);
        } else {
            if (timeoutId) clearTimeout(timeoutId);
            showDelayed = false;
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    });

    // Recalculate on window resize
    $effect(() => {
        if (showDelayed) {
            const handleResize = () => calculatePosition();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    });
</script>

{#if showDelayed}
    <div
        bind:this={tooltipElement}
        class="fixed z-[9999] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 px-3 py-2 min-w-[160px] pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200"
        style="left: {position.x}px; top: {position.y}px;"
    >
        {@html content}
    </div>
{/if}

<style>
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes slide-in-from-left-2 {
        from { transform: translateX(-8px); }
        to { transform: translateX(0); }
    }
    
    .animate-in {
        animation: fade-in 0.2s ease-out, slide-in-from-left-2 0.2s ease-out;
    }
</style>
