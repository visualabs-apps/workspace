# Script Injector System — Deep Analysis

> **Date**: 2025-05-15  
> **Scope**: Script Injector architecture, IPC flow, API readiness for OpenClaw/AI Agent  
> **Files Analyzed**: 13 files across `electron/handlers/`, `electron/`, `src/`  
> **Status**: ✅ All critical and warning issues fixed

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Issues Found & Fixed](#issues-found--fixed)
3. [Remaining Info Items](#remaining-info-items)
4. [AI Agent / OpenClaw Readiness](#ai-agent--openclaw-readiness)
5. [Changelog](#changelog)

---

## Architecture Overview

### Active Flow (After Fixes)

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
            └─ ContextController.cjs    → get-workspace-context
```

### API Injection Layers (2 layers — fixed from 3)

```
Layer 1: webview-preload.cjs     → Always loaded, exposes IPC bridges + full VBox API (canonical)
Layer 2: vbox-api-inline.js      → Injected per execution, MERGES missing methods into existing API
```

---

## Issues Found & Fixed

### 🔴 CRITICAL — All Fixed

#### ✅ C1. Dead Code `scriptInjector.cjs` — DELETED
**File**: `electron/handlers/scriptInjector.cjs`  
**Fix**: File deleted. It was never imported in `main.cjs` and contained duplicate IPC channel names that would crash if accidentally imported alongside `routes.cjs`.

#### ✅ C2. Double Console Forwarding — FIXED
**Files**: `webview-preload.cjs`, `vbox-api-inline.js`  
**Fix**: Removed the entire console override block from `vbox-api-inline.js`. The preload script already handles all console forwarding via IPC. Previously, every `console.log()` was being sent twice.

#### ✅ C3. `vbox-api-inline.js` Crash on Missing File — FIXED
**File**: `ExecutionController.cjs`  
**Fix**: Changed from synchronous module-level `readFileSync` to lazy-loading with try/catch fallback:
```javascript
let VBOX_API_INLINE = null;
function getVboxApiInline() {
    if (VBOX_API_INLINE === null) {
        try {
            VBOX_API_INLINE = fsSync.readFileSync(...);
        } catch (error) {
            VBOX_API_INLINE = ''; // Fallback — scripts run without API
        }
    }
    return VBOX_API_INLINE;
}
```

#### ✅ C4. Two Inconsistent VBox API Implementations — CONSOLIDATED
**Files**: `webview-preload.cjs`, `vbox-api-inline.js`  
**Fix**: 
- `webview-preload.cjs` is now the canonical API with ALL methods (including `watchChanges`, `waitForChange`, `waitUntil`, `getActiveProfile`, `saveFile`, `openInput`, `shouldDownload`)
- `vbox-api-inline.js` now **merges** missing methods into existing API instead of skipping injection
- Both implementations now have consistent `screenshot()` (IPC-based), `type()` (native setter), `extractTable()` (object format), `scrapeImages()` (unloaded image handling), `autoScroll()` (recursive setTimeout)

#### ✅ C5. Script Downloads Without `profile_id` — FIXED
**File**: `DownloadController.cjs`  
**Fix**: Now accepts `profile_id`/`workspaceId` from `fileInfo` and includes it in the INSERT query. Falls back to no `profile_id` for backward compatibility.

---

### 🟡 WARNING — All Fixed

#### ✅ W1. `ContextController` Webview Selection — FIXED
**File**: `ContextController.cjs`  
**Fix**: Now uses `appStore.activeAppId` + `data-app-id` selector for precise webview selection, with fallback to focus/active/first.

#### ✅ W2. File Overwrite Without Warning — FIXED
**Files**: `ScreenshotController.cjs`, `FileController.cjs`  
**Fix**: Both now check if file exists and append timestamp suffix to avoid silent overwrites.

#### ✅ W4. `autoScroll()` Race Condition — FIXED
**Files**: `vbox-api-inline.js`, `webview-preload.cjs`  
**Fix**: Replaced nested `setInterval`+`setTimeout` with recursive `setTimeout` pattern for deterministic behavior.

#### ✅ W5. `uuid` Require Inside Handler — FIXED
**File**: `DownloadController.cjs`  
**Fix**: Moved `const { v4: uuidv4 } = require('uuid')` to top-level import.

#### ✅ W6. `type()` Framework Compatibility — FIXED
**Files**: `vbox-api-inline.js`, `webview-preload.cjs`  
**Fix**: Now uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` (native setter) to trigger React/Vue/Svelte change detection, and dispatches both `input` and `change` events.

#### ✅ W7. `scrapeImages()` naturalWidth Check — FIXED
**Files**: `vbox-api-inline.js`, `webview-preload.cjs`  
**Fix**: Only applies size filtering when `el.complete && el.naturalWidth > 0` (image has loaded). Unloaded images are now included with `loaded: false` flag.

#### ✅ W8. `InputController.handleResponse()` No-Op — DOCUMENTED
**File**: `InputController.cjs`  
**Fix**: Added JSDoc comment explaining the intentional no-op behavior and that the actual response flows through the `script-open-input` promise chain.

---

### 🟢 INFO — Applied

#### ✅ I5. Input Validation on Script Save — FIXED
**File**: `ScriptController.cjs`  
**Fix**: Added:
- `validateScriptData()` — validates name length (255 max), code size (5MB max), script ID format
- `sanitizeScriptId()` — prevents path traversal attacks by stripping `../`, `\`, `.` characters
- Malformed script files in `list()` are now skipped instead of failing the entire list

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

### Assessment: **Ready** — All Critical & High Priority APIs Implemented

### ✅ Available APIs (26 total)

| Capability | API | Status |
|---|---|---|
| **Navigation** | `navigate(url)`, `goBack()`, `goForward()`, `reload()` | ✅ IPC-based |
| **Keyboard** | `press(key, options)` | ✅ DOM events |
| **Mouse** | `hover(selector)`, `drag(source, target)` | ✅ DOM events |
| **Form** | `click(selector)`, `type(selector, text)`, `select(selector, value)` | ✅ Framework-compatible |
| **Read DOM** | `getText`, `getHTML`, `getAttribute`, `exists`, `count` | ✅ |
| **Scrape data** | `scrapeLinks`, `scrapeImages`, `extractData`, `extractTable` | ✅ |
| **Wait** | `waitForElement`, `waitForChange`, `waitUntil`, `waitForNetworkIdle` | ✅ |
| **Screenshots** | `screenshot(selector, filename)` | ✅ IPC-based |
| **Cookies** | `getCookies(filter)`, `setCookie(cookie)` | ✅ IPC-based |
| **Dialogs** | `handleDialog(options)`, `clearDialogHandler()` | ✅ IPC-based |
| **iframe** | `getIFrameContent(selector)` | ✅ Same-origin |
| **File I/O** | `saveFile`, `shouldDownload`, PPT generation | ✅ |
| **User Input** | `openInput(config)` | ✅ |
| **Page Info** | `getPageInfo()`, `getActiveProfile()` | ✅ |
| **Tab Management** | `listProfiles()`, `listTabs()`, `switchTab(id)`, `getTabInfo(id)` | ✅ MCP-ready |
| **DOM Monitoring** | `watchChanges`, `waitForChange`, `waitUntil` | ✅ |
| **Auto-scroll** | `autoScroll(options)` | ✅ |

### ❌ Not Yet Implemented (Low Priority)

| Missing API | Priority | Notes |
|---|---|---|
| `vbox.uploadFile(selector, paths)` | 🟡 Medium | Requires file dialog interception |
| `vbox.interceptRequests(callback)` | 🟢 Low | Requires session.webRequest API |
| `vbox.waitForNavigation()` | ℹ️ Note | Not possible in-webview (context destroyed). Use MCP `navigateAndWait()` instead |

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
| Arbitrary code execution via `evaluate()` | 🔴 | Still present — by design for script engine |
| No permission model | 🔴 | Not addressed — future work |
| No rate limiting | 🟡 | Not addressed — future work |
| No resource limits | 🟡 | Not addressed — future work |
| File system write access | 🟡 | By design — scripts can save to Downloads |
| No script signing | 🟢 | Future work |

---

## Changelog

### 2025-05-15 — Phase 2: Full API Implementation (MCP-Ready)

**Files Created:**
1. `electron/handlers/injectorController/WebviewController.cjs` — New controller for navigation, cookies, dialogs, tab management

**Files Modified:**
1. `electron/handlers/injectorController/routes.cjs` — Registered 12 new IPC routes (navigation, cookies, dialogs, tabs, MCP)
2. `electron/webview-preload.cjs` — Added 4 IPC bridges (vboxNavigation, vboxCookies, vboxDialog, vboxTabs) + 16 new API methods
3. `electron/handlers/vbox-api-inline.js` — Added merge entries for all 16 new methods
4. `electron/preload.cjs` — Added `window.api.mcp.*` bridges for renderer-side MCP control
5. `src/pages/WindowVBoxApiDocumentation.svelte` — Full documentation rewrite with all 26 APIs + MCP guide
6. `docs/script-injector-analysis.md` — Updated readiness assessment

### 2025-05-15 — Phase 1: Initial Analysis & Fixes

**Files Modified:**
1. `electron/handlers/scriptInjector.cjs` — **DELETED** (dead code)
2. `electron/handlers/vbox-api-inline.js` — Removed console override, changed to merge strategy, fixed autoScroll/type/scrapeImages/extractTable
3. `electron/handlers/injectorController/ExecutionController.cjs` — Lazy-load vbox-api-inline.js with error handling
4. `electron/handlers/injectorController/DownloadController.cjs` — Added profile_id support, moved uuid to top-level
5. `electron/handlers/injectorController/ContextController.cjs` — Uses appStore.activeAppId for webview selection
6. `electron/handlers/injectorController/ScreenshotController.cjs` — File collision handling
7. `electron/handlers/injectorController/FileController.cjs` — File collision handling
8. `electron/handlers/injectorController/ScriptController.cjs` — Input validation, path traversal prevention, graceful parse error handling
9. `electron/handlers/injectorController/InputController.cjs` — Documented no-op handleResponse
10. `electron/webview-preload.cjs` — Added missing methods, fixed type/screenshot/autoScroll/scrapeImages/extractTable, IPC-based screenshot

**Files Created:**
1. `docs/script-injector-analysis.md` — This analysis document
