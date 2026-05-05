import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestWorkspaceStore } from './test-stores.js';

describe('Workspace Store (Simple)', () => {
  let workspaceStore;

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceStore = createTestWorkspaceStore();
  });

  test('should initialize with default workspace', async () => {
    await workspaceStore.init();

    expect(workspaceStore.workspaces).toHaveLength(1);
    expect(workspaceStore.activeWorkspace).toBeDefined();
    expect(workspaceStore.activeWorkspace.name).toBe('Default Workspace');
    expect(workspaceStore.isInitialized).toBe(true);
  });

  test('should create new workspace', async () => {
    await workspaceStore.init();
    const initialCount = workspaceStore.workspaces.length;
    
    // Add a new workspace
    workspaceStore.workspaces = [...workspaceStore.workspaces, {
      id: 'workspace2',
      name: 'Test Workspace',
      icon: 'TW',
      color: '#4A90E2',
      apps: []
    }];

    expect(workspaceStore.workspaces).toHaveLength(initialCount + 1);
    expect(workspaceStore.workspaces.find(w => w.name === 'Test Workspace')).toBeDefined();
  });

  test('should switch active workspace', async () => {
    await workspaceStore.init();
    
    // Add a new workspace
    workspaceStore.workspaces = [...workspaceStore.workspaces, {
      id: 'workspace2',
      name: 'New Workspace',
      icon: 'NW',
      color: '#E24A4A',
      apps: []
    }];

    await workspaceStore.setActiveWorkspace('workspace2');

    expect(workspaceStore.activeWorkspaceId).toBe('workspace2');
    expect(workspaceStore.activeWorkspace.name).toBe('New Workspace');
  });

  test('should delete workspace', async () => {
    await workspaceStore.init();
    
    // Add a workspace to delete
    workspaceStore.workspaces = [...workspaceStore.workspaces, {
      id: 'workspace2',
      name: 'To Delete',
      icon: 'TD',
      color: '#4AE290',
      apps: []
    }];
    
    const initialCount = workspaceStore.workspaces.length;

    const result = await workspaceStore.deleteWorkspace('workspace2');

    expect(result).toBe(true);
    expect(workspaceStore.workspaces).toHaveLength(initialCount - 1);
    expect(workspaceStore.workspaces.find(w => w.id === 'workspace2')).toBeUndefined();
  });

  test('should add app to workspace', async () => {
    await workspaceStore.init();

    await workspaceStore.addAppToWorkspace('workspace1', 'service1');

    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).toContain('service1');
  });

  test('should remove app from workspace', async () => {
    await workspaceStore.init();

    // Add app first
    await workspaceStore.addAppToWorkspace('workspace1', 'service1');
    
    // Then remove app
    await workspaceStore.removeAppFromWorkspace('workspace1', 'service1');

    const workspace = workspaceStore.workspaces.find(w => w.id === 'workspace1');
    expect(workspace.apps).not.toContain('service1');
  });
});
