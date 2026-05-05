/**
 * Tab Lifetime Manager Tests
 * Tests for automatic unloading of inactive services/tabs to save memory
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tabLifetimeManager } from '../tabLifetime.svelte.js';

describe('Tab Lifetime Manager', () => {
  beforeEach(() => {
    // Reset manager state before each test
    tabLifetimeManager.serviceLastActive.clear();
    tabLifetimeManager.stopChecking();
    tabLifetimeManager.enabled = true;
    tabLifetimeManager.lifetimeMinutes = 30;
    tabLifetimeManager.onUnloadCallback = null;
    
    // Mock window.api.settings
    global.window = {
      api: {
        settings: {
          getTabLifetime: vi.fn()
        }
      }
    };
  });

  afterEach(() => {
    tabLifetimeManager.stopChecking();
    vi.clearAllMocks();
  });

  test('should initialize with default settings', async () => {
    // Mock successful settings load
    window.api.settings.getTabLifetime.mockResolvedValue({
      success: true,
      minutes: 45
    });

    await tabLifetimeManager.init();

    expect(tabLifetimeManager.enabled).toBe(true);
    expect(tabLifetimeManager.lifetimeMinutes).toBe(45);
    expect(tabLifetimeManager.checkInterval).not.toBeNull();
  });

  test('should handle settings load failure gracefully', async () => {
    // Mock settings load failure
    window.api.settings.getTabLifetime.mockRejectedValue(new Error('Settings error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await tabLifetimeManager.init();

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load tab lifetime setting:', expect.any(Error));
    expect(tabLifetimeManager.enabled).toBe(true);
    expect(tabLifetimeManager.lifetimeMinutes).toBe(30); // Default value
    
    consoleSpy.mockRestore();
  });

  test('should set lifetime to custom minutes', () => {
    tabLifetimeManager.setLifetime(60);
    
    expect(tabLifetimeManager.enabled).toBe(true);
    expect(tabLifetimeManager.lifetimeMinutes).toBe(60);
    expect(tabLifetimeManager.checkInterval).not.toBeNull();
  });

  test('should set lifetime to forever', () => {
    tabLifetimeManager.setLifetime('forever');
    
    expect(tabLifetimeManager.enabled).toBe(false);
    expect(tabLifetimeManager.checkInterval).not.toBeNull();
  });

  test('should mark service as active', () => {
    const serviceId = 'service1';
    const beforeTime = Date.now();
    
    tabLifetimeManager.markActive(serviceId);
    
    expect(tabLifetimeManager.serviceLastActive.has(serviceId)).toBe(true);
    expect(tabLifetimeManager.serviceLastActive.get(serviceId)).toBeGreaterThanOrEqual(beforeTime);
  });

  test('should remove service from tracking', () => {
    const serviceId = 'service1';
    tabLifetimeManager.markActive(serviceId);
    
    tabLifetimeManager.removeService(serviceId);
    
    expect(tabLifetimeManager.serviceLastActive.has(serviceId)).toBe(false);
  });

  test('should check and unload inactive services', () => {
    const mockCallback = vi.fn();
    tabLifetimeManager.onUnload(mockCallback);
    
    // Add service that should be unloaded (inactive for 60 minutes)
    const oldServiceId = 'oldService';
    const oldTime = Date.now() - (60 * 60 * 1000); // 60 minutes ago
    tabLifetimeManager.serviceLastActive.set(oldServiceId, oldTime);
    
    // Add service that should not be unloaded (active)
    const activeServiceId = 'activeService';
    const activeTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
    tabLifetimeManager.serviceLastActive.set(activeServiceId, activeTime);
    
    tabLifetimeManager.checkServices();
    
    expect(mockCallback).toHaveBeenCalledWith(oldServiceId);
    expect(mockCallback).not.toHaveBeenCalledWith(activeServiceId);
  });

  test('should not check services when disabled', () => {
    tabLifetimeManager.enabled = false;
    const mockCallback = vi.fn();
    tabLifetimeManager.onUnload(mockCallback);
    
    // Add an inactive service
    const serviceId = 'service1';
    const oldTime = Date.now() - (60 * 60 * 1000);
    tabLifetimeManager.serviceLastActive.set(serviceId, oldTime);
    
    tabLifetimeManager.checkServices();
    
    expect(mockCallback).not.toHaveBeenCalled();
  });

  test('should start and stop checking interval', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    expect(tabLifetimeManager.checkInterval).toBeNull();
    
    tabLifetimeManager.startChecking();
    expect(tabLifetimeManager.checkInterval).not.toBeNull();
    
    const intervalId = tabLifetimeManager.checkInterval;
    tabLifetimeManager.stopChecking();
    expect(tabLifetimeManager.checkInterval).toBeNull();
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    
    clearIntervalSpy.mockRestore();
  });

  test('should handle unload callback', () => {
    const mockCallback = vi.fn();
    tabLifetimeManager.onUnload(mockCallback);
    
    const serviceId = 'service1';
    const oldTime = Date.now() - (60 * 60 * 1000);
    tabLifetimeManager.serviceLastActive.set(serviceId, oldTime);
    
    tabLifetimeManager.checkServices();
    
    expect(mockCallback).toHaveBeenCalledWith(serviceId);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  test('should get inactive time for service', () => {
    const serviceId = 'service1';
    const activeTime = Date.now() - (30 * 1000); // 30 seconds ago
    
    tabLifetimeManager.markActive(serviceId);
    // Manually set to specific time for testing
    tabLifetimeManager.serviceLastActive.set(serviceId, activeTime);
    
    const inactiveTime = tabLifetimeManager.getInactiveTime(serviceId);
    
    expect(inactiveTime).toBeGreaterThanOrEqual(30);
    expect(inactiveTime).toBeLessThan(35); // Allow some tolerance
  });

  test('should return 0 for non-existent service inactive time', () => {
    const inactiveTime = tabLifetimeManager.getInactiveTime('nonExistent');
    expect(inactiveTime).toBe(0);
  });

  test('should check if service should be unloaded', () => {
    const serviceId = 'inactiveService';
    const oldTime = Date.now() - (60 * 60 * 1000); // 60 minutes ago
    tabLifetimeManager.serviceLastActive.set(serviceId, oldTime);
    
    expect(tabLifetimeManager.shouldUnload(serviceId)).toBe(true);
    
    const activeServiceId = 'activeService';
    const activeTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
    tabLifetimeManager.serviceLastActive.set(activeServiceId, activeTime);
    
    expect(tabLifetimeManager.shouldUnload(activeServiceId)).toBe(false);
  });

  test('should not unload when disabled', () => {
    tabLifetimeManager.enabled = false;
    const serviceId = 'service1';
    const oldTime = Date.now() - (60 * 60 * 1000);
    tabLifetimeManager.serviceLastActive.set(serviceId, oldTime);
    
    expect(tabLifetimeManager.shouldUnload(serviceId)).toBe(false);
  });

  test('should get debug status information', () => {
    // Add some test services
    tabLifetimeManager.markActive('service1');
    tabLifetimeManager.markActive('service2');
    
    // Manually set one service as old
    const oldTime = Date.now() - (60 * 60 * 1000);
    tabLifetimeManager.serviceLastActive.set('service2', oldTime);
    
    const debugStatus = tabLifetimeManager.getDebugStatus();
    
    expect(debugStatus).toHaveProperty('enabled');
    expect(debugStatus).toHaveProperty('lifetimeMinutes');
    expect(debugStatus).toHaveProperty('trackedServices');
    expect(debugStatus).toHaveProperty('services');
    
    expect(debugStatus.enabled).toBe(true);
    expect(debugStatus.lifetimeMinutes).toBe(30);
    expect(debugStatus.trackedServices).toBe(2);
    expect(debugStatus.services).toHaveLength(2);
    
    // Check service details
    const service1Info = debugStatus.services.find(s => s.serviceId === 'service1');
    expect(service1Info).toHaveProperty('serviceId');
    expect(service1Info).toHaveProperty('lastActive');
    expect(service1Info).toHaveProperty('inactiveSeconds');
    expect(service1Info).toHaveProperty('shouldUnload');
    expect(service1Info.shouldUnload).toBe(false);
    
    const service2Info = debugStatus.services.find(s => s.serviceId === 'service2');
    expect(service2Info.shouldUnload).toBe(true);
  });

  test('should adjust check interval based on lifetime', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    
    // Test short lifetime (< 5 minutes)
    tabLifetimeManager.setLifetime(3);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 1000);
    
    // Test long lifetime (>= 5 minutes)
    tabLifetimeManager.setLifetime(10);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 1000);
    
    setIntervalSpy.mockRestore();
  });

  test('should restart checking when lifetime changes', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    
    // Start initial checking
    tabLifetimeManager.startChecking();
    const firstInterval = tabLifetimeManager.checkInterval;
    
    // Change lifetime
    tabLifetimeManager.setLifetime(45);
    
    expect(clearIntervalSpy).toHaveBeenCalledWith(firstInterval);
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(tabLifetimeManager.checkInterval).not.toBe(firstInterval);
    
    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });
});
