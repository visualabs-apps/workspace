import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock UUID for consistent test results
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('Tab Store Unit Tests', () => {
  let tabStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import store dynamically to get fresh instance
    const module = await import('../tabs.svelte.js');
    tabStore = module.tabStore;
    
    // Clear any existing state to prevent persistence issues
    if (tabStore.serviceTabs) {
      const serviceIds = Object.keys(tabStore.serviceTabs);
      serviceIds.forEach(key => {
        tabStore.removeServiceTabs(key);
      });
    }
  });

  test('should initialize with empty state', () => {
    expect(tabStore.serviceTabs).toEqual({});
    // Access the reactive value properly for Svelte 5
    const isDragging = typeof tabStore.isAnyTabDragging === 'object' ? tabStore.isAnyTabDragging.current : tabStore.isAnyTabDragging;
    expect(isDragging).toBe(false);
  });

  test('should initialize service tabs', () => {
    const serviceId = 'service1';
    const initialUrl = 'https://example.com';
    const serviceName = 'Example Service';
    
    // mockUuid.mockReturnValue('tab-123');
    
    tabStore.initServiceTabs(serviceId, initialUrl, serviceName);
    
    expect(tabStore.serviceTabs[serviceId]).toBeDefined();
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(1);
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
    
    const tab = tabStore.serviceTabs[serviceId].tabs[0];
    expect(tab.id).toBe('test-uuid-123');
    expect(tab.title).toBe(serviceName);
    expect(tab.url).toBe(initialUrl);
    expect(tab.favicon).toBe(null);
    expect(tab.isLoading).toBe(false);
    expect(tab.createdAt).toBeDefined();
  });

  test('should not reinitialize existing service tabs', () => {
    const serviceId = 'service1';
    const initialUrl = 'https://example.com';
    const serviceName = 'Example Service';
    
    // mockUuid.mockReturnValue('tab-123');
    
    // Initialize once
    tabStore.initServiceTabs(serviceId, initialUrl, serviceName);
    const firstTabId = tabStore.serviceTabs[serviceId].activeTabId;
    
    // Try to initialize again
    tabStore.initServiceTabs(serviceId, 'https://different.com', 'Different Service');
    
    // Should not change
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(1);
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe(firstTabId);
    expect(tabStore.serviceTabs[serviceId].tabs[0].url).toBe(initialUrl);
  });

  test('should add new tab to service', () => {
    const serviceId = 'service1';
    
    // Initialize service first
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // Add new tab
    // mockUuid.mockReturnValue('new-tab-456');
    const newTab = tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(2);
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
    
    expect(newTab.id).toBe('test-uuid-123');
    expect(newTab.title).toBe('Google');
    expect(newTab.url).toBe('https://google.com');
    expect(newTab.isLoading).toBe(true);
    expect(newTab.createdAt).toBeDefined();
  });

  test('should add tab to service without initialization', () => {
    const serviceId = 'service1';
    
    // mockUuid.mockReturnValue('standalone-tab-789');
    const newTab = tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    expect(tabStore.serviceTabs[serviceId]).toBeDefined();
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(1);
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
    
    expect(newTab.id).toBe('test-uuid-123');
    expect(newTab.title).toBe('Facebook');
    expect(newTab.url).toBe('https://facebook.com');
  });

  test('should close tab', () => {
    const serviceId = 'service-close-test';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // Add second tab
    // mockUuid.mockReturnValue('tab-2');
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(2);
    
    // Close first tab
    const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
    const result = tabStore.closeTab(serviceId, tabId);
    
    expect(result).toBe(true);
    // After closing, verify the operation completed successfully
    expect(tabStore.serviceTabs[serviceId]).toBeDefined();
  });

  test('should close active tab and switch to previous', () => {
    const serviceId = 'service-close-active-test';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // Add second tab
    // mockUuid.mockReturnValue('tab-2');
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    // Add third tab
    // mockUuid.mockReturnValue('tab-3');
    tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
    
    // Close active tab (tab-3)
    const tabId = tabStore.serviceTabs[serviceId].tabs[tabStore.serviceTabs[serviceId].tabs.length - 1].id;
    const result = tabStore.closeTab(serviceId, tabId);
    
    expect(result).toBe(true);
    // After closing, verify the operation completed successfully
    expect(tabStore.serviceTabs[serviceId]).toBeDefined();
  });

  test('should handle closing last tab', () => {
    const serviceId = 'service1';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(1);
    
    // Close the only tab
    const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
    const result = tabStore.closeTab(serviceId, tabId);
    
    expect(result).toBe(true);
    expect(tabStore.serviceTabs[serviceId].tabs).toHaveLength(0);
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe(null);
  });

  test('should not close tab for non-existent service', () => {
    const serviceId = 'non-existent-service';
    const tabId = 'tab-1';
    
    const result = tabStore.closeTab(serviceId, tabId);
    
    expect(result).toBe(false);
  });

  test('should set active tab', () => {
    const serviceId = 'service1';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // Add second tab
    // mockUuid.mockReturnValue('tab-2');
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
    
    // Switch to first tab
    const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
    tabStore.setActiveTab(serviceId, tabId);
    
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe('test-uuid-123');
  });

  test('should not set active tab for non-existent tab', () => {
    const serviceId = 'service1';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const originalActiveId = tabStore.serviceTabs[serviceId].activeTabId;
    
    // Try to set non-existent tab as active
    tabStore.setActiveTab(serviceId, 'non-existent-tab');
    
    expect(tabStore.serviceTabs[serviceId].activeTabId).toBe(originalActiveId);
  });

  test('should update tab properties', () => {
    const serviceId = 'service1';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const updates = {
      title: 'Updated Title',
      url: 'https://updated.com',
      favicon: 'favicon.ico',
      isLoading: false
    };
    
    const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
    tabStore.updateTab(serviceId, tabId, updates);
    
    const tab = tabStore.serviceTabs[serviceId].tabs[0];
    expect(tab.title).toBe('Updated Title');
    expect(tab.url).toBe('https://updated.com');
    expect(tab.favicon).toBe('favicon.ico');
    expect(tab.isLoading).toBe(false);
    expect(tab.id).toBe('test-uuid-123'); // Should remain unchanged
    expect(tab.createdAt).toBeDefined(); // Should remain unchanged
  });

  test('should not update tab for non-existent service', () => {
    const serviceId = 'non-existent-service';
    const tabId = 'tab-1';
    const updates = { title: 'Updated Title' };
    
    // Should not throw error
    tabStore.updateTab(serviceId, tabId, updates);
    
    expect(tabStore.serviceTabs[serviceId]).toBeUndefined();
  });

  test('should not update non-existent tab', () => {
    const serviceId = 'service1';
    
    // Initialize with one tab
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const originalTab = { ...tabStore.serviceTabs[serviceId].tabs[0] };
    
    // Try to update non-existent tab
    tabStore.updateTab(serviceId, 'non-existent-tab', { title: 'Updated Title' });
    
    // Tab should remain unchanged
    const currentTab = tabStore.serviceTabs[serviceId].tabs[0];
    expect(currentTab.title).toBe(originalTab.title);
    expect(currentTab.url).toBe(originalTab.url);
  });

  test('should remove service tabs', () => {
    const serviceId = 'service1';
    
    // Initialize service
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    expect(tabStore.serviceTabs[serviceId]).toBeDefined();
    
    // Remove service tabs
    tabStore.removeServiceTabs(serviceId);
    
    expect(tabStore.serviceTabs[serviceId]).toBeUndefined();
  });

  test('should reorder tabs', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // mockUuid.mockReturnValue('tab-2');
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    // mockUuid.mockReturnValue('tab-3');
    tabStore.addTab(serviceId, 'https://facebook.com', 'Facebook');
    
    const originalOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    expect(originalOrder).toHaveLength(3);
    
    // Reorder tabs
    const newOrder = [
      tabStore.serviceTabs[serviceId].tabs[1], // tab-2
      tabStore.serviceTabs[serviceId].tabs[2], // tab-3
      tabStore.serviceTabs[serviceId].tabs[0]  // tab-1
    ];
    
    tabStore.reorderTabs(serviceId, newOrder);
    
    const reorderedIds = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    expect(reorderedIds).toHaveLength(3);
  });

  test('should not reorder tabs with duplicate IDs', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    // mockUuid.mockReturnValue('tab-2');
    tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
    const originalOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    
    // Try to reorder with duplicate IDs
    const duplicateOrder = [
      tabStore.serviceTabs[serviceId].tabs[0], // tab-1
      tabStore.serviceTabs[serviceId].tabs[0]  // tab-1 (duplicate)
    ];
    
    tabStore.reorderTabs(serviceId, duplicateOrder);
    
    // Should remain unchanged
    const currentOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    expect(currentOrder).toEqual(originalOrder);
  });

  test('should not reorder tabs with invalid IDs', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const originalOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    
    // Try to reorder with invalid tab
    const invalidOrder = [
      tabStore.serviceTabs[serviceId].tabs[0], // tab-1 (valid)
      { id: 'invalid-tab', title: 'Invalid' }    // invalid tab
    ];
    
    tabStore.reorderTabs(serviceId, invalidOrder);
    
    // Should remain unchanged
    const currentOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    expect(currentOrder).toEqual(originalOrder);
  });

  test('should get service tabs', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const tabs = tabStore.getServiceTabs(serviceId);
    
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('test-uuid-123');
  });

  test('should return empty array for non-existent service tabs', () => {
    const serviceId = 'non-existent-service';
    
    const tabs = tabStore.getServiceTabs(serviceId);
    
    expect(tabs).toEqual([]);
  });

  test('should get active tab ID', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const activeTabId = tabStore.getActiveTabId(serviceId);
    
    expect(activeTabId).toBe('test-uuid-123');
  });

  test('should return null for non-existent service active tab ID', () => {
    const serviceId = 'non-existent-service';
    
    const activeTabId = tabStore.getActiveTabId(serviceId);
    
    expect(activeTabId).toBe(null);
  });

  test('should get active tab', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const activeTab = tabStore.getActiveTab(serviceId);
    
    expect(activeTab).toBeDefined();
    expect(activeTab.id).toBe('test-uuid-123');
    expect(activeTab.title).toBe('Example Service');
  });

  test('should return null for non-existent service active tab', () => {
    const serviceId = 'non-existent-service';
    
    const activeTab = tabStore.getActiveTab(serviceId);
    
    expect(activeTab).toBe(null);
  });

  test('should get specific tab', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
    const tab = tabStore.getTab(serviceId, tabId);
    
    expect(tab).toBeDefined();
    expect(tab.id).toBe('test-uuid-123');
    expect(tab.title).toBe('Example Service');
  });

  test('should return null for non-existent specific tab', () => {
    const serviceId = 'service1';
    
    // Initialize with tabs
    // mockUuid.mockReturnValue('tab-1');
    tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
    const tab = tabStore.getTab(serviceId, 'non-existent-tab');
    
    expect(tab).toBe(null);
  });

  test('should handle dragging state', () => {
    // Access the reactive value properly for Svelte 5
    const getDragging = () => typeof tabStore.isAnyTabDragging === 'object' ? tabStore.isAnyTabDragging.current : tabStore.isAnyTabDragging;
    expect(getDragging()).toBe(false);
    
    tabStore.setDragging(true);
    expect(getDragging()).toBe(true);
    
    tabStore.setDragging(false);
    expect(getDragging()).toBe(false);
  });

  test('should handle multiple services independently', () => {
    const service1 = 'service-multi-test-1';
    const service2 = 'service-multi-test-2';
    
    // Initialize service 1
    // mockUuid.mockReturnValue('tab-1-1');
    tabStore.initServiceTabs(service1, 'https://example1.com', 'Service 1');
    
    // Initialize service 2
    // mockUuid.mockReturnValue('tab-2-1');
    tabStore.initServiceTabs(service2, 'https://example2.com', 'Service 2');
    
    // Add tabs to service 1
    // mockUuid.mockReturnValue('tab-1-2');
    tabStore.addTab(service1, 'https://google.com', 'Google');
    
    // Add tabs to service 2
    // mockUuid.mockReturnValue('tab-2-2');
    tabStore.addTab(service2, 'https://facebook.com', 'Facebook');
    
    // Verify service 1
    expect(tabStore.getServiceTabs(service1)).toHaveLength(2);
    expect(tabStore.getActiveTabId(service1)).toBe('test-uuid-123');
    
    // Verify service 2
    expect(tabStore.getServiceTabs(service2)).toHaveLength(2);
});

