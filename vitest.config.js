import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/',
      'src/test/',
      '**/*.d.ts',
      '**/*.config.*',
      'electron/',
      'scripts/',
      'build/',
      'dist/'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'electron/',
        'scripts/',
        'build/',
        'dist/'
      ]
    },
    // Increase timeout for Svelte 5 compilation
    testTimeout: 10000
  },
  resolve: {
    alias: {
      $lib: '/src/lib'
    }
  },
  define: {
    // Enable Svelte 5 client-side mode for testing
    'process.browser': 'true',
    'global': 'globalThis',
    // Force client-side environment
    'process.env.NODE_ENV': '"test"',
    // Force Svelte 5 to run in browser mode
    'import.meta.env.SSR': 'false',
    'import.meta.env.MODE': '"test"',
    // Additional Svelte 5 client-side flags
    'process.env.SSR': 'false',
    'process.client': 'true'
  },
  server: {
    deps: {
      inline: ['svelte']
    }
  }
});
