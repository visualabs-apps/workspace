import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['electron/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules/',
      '**/*.d.ts',
      '**/*.config.*'
    ],
    transformMode: {
      web: [/\.[c]?js$/],
      ssr: [/\.[c]?js$/]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
