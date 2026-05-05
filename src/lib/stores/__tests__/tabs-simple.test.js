import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestTabStore } from './test-stores.js';

describe('Tab Store (Simple)', () => {
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

  test('should handle dragging state', () => {
    expect(tabStore.isAnyTabDragging).toBe(false);
    
    tabStore.setDragging(true);
    expect(tabStore.isAnyTabDragging).toBe(true);
    
    tabStore.setDragging(false);
    expect(tabStore.isAnyTabDragging).toBe(false);
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
  });
});
