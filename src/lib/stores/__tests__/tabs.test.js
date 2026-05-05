import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestTabStore } from './test-stores.js';

// Mock uuid
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `mock-uuid-${++uuidCounter}`)
}));

describe('Tab Store', () => {
  let tabStore;

  beforeEach(() => {
    vi.clearAllMocks();
    tabStore = createTestTabStore();
  });

  test('should initialize with empty tabs', () => {
    expect(tabStore.serviceTabs).toEqual({});
    expect(tabStore.isAnyTabDragging).toBe(false);
  });

  test('should add new tab', () => {
    const serviceId = 'service1';
    const url = 'https://google.com';
    const title = 'Google';
    
    const newTab = tabStore.addTab(serviceId, url, title);
    
    expect(newTab.id).toMatch(/^mock-uuid-\d+-[a-z0-9]+$/);
    expect(newTab.title).toBe(title);
    expect(newTab.url).toBe(url);
    expect(newTab.isLoading).toBe(true);
    
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(1);
    expect(tabStore.getActiveTabId(serviceId)).toBe(newTab.id);
    expect(tabStore.getActiveTab(serviceId)).toEqual(newTab);
  });

  test('should close tab', () => {
    const serviceId = 'service1';
    
    // Add a tab first
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(2);
    
    // Close the first tab
    const result = tabStore.closeTab(serviceId, tab1.id);
    
    expect(result).toBe(true);
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(1);
    expect(tabStore.getServiceTabs(serviceId)[0].id).toBe(tab2.id);
    expect(tabStore.getActiveTabId(serviceId)).toBe(tab2.id);
  });

  test('should switch active tab', () => {
    const serviceId = 'service1';
    
    // Add multiple tabs
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    // Initially tab2 should be active (last added)
    expect(tabStore.getActiveTabId(serviceId)).toBe(tab2.id);
    
    // Switch to tab1
    tabStore.setActiveTab(serviceId, tab1.id);
    
    expect(tabStore.getActiveTabId(serviceId)).toBe(tab1.id);
    expect(tabStore.getActiveTab(serviceId)).toEqual(tab1);
  });

  test('should not close last tab', () => {
    const serviceId = 'service1';
    
    // Add a single tab
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(1);
    
    // Try to close the only tab
    const result = tabStore.closeTab(serviceId, tab1.id);
    
    expect(result).toBe(true);
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(0);
    expect(tabStore.getActiveTabId(serviceId)).toBe(null);
    expect(tabStore.getActiveTab(serviceId)).toBe(null);
  });

  test('should initialize service tabs', () => {
    const serviceId = 'service1';
    const initialUrl = 'https://example.com';
    const serviceName = 'Example Service';
    
    tabStore.initServiceTabs(serviceId, initialUrl, serviceName);
    
    const tabs = tabStore.getServiceTabs(serviceId);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe(serviceName);
    expect(tabs[0].url).toBe(initialUrl);
    expect(tabs[0].isLoading).toBe(false);
    expect(tabStore.getActiveTabId(serviceId)).toBe(tabs[0].id);
  });

  test('should not initialize service tabs if already exists', () => {
    const serviceId = 'service1';
    
    // Initialize once
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Service 1');
    const firstTabs = tabStore.getServiceTabs(serviceId);
    
    // Try to initialize again
    tabStore.initServiceTabs(serviceId, 'https://different.com', 'Service 2');
    const secondTabs = tabStore.getServiceTabs(serviceId);
    
    // Should still have the first tabs
    expect(secondTabs).toEqual(firstTabs);
    expect(secondTabs[0].title).toBe('Service 1');
    expect(secondTabs[0].url).toBe('https://example.com');
  });

  test('should update tab properties', () => {
    const serviceId = 'service1';
    
    const tab = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    const updates = {
      title: 'Updated Google',
      url: 'https://updated.google.com',
      favicon: 'https://google.com/favicon.ico',
      isLoading: false
    };
    
    tabStore.updateTab(serviceId, tab.id, updates);
    
    const updatedTab = tabStore.getTab(serviceId, tab.id);
    expect(updatedTab.title).toBe(updates.title);
    expect(updatedTab.url).toBe(updates.url);
    expect(updatedTab.favicon).toBe(updates.favicon);
    expect(updatedTab.isLoading).toBe(updates.isLoading);
  });

  test('should remove service tabs', () => {
    const serviceId = 'service1';
    
    // Add tabs
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(2);
    
    // Remove all tabs for the service
    tabStore.removeServiceTabs(serviceId);
    
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(0);
    expect(tabStore.getActiveTabId(serviceId)).toBe(null);
  });

  test('should reorder tabs', () => {
    const serviceId = 'service1';
    
    // Add multiple tabs
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    const tab3 = tabStore.addTab(serviceId, 'https://twitter.com', 'Twitter');
    
    // Get current order
    const currentTabs = tabStore.getServiceTabs(serviceId);
    expect(currentTabs.map(t => t.id)).toEqual([tab1.id, tab2.id, tab3.id]);
    
    // Reorder tabs
    const newOrder = [tab3, tab1, tab2];
    tabStore.reorderTabs(serviceId, newOrder);
    
    // Check new order
    const reorderedTabs = tabStore.getServiceTabs(serviceId);
    expect(reorderedTabs.map(t => t.id)).toEqual([tab3.id, tab1.id, tab2.id]);
  });

  test('should handle invalid reorder with duplicate IDs', () => {
    const serviceId = 'service1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Add tabs
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    // Try to reorder with duplicate IDs
    const invalidOrder = [tab1, tab1, tab2];
    tabStore.reorderTabs(serviceId, invalidOrder);
    
    // Should not change order
    const tabs = tabStore.getServiceTabs(serviceId);
    expect(tabs.map(t => t.id)).toEqual([tab1.id, tab2.id]);
    expect(consoleSpy).toHaveBeenCalledWith('Duplicate tab IDs detected in reorder, skipping');
    
    consoleSpy.mockRestore();
  });

  test('should handle invalid reorder with missing IDs', () => {
    const serviceId = 'service1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Add tabs
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    // Try to reorder with non-existent tab
    const invalidOrder = [tab1, { id: 'non-existent', title: 'Fake' }];
    tabStore.reorderTabs(serviceId, invalidOrder);
    
    // Should not change order
    const tabs = tabStore.getServiceTabs(serviceId);
    expect(tabs.map(t => t.id)).toEqual([tab1.id, tab2.id]);
    expect(consoleSpy).toHaveBeenCalledWith('Invalid tab IDs in reorder, skipping');
    
    consoleSpy.mockRestore();
  });

  test('should handle dragging state', () => {
    expect(tabStore.isAnyTabDragging).toBe(false);
    
    tabStore.setDragging(true);
    expect(tabStore.isAnyTabDragging).toBe(true);
    
    tabStore.setDragging(false);
    expect(tabStore.isAnyTabDragging).toBe(false);
  });

  test('should handle closing active tab by switching to previous', () => {
    const serviceId = 'service1';
    
    // Add multiple tabs
    const tab1 = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    const tab2 = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    const tab3 = tabStore.addTab(serviceId, 'https://twitter.com', 'Twitter');
    
    // tab3 should be active (last added)
    expect(tabStore.getActiveTabId(serviceId)).toBe(tab3.id);
    
    // Close active tab (tab3)
    tabStore.closeTab(serviceId, tab3.id);
    
    // Should switch to tab2 (previous)
    expect(tabStore.getActiveTabId(serviceId)).toBe(tab2.id);
    expect(tabStore.getServiceTabs(serviceId)).toHaveLength(2);
  });

  test('should handle operations on non-existent service', () => {
    const nonExistentService = 'non-existent';
    
    expect(tabStore.getServiceTabs(nonExistentService)).toEqual([]);
    expect(tabStore.getActiveTabId(nonExistentService)).toBe(null);
    expect(tabStore.getActiveTab(nonExistentService)).toBe(null);
    expect(tabStore.getTab(nonExistentService, 'any-id')).toBe(null);
    
    // These should not throw errors
    expect(() => tabStore.closeTab(nonExistentService, 'any-id')).not.toThrow();
    expect(() => tabStore.setActiveTab(nonExistentService, 'any-id')).not.toThrow();
    expect(() => tabStore.updateTab(nonExistentService, 'any-id', {})).not.toThrow();
    expect(() => tabStore.reorderTabs(nonExistentService, [])).not.toThrow();
  });
});