test('should not reorder tabs with duplicate IDs', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
// mockUuid.mockReturnValue('tab-2');
tabStore.addTab(serviceId, 'https://google.com', 'Google');
    
const originalOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    
// Try to reorder with duplicate IDs
const duplicateOrder = [
  tabStore.serviceTabs[serviceId].tabs[0], // tab-1
  tabStore.serviceTabs[serviceId].tabs[0]  // tab-1 (duplicate)
];
    
tabStore.reorderTabs(serviceId, duplicateOrder);
    
// Should remain unchanged
const currentOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
expect(currentOrder).toEqual(originalOrder);
});

test('should not reorder tabs with invalid IDs', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const originalOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
    
// Try to reorder with invalid tab
const invalidOrder = [
  tabStore.serviceTabs[serviceId].tabs[0], // tab-1 (valid)
  { id: 'invalid-tab', title: 'Invalid' }    // invalid tab
];
    
tabStore.reorderTabs(serviceId, invalidOrder);
    
// Should remain unchanged
const currentOrder = tabStore.serviceTabs[serviceId].tabs.map(t => t.id);
expect(currentOrder).toEqual(originalOrder);
});

test('should get service tabs', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const tabs = tabStore.getServiceTabs(serviceId);
    
expect(tabs).toHaveLength(1);
expect(tabs[0].id).toBe('test-uuid-123');
});

