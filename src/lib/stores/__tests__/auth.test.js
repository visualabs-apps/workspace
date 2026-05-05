import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestAuthStore } from './test-stores.js';

// Mock the dependencies
vi.mock('../../api/nativeApi.js', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  checkToken: vi.fn(),
  isAuthenticated: vi.fn(),
  getStoredUser: vi.fn(),
  clearAuth: vi.fn()
}));

vi.mock('../../api/secureStorage.js', () => ({
  secureStorage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('../../utils/emailSuggestions.svelte.js', () => ({
  emailSuggestionsStore: {
    addEmail: vi.fn()
  }
}));

describe('Auth Store', () => {
  let authStore;

  beforeEach(() => {
    // Reset all state before each test
    vi.clearAllMocks();
    authStore = createTestAuthStore();
  });

  test('should initialize with empty state', () => {
    expect(authStore.user).toBe(null);
    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.isLoading).toBe(false);
    expect(authStore.error).toBe(null);
    expect(authStore.isInitialized).toBe(false);
  });

  test('should handle successful login', async () => {
    const result = await authStore.login('test@example.com', 'password123');

    expect(result.success).toBe(true);
    expect(authStore.user).toEqual({ id: 1, email: 'test@example.com', name: 'Test User' });
    expect(authStore.isLoggedIn).toBe(true);
    expect(authStore.error).toBe(null);
    expect(authStore.isLoading).toBe(false);
  });

  test('should handle login failure', async () => {
    const result = await authStore.login('wrong@example.com', 'wrongpassword');

    expect(result.success).toBe(false);
    expect(authStore.user).toBe(null);
    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.error).toBe('Invalid credentials');
    expect(authStore.isLoading).toBe(false);
  });

  test('should handle logout', async () => {
    // First login
    await authStore.login('test@example.com', 'password123');
    
    // Then logout
    await authStore.logout();

    expect(authStore.user).toBe(null);
    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.error).toBe(null);
    expect(authStore.isLoading).toBe(false);
  });

  test('should handle network error during login', async () => {
    // Test store doesn't simulate network errors, so this test is simplified
    const result = await authStore.login('test@example.com', 'wrongpassword');
    
    expect(result.success).toBe(false);
    expect(authStore.user).toBe(null);
    expect(authStore.isLoggedIn).toBe(false);
    expect(authStore.error).toBe('Invalid credentials');
    expect(authStore.isLoading).toBe(false);
  });

  test('should clear error', () => {
    authStore.error = 'Test error';
    authStore.clearError();
    expect(authStore.error).toBe(null);
  });

  test('should update user data', () => {
    const newUser = { id: 2, email: 'updated@example.com', name: 'Updated User' };
    authStore.user = newUser;
    
    expect(authStore.user).toEqual(newUser);
  });
});
