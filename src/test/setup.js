import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Force browser environment for Svelte 5
Object.defineProperty(global, 'window', {
  value: global.window || {},
  writable: true
});

Object.defineProperty(global, 'document', {
  value: global.document || {},
  writable: true
});

// Force client-side mode for Svelte 5
Object.defineProperty(global, 'import', {
  value: global.import || {},
  writable: true
});

// Mock import.meta.env for Svelte 5 with proper client-side flags
global.import = {
  meta: {
    env: {
      SSR: false,
      MODE: 'test',
      DEV: true,
      BASE_URL: '/',
      PROD: false,
      // Additional Svelte 5 client-side flags
      RUNTIME: 'browser'
    }
  }
};

// Additional Svelte 5 client-side setup
Object.defineProperty(global, 'process', {
  value: {
    ...global.process,
    browser: true,
    client: true,
    env: {
      ...global.process?.env,
      SSR: 'false',
      NODE_ENV: 'test'
    }
  },
  writable: true
});

// Ensure globalThis has proper browser properties
if (typeof globalThis !== 'undefined') {
  globalThis.window = global.window;
  globalThis.document = global.document;
  globalThis.navigator = global.navigator || {
    userAgent: 'Mozilla/5.0 (Test Environment)'
  };
}

// Don't mock Svelte - let it work naturally for client-side testing

// Mock Electron APIs
global.electronAPI = {
  openUrl: vi.fn(),
  downloadFile: vi.fn(),
  showNotification: vi.fn(),
  getAppVersion: vi.fn(() => '1.2.0'),
  getPath: vi.fn((name) => `/mock/path/${name}`),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  shell: {
    openExternal: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  }
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.sessionStorage = sessionStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Mock URL constructor for testing
global.URL = class MockURL {
  constructor(url, base) {
    this.href = url;
    this.origin = 'https://example.com';
    this.protocol = 'https:';
    this.host = 'example.com';
    this.hostname = 'example.com';
    this.port = '';
    this.pathname = '/';
    this.search = '';
    this.hash = '';
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Additional Svelte 5 specific setup
// Mock the Svelte 5 runtime if needed
if (typeof globalThis.SvelteComponent === 'undefined') {
  globalThis.SvelteComponent = class {};
}

// Ensure proper browser environment for Svelte 5 runes
Object.defineProperty(global, 'requestAnimationFrame', {
  value: (callback) => setTimeout(callback, 16),
  writable: true
});

Object.defineProperty(global, 'cancelAnimationFrame', {
  value: (id) => clearTimeout(id),
  writable: true
});
