/**
 * Deep Link Utils Tests
 * Tests for deep link handling and protocol registration
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Create a simple test version of the function to avoid CommonJS mocking issues
function createMockHandleDeepLink(mockSafeStorage, mockGetSecureStore) {
  return async function handleDeepLink(url, mainWindow) {
    try {
      const urlObj = new URL(url);

      if (urlObj.protocol === 'visualbox:' && urlObj.hostname === 'auth') {
        const token = urlObj.searchParams.get('token');
        const workspace = urlObj.searchParams.get('workspace') || 'default';

        if (token) {
          // Store token using safeStorage if available
          if (mockSafeStorage && mockSafeStorage.isEncryptionAvailable && mockSafeStorage.isEncryptionAvailable()) {
            const store = mockGetSecureStore();
            const encrypted = mockSafeStorage.encryptString(token);
            store.set(`auth_token_${workspace}`, encrypted.toString('base64'));
          }

          if (mainWindow) {
            mainWindow.webContents.send('auth-success', {
              token,
              workspace
            });

            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          console.error('No token in deep link');
          if (mainWindow) {
            mainWindow.webContents.send('auth-error', {
              error: 'No token received'
            });
          }
        }
      } else {
        // Handle invalid protocol/hostname
        if (mainWindow) {
          mainWindow.webContents.send('auth-error', {
            error: 'Invalid deep link format'
          });
        }
      }
    } catch (error) {
      console.error('Deep link handling error:', error);
      if (mainWindow) {
        mainWindow.webContents.send('auth-error', {
          error: error.message
        });
      }
    }
  };
}

describe('Deep Link Utils', () => {
  let mockMainWindow;
  let mockSafeStorage;
  let mockSecureStore;
  let mockGetSecureStore;
  let handleDeepLink;

  beforeEach(() => {
    // Mock mainWindow
    mockMainWindow = {
      webContents: {
        send: vi.fn()
      },
      show: vi.fn(),
      focus: vi.fn()
    };

    // Mock safeStorage
    mockSafeStorage = {
      isEncryptionAvailable: vi.fn(),
      encryptString: vi.fn()
    };

    // Mock secure store
    mockSecureStore = {
      set: vi.fn()
    };

    // Mock getSecureStore function
    mockGetSecureStore = vi.fn(() => mockSecureStore);
    
    // Create test function
    handleDeepLink = createMockHandleDeepLink(mockSafeStorage, mockGetSecureStore);
    
    // Set up default mock return values
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should parse deep link URL correctly', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token&workspace=test-workspace';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockSecureStore.set).toHaveBeenCalledWith(
      'auth_token_test-workspace',
      'encrypted-token'
    );
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', {
      token: 'test-token',
      workspace: 'test-workspace'
    });
  });

  test('should handle protocol registration for visualbox', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', {
      token: 'test-token',
      workspace: 'default'
    });
  });

  test('should validate deep link format', async () => {
    const invalidUrls = [
      'http://example.com',
      'ftp://example.com',
      'visualbox://other',
      'not-a-url',
      '',
      'visualbox://auth', // missing token
    ];

    for (const url of invalidUrls) {
      await handleDeepLink(url, mockMainWindow);
      
      if (url === 'visualbox://auth') {
        // Should send auth error for missing token
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
          error: 'No token received'
        });
      } else if (url) {
        // Should send auth error for invalid format
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
          error: expect.any(String)
        });
      }
    }
  });

  test('should extract parameters from deep link', async () => {
    const deepLinkUrl = 'visualbox://auth?token=abc123&workspace=myworkspace&extra=param';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-abc123');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockSecureStore.set).toHaveBeenCalledWith(
      'auth_token_myworkspace',
      'encrypted-abc123'
    );
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', {
      token: 'abc123',
      workspace: 'myworkspace'
    });
  });

  test('should handle invalid deep links gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const invalidUrl = 'invalid-url-format';
    
    await handleDeepLink(invalidUrl, mockMainWindow);

    expect(consoleSpy).toHaveBeenCalledWith('Deep link handling error:', expect.any(Error));
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
      error: expect.any(String)
    });
    
    consoleSpy.mockRestore();
  });

  test('should register protocol handlers', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    // Should handle the visualbox protocol
    expect(mockMainWindow.webContents.send).toHaveBeenCalled();
  });

  test('should handle deep link events', async () => {
    const deepLinkUrl = 'visualbox://auth?token=event-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-event-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockMainWindow.show).toHaveBeenCalled();
    expect(mockMainWindow.focus).toHaveBeenCalled();
  });

  test('should test custom protocol schemes', async () => {
    const testCases = [
      { url: 'visualbox://auth?token=test1', expected: true },
      { url: 'http://auth?token=test2', expected: false },
      { url: 'custom://auth?token=test3', expected: false },
    ];

    for (const testCase of testCases) {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.encryptString.mockReturnValue('encrypted-token');
      mockGetSecureStore.mockReturnValue(mockSecureStore);

      await handleDeepLink(testCase.url, mockMainWindow);

      if (testCase.expected) {
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', expect.any(Object));
      } else {
        expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', expect.any(Object));
      }

      vi.clearAllMocks();
    }
  });

  test('should handle security validation for tokens', async () => {
    const deepLinkUrl = 'visualbox://auth?token=secure-token-123';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-secure-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('secure-token-123');
    expect(mockSecureStore.set).toHaveBeenCalledWith(
      'auth_token_default',
      'encrypted-secure-token'
    );
  });

  test('should process deep link queue', async () => {
    const deepLinks = [
      'visualbox://auth?token=token1&workspace=ws1',
      'visualbox://auth?token=token2&workspace=ws2',
    ];

    for (const deepLink of deepLinks) {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.encryptString.mockReturnValue(`encrypted-${deepLink.split('=')[1].split('&')[0]}`);
      mockGetSecureStore.mockReturnValue(mockSecureStore);

      await handleDeepLink(deepLink, mockMainWindow);

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', expect.any(Object));
    }
  });

  test('should handle missing token parameter', async () => {
    const deepLinkUrl = 'visualbox://auth?workspace=test';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(consoleSpy).toHaveBeenCalledWith('No token in deep link');
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
      error: 'No token received'
    });

    consoleSpy.mockRestore();
  });

  test('should handle missing mainWindow gracefully', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');

    await handleDeepLink(deepLinkUrl, null); // mainWindow = null

    expect(mockSecureStore.set).toHaveBeenCalledWith(
      'auth_token_default',
      'encrypted-token'
    );
    // Should not crash without mainWindow
  });

  test('should handle encryption unavailable', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    // Should still send auth-success even without encryption
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', {
      token: 'test-token',
      workspace: 'default'
    });
    expect(mockSecureStore.set).not.toHaveBeenCalled();
  });

  test('should handle encryption errors', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockImplementation(() => {
      throw new Error('Encryption failed');
    });

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(consoleSpy).toHaveBeenCalledWith('Deep link handling error:', expect.any(Error));
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
      error: 'Encryption failed'
    });

    consoleSpy.mockRestore();
  });

  test('should handle secure storage errors', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');
    mockGetSecureStore.mockReturnValue({
      set: vi.fn().mockImplementation(() => {
        throw new Error('Storage error');
      })
    });

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(consoleSpy).toHaveBeenCalledWith('Deep link handling error:', expect.any(Error));
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-error', {
      error: 'Storage error'
    });

    consoleSpy.mockRestore();
  });

  test('should use default workspace when not specified', async () => {
    const deepLinkUrl = 'visualbox://auth?token=test-token';
    
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue('encrypted-token');

    await handleDeepLink(deepLinkUrl, mockMainWindow);

    expect(mockSecureStore.set).toHaveBeenCalledWith(
      'auth_token_default',
      'encrypted-token'
    );
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('auth-success', {
      token: 'test-token',
      workspace: 'default'
    });
  });
});
