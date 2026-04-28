// Bookmark Store - manages bookmarks per profile

function createBookmarkStore() {
    let bookmarks = $state({});  // { profileId: [bookmarks] }
    let isLoading = $state(false);

    return {
        get bookmarks() { return bookmarks; },
        get isLoading() { return isLoading; },

        // Load bookmarks for a profile
        async loadBookmarks(profileId) {
            if (!profileId) return;
            
            isLoading = true;
            try {
                const result = await window.api.db.getBookmarks(profileId);
                if (result.success) {
                    bookmarks = {
                        ...bookmarks,
                        [profileId]: result.bookmarks
                    };
                }
            } catch (error) {
                console.error('Failed to load bookmarks:', error);
            } finally {
                isLoading = false;
            }
        },

        // Check if URL is bookmarked
        async isBookmarked(profileId, url) {
            if (!profileId || !url) return false;
            
            try {
                const result = await window.api.db.isBookmarked(profileId, url);
                return result.success ? result.isBookmarked : false;
            } catch (error) {
                console.error('Failed to check bookmark:', error);
                return false;
            }
        },

        // Add bookmark
        async addBookmark(profileId, url, title, favicon) {
            if (!profileId || !url) return false;
            
            try {
                const result = await window.api.db.addBookmark(profileId, url, title, favicon);
                if (result.success) {
                    // Reload bookmarks for this profile
                    await this.loadBookmarks(profileId);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to add bookmark:', error);
                return false;
            }
        },

        // Remove bookmark
        async removeBookmark(profileId, url) {
            if (!profileId || !url) return false;
            
            try {
                const result = await window.api.db.removeBookmark(profileId, url);
                if (result.success) {
                    // Reload bookmarks for this profile
                    await this.loadBookmarks(profileId);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Failed to remove bookmark:', error);
                return false;
            }
        },

        // Toggle bookmark
        async toggleBookmark(profileId, url, title, favicon) {
            const isBookmarked = await this.isBookmarked(profileId, url);
            if (isBookmarked) {
                return await this.removeBookmark(profileId, url);
            } else {
                return await this.addBookmark(profileId, url, title, favicon);
            }
        },

        // Get bookmarks for a profile
        getProfileBookmarks(profileId) {
            return bookmarks[profileId] || [];
        }
    };
}

export const bookmarkStore = createBookmarkStore();
