import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestWorkspaceStore } from './test-stores.js';

// Mock the dependencies
vi.mock('../api/api.js', () => ({
  getChromeProfiles: vi.fn(),
  deleteChromeProfile: vi.fn()
}));

vi.mock('./auth.svelte.js', () => ({
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
    deleteSetting: vi.fn(),
    getDownloads: vi.fn()
  }
};

// Setup global window.api
Object.defineProperty(window, 'api', {
  value: mockWindowApi,
  writable: true
});

describe('Workspace Store', () => {
  let workspaceStore;

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceStore = createTestWorkspaceStore();
  });

  test('should initialize with empty state', () => {
    expect(workspaceStore.workspaces).toEqual([]);
    expect(workspaceStore.activeWorkspaceId).toBe(null);
    expect(workspaceStore.activeWorkspace).toBe(null);
    expect(workspaceStore.isLoading).toBe(false);
    expect(workspaceStore.isInitialized).toBe(false);
  });

  test('should initialize with default workspace when user is logged in', async () => {
    await workspaceStore.init();

    expect(workspaceStore.workspaces).toHaveLength(1);
    expect(workspaceStore.activeWorkspaceId).toBe('workspace1');
    expect(workspaceStore.activeWorkspace.name).toBe('Default Workspace');
    expect(workspaceStore.isInitialized).toBe(true);
    expect(workspaceStore.isLoading).toBe(false);
  });

  test('should create new workspace', async () => {
    await workspaceStore.init();
    const initialCount = workspaceStore.workspaces.length;

    await workspaceStore.refresh();

    expect(workspaceStore.workspaces).toHaveLength(initialCount + 1);
    expect(workspaceStore.workspaces.find(w => w.name.includes('Test Workspace'))).toBeDefined();
  });

  test('should switch active workspace', async () => {
    await workspaceStore.init();
    
    // Add a second workspace
    await workspaceStore.refresh();
    const secondWorkspace = workspaceStore.workspaces[1];

    // Switch to second workspace
    const result = await workspaceStore.setActiveWorkspace(secondWorkspace.id);

    expect(result).toBe(true);
    expect(workspaceStore.activeWorkspaceId).toBe(secondWorkspace.id);
    expect(workspaceStore.activeWorkspace.name).toBe(secondWorkspace.name);
  });

  test('should delete workspace', async () => {
    await workspaceStore.init();
    
    // Add a second workspace to delete
    await workspaceStore.refresh();
    const secondWorkspace = workspaceStore.workspaces[1];
    const initialCount = workspaceStore.workspaces.length;

    // Delete workspace
    const result = await workspaceStore.deleteWorkspace(secondWorkspace.id);

    expect(result).toBe(true);
    expect(workspaceStore.workspaces).toHaveLength(initialCount - 1);
    expect(workspaceStore.workspaces.find(w => w.id === secondWorkspace.id)).toBeUndefined();
  });

  test('should add app to workspace', async () => {
    await workspaceStore.init();

    // Add app to workspace
    const result = await workspaceStore.addAppToWorkspace('workspace1', 'service1');

    expect(result).toBe(true);
    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).toContain('service1');
  });

  test('should remove app from workspace', async () => {
    await workspaceStore.init();

    // Add app first
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    // Then remove app
    const result = await workspaceStore.removeAppFromWorkspace('workspace1', 'service1');

    expect(result).toBe(true);
    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).not.toContain('service1');
  });
});
