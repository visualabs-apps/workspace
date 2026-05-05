/**
 * Favicon Component Tests
 * Tests for favicon loading and display functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import Favicon from '../Favicon.svelte';

// Mock window.api for favicon fetching
const mockGetFavicon = vi.fn();

// Setup proper browser environment before each test
beforeEach(() => {
  // Ensure window.api is available
  Object.defineProperty(global.window, 'api', {
    value: {
      getFavicon: mockGetFavicon
    },
    writable: true
  });
  
  // Clear all mocks
  vi.clearAllMocks();
  mockGetFavicon.mockClear();
});

describe('Favicon Component', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render favicon image', async () => {
    const testUrl = 'https://example.com';
    const testFavicon = 'https://example.com/favicon.ico';
    
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    // Create a new container for the component
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      // Create component instance manually
      const component = new Favicon({
        target: container,
        props: {
          url: testUrl,
          size: 16
        }
      });

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain(testFavicon);
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should handle missing favicon gracefully', async () => {
    const testUrl = 'https://example.com';
    
    // Mock API returning null (no favicon found)
    mockGetFavicon.mockResolvedValue(null);
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: testUrl,
          size: 32
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('/icon.png'); // Fallback icon
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should handle different favicon formats', async () => {
    const testCases = [
      { favicon: 'https://example.com/favicon.ico', description: 'ICO format' },
      { favicon: 'https://example.com/favicon.png', description: 'PNG format' },
      { favicon: 'https://example.com/favicon.svg', description: 'SVG format' },
      { favicon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', description: 'Base64 data URL' }
    ];

    for (const testCase of testCases) {
      mockGetFavicon.mockResolvedValue(testCase.favicon);
      
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      try {
        const component = new Favicon({
          target: container,
          props: {
            url: 'https://example.com',
            size: 16
          }
        });

        await new Promise(resolve => setTimeout(resolve, 0));
        
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img.src).toContain(testCase.favicon);
        
        component.$destroy();
      } finally {
        document.body.removeChild(container);
      }
      
      // Clean up for next test
      vi.clearAllMocks();
    }
  });

  test('should show loading state', async () => {
    // Mock slow favicon loading
    mockGetFavicon.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: 'https://example.com',
          size: 16
        }
      });

      // Should show loading state initially
      const loadingElement = container.querySelector('div');
      expect(loadingElement).toBeTruthy();
      expect(loadingElement.className).toContain('animate-pulse');
      expect(loadingElement.style.width).toBe('16px');
      expect(loadingElement.style.height).toBe('16px');
      
      // Wait for loading to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should handle error state', async () => {
    const testUrl = 'https://example.com';
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock API error
    mockGetFavicon.mockRejectedValue(new Error('Network error'));
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: testUrl,
          size: 16
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.src).toContain('/icon.png'); // Fallback icon

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load favicon:', expect.any(Error));
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
      consoleSpy.mockRestore();
    }
  });

  test('should apply custom CSS classes', async () => {
    const testFavicon = 'https://example.com/favicon.ico';
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: 'https://example.com',
          size: 16,
          class: 'custom-class another-class'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.className).toContain('custom-class');
      expect(img.className).toContain('another-class');
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should use custom alt text', async () => {
    const testFavicon = 'https://example.com/favicon.ico';
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: 'https://example.com',
          size: 16,
          alt: 'Custom Alt Text'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.alt).toBe('Custom Alt Text');
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should handle different sizes', async () => {
    const testFavicon = 'https://example.com/favicon.ico';
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    const sizes = [16, 24, 32, 48, 64];
    
    for (const size of sizes) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      try {
        const component = new Favicon({
          target: container,
          props: {
            url: 'https://example.com',
            size: size
          }
        });

        await new Promise(resolve => setTimeout(resolve, 0));
        
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img.width).toBe(size);
        expect(img.height).toBe(size);
        
        component.$destroy();
      } finally {
        document.body.removeChild(container);
      }
      
      // Clean up for next test
      vi.clearAllMocks();
      mockGetFavicon.mockResolvedValue(testFavicon);
    }
  });

  test('should set lazy loading attribute', async () => {
    const testFavicon = 'https://example.com/favicon.ico';
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: 'https://example.com',
          size: 16
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      expect(img.loading).toBe('lazy');
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should not load favicon when URL is empty', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: '',
          size: 16
        }
      });

      // Should not call API when URL is empty
      expect(mockGetFavicon).not.toHaveBeenCalled();
      
      // Should not show loading state when URL is empty
      expect(container.querySelector('img')).toBeFalsy();
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });

  test('should handle image load error gracefully', async () => {
    const testFavicon = 'https://example.com/favicon.ico';
    mockGetFavicon.mockResolvedValue(testFavicon);
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    try {
      const component = new Favicon({
        target: container,
        props: {
          url: 'https://example.com',
          size: 16
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      
      const img = container.querySelector('img');
      expect(img).toBeTruthy();
      
      // Simulate image load error
      const errorEvent = new Event('error');
      img.dispatchEvent(errorEvent);
      
      // Should fallback to default icon
      expect(img.src).toContain('/icon.png');
      
      component.$destroy();
    } finally {
      document.body.removeChild(container);
    }
  });
});
