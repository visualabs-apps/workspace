import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the API modules
vi.mock('../../api/api.js', () => ({
  getChromeProfiles: vi.fn(),
  deleteChromeProfile: vi.fn()
}));

vi.mock('../../api/nativeApi.js', () => ({
  authStore: {
    user: null
  }
}));

// Mock window.api for SQLite operations
const mockWindowApi = {
  db: {
    getProfileColor: vi.fn(),
    getSetting: vi.fn(),
    saveSetting: vi.fn(),
    deleteProfileColor: vi.fn(),
    deleteSetting: vi.fn()
  }
};

global.window = { api: mockWindowApi };

describe('Workspace Store Interface Tests', () => {
  let workspaceStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked modules
    const { getChromeProfiles: mockedGetChromeProfiles, deleteChromeProfile: mockedDeleteChromeProfile } = await import('../../api/api.js');
    const { authStore: mockedAuthStore } = await import('../../api/nativeApi.js');
    
    // Reset window API mocks
    Object.values(mockWindowApi.db).forEach(mock => mock.mockReset());
    
    // Reset auth store
    mockedAuthStore.user = null;
    
    // Import the store after mocking
    const workspaceModule = await import('../workspaces.svelte.js');
    workspaceStore = workspaceModule.workspaceStore;
    
    // Reset store state
    workspaceStore.reset();
    
    // Manual mock injection - override the store's internal references
    workspaceStore._testInjectMocks({
      getChromeProfiles: mockedGetChromeProfiles,
      deleteChromeProfile: mockedDeleteChromeProfile,
      authStore: mockedAuthStore
    });
    
    // Make mocks available to tests
    global.mockGetChromeProfiles = mockedGetChromeProfiles;
    global.mockDeleteChromeProfile = mockedDeleteChromeProfile;
    global.mockAuthStore = mockedAuthStore;
  });

  test('should have correct initial state', () => {
    expect(workspaceStore.workspaces).toBeDefined();
    expect(workspaceStore.activeWorkspaceId).toBeDefined();
    expect(workspaceStore.isLoading).toBeDefined();
    expect(workspaceStore.isInitialized).toBeDefined();
    expect(workspaceStore.activeWorkspace).toBeDefined();
    
    // Initial values
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isLoading).toBe(false);
    expect(workspaceStore.isInitialized).toBe(false);
    expect(workspaceStore.activeWorkspace).toBe(null);
  });

  test('should initialize when no user is logged in', async () => {
    // Mock no user logged in
    global.mockAuthStore.user = null;
    
    await workspaceStore.init();
    
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should initialize with user workspaces', async () => {
    // Mock user logged in
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    // Mock API responses
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      },
      {
        id: 'workspace2',
        name: 'Test Workspace',
        customerId: 'customer2',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-02',
        updatedAt: '2023-01-02'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    
    await workspaceStore.init();
    
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.isLoading).toBe(false);
    expect(workspaceStore.workspaces.length).toBeGreaterThan(0);
    expect(workspaceStore.activeWorkspaceId).toBeTruthy();
    expect(workspaceStore.activeWorkspace).toBeTruthy();
  });

  test('should handle API errors during initialization', async () => {
    // Mock user logged in
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    // Mock API error
    global.mockGetChromeProfiles.mockRejectedValue(new Error('Network error'));
    
    await workspaceStore.init();
    
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should set active workspace', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      },
      {
        id: 'workspace2',
        name: 'Test Workspace',
        customerId: 'customer2',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-02',
        updatedAt: '2023-01-02'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Get the initial active workspace ID
    const initialActiveId = workspaceStore.activeWorkspaceId;
    
    // Switch to a different workspace
    await workspaceStore.setActiveWorkspace('workspace2');
    
    expect(workspaceStore.activeWorkspaceId).toBe('workspace2');
    expect(workspaceStore.activeWorkspace.name).toBe('Test Workspace');
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('active_workspace_id', 'workspace2');
  });

  test('should not set active workspace for invalid ID', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    
    await workspaceStore.init();
    
    const originalActiveId = workspaceStore.activeWorkspaceId;
    
    // Try to switch to non-existent workspace
    await workspaceStore.setActiveWorkspace('non-existent-id');
    
    // Should remain unchanged
    expect(workspaceStore.activeWorkspaceId).toBe(originalActiveId);
    expect(mockWindowApi.db.saveSetting).not.toHaveBeenCalled();
  });

  test('should delete workspace successfully', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      },
      {
        id: 'workspace2',
        name: 'Test Workspace',
        customerId: 'customer2',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-02',
        updatedAt: '2023-01-02'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    global.mockDeleteChromeProfile.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteProfileColor.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteSetting.mockResolvedValue({ success: true });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    const initialCount = workspaceStore.workspaces.length;
    
    // Delete workspace
    const result = await workspaceStore.deleteWorkspace('workspace2');
    
    expect(result).toBe(true);
    expect(global.mockDeleteChromeProfile).toHaveBeenCalledWith('workspace2');
    expect(mockWindowApi.db.deleteProfileColor).toHaveBeenCalledWith('workspace2');
    expect(mockWindowApi.db.deleteSetting).toHaveBeenCalledWith('workspace_apps_workspace2');
  });

  test('should handle delete workspace failure', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    global.mockDeleteChromeProfile.mockResolvedValue({ success: false, error: 'Delete failed' });
    
    await workspaceStore.init();
    
    // Try to delete workspace
    const result = await workspaceStore.deleteWorkspace('workspace1');
    
    expect(result).toBe(false);
    expect(global.mockDeleteChromeProfile).toHaveBeenCalledWith('workspace1');
  });

  test('should add app to workspace', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Add app to workspace
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('workspace_apps_workspace1', ['service1']);
  });

  test('should remove app from workspace', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: ['service1'] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Remove app from workspace
    await workspaceStore.removeAppFromWorkspace('workspace1', 'service1');
    
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('workspace_apps_workspace1', []);
  });

  test('should refresh workspaces', async () => {
    // Setup initial workspaces
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    
    await workspaceStore.init();
    
    // Refresh workspaces
    await workspaceStore.refresh();
    
    expect(global.mockGetChromeProfiles).toHaveBeenCalledWith({ userId: 'user123', limit: 100 });
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should handle refresh without user', async () => {
    // Mock no user
    global.mockAuthStore.user = null;
    
    await workspaceStore.refresh();
    
    expect(workspaceStore.workspaces).toEqual([]);
    expect(global.mockGetChromeProfiles).not.toHaveBeenCalled();
  });

  test('should have removeWorkspace alias', async () => {
    // Test that removeWorkspace is an alias for deleteWorkspace
    global.mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const mockProfiles = [
      {
        id: 'workspace1',
        name: 'Default Workspace',
        customerId: 'customer1',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      }
    ];
    
    global.mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false });
    global.mockDeleteChromeProfile.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteProfileColor.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Test alias method
    const result = await workspaceStore.removeWorkspace('workspace1');
    
    expect(result).toBe(true);
    expect(global.mockDeleteChromeProfile).toHaveBeenCalledWith('workspace1');
  });
});
