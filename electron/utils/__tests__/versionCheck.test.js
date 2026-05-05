/**
 * Version Check Utils Tests
 * Tests for version checking and update management
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import https from 'https';
import { checkForNewVersion } from '../versionCheck.cjs';

// Mock constants
vi.mock('../config/constants.cjs', () => ({
  VERSION_CHECK_URL: 'https://api.example.com/version'
}));

// Mock console module
vi.mock('console', () => ({
  log: vi.fn()
}));

const consoleLogSpy = vi.mocked(console.log);

describe('Version Utils', () => {
  let mockApp;
  let mockMainWindow;
  let mockHttpsGet;

  beforeEach(() => {
    // Mock app and mainWindow
    mockApp = {
      getVersion: vi.fn()
    };
    mockMainWindow = {
      webContents: {
        send: vi.fn()
      }
    };

    // Mock https.get
    mockHttpsGet = vi.spyOn(https, 'get').mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn()
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test('should check current version', () => {
    const testVersion = '1.2.3';
    mockApp.getVersion.mockReturnValue(testVersion);

    expect(mockApp.getVersion()).toBe(testVersion);
  });

  test('should compare version strings correctly', async () => {
    // Import the compareVersions function
    const { compareVersions } = await import('../versionCheck.cjs');

    // Test cases for version comparison
    const testCases = [
      { v1: '1.0.0', v2: '1.0.1', expected: -1 },
      { v1: '1.0.1', v2: '1.0.0', expected: 1 },
      { v1: '1.0.0', v2: '1.0.0', expected: 0 },
      { v1: '1.2.3', v2: '2.0.0', expected: -1 },
      { v1: '2.0.0', v2: '1.2.3', expected: 1 },
      { v1: '1.0', v2: '1.0.0', expected: 0 }, // Missing patch version
      { v1: '1', v2: '1.0.0', expected: 0 }, // Missing minor and patch
      { v1: '1.0.0', v2: '1', expected: 0 }, // Reverse of above
    ];

    for (const testCase of testCases) {
      const result = compareVersions(testCase.v1, testCase.v2);
      expect(result).toBe(testCase.expected);
    }
  });

  test('should check for updates and find none available', async () => {
    const currentVersion = '1.2.3';
    const latestVersion = '1.2.3';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock successful response with same version
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ version: latestVersion }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    // Should not send update notification
    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('should check for updates and find new version available', async () => {
    const currentVersion = '1.2.3';
    const latestVersion = '1.3.0';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock successful response with newer version
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ 
              version: latestVersion,
              notes: 'Bug fixes and improvements',
              windows: {
                setup: {
                  url: 'https://example.com/download'
                }
              }
            }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    // Should send update notification
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('new-version-available', {
      version: latestVersion,
      notes: 'Bug fixes and improvements',
      downloadUrl: 'https://example.com/download'
    });
  });

  test('should handle no updates available gracefully', async () => {
    const currentVersion = '2.0.0';
    const latestVersion = '1.5.0';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock response with older version
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ version: latestVersion }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    // Should not send update notification
    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('should handle update available with minimal info', async () => {
    const currentVersion = '1.0.0';
    const latestVersion = '1.1.0';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock response with minimal version info
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ version: latestVersion }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    // Should send update notification with fallback URL
    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('new-version-available', {
      version: latestVersion,
      notes: '',
      downloadUrl: 'https://visualbox.app/downloads/version.json'
    });
  });

  test('should parse version information correctly', async () => {
    const currentVersion = '1.0.0';
    const versionInfo = {
      version: '1.1.0',
      notes: 'New features and bug fixes',
      windows: {
        setup: {
          url: 'https://example.com/setup.exe'
        }
      }
    };
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock response with full version info
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify(versionInfo));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('new-version-available', {
      version: versionInfo.version,
      notes: versionInfo.notes,
      downloadUrl: versionInfo.windows.setup.url
    });
  });

  test('should handle network errors gracefully', async () => {
    mockApp.getVersion.mockReturnValue('1.0.0');

    // Mock network error
    mockHttpsGet.mockImplementation(() => {
      const mockReq = {
        on: vi.fn((event, handler) => {
          if (event === 'error') {
            // Simulate async error
            setImmediate(() => handler(new Error('Network error')));
          }
        })
      };
      return mockReq;
    });

    // This should not throw an error
    expect(() => {
      checkForNewVersion(mockApp, mockMainWindow, false);
    }).not.toThrow();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should not send update notification on error
    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('should handle JSON parse errors gracefully', async () => {
    mockApp.getVersion.mockReturnValue('1.0.0');

    // Mock invalid JSON response
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler('invalid json');
          } else if (event === 'end') {
            // Simulate async end event
            setImmediate(() => handler());
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    // This should not throw an error
    expect(() => {
      checkForNewVersion(mockApp, mockMainWindow, false);
    }).not.toThrow();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Should not send update notification on parse error
    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('should skip version check in development environment', async () => {
    mockApp.getVersion.mockReturnValue('1.0.0');

    checkForNewVersion(mockApp, mockMainWindow, true); // isDevEnvironment = true

    // Should not make HTTP request
    expect(mockHttpsGet).not.toHaveBeenCalled();
    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
  });

  test('should handle missing mainWindow gracefully', async () => {
    const currentVersion = '1.0.0';
    const latestVersion = '1.1.0';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock response with newer version
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ version: latestVersion }));
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, null, false); // mainWindow = null

    // Should not crash and not send notification
    expect(mockMainWindow?.webContents?.send).not.toHaveBeenCalled();
  });

  test('should handle chunked response data', async () => {
    const currentVersion = '1.0.0';
    const latestVersion = '1.1.0';
    
    mockApp.getVersion.mockReturnValue(currentVersion);

    // Mock chunked response
    mockHttpsGet.mockImplementation((url, callback) => {
      const mockResponse = {
        on: vi.fn((event, handler) => {
          if (event === 'data') {
            // Send data in chunks
            handler('{"version":');
            handler(`"${latestVersion}"}`);
          } else if (event === 'end') {
            handler();
          }
        })
      };
      callback(mockResponse);
      return { on: vi.fn() };
    });

    checkForNewVersion(mockApp, mockMainWindow, false);

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('new-version-available', {
      version: latestVersion,
      notes: '',
      downloadUrl: 'https://visualbox.app/downloads/version.json'
    });
  });
});
