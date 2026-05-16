# Script Injector System — Deep Analysis

> **Date**: 2025-05-16
> **Scope**: Script Injector architecture, IPC flow, API readiness for AI Agent / MCP
> **Files Analyzed**: 20+ files across `electron/handlers/`, `electron/`, `src/`
> **Status**: All critical and warning issues fixed
> **APIs**: 31 documented, 45 implemented (14 sync DOM + 17 async IPC + 14 utility/internal)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Reference (31 APIs)](#api-reference-31-apis)
3. [Issues Found & Fixed](#issues-found--fixed)
4. [Remaining Info Items](#remaining-info-items)
5. [AI Agent / MCP Readiness](#ai-agent--mcp-readiness)
6. [Changelog](#changelog)

---

## Architecture Overview

### Active Flow

```
main.cjs
  └─ registerInjectorRoutes(getMainWindow)
       └─ routes.cjs
            ├─ ScriptController.cjs     → scripts-list/save/load/delete/get-directory
            ├─ ExecutionController.cjs  → scripts-execute
            ├─ InputController.cjs      → script-open-input, script-input-response
            ├─ ScreenshotController.cjs → webview-screenshot
            ├─ PowerPointController.cjs → generate-powerpoint, ppt-*
            ├─ DownloadController.cjs   → script-add-to-downloads
            ├─ ConsoleController.cjs    → webview-console-log
            ├─ FileController.cjs       → save-file
            ├─ ContextController.cjs    → get-workspace-context
            └─ WebviewController.cjs    → navigation, cookies, dialogs, tabs, MCP
```

### API Injection Layers (2 layers)

```
Layer 1: webview-preload.cjs     → Always loaded, exposes IPC bridges + full VBox API (canonical)
Layer 2: vbox-api-inline.js      → Injected per execution, MERGES missing methods into existing API
```

### UI Components

```
WindowInjectScript.svelte    → Main script editor + console + docs (3 tabs)
  ├─ ScriptConsolePanel      → Shared reusable console panel (search, copy, expand objects)
  └─ VBoxApiDocsPanel        → Shared Swagger-style API documentation (accordion, copy as markdown)

WindowScriptConsole.svelte   → Standalone console window (uses ScriptConsolePanel)
WindowVBoxApiDocumentation.svelte → Standalone docs window (uses VBoxApiDocsPanel)
WindowScriptInput.svelte     → User input collection dialog
```

---

## API Reference (31 APIs)

### Core APIs (5)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.isVBox()` | sync | Check if running in VBox environment |
| `vbox.getPageInfo()` | sync | Get current page URL, title, domain, etc. |
| `vbox.toast(message, type)` | sync | Show toast notification (info/success/warning/error) |
| `vbox.evaluate(code)` | sync | Evaluate arbitrary JavaScript in page context |
| `vbox.getActiveProfile()` | async | Get active workspace/profile info |

### Navigation (4)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.navigate(url)` | async | Navigate to URL (destroys current JS context) |
| `vbox.goBack()` | async | Go back in browser history |
| `vbox.goForward()` | async | Go forward in browser history |
| `vbox.reload()` | async | Reload current page |

### DOM Manipulation (15)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.click(selector)` | sync | Simulate mouse click on element |
| `vbox.type(selector, text, options)` | sync/async | Simulate typing with framework compatibility (React/Vue/Svelte) |
| `vbox.press(key, options)` | sync | Dispatch keyboard event (Enter, Tab, Escape, etc.) |
| `vbox.hover(selector)` | sync | Simulate mouse hover on element |
| `vbox.select(selector, value)` | sync | Select option in dropdown |
| `vbox.drag(source, target)` | sync | Simulate HTML5 drag-and-drop |
| `vbox.scrollTo(selector, options)` | sync | Scroll to element (smooth/instant) |
| `vbox.getText(selector)` | sync | Get element text content |
| `vbox.getHTML(selector)` | sync | Get element innerHTML |
| `vbox.getAttribute(selector, attr)` | sync | Get element attribute value |
| `vbox.setAttribute(selector, attr, value)` | sync | Set element attribute |
| `vbox.exists(selector)` | sync | Check if element exists in DOM |
| `vbox.count(selector)` | sync | Count matching elements |
| `vbox.waitForElement(selector, timeout)` | async | Wait for element to appear (polls every 100ms) |
| `vbox.autoScroll(options)` | async | Auto-scroll for infinite scroll pages |

### Cookies (2)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.getCookies(filter?)` | async | Get cookies from current session (scoped to workspace) |
| `vbox.setCookie(cookie)` | async | Set cookie in current session |

### Dialog Handling (2)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.handleDialog(options)` | async | Auto-respond to browser dialogs (alert/confirm/prompt) |
| `vbox.clearDialogHandler()` | async | Remove dialog handler, restore default behavior |

### Data Extraction (5)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.scrapeLinks(options)` | sync | Extract all links from page |
| `vbox.scrapeImages(options)` | sync | Extract images with size filtering |
| `vbox.extractData(selectors)` | sync | Extract data from multiple selectors at once |
| `vbox.extractTable(selector)` | sync | Extract HTML table to structured data |
| `vbox.getIFrameContent(selector)` | sync | Read iframe content (same-origin only) |

### Network (1)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.waitForNetworkIdle(options)` | async | Wait for network activity to settle |

### Screenshot (1)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.screenshot(selector, filename)` | async | Capture element screenshot as PNG |

### Tab & Profile Management (4)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.listProfiles()` | async | List all workspace profiles |
| `vbox.listTabs()` | async | List all open tabs |
| `vbox.switchTab(tabId)` | async | Switch to specific tab |
| `vbox.getTabInfo(tabId?)` | async | Get page info for a tab |

### User Input (1)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.openInput(config)` | async | Open modal to collect user input |

### PowerPoint (3)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.ppt.create()` | sync | Create PowerPoint builder (chainable) |
| `vbox.ppt.listTemplates()` | async | List available PowerPoint templates |
| `vbox.ppt.useTemplate(name, vars, output)` | async | Generate from template with variable replacement |

### File & Downloads (2)

| API | Method | Description |
|-----|--------|-------------|
| `vbox.saveFile(content, filename, type)` | async | Save text content to file |
| `vbox.shouldDownload(filepath, filename)` | async | Register file in download manager |

---

## Issues Found & Fixed

### CRITICAL — All Fixed

#### C1. Dead Code `scriptInjector.cjs` — DELETED
**File**: `electron/handlers/scriptInjector.cjs`  
**Fix**: File deleted. It was never imported in `main.cjs` and contained duplicate IPC channel names.

#### C2. Double Console Forwarding — FIXED
**Files**: `webview-preload.cjs`, `vbox-api-inline.js`  
**Fix**: Removed the entire console override block from `vbox-api-inline.js`. The preload script already handles all console forwarding via IPC.

#### C3. `vbox-api-inline.js` Crash on Missing File — FIXED
**File**: `ExecutionController.cjs`  
**Fix**: Changed from synchronous module-level `readFileSync` to lazy-loading with try/catch fallback.

#### C4. Two Inconsistent VBox API Implementations — CONSOLIDATED
**Files**: `webview-preload.cjs`, `vbox-api-inline.js`  
**Fix**: 
- `webview-preload.cjs` is the canonical API with ALL methods
- `vbox-api-inline.js` now **merges** missing methods into existing API instead of skipping injection

#### C5. Script Downloads Without `profile_id` — FIXED
**File**: `DownloadController.cjs`  
**Fix**: Now accepts `profile_id`/`workspaceId` from `fileInfo`.

### WARNING — All Fixed

#### W1. `ContextController` Webview Selection — FIXED
Uses `appStore.activeAppId` + `data-app-id` selector for precise webview selection.

#### W2. File Overwrite Without Warning — FIXED
Both `ScreenshotController.cjs` and `FileController.cjs` now check if file exists and append timestamp suffix.

#### W4. `autoScroll()` Race Condition — FIXED
Replaced nested `setInterval`+`setTimeout` with recursive `setTimeout` pattern.

#### W5. `uuid` Require Inside Handler — FIXED
Moved to top-level import.

#### W6. `type()` Framework Compatibility — FIXED
Uses native value setter to trigger React/Vue/Svelte change detection.

#### W7. `scrapeImages()` naturalWidth Check — FIXED
Only applies size filtering when image has loaded. Unloaded images included with `loaded: false` flag.

#### W8. `InputController.handleResponse()` No-Op — DOCUMENTED
Added JSDoc comment explaining the intentional no-op behavior.

---

## Remaining Info Items

### I1. Script Storage Uses File System, Not Database
Scripts are stored as `.json` + `.js` files. This works but has limitations (no atomic transactions, no search). Consider migrating to SQLite for production scale.

### I2. No Script Versioning or Undo
When a script is saved, the previous version is permanently overwritten.

### I3. No Script Sandboxing or Permissions Model
All scripts run with the same level of access. No way to restrict capabilities.

### I4. `evaluate()` Uses Raw `eval()` — Security Risk
The `vbox.evaluate(code)` method allows arbitrary code execution. Consider restricting or removing for AI Agent use.

---

## AI Agent / MCP Readiness

### Assessment: Ready — 31 APIs Available

### Available APIs by Capability

| Capability | API | Status |
|---|---|---|
| **Navigation** | `navigate(url)`, `goBack()`, `goForward()`, `reload()` | IPC-based |
| **Keyboard** | `press(key, options)` | DOM events |
| **Mouse** | `click(selector)`, `hover(selector)`, `drag(source, target)` | DOM events |
| **Form Input** | `type(selector, text, options)`, `select(selector, value)` | Framework-compatible |
| **Read DOM** | `getText`, `getHTML`, `getAttribute`, `exists`, `count` | Sync |
| **Write DOM** | `setAttribute`, `scrollTo` | Sync |
| **Scrape data** | `scrapeLinks`, `scrapeImages`, `extractData`, `extractTable` | Sync |
| **Wait** | `waitForElement`, `waitForNetworkIdle` | Async |
| **Screenshots** | `screenshot(selector, filename)` | IPC-based |
| **Cookies** | `getCookies(filter)`, `setCookie(cookie)` | IPC-based, workspace-scoped |
| **Dialogs** | `handleDialog(options)`, `clearDialogHandler()` | IPC-based |
| **iframe** | `getIFrameContent(selector)` | Same-origin |
| **File I/O** | `saveFile`, `shouldDownload`, PPT generation | IPC-based |
| **User Input** | `openInput(config)` | Modal dialog |
| **Page Info** | `getPageInfo()`, `getActiveProfile()`, `evaluate(code)` | Sync/Async |
| **Tab Management** | `listProfiles()`, `listTabs()`, `switchTab(id)`, `getTabInfo(id)` | MCP-ready |
| **Auto-scroll** | `autoScroll(options)` | Async |

### Not Yet Implemented (Low Priority)

| Missing API | Priority | Notes |
|---|---|---|
| `vbox.uploadFile(selector, paths)` | Medium | Requires file dialog interception |
| `vbox.interceptRequests(callback)` | Low | Requires session.webRequest API |
| `vbox.waitForNavigation()` | Note | Not possible in-webview. Use MCP `navigateAndWait()` instead |

### MCP-Level APIs (Renderer Process)

Available via `window.api.mcp.*` for external control:

| API | Description |
|---|---|
| `mcp.listProfiles()` | List all workspace profiles |
| `mcp.listTabs()` | List all open tabs |
| `mcp.switchTab(tabId)` | Switch to specific tab |
| `mcp.getPageInfo(tabId?)` | Get page info for tab |
| `mcp.navigateAndWait({ tabId, url, timeout })` | Navigate and wait for load |

### Security Concerns for AI Agent

| Concern | Severity | Status |
|---|---|---|
| Arbitrary code execution via `evaluate()` | High | By design for script engine |
| No permission model | High | Future work |
| No rate limiting | Medium | Future work |
| No resource limits | Medium | Future work |
| File system write access | Medium | By design — scripts can save to Downloads |
| No script signing | Low | Future work |

---

## Changelog

### 2025-05-16 — Phase 3: UI Refactoring & Documentation Overhaul

**Files Created:**
1. `src/lib/data/apiSections.js` — Shared API documentation data (31 APIs, 12 categories)
2. `src/components/panels/ScriptConsolePanel.svelte` — Reusable console panel with search, copy, expand
3. `src/components/panels/VBoxApiDocsPanel.svelte` — Swagger-style API docs panel (accordion, copy as markdown)

**Files Modified:**
1. `src/pages/WindowInjectScript.svelte` — Replaced inline console/docs with shared panel components, fixed consoleLogs error
2. `src/pages/WindowScriptConsole.svelte` — Simplified to use ScriptConsolePanel
3. `src/pages/WindowVBoxApiDocumentation.svelte` — Simplified to use VBoxApiDocsPanel
4. `src/pages/WindowCookieManager.svelte` — Added drag-and-drop cookie import, Cookie-Editor encrypted format support
5. `docs/script-injector-analysis.md` — Updated to reflect 31 APIs, Phase 3 changes

**Changes:**
- Eliminated code duplication across 3 window files by extracting shared panel components
- Redesigned API documentation as Swagger UI-style accordion with method badges (GET/POST/PUT/DELETE)
- Added "Copy as Markdown" feature for full documentation export
- Added 4 previously undocumented APIs: `scrollTo`, `getAttribute`, `setAttribute`, `evaluate`
- Improved all 30 API descriptions with detailed explanations, parameter types, and usage notes
- Fixed `consoleLogs is not defined` runtime error from incomplete refactoring

### 2025-05-15 — Phase 2: Full API Implementation (MCP-Ready)

**Files Created:**
1. `electron/handlers/injectorController/WebviewController.cjs` — Navigation, cookies, dialogs, tab management

**Files Modified:**
1. `electron/handlers/injectorController/routes.cjs` — Registered 12 new IPC routes
2. `electron/webview-preload.cjs` — Added 4 IPC bridges + 16 new API methods
3. `electron/handlers/vbox-api-inline.js` — Added merge entries for all 16 new methods
4. `electron/preload.cjs` — Added `window.api.mcp.*` bridges

### 2025-05-15 — Phase 1: Initial Analysis & Fixes

**Files Modified:**
1. `electron/handlers/scriptInjector.cjs` — **DELETED** (dead code)
2. `electron/handlers/vbox-api-inline.js` — Removed console override, merge strategy, fixed autoScroll/type/scrapeImages/extractTable
3. `electron/handlers/injectorController/ExecutionController.cjs` — Lazy-load vbox-api-inline.js
4. `electron/handlers/injectorController/DownloadController.cjs` — profile_id support
5. `electron/handlers/injectorController/ContextController.cjs` — appStore.activeAppId for webview selection
6. `electron/handlers/injectorController/ScreenshotController.cjs` — File collision handling
7. `electron/handlers/injectorController/FileController.cjs` — File collision handling
8. `electron/handlers/injectorController/ScriptController.cjs` — Input validation, path traversal prevention
9. `electron/webview-preload.cjs` — Added missing methods, fixed type/screenshot/autoScroll/scrapeImages/extractTable

**Files Created:**
1. `docs/script-injector-analysis.md` — This analysis document