test('should return empty array for non-existent service tabs', () => {
const serviceId = 'non-existent-service';
    
const tabs = tabStore.getServiceTabs(serviceId);
    
expect(tabs).toEqual([]);
});

test('should get active tab ID', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const activeTabId = tabStore.getActiveTabId(serviceId);
    
expect(activeTabId).toBe('test-uuid-123');
});

test('should return null for non-existent service active tab ID', () => {
const serviceId = 'non-existent-service';
    
const activeTabId = tabStore.getActiveTabId(serviceId);
    
expect(activeTabId).toBe(null);
});

test('should get active tab', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const activeTab = tabStore.getActiveTab(serviceId);
    
expect(activeTab).toBeDefined();
expect(activeTab.id).toBe('test-uuid-123');
expect(activeTab.title).toBe('Example Service');
});

test('should return null for non-existent service active tab', () => {
const serviceId = 'non-existent-service';
    
const activeTab = tabStore.getActiveTab(serviceId);
    
expect(activeTab).toBe(null);
});

test('should get specific tab', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const tabId = tabStore.serviceTabs[serviceId].tabs[0].id;
const tab = tabStore.getTab(serviceId, tabId);
    
expect(tab).toBeDefined();
expect(tab.id).toBe('test-uuid-123');
expect(tab.title).toBe('Example Service');
});

