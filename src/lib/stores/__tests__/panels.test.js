import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestPanelStore } from './test-stores.js';

describe('Panel Store', () => {
  let panelStore;

  beforeEach(() => {
    vi.clearAllMocks();
    panelStore = createTestPanelStore();
  });

  test('should initialize with default panels', () => {
    expect(panelStore.isHistoryPanelOpen).toBe(false);
    expect(panelStore.isBookmarkPanelOpen).toBe(false);
    expect(panelStore.isDownloadPanelOpen).toBe(false);
  });

  test('should open history panel', () => {
    panelStore.openHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(true);
  });

  test('should close history panel', () => {
    panelStore.isHistoryPanelOpen = true;
    panelStore.closeHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(false);
  });

  test('should toggle history panel', () => {
    // Test toggle from closed to open
    panelStore.isHistoryPanelOpen = false;
    panelStore.toggleHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(true);

    // Test toggle from open to closed
    panelStore.toggleHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(false);
  });

  test('should open bookmark panel', () => {
    panelStore.openBookmarks();
    expect(panelStore.isBookmarkPanelOpen).toBe(true);
  });

  test('should close bookmark panel', () => {
    panelStore.isBookmarkPanelOpen = true;
    panelStore.closeBookmarks();
    expect(panelStore.isBookmarkPanelOpen).toBe(false);
  });

  test('should toggle bookmark panel', () => {
    // Test toggle from closed to open
    panelStore.isBookmarkPanelOpen = false;
    panelStore.toggleBookmarks();
    expect(panelStore.isBookmarkPanelOpen).toBe(true);

    // Test toggle from open to closed
    panelStore.toggleBookmarks();
    expect(panelStore.isBookmarkPanelOpen).toBe(false);
  });

  test('should open download panel', () => {
    panelStore.openDownloads();
    expect(panelStore.isDownloadPanelOpen).toBe(true);
  });

  test('should close download panel', () => {
    panelStore.isDownloadPanelOpen = true;
    panelStore.closeDownloads();
    expect(panelStore.isDownloadPanelOpen).toBe(false);
  });

  test('should toggle download panel', () => {
    // Test toggle from closed to open
    panelStore.isDownloadPanelOpen = false;
    panelStore.toggleDownloads();
    expect(panelStore.isDownloadPanelOpen).toBe(true);

    // Test toggle from open to closed
    panelStore.toggleDownloads();
    expect(panelStore.isDownloadPanelOpen).toBe(false);
  });

  test('should handle multiple panels independently', () => {
    // Open all panels
    panelStore.openHistory();
    panelStore.openBookmarks();
    panelStore.openDownloads();

    expect(panelStore.isHistoryPanelOpen).toBe(true);
    expect(panelStore.isBookmarkPanelOpen).toBe(true);
    expect(panelStore.isDownloadPanelOpen).toBe(true);

    // Close one panel
    panelStore.closeBookmarks();

    expect(panelStore.isHistoryPanelOpen).toBe(true);
    expect(panelStore.isBookmarkPanelOpen).toBe(false);
    expect(panelStore.isDownloadPanelOpen).toBe(true);
  });

  test('should toggle panel independently', () => {
    // Open history panel
    panelStore.toggleHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(true);
    expect(panelStore.isBookmarkPanelOpen).toBe(false);
    expect(panelStore.isDownloadPanelOpen).toBe(false);

    // Open bookmark panel
    panelStore.toggleBookmarks();
    expect(panelStore.isHistoryPanelOpen).toBe(true);
    expect(panelStore.isBookmarkPanelOpen).toBe(true);
    expect(panelStore.isDownloadPanelOpen).toBe(false);

    // Close history panel
    panelStore.toggleHistory();
    expect(panelStore.isHistoryPanelOpen).toBe(false);
    expect(panelStore.isBookmarkPanelOpen).toBe(true);
    expect(panelStore.isDownloadPanelOpen).toBe(false);
  });
});
