/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{html,svelte,js,ts,}",
        "./electron/**/*.{html,svelte,js,ts,}"
    ],
    // Tailwind v4 uses CSS-first configuration
    // Dark mode is enabled by default with .dark class
    theme: {
        extend: {
            colors: {
                gray: {
                    850: '#1a1d24',
                }
            }
        },
    },
    plugins: [],
}