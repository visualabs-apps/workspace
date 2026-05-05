import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock the API modules
vi.mock('../../api/api.js', () => ({
  getChromeProfiles: vi.fn(),
  deleteChromeProfile: vi.fn()
}));

vi.mock('../auth.svelte.js', () => ({
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

describe('Workspace Store Unit Tests', () => {
  let workspaceStore;
  let mockGetChromeProfiles, mockDeleteChromeProfile, mockAuthStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset all mocks
    mockGetChromeProfiles = (await import('../../api/api.js')).getChromeProfiles;
    mockDeleteChromeProfile = (await import('../../api/api.js')).deleteChromeProfile;
    mockAuthStore = (await import('../auth.svelte.js')).authStore;
    
    // Reset window API mocks
    Object.values(mockWindowApi.db).forEach(mock => mock.mockReset());
    
    // Reset global mocks
    delete global._mockGetChromeProfiles;
    delete global._mockDeleteChromeProfile;
    delete global._mockAuthStore;
    
    // Import the store after mocking
    const workspaceModule = await import('../workspaces.svelte.js');
    workspaceStore = workspaceModule.workspaceStore;
    
    // Reset store state
    workspaceStore.reset();
    
    // Inject mocks for testing
    workspaceStore._testInjectMocks({
      getChromeProfiles: mockGetChromeProfiles,
      deleteChromeProfile: mockDeleteChromeProfile,
      authStore: mockAuthStore
    });
  });

  test('should initialize with empty state', () => {
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isLoading).toBe(false);
    expect(workspaceStore.isInitialized).toBe(false);
    expect(workspaceStore.activeWorkspace).toBe(null);
  });

  test('should initialize with default workspace when no user logged in', async () => {
    // Mock no user logged in
    mockAuthStore.user = null;
    
    await workspaceStore.init();
    
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should initialize with workspaces from backend', async () => {
    // Mock user logged in
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.workspaces).toHaveLength(2);
    expect(workspaceStore.activeWorkspaceId).toBe('workspace1');
    expect(workspaceStore.activeWorkspace.name).toBe('Default Workspace');
    expect(workspaceStore.activeWorkspace.icon).toBe('DW');
    expect(workspaceStore.activeWorkspace.color).toBe('#4A90E2');
  });

  test('should restore last active workspace from SQLite', async () => {
    // Mock user logged in
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting
      .mockResolvedValueOnce({ success: false, value: [] }) // workspace apps for workspace1
      .mockResolvedValueOnce({ success: false, value: [] }) // workspace apps for workspace2
      .mockResolvedValueOnce({ success: true, value: 'workspace2' }); // active workspace
    
    await workspaceStore.init();
    
    expect(workspaceStore.activeWorkspaceId).toBe('workspace2');
    expect(workspaceStore.activeWorkspace.name).toBe('Test Workspace');
  });

  test('should handle init errors gracefully', async () => {
    // Mock user logged in
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    // Mock API error
    mockGetChromeProfiles.mockRejectedValue(new Error('Network error'));
    
    await workspaceStore.init();
    
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should create new workspace', async () => {
    // This would be handled by the backend API, but we can test the state update
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    
    await workspaceStore.init();
    
    const initialCount = workspaceStore.workspaces.length;
    
    // Simulate adding a new workspace by updating the mock and refreshing
    const newWorkspace = {
      id: 'workspace2',
      name: 'Test Workspace',
      customerId: 'customer2',
      userId: 'user123',
      status: 'active',
      createdAt: '2023-01-02',
      updatedAt: '2023-01-02'
    };
    
    // Update the mock to return the new workspace
    const updatedProfiles = [
      ...mockProfiles,
      newWorkspace
    ];
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: updatedProfiles
    });
    
    // Refresh to simulate the workspace being added from backend
    await workspaceStore.refresh();
    
    expect(workspaceStore.workspaces).toHaveLength(initialCount + 1);
    expect(workspaceStore.workspaces.find(w => w.name === 'Test Workspace')).toBeDefined();
  });

  test('should switch active workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Switch to workspace2
    await workspaceStore.setActiveWorkspace('workspace2');
    
    expect(workspaceStore.activeWorkspaceId).toBe('workspace2');
    expect(workspaceStore.activeWorkspace.name).toBe('Test Workspace');
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('active_workspace_id', 'workspace2');
  });

  test('should not switch to non-existent workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    
    await workspaceStore.init();
    
    const originalActiveId = workspaceStore.activeWorkspaceId;
    
    // Try to switch to non-existent workspace
    await workspaceStore.setActiveWorkspace('non-existent');
    
    // Should remain unchanged
    expect(workspaceStore.activeWorkspaceId).toBe(originalActiveId);
    expect(mockWindowApi.db.saveSetting).not.toHaveBeenCalled();
  });

  test('should delete workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockDeleteChromeProfile.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteProfileColor.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteSetting.mockResolvedValue({ success: true });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    const initialCount = workspaceStore.workspaces.length;
    
    // Delete workspace2
    const result = await workspaceStore.deleteWorkspace('workspace2');
    
    expect(result).toBe(true);
    expect(workspaceStore.workspaces).toHaveLength(initialCount - 1);
    expect(workspaceStore.workspaces.find(w => w.id === 'workspace2')).toBeUndefined();
    expect(mockDeleteChromeProfile).toHaveBeenCalledWith('workspace2');
    expect(mockWindowApi.db.deleteProfileColor).toHaveBeenCalledWith('workspace2');
    expect(mockWindowApi.db.deleteSetting).toHaveBeenCalledWith('workspace_apps_workspace2');
  });

  test('should handle delete workspace failure', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockDeleteChromeProfile.mockResolvedValue({ success: false, error: 'Delete failed' });
    
    await workspaceStore.init();
    
    const initialCount = workspaceStore.workspaces.length;
    
    // Try to delete workspace
    const result = await workspaceStore.deleteWorkspace('workspace1');
    
    expect(result).toBe(false);
    expect(workspaceStore.workspaces).toHaveLength(initialCount); // Should remain unchanged
  });

  test('should switch to remaining workspace when active workspace is deleted', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockDeleteChromeProfile.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteProfileColor.mockResolvedValue({ success: true });
    mockWindowApi.db.deleteSetting.mockResolvedValue({ success: true });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Switch to workspace2 (make it active)
    await workspaceStore.setActiveWorkspace('workspace2');
    expect(workspaceStore.activeWorkspaceId).toBe('workspace2');
    
    // Delete the active workspace
    await workspaceStore.deleteWorkspace('workspace2');
    
    // Should switch to remaining workspace
    expect(workspaceStore.activeWorkspaceId).toBe('workspace1');
    expect(workspaceStore.activeWorkspace.name).toBe('Default Workspace');
  });

  test('should add app to workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Add app to workspace
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).toContain('service1');
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('workspace_apps_workspace1', ['service1']);
  });

  test('should not add duplicate app to workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Add app twice
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).toHaveLength(1);
    expect(workspace.apps).toEqual(['service1']);
  });

  test('should remove app from workspace', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
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
    
    mockGetChromeProfiles.mockResolvedValue({
      success: true,
      data: mockProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    mockWindowApi.db.saveSetting.mockResolvedValue({ success: true });
    
    await workspaceStore.init();
    
    // Add app first
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    // Then remove app
    await workspaceStore.removeAppFromWorkspace('workspace1', 'service1');
    
    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).not.toContain('service1');
    expect(mockWindowApi.db.saveSetting).toHaveBeenCalledWith('workspace_apps_workspace1', []);
  });

  test('should refresh workspaces', async () => {
    // Setup initial workspaces
    mockAuthStore.user = { id: 'user123', email: 'test@example.com' };
    
    const initialProfiles = [
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
    
    const refreshedProfiles = [
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
        name: 'New Workspace',
        customerId: 'customer2',
        userId: 'user123',
        status: 'active',
        createdAt: '2023-01-02',
        updatedAt: '2023-01-02'
      }
    ];
    
    // Initial load
    mockGetChromeProfiles.mockResolvedValueOnce({
      success: true,
      data: initialProfiles
    });
    
    mockWindowApi.db.getProfileColor.mockResolvedValue({ success: true, color: '#4A90E2' });
    mockWindowApi.db.getSetting.mockResolvedValue({ success: false, value: [] });
    
    await workspaceStore.init();
    
    expect(workspaceStore.workspaces).toHaveLength(1);
    
    // Refresh with new data
    mockGetChromeProfiles.mockResolvedValueOnce({
      success: true,
      data: refreshedProfiles
    });
    
    await workspaceStore.refresh();
    
    expect(workspaceStore.workspaces).toHaveLength(2);
    expect(workspaceStore.workspaces.find(w => w.name === 'New Workspace')).toBeDefined();
  });
});
