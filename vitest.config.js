import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: true,
        // Force client-side compilation for Svelte 5 runes
        generate: 'client',
        hydratable: false,
        runes: true,
        // Enable Svelte 4 compatibility for testing
        compatibility: {
          componentApi: 4
        }
      },
      // Ensure Svelte 5 runs in client mode for tests
      preprocess: [],
      onwarn: (warning, handler) => {
        // Ignore warnings about missing lifecycle functions in tests
        if (warning.code === 'missing-export') return;
        if (warning.code === 'unused-export-let') return;
        handler(warning);
      }
    })
  ],
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
    // Force Svelte 5 to use client-side mode
    environmentOptions: {
      happyDOM: {
        settings: {
          navigator: {
            userAgent: 'Mozilla/5.0 (Test Environment)'
          }
        }
      }
    },
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
    'process.client': 'true',
    // Svelte 5 specific flags
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false'
  },
  server: {
    deps: {
      inline: ['svelte']
    }
  }
});
