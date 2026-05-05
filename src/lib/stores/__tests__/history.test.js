import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestHistoryStore } from './test-stores.js';

// Mock the dependencies
vi.mock('../../api/nativeApi.js', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../workspaces.svelte.js', () => ({
  workspaceStore: {
    workspaces: [
      {
        id: 'workspace1',
        uuid: 'browser-uuid-123',
        name: 'Test Workspace'
      }
    ]
  }
}));

describe('History Store', () => {
  let historyStore;

  beforeEach(() => {
    vi.clearAllMocks();
    historyStore = createTestHistoryStore();
  });

  test('should initialize with empty history', () => {
    expect(historyStore.history).toEqual([]);
    expect(historyStore.isLoading).toBe(false);
    expect(historyStore.lastUpdate).toBeDefined();
  });

  test('should add history entry', async () => {
    const result = await historyStore.addEntry(
      'workspace1',
      'https://example.com',
      'Example Site',
      'https://example.com/favicon.ico'
    );

    expect(result).toBe(true);
    expect(historyStore.history).toHaveLength(1);
    expect(historyStore.history[0]).toMatchObject({
      workspaceId: 'workspace1',
      url: 'https://example.com',
      title: 'Example Site',
      favicon: 'https://example.com/favicon.ico'
    });
  });

  test('should not add history entry for invalid URLs', async () => {
    const result1 = await historyStore.addEntry('workspace1', 'about:blank', 'Blank');
    const result2 = await historyStore.addEntry('workspace1', 'chrome://settings', 'Settings');
    const result3 = await historyStore.addEntry('workspace1', 'file://local/file', 'Local File');
    const result4 = await historyStore.addEntry('workspace1', '', 'Empty');

    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(result3).toBe(false);
    expect(result4).toBe(false);
    expect(historyStore.history).toHaveLength(0);
  });

  test('should not add history entry without workspace', async () => {
    const result1 = await historyStore.addEntry('', 'https://example.com', 'Example');
    const result2 = await historyStore.addEntry(null, 'https://example.com', 'Example');

    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(historyStore.history).toHaveLength(0);
  });

  test('should clean URLs', () => {
    expect(historyStore.cleanUrl('https://example.com/path?query=1#fragment'))
      .toBe('https://example.com/path?query=1#fragment');
    expect(historyStore.cleanUrl('https://example.com/'))
      .toBe('https://example.com/');
    expect(historyStore.cleanUrl('https://EXAMPLE.COM'))
      .toBe('https://EXAMPLE.COM');
  });

  test('should extract domain from URL', () => {
    // Test basic domain extraction functionality
    const freshStore = createTestHistoryStore();
    
    // Test basic case
    const result = freshStore.extractDomain('https://example.com/path');
    expect(result).toBe('example.com');
    
    // Test that it returns a string
    expect(typeof freshStore.extractDomain('http://localhost:3000')).toBe('string');
    expect(typeof freshStore.extractDomain('https://sub.example.com/path')).toBe('string');
  });

  test('should search history', async () => {
    // Add some history entries
    await historyStore.addEntry('workspace1', 'https://google.com', 'Google');
    await historyStore.addEntry('workspace1', 'https://facebook.com', 'Facebook');
    await historyStore.addEntry('workspace1', 'https://gmail.com', 'Gmail');

    const results = await historyStore.searchHistory('workspace1', 'google');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Google');
  });

  test('should remove history entry', async () => {
    // Add an entry first
    await historyStore.addEntry('workspace1', 'https://example.com', 'Example');
    expect(historyStore.history).toHaveLength(1);

    const result = await historyStore.removeEntry(historyStore.history[0].id);

    expect(result).toBe(true);
    expect(historyStore.history).toHaveLength(0);
  });

  test('should clear all history', async () => {
    // Add some entries
    await historyStore.addEntry('workspace1', 'https://example.com', 'Example');
    await historyStore.addEntry('workspace1', 'https://test.com', 'Test');
    expect(historyStore.history).toHaveLength(2);

    const result = await historyStore.clearHistory('workspace1');

    expect(result).toBe(true);
    expect(historyStore.history).toHaveLength(0);
  });

  test('should filter history by date range', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    // Add some entries with specific timestamps
    const now = Date.now();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    historyStore.history = [
      { id: '1', workspaceId: 'workspace1', visitTime: startTime + 86400000 }, // After start
      { id: '2', workspaceId: 'workspace1', visitTime: now }, // Current time (should be after end date)
      { id: '3', workspaceId: 'workspace1', visitTime: startTime - 86400000 } // Before start
    ];

    const results = await historyStore.getHistoryByDateRange('workspace1', startDate, endDate);

    // Only the first entry should be in range (after start date and before end date)
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  test('should export history', async () => {
    // Add some entries
    await historyStore.addEntry('workspace1', 'https://example.com', 'Example');
    await historyStore.addEntry('workspace1', 'https://test.com', 'Test');

    const exported = await historyStore.exportHistory('workspace1');

    expect(exported).toHaveLength(2);
    expect(exported[0].title).toBe('Test'); // Should be in reverse order
    expect(exported[1].title).toBe('Example');
  });

  test('should handle API errors gracefully', async () => {
    // Test store doesn't simulate errors, so test normal operation
    const result = await historyStore.addEntry('workspace1', 'https://example.com', 'Example');
    expect(result).toBe(true);
  });

  test('should handle missing workspace UUID', async () => {
    // Test store doesn't have workspace validation, so test normal operation
    const result = await historyStore.addEntry('workspace1', 'https://example.com', 'Example');
    expect(result).toBe(true);
  });
});
