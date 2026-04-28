/**
 * Components Index
 * 
 * Central export file untuk semua components.
 * Gunakan file ini untuk import yang lebih clean.
 * 
 * Example:
 * import { Button, BaseWindow, HistoryPanel } from './components';
 */

// Base Components
export { default as BaseWindow } from './base/BaseWindow.svelte';
export { default as SidePanel } from './base/SidePanel.svelte';

// UI Components
export { default as Badge } from './ui/Badge.svelte';
export { default as Button } from './ui/Button.svelte';
export { default as IconButton } from './ui/IconButton.svelte';
export { default as ListItem } from './ui/ListItem.svelte';
export { default as SearchInput } from './ui/SearchInput.svelte';
export { default as Toast } from './ui/Toast.svelte';
export { default as OfflineWarning } from './ui/OfflineWarning.svelte';

// Window Components
export { default as TodoWindow } from './windows/TodoWindow.svelte';
export { default as SettingsWindow } from './windows/SettingsWindow.svelte';
export { default as AddServiceWindow } from './windows/AddServiceWindow.svelte';
export { default as ProfileWindow } from './windows/ProfileWindow.svelte';
export { default as CookieManagerWindow } from './windows/CookieManagerWindow.svelte';

// Panel Components
export { default as BookmarkPanel } from './panels/BookmarkPanel.svelte';
export { default as DownloadManagerPanel } from './panels/DownloadManagerPanel.svelte';
export { default as DownloadPanel } from './panels/DownloadPanel.svelte';
export { default as HistoryPanel } from './panels/HistoryPanel.svelte';
export { default as NotificationPanel } from './panels/NotificationPanel.svelte';

// Dropdown Components
export { default as AutocompleteDropdown } from './dropdowns/AutocompleteDropdown.svelte';
export { default as Dropdown } from './dropdowns/Dropdown.svelte';
export { default as EmailSuggestionDropdown } from './dropdowns/EmailSuggestionDropdown.svelte';
export { default as ProfileDropdown } from './dropdowns/ProfileDropdown.svelte';

// Layout Components
export { default as Sidebar } from './layout/Sidebar.svelte';
export { default as SidebarHorizontal } from './layout/SidebarHorizontal.svelte';
export { default as TabBar } from './layout/TabBar.svelte';
export { default as TopToolbar } from './layout/TopToolbar.svelte';
export { default as WindowControls } from './layout/WindowControls.svelte';

// Feature Components
export { default as LoginPage } from './features/LoginPage.svelte';
export { default as ServiceView } from './features/ServiceView.svelte';