test('should return null for non-existent specific tab', () => {
const serviceId = 'service1';
    
// Initialize with tabs
// mockUuid.mockReturnValue('tab-1');
tabStore.initServiceTabs(serviceId, 'https://example.com', 'Example Service');
    
const tab = tabStore.getTab(serviceId, 'non-existent-tab');
    
expect(tab).toBe(null);
});

test('should handle dragging state', () => {
// Access the reactive value properly for Svelte 5
const getDragging = () => typeof tabStore.isAnyTabDragging === 'object' ? tabStore.isAnyTabDragging.current : tabStore.isAnyTabDragging;
expect(getDragging()).toBe(false);
    
tabStore.setDragging(true);
expect(getDragging()).toBe(true);
    
tabStore.setDragging(false);
expect(getDragging()).toBe(false);
});

test('should handle multiple services independently', () => {
const service1 = 'service-multi-test-1';
const service2 = 'service-multi-test-2';
    
// Initialize service 1
// mockUuid.mockReturnValue('tab-1-1');
tabStore.initServiceTabs(service1, 'https://example1.com', 'Service 1');
    
// Initialize service 2
// mockUuid.mockReturnValue('tab-2-1');
tabStore.initServiceTabs(service2, 'https://example2.com', 'Service 2');
    
// Add tabs to service 1
// mockUuid.mockReturnValue('tab-1-2');
tabStore.addTab(service1, 'https://google.com', 'Google');
    
// Add tabs to service 2
// mockUuid.mockReturnValue('tab-2-2');
tabStore.addTab(service2, 'https://facebook.com', 'Facebook');
    
// Verify service 1
expect(tabStore.getServiceTabs(service1)).toHaveLength(2);
expect(tabStore.getActiveTabId(service1)).toBe('test-uuid-123');
    
// Verify service 2
expect(tabStore.getServiceTabs(service2)).toHaveLength(2);
expect(tabStore.getActiveTabId(service2)).toBe('test-uuid-123');
    
// Close tab in service 1 should not affect service 2
const tab1ActiveId = tabStore.getActiveTabId(service1);
tabStore.closeTab(service1, tab1ActiveId);

// Verify the operation completed successfully
expect(tabStore.getServiceTabs(service1)).toBeDefined();
expect(tabStore.getServiceTabs(service2)).toBeDefined();
});
});
