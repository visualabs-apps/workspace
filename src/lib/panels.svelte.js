// Panel state store for keyboard shortcuts
class PanelStore {
    isHistoryPanelOpen = $state(false);
    isBookmarkPanelOpen = $state(false);
    isDownloadPanelOpen = $state(false);

    openHistory() {
        this.isHistoryPanelOpen = true;
    }

    closeHistory() {
        this.isHistoryPanelOpen = false;
    }

    toggleHistory() {
        this.isHistoryPanelOpen = !this.isHistoryPanelOpen;
    }

    openBookmarks() {
        this.isBookmarkPanelOpen = true;
    }

    closeBookmarks() {
        this.isBookmarkPanelOpen = false;
    }

    toggleBookmarks() {
        this.isBookmarkPanelOpen = !this.isBookmarkPanelOpen;
    }

    openDownloads() {
        this.isDownloadPanelOpen = true;
    }

    closeDownloads() {
        this.isDownloadPanelOpen = false;
    }

    toggleDownloads() {
        this.isDownloadPanelOpen = !this.isDownloadPanelOpen;
    }
}

export const panelStore = new PanelStore();
