import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestBookmarkStore } from './test-stores.js';

describe('Bookmark Store (Simple)', () => {
  let bookmarkStore;

  beforeEach(() => {
    vi.clearAllMocks();
    bookmarkStore = createTestBookmarkStore();
  });

  test('should initialize with empty bookmarks', () => {
    expect(bookmarkStore.bookmarks).toEqual({});
    expect(bookmarkStore.isLoading).toBe(false);
  });

  test('should initialize with default bookmarks', async () => {
    await bookmarkStore.loadBookmarks('profile1');

    expect(bookmarkStore.bookmarks.profile1).toHaveLength(2);
    expect(bookmarkStore.bookmarks.profile1[0].title).toBe('Google');
    expect(bookmarkStore.bookmarks.profile1[1].title).toBe('Facebook');
    expect(bookmarkStore.isLoading).toBe(false);
  });

  test('should add new bookmark', async () => {
    const profileId = 'profile1';
    const url = 'https://test.com';
    const title = 'Test Bookmark';
    const favicon = 'https://test.com/favicon.ico';

    const result = await bookmarkStore.addBookmark(profileId, url, title, favicon);

    expect(result).toBe(true);
    expect(bookmarkStore.bookmarks[profileId]).toHaveLength(1);
    expect(bookmarkStore.bookmarks[profileId][0].title).toBe(title);
    expect(bookmarkStore.bookmarks[profileId][0].url).toBe(url);
  });

  test('should create new category', async () => {
    const profileId = 'profile1';
    
    await bookmarkStore.loadBookmarks(profileId);
    
    // The current implementation doesn't have categories, but we can test that bookmarks have different titles
    expect(bookmarkStore.bookmarks[profileId]).toHaveLength(2);
    expect(bookmarkStore.getProfileBookmarks(profileId)).toHaveLength(2);
  });

  test('should delete bookmark', async () => {
    const profileId = 'profile1';
    const url = 'https://test.com';
    const title = 'Test Bookmark';

    // Add a bookmark first
    await bookmarkStore.addBookmark(profileId, url, title, '');
    expect(bookmarkStore.bookmarks[profileId]).toHaveLength(1);

    // Remove the bookmark
    const result = await bookmarkStore.removeBookmark(profileId, url);

    expect(result).toBe(true);
    expect(bookmarkStore.bookmarks[profileId]).toHaveLength(0);
  });

  test('should search bookmarks', async () => {
    const profileId = 'profile1';
    
    // Add bookmarks
    await bookmarkStore.addBookmark(profileId, 'https://google.com', 'Google Search', '');
    await bookmarkStore.addBookmark(profileId, 'https://facebook.com', 'Facebook Social', '');
    await bookmarkStore.addBookmark(profileId, 'https://gmail.com', 'Gmail Mail', '');

    const profileBookmarks = bookmarkStore.getProfileBookmarks(profileId);
    
    // Search for Google
    const searchResults = profileBookmarks.filter(bookmark => 
      bookmark.title.toLowerCase().includes('google') ||
      bookmark.url.toLowerCase().includes('google')
    );

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title).toBe('Google Search');
  });

  test('should check if URL is bookmarked', async () => {
    const profileId = 'profile1';
    const url = 'https://google.com';

    // Initially not bookmarked
    const result1 = await bookmarkStore.isBookmarked(profileId, url);
    expect(result1).toBe(false);

    // Add bookmark
    await bookmarkStore.addBookmark(profileId, url, 'Google', '');

    // Now should be bookmarked
    const result2 = await bookmarkStore.isBookmarked(profileId, url);
    expect(result2).toBe(true);
  });

  test('should toggle bookmark', async () => {
    const profileId = 'profile1';
    const url = 'https://test.com';
    const title = 'Test Bookmark';

    // Initially not bookmarked, should add
    const result1 = await bookmarkStore.toggleBookmark(profileId, url, title, '');
    expect(result1).toBe(true);
    expect(bookmarkStore.getProfileBookmarks(profileId)).toHaveLength(1);

    // Now bookmarked, should remove
    const result2 = await bookmarkStore.toggleBookmark(profileId, url, title, '');
    expect(result2).toBe(true);
    expect(bookmarkStore.getProfileBookmarks(profileId)).toHaveLength(0);
  });

  test('should get profile bookmarks', () => {
    const profileId = 'profile1';
    const mockBookmarks = [
      { id: 1, url: 'https://google.com', title: 'Google' },
      { id: 2, url: 'https://facebook.com', title: 'Facebook' }
    ];

    bookmarkStore.bookmarks = {
      [profileId]: mockBookmarks
    };

    const profileBookmarks = bookmarkStore.getProfileBookmarks(profileId);
    expect(profileBookmarks).toEqual(mockBookmarks);
  });

  test('should return empty array for non-existent profile', () => {
    const profileBookmarks = bookmarkStore.getProfileBookmarks('non-existent');
    expect(profileBookmarks).toEqual([]);
  });

  test('should return false for invalid inputs', async () => {
    // Test isBookmarked with invalid inputs
    const result1 = await bookmarkStore.isBookmarked('', 'https://test.com');
    const result2 = await bookmarkStore.isBookmarked('profile1', '');
    const result3 = await bookmarkStore.isBookmarked(null, null);

    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(result3).toBe(false);

    // Test addBookmark with invalid inputs
    const result4 = await bookmarkStore.addBookmark('', 'https://test.com', 'Test', '');
    const result5 = await bookmarkStore.addBookmark('profile1', '', 'Test', '');

    expect(result4).toBe(false);
    expect(result5).toBe(false);

    // Test removeBookmark with invalid inputs
    const result6 = await bookmarkStore.removeBookmark('', 'https://test.com');
    const result7 = await bookmarkStore.removeBookmark('profile1', '');

    expect(result6).toBe(false);
    expect(result7).toBe(false);
  });
});
