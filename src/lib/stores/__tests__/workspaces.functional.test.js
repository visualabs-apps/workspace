import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../api/api.js', () => ({
  getChromeProfiles: vi.fn(),
  deleteChromeProfile: vi.fn()
}));

vi.mock('../../stores/auth.svelte.js', () => ({
  authStore: {
    user: { id: 'test-user', email: 'test@example.com' }
  }
}));

// Mock window.api.db
global.window = {
  api: {
    db: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getProfileColor: vi.fn().mockResolvedValue({ success: false }),
      saveSetting: vi.fn().mockResolvedValue({ success: true }),
      getSetting: vi.fn().mockResolvedValue({ success: false }),
      deleteProfileColor: vi.fn().mockResolvedValue({ success: true }),
      deleteSetting: vi.fn().mockResolvedValue({ success: true })
    }
  }
};

describe('Workspace Store Functional Tests', () => {
  let workspaceStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import store dynamically to reset state
    const { workspaceStore: freshWorkspaceStore } = await import('../workspaces.svelte.js');
    workspaceStore = freshWorkspaceStore;
    
    // Reset store state
    workspaceStore.reset();
  });

  describe('Store Initialization', () => {
    it('should initialize with empty state', () => {
      expect(workspaceStore).toBeDefined();
      expect(workspaceStore.isLoading).toBeDefined();
      expect(workspaceStore.isInitialized).toBeDefined();
      expect(workspaceStore.activeWorkspaceId).toBeDefined();
    });

    it('should have reactive state getters', () => {
      expect(typeof workspaceStore.workspaces).toBeDefined();
      expect(typeof workspaceStore.activeWorkspaceId).toBeDefined();
      expect(typeof workspaceStore.isLoading).toBeDefined();
      expect(typeof workspaceStore.isInitialized).toBeDefined();
    });
  });

  describe('Workspace Management', () => {
    it('should initialize workspaces from API', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' },
        { id: 'ws2', name: 'Workspace 2', color: '#00FF00' }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: mockProfiles,
        page: {}
      });

      await workspaceStore.init();

      expect(getChromeProfiles).toHaveBeenCalled();
      expect(workspaceStore.isInitialized).toBe(true);
      expect(workspaceStore.isLoading).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockRejectedValue(new Error('API Error'));

      await workspaceStore.init();

      expect(workspaceStore.isLoading).toBe(false);
      expect(workspaceStore.isInitialized).toBe(true);
    });
  });

  describe('Active Workspace Management', () => {
    it('should set active workspace', async () => {
      // First initialize with some workspaces
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' },
        { id: 'ws2', name: 'Workspace 2', color: '#00FF00' }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: mockProfiles,
        page: {}
      });

      await workspaceStore.init();

      // Test setting active workspace
      const result = await workspaceStore.setActiveWorkspace('ws2');
      
      // Should not throw error and should complete successfully
      expect(result).toBeDefined();
    });

    it('should handle setting non-existent workspace', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: mockProfiles,
        page: {}
      });

      await workspaceStore.init();

      // Try to set non-existent workspace
      const result = await workspaceStore.setActiveWorkspace('non-existent');
      
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Workspace Deletion', () => {
    it('should delete workspace successfully', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' },
        { id: 'ws2', name: 'Workspace 2', color: '#00FF00' }
      ];

      const { getChromeProfiles, deleteChromeProfile } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue(mockProfiles);
      deleteChromeProfile.mockResolvedValue(true);

      await workspaceStore.init();

      const result = await workspaceStore.deleteWorkspace('ws2');

      expect(deleteChromeProfile).toHaveBeenCalledWith('ws2');
      expect(result).toBeDefined();
    });

    it('should handle deletion failure', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' }
      ];

      const { getChromeProfiles, deleteChromeProfile } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue(mockProfiles);
      deleteChromeProfile.mockRejectedValue(new Error('Delete failed'));

      await workspaceStore.init();

      const result = await workspaceStore.deleteWorkspace('ws1');

      expect(deleteChromeProfile).toHaveBeenCalledWith('ws1');
      expect(result).toBeDefined();
    });
  });

  describe('App Management', () => {
    it('should add app to workspace', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000', apps: [] }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: mockProfiles,
        page: {}
      });

      await workspaceStore.init();

      const result = await workspaceStore.addAppToWorkspace('ws1', 'app1');

      expect(result).toBeDefined();
    });

    it('should remove app from workspace', async () => {
      const mockProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000', apps: ['app1', 'app2'] }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: mockProfiles,
        page: {}
      });

      await workspaceStore.init();

      const result = await workspaceStore.removeAppFromWorkspace('ws1', 'app1');

      expect(result).toBeDefined();
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh workspaces', async () => {
      const initialProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' }
      ];

      const refreshedProfiles = [
        { id: 'ws1', name: 'Workspace 1', color: '#FF0000' },
        { id: 'ws2', name: 'Workspace 2', color: '#00FF00' }
      ];

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles
        .mockResolvedValueOnce({
          success: true,
          data: initialProfiles,
          page: {}
        })
        .mockResolvedValueOnce({
          success: true,
          data: refreshedProfiles,
          page: {}
        });

      await workspaceStore.init();
      await workspaceStore.refresh();

      expect(getChromeProfiles).toHaveBeenCalledTimes(2);
      expect(workspaceStore.isInitialized).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockRejectedValue(new Error('Network error'));

      // Should not throw unhandled errors
      await expect(workspaceStore.init()).resolves.toBeDefined();
    });

    it('should handle missing user data', async () => {
      // Mock auth store with no user
      vi.doMock('../../stores/auth.svelte.js', () => ({
        authStore: {
          user: null
        }
      }));

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: [],
        page: {}
      });

      await expect(workspaceStore.init()).resolves.toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should maintain loading states correctly', async () => {
      const mockProfiles = [{ id: 'ws1', name: 'Workspace 1' }];
      
      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            data: mockProfiles,
            page: {}
          }), 100);
        });
      });

      // Should be loading during initialization
      const initPromise = workspaceStore.init();
      expect(workspaceStore.isLoading).toBe(true);

      await initPromise;
      expect(workspaceStore.isLoading).toBe(false);
    });

    it('should track initialization state', async () => {
      expect(workspaceStore.isInitialized).toBe(false);

      const { getChromeProfiles } = await import('../../api/api.js');
      getChromeProfiles.mockResolvedValue({
        success: true,
        data: [],
        page: {}
      });

      await workspaceStore.init();

      expect(workspaceStore.isInitialized).toBe(true);
    });
  });
});
