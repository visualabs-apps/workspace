# Lib Structure

Struktur folder lib yang terorganisir untuk memudahkan maintenance dan development.

## 📁 Struktur Folder

```
lib/
├── stores/              # State management stores (Svelte 5 Runes)
│   ├── auth.svelte.js
│   ├── bookmarks.svelte.js
│   ├── downloads.svelte.js
│   ├── history.svelte.js
│   ├── notifications.svelte.js
│   ├── panels.svelte.js
│   ├── services.svelte.js
│   ├── tabs.svelte.js
│   ├── todos.svelte.js
│   └── workspaces.svelte.js
│
├── api/                 # API clients & backend communication
│   ├── api.js
│   ├── nativeApi.js
│   └── secureStorage.js
│
├── managers/            # UI behavior managers
│   ├── dropdownManager.svelte.js
│   ├── navigation.svelte.js
│   └── toast.svelte.js
│
└── utils/               # Utility functions & helpers
    ├── clickOutside.svelte.js
    ├── dnd.svelte.js
    ├── emailSuggestions.svelte.js
    └── linkRouting.svelte.js
```

## 🎯 Kategori

### Stores (State Management)
Store yang menggunakan Svelte 5 Runes untuk manage application state:

- **auth.svelte.js** - Authentication state (user, login, logout)
- **bookmarks.svelte.js** - Bookmark management per profile
- **downloads.svelte.js** - Download manager state
- **history.svelte.js** - Browsing history state
- **notifications.svelte.js** - Notification center state
- **panels.svelte.js** - Panel visibility state (history, bookmarks, downloads)
- **services.svelte.js** - Services/apps management
- **tabs.svelte.js** - Tab management per service
- **todos.svelte.js** - Todo list state
- **workspaces.svelte.js** - Workspace/profile management

### API (Backend Communication)
File yang handle komunikasi dengan backend dan external services:

- **api.js** - API client untuk v-auto-backend (subscriptions, clients, etc)
- **nativeApi.js** - Native API service dengan HTTP client dan auth
- **secureStorage.js** - Secure storage menggunakan Electron safeStorage

### Managers (UI Behavior)
Manager untuk mengatur behavior UI components:

- **dropdownManager.svelte.js** - Ensures only one dropdown open at a time
- **navigation.svelte.js** - Webview navigation control (back, forward, reload)
- **toast.svelte.js** - Toast notification manager

### Utils (Utilities & Helpers)
Utility functions dan helper modules:

- **clickOutside.svelte.js** - Click outside detection helper
- **dnd.svelte.js** - Do Not Disturb mode management
- **emailSuggestions.svelte.js** - Email suggestions for login
- **linkRouting.svelte.js** - Smart link routing rules

## 📦 Import Examples

### Import dari stores
```javascript
import { authStore } from './lib/stores/auth.svelte.js';
import { serviceStore } from './lib/stores/services.svelte.js';
import { workspaceStore } from './lib/stores/workspaces.svelte.js';
```

### Import dari api
```javascript
import nativeApi from './lib/api/nativeApi.js';
import { getSubscriptions } from './lib/api/api.js';
import { secureStorage } from './lib/api/secureStorage.js';
```

### Import dari managers
```javascript
import { dropdownManager } from './lib/managers/dropdownManager.svelte.js';
import { navigationStore } from './lib/managers/navigation.svelte.js';
import { toastStore } from './lib/managers/toast.svelte.js';
```

### Import dari utils
```javascript
import { useClickOutside } from './lib/utils/clickOutside.svelte.js';
import { dndStore } from './lib/utils/dnd.svelte.js';
import { emailSuggestionsStore } from './lib/utils/emailSuggestions.svelte.js';
```

## 🔧 Best Practices

1. **Stores** - Gunakan untuk application state yang perlu reactive
2. **API** - Semua komunikasi backend harus melalui api folder
3. **Managers** - Untuk mengatur behavior UI yang kompleks
4. **Utils** - Untuk helper functions yang reusable

## 📝 Naming Conventions

- **Stores**: `{name}Store` - e.g., `authStore`, `serviceStore`
- **API**: `{name}Api` atau `{name}` - e.g., `nativeApi`, `api.js`
- **Managers**: `{name}Manager` - e.g., `dropdownManager`
- **Utils**: descriptive names - e.g., `useClickOutside`, `dndStore`

## 🔄 Migration Notes

Setelah reorganisasi, update import paths di semua file yang menggunakan lib:
- `./lib/auth.svelte.js` → `./lib/stores/auth.svelte.js`
- `./lib/nativeApi.js` → `./lib/api/nativeApi.js`
- `./lib/clickOutside.svelte.js` → `./lib/utils/clickOutside.svelte.js`
- dll.

## ✅ Benefits

- **Easier Navigation**: File terorganisir berdasarkan fungsi
- **Better Maintenance**: Mudah menemukan dan update file
- **Clear Separation**: Jelas mana store, API, manager, atau util
- **Scalability**: Mudah menambah file baru di kategori yang tepat
