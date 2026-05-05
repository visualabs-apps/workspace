import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestDownloadStore } from './test-stores.js';

describe('Download Store (Simple)', () => {
  let downloadStore;

  beforeEach(() => {
    vi.clearAllMocks();
    downloadStore = createTestDownloadStore();
  });

  test('should initialize with empty downloads', () => {
    expect(downloadStore.downloads).toEqual([]);
    expect(downloadStore.activeDownloads).toEqual([]);
    expect(downloadStore.completedDownloads).toEqual([]);
    expect(downloadStore.isDownloadPanelOpen).toBe(false);
    expect(downloadStore.isLoaded).toBe(false);
  });

  test('should add new download', () => {
    const downloadData = {
      filename: 'test-file.pdf',
      url: 'https://example.com/test-file.pdf',
      totalBytes: 1024000,
      state: 'pending'
    };

    const download = downloadStore.addMockDownload(downloadData);

    expect(download.filename).toBe('test-file.pdf');
    expect(download.url).toBe('https://example.com/test-file.pdf');
    expect(download.state).toBe('pending');
    expect(downloadStore.downloads).toHaveLength(1);
  });

  test('should update download progress', async () => {
    const download = downloadStore.addMockDownload({
      state: 'progressing',
      receivedBytes: 0
    });

    await downloadStore.updateDownload(download.id, {
      receivedBytes: 512000,
      totalBytes: 1024000,
      downloadSpeed: 1024,
      state: 'progressing'
    });

    const updatedDownload = downloadStore.getDownload(download.id);
    expect(updatedDownload.receivedBytes).toBe(512000);
    expect(updatedDownload.downloadSpeed).toBe(1024);
    expect(updatedDownload.state).toBe('progressing');
  });

  test('should complete download', async () => {
    const download = downloadStore.addMockDownload({
      state: 'progressing',
      receivedBytes: 512000
    });

    await downloadStore.updateDownload(download.id, {
      state: 'completed',
      savePath: '/downloads/test-file.pdf',
      endTime: Date.now(),
      receivedBytes: 1024000,
      fileExists: true
    });

    const completedDownload = downloadStore.getDownload(download.id);
    expect(completedDownload.state).toBe('completed');
    expect(completedDownload.savePath).toBe('/downloads/test-file.pdf');
    expect(completedDownload.fileExists).toBe(true);
    expect(downloadStore.completedDownloads).toHaveLength(1);
  });

  test('should handle download error', async () => {
    const download = downloadStore.addMockDownload({
      state: 'progressing'
    });

    await downloadStore.updateDownload(download.id, {
      state: 'failed',
      endTime: Date.now(),
      error: 'Network error'
    });

    const failedDownload = downloadStore.getDownload(download.id);
    expect(failedDownload.state).toBe('failed');
    expect(failedDownload.error).toBe('Network error');
  });

  test('should filter active downloads', () => {
    downloadStore.addMockDownload({ state: 'progressing' });
    downloadStore.addMockDownload({ state: 'completed' });
    downloadStore.addMockDownload({ state: 'paused' });
    downloadStore.addMockDownload({ state: 'failed' });

    const activeDownloads = downloadStore.activeDownloads;
    expect(activeDownloads).toHaveLength(2);
    expect(activeDownloads.every(d => d.state === 'progressing' || d.state === 'paused')).toBe(true);
  });

  test('should filter completed downloads', () => {
    downloadStore.addMockDownload({ state: 'progressing' });
    downloadStore.addMockDownload({ state: 'completed' });
    downloadStore.addMockDownload({ state: 'completed' });

    const completedDownloads = downloadStore.completedDownloads;
    expect(completedDownloads).toHaveLength(2);
    expect(completedDownloads.every(d => d.state === 'completed')).toBe(true);
  });

  test('should toggle download panel', () => {
    expect(downloadStore.isDownloadPanelOpen).toBe(false);
    
    downloadStore.toggleDownloadPanel();
    expect(downloadStore.isDownloadPanelOpen).toBe(true);
    
    downloadStore.toggleDownloadPanel();
    expect(downloadStore.isDownloadPanelOpen).toBe(false);
  });

  test('should open and close download panel', () => {
    downloadStore.openDownloadPanel();
    expect(downloadStore.isDownloadPanelOpen).toBe(true);
    
    downloadStore.closeDownloadPanel();
    expect(downloadStore.isDownloadPanelOpen).toBe(false);
  });

  test('should remove download', async () => {
    const download1 = downloadStore.addMockDownload({ filename: 'file1.pdf' });
    const download2 = downloadStore.addMockDownload({ filename: 'file2.pdf' });

    expect(downloadStore.downloads).toHaveLength(2);

    const result = await downloadStore.removeDownload(download1.id);

    expect(result).toBe(true);
    // Check that download1 is no longer in the array
    expect(downloadStore.downloads.find(d => d.id === download1.id)).toBeUndefined();
    // Check that download2 is still in the array
    expect(downloadStore.downloads.length).toBe(1);
    expect(downloadStore.downloads[0].filename).toBe('file2.pdf');
  });

  test('should clear completed downloads', async () => {
    downloadStore.addMockDownload({ state: 'completed', profileId: 'workspace1' });
    downloadStore.addMockDownload({ state: 'progressing', profileId: 'workspace1' });
    downloadStore.addMockDownload({ state: 'completed', profileId: 'workspace1' });
    downloadStore.addMockDownload({ state: 'completed', profileId: 'workspace2' });

    const result = await downloadStore.clearCompleted('workspace1');

    expect(result).toBe(true);
    expect(downloadStore.downloads).toHaveLength(2);
    expect(downloadStore.downloads.filter(d => d.profileId === 'workspace1' && d.state === 'completed')).toHaveLength(0);
  });

  test('should get download by ID', () => {
    const download = downloadStore.addMockDownload({ filename: 'test.pdf' });

    const found = downloadStore.getDownload(download.id);
    expect(found).toEqual(download);

    const notFound = downloadStore.getDownload('non-existent');
    expect(notFound).toBeUndefined();
  });
});
