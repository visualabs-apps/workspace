/**
 * Inject custom scrollbar styles into webview
 */
function initScrollbarStyles() {
    try {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectStyles);
        } else {
            injectStyles();
        }

        function injectStyles() {
            const style = document.createElement('style');
            style.id = 'vbox-custom-scrollbar';
            style.textContent = `
                /* Custom scrollbar - Modern rounded style */
                ::-webkit-scrollbar {
                    width: 10px !important;
                    height: 10px !important;
                }

                ::-webkit-scrollbar-track {
                    background: transparent !important;
                }

                ::-webkit-scrollbar-thumb {
                    background: #c1c1c1 !important;
                    border-radius: 10px !important;
                    min-height: 40px !important;
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8 !important;
                }

                /* Dark mode scrollbar */
                @media (prefers-color-scheme: dark) {
                    ::-webkit-scrollbar-thumb {
                        background: #5a5a5a !important;
                    }

                    ::-webkit-scrollbar-thumb:hover {
                        background: #6e6e6e !important;
                    }
                }

                ::-webkit-scrollbar-corner {
                    background: transparent !important;
                }
            `;

            // Insert at the end of head with high priority
            if (document.head) {
                document.head.appendChild(style);
            } else {
                // Fallback if head doesn't exist yet
                const observer = new MutationObserver(() => {
                    if (document.head) {
                        document.head.appendChild(style);
                        observer.disconnect();
                    }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            }
        }
    } catch (error) {
        // Silently fail - scrollbar styling is not critical
    }
}

module.exports = { init: initScrollbarStyles };
