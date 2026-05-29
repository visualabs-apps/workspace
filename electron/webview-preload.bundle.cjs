var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// electron/webview/theme.cjs
var require_theme = __commonJS({
  "electron/webview/theme.cjs"(exports2, module2) {
    function initThemeOverride2(ipcRenderer2) {
      try {
        let patchMql2 = function(mql, query) {
          const isDarkQuery = query === "(prefers-color-scheme: dark)";
          const isLightQuery = query === "(prefers-color-scheme: light)";
          if (!isDarkQuery && !isLightQuery) return;
          try {
            Object.defineProperty(mql, "matches", {
              get: () => isDarkQuery ? isDark : !isDark,
              configurable: true
            });
          } catch (_) {
          }
          if (!trackedMqls.has(query)) trackedMqls.set(query, /* @__PURE__ */ new Set());
          trackedMqls.get(query).add(new WeakRef(mql));
        };
        var patchMql = patchMql2;
        const theme = ipcRenderer2.sendSync("get-theme-sync");
        const nativeMatchMedia = window.matchMedia.bind(window);
        let isDark = theme === "dark" || theme === "system" && nativeMatchMedia("(prefers-color-scheme: dark)").matches;
        const trackedMqls = /* @__PURE__ */ new Map();
        window.matchMedia = function(query) {
          const mql = nativeMatchMedia(query);
          patchMql2(mql, query);
          return mql;
        };
        if (isDark) {
          try {
            const script = document.createElement("script");
            script.textContent = [
              "(function(){",
              "  var nm=window.matchMedia;",
              "  window.matchMedia=function(q){",
              "    var m=nm.call(window,q);",
              '    if(q==="(prefers-color-scheme: dark)"){',
              '      try{Object.defineProperty(m,"matches",{get:function(){return true},configurable:true});}catch(e){}',
              "    }",
              '    if(q==="(prefers-color-scheme: light)"){',
              '      try{Object.defineProperty(m,"matches",{get:function(){return false},configurable:true});}catch(e){}',
              "    }",
              "    return m;",
              "  };",
              "})();"
            ].join("");
            (document.documentElement || document.head || document).appendChild(script);
            script.remove();
          } catch (_) {
          }
        }
        ipcRenderer2.on("webview-theme-changed", (_event, newTheme) => {
          const newIsDark = newTheme === "dark" || newTheme === "system" && nativeMatchMedia("(prefers-color-scheme: dark)").matches;
          if (newIsDark === isDark) return;
          isDark = newIsDark;
          for (const [query, refs] of trackedMqls) {
            const dead = [];
            for (const ref of refs) {
              const mql = ref.deref();
              if (!mql) {
                dead.push(ref);
                continue;
              }
              const isDarkQuery = query === "(prefers-color-scheme: dark)";
              try {
                Object.defineProperty(mql, "matches", {
                  get: () => isDarkQuery ? isDark : !isDark,
                  configurable: true
                });
              } catch (_) {
              }
              try {
                mql.dispatchEvent(new MediaQueryListEvent("change", {
                  media: query,
                  matches: mql.matches
                }));
              } catch (_) {
              }
            }
            dead.forEach((r) => refs.delete(r));
          }
          try {
            const script = document.createElement("script");
            const darkStr = isDark ? "true" : "false";
            script.textContent = [
              "(function(){",
              "  var nm=window.__nativeMatchMedia__||window.matchMedia;",
              '  ["(prefers-color-scheme: dark)","(prefers-color-scheme: light)"].forEach(function(q){',
              "    var m=nm.call(window,q);",
              '    var isD=q==="(prefers-color-scheme: dark)";',
              '    try{Object.defineProperty(m,"matches",{get:function(){return isD?' + darkStr + ":!" + darkStr + "},configurable:true});}catch(e){}",
              "  });",
              "})();"
            ].join("");
            (document.documentElement || document.head || document).appendChild(script);
            script.remove();
          } catch (_) {
          }
        });
      } catch (_) {
      }
    }
    module2.exports = { init: initThemeOverride2 };
  }
});

// electron/webview/contextBridge.cjs
var require_contextBridge = __commonJS({
  "electron/webview/contextBridge.cjs"(exports2, module2) {
    function initContextBridge2(contextBridge2, ipcRenderer2) {
      contextBridge2.exposeInMainWorld("vboxConsole", {
        log: (message) => {
          console.log(message);
          ipcRenderer2.send("webview-console-log", { level: "log", args: [message] });
        },
        error: (message) => {
          console.error(message);
          ipcRenderer2.send("webview-console-log", { level: "error", args: [message] });
        },
        warn: (message) => {
          console.warn(message);
          ipcRenderer2.send("webview-console-log", { level: "warn", args: [message] });
        },
        info: (message) => {
          console.info(message);
          ipcRenderer2.send("webview-console-log", { level: "info", args: [message] });
        }
      });
      contextBridge2.exposeInMainWorld("vboxPowerPoint", {
        generate: (pptData) => ipcRenderer2.invoke("generate-powerpoint", pptData),
        processTemplate: (templateName, variables, outputFilename) => {
          return ipcRenderer2.invoke("ppt-process-template", { templateName, variables, outputFilename });
        },
        listTemplates: () => ipcRenderer2.invoke("ppt-list-templates")
      });
      contextBridge2.exposeInMainWorld("vboxDownloads", {
        addToDownloads: (fileInfo) => ipcRenderer2.invoke("script-add-to-downloads", fileInfo)
      });
      contextBridge2.exposeInMainWorld("vboxInput", {
        open: async (config) => {
          try {
            const serializedConfig = JSON.parse(JSON.stringify(config));
            const result = await ipcRenderer2.invoke("script-open-input", serializedConfig);
            return result;
          } catch (error) {
            return { success: false, message: error.message || "IPC Error", data: null };
          }
        }
      });
      contextBridge2.exposeInMainWorld("vboxScreenshot", {
        capture: async (options) => {
          try {
            return await ipcRenderer2.invoke("webview-screenshot", options);
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
      contextBridge2.exposeInMainWorld("vboxFile", {
        save: async (content, filename, type = "text/html") => {
          try {
            return await ipcRenderer2.invoke("save-file", { content, filename, type });
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
      contextBridge2.exposeInMainWorld("vboxContext", {
        getWorkspaceInfo: async () => {
          try {
            return await ipcRenderer2.invoke("get-workspace-context");
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
      contextBridge2.exposeInMainWorld("vboxNavigation", {
        navigate: (url) => ipcRenderer2.invoke("webview-navigate", url),
        goBack: () => ipcRenderer2.invoke("webview-go-back"),
        goForward: () => ipcRenderer2.invoke("webview-go-forward"),
        reload: () => ipcRenderer2.invoke("webview-reload")
      });
      contextBridge2.exposeInMainWorld("vboxCookies", {
        get: (filter) => ipcRenderer2.invoke("webview-get-cookies", filter || {}),
        set: (cookie) => ipcRenderer2.invoke("webview-set-cookie", cookie)
      });
      contextBridge2.exposeInMainWorld("vboxDialog", {
        handle: (options) => ipcRenderer2.invoke("webview-handle-dialog", options || {}),
        clear: () => ipcRenderer2.invoke("webview-clear-dialog-handler")
      });
      contextBridge2.exposeInMainWorld("vboxTabs", {
        listProfiles: () => ipcRenderer2.invoke("webview-list-profiles"),
        listTabs: () => ipcRenderer2.invoke("webview-list-tabs"),
        switchTab: (tabId) => ipcRenderer2.invoke("webview-switch-tab", tabId),
        getPageInfo: (tabId) => ipcRenderer2.invoke("webview-get-page-info", tabId || null)
      });
      contextBridge2.exposeInMainWorld("vboxPassword", {
        onLoginSubmit: async (formData) => {
          try {
            const ctx = await ipcRenderer2.invoke("get-workspace-context");
            const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            if (!profileId) {
              return { success: false, error: "No active profile" };
            }
            const username = formData.usernameField?.value || "";
            const password = formData.passwordField?.value || "";
            if (!username || !password) {
              return { success: false, error: "Missing username or password" };
            }
            const result = await ipcRenderer2.invoke("password-capture-submit", {
              profileId,
              origin: formData.origin || window.location.origin,
              username,
              password,
              title: formData.title || document.title,
              url: formData.url || window.location.href
            });
            if (result.success && result.captured) {
              ipcRenderer2.send("password-show-save-prompt", {
                profileId,
                origin: formData.origin || window.location.origin,
                username,
                password,
                title: formData.title || document.title,
                url: formData.url || window.location.href,
                isUpdate: result.isUpdate
              });
            }
            return result;
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        checkCredentials: async (origin) => {
          try {
            const ctx = await ipcRenderer2.invoke("get-workspace-context");
            const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            if (!profileId) return { hasCredentials: false };
            const result = await ipcRenderer2.invoke("password-autofill-lookup", {
              profileId,
              origin
            });
            if (result.success && result.credentials?.length > 0) {
              return { hasCredentials: true, credentials: result.credentials };
            }
            return { hasCredentials: false };
          } catch (error) {
            return { hasCredentials: false };
          }
        },
        requestAutofill: async (origin) => {
          try {
            const ctx = await ipcRenderer2.invoke("get-workspace-context");
            const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            if (!profileId) return { success: false, credentials: [] };
            return await ipcRenderer2.invoke("password-autofill-lookup", {
              profileId,
              origin
            });
          } catch (error) {
            return { success: false, credentials: [] };
          }
        },
        generatePassword: async (options = {}) => {
          try {
            return await ipcRenderer2.invoke("password-generate", options);
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      });
    }
    module2.exports = { init: initContextBridge2 };
  }
});

// electron/webview/consoleOverride.cjs
var require_consoleOverride = __commonJS({
  "electron/webview/consoleOverride.cjs"(exports2, module2) {
    function initConsoleOverride2(ipcRenderer2) {
      const originalConsole = {
        log: console.log.bind(console),
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console)
      };
      const serializeArgs = (args) => {
        return args.map((arg) => {
          if (typeof arg === "object" && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        });
      };
      console.log = function(...args) {
        originalConsole.log(...args);
        ipcRenderer2.send("webview-console-log", { level: "log", args: serializeArgs(args) });
      };
      console.error = function(...args) {
        originalConsole.error(...args);
        ipcRenderer2.send("webview-console-log", { level: "error", args: serializeArgs(args) });
      };
      console.warn = function(...args) {
        originalConsole.warn(...args);
        ipcRenderer2.send("webview-console-log", { level: "warn", args: serializeArgs(args) });
      };
      console.info = function(...args) {
        originalConsole.info(...args);
        ipcRenderer2.send("webview-console-log", { level: "info", args: serializeArgs(args) });
      };
    }
    module2.exports = { init: initConsoleOverride2 };
  }
});

// electron/webview/vboxApi.cjs
var require_vboxApi = __commonJS({
  "electron/webview/vboxApi.cjs"(exports, module) {
    function initVBoxApi() {
      if (typeof window.__VBOX_API__ !== "undefined") {
        return;
      }
      function getNativeValueSetter(element) {
        try {
          if (element.tagName === "TEXTAREA") {
            return Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              "value"
            ).set;
          }
          return Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;
        } catch (e) {
          return null;
        }
      }
      function setValueWithEvents(element, value) {
        const nativeSetter = getNativeValueSetter(element);
        if (nativeSetter) {
          nativeSetter.call(element, value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      window.__VBOX_API__ = {
        APP_NAME: "VisualBox",
        VERSION: "1.0.0",
        isVBox: function() {
          return true;
        },
        getPageInfo: function() {
          return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            protocol: window.location.protocol,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
          };
        },
        click: function(selector) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          element.click();
          return true;
        },
        type: function(selector, text, options) {
          if (options === void 0) options = {};
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          const { delay = 0, clear = false } = options;
          if (clear) {
            setValueWithEvents(element, "");
          }
          if (delay > 0) {
            let index = 0;
            let current = clear ? "" : element.value;
            return new Promise((resolve) => {
              const interval = setInterval(() => {
                if (index < text.length) {
                  current += text[index];
                  setValueWithEvents(element, current);
                  index++;
                } else {
                  clearInterval(interval);
                  resolve(true);
                }
              }, delay);
            });
          } else {
            const newValue = clear ? text : element.value + text;
            setValueWithEvents(element, newValue);
            return true;
          }
        },
        scrollTo: function(selector, options) {
          if (options === void 0) options = {};
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          const { behavior = "smooth", block = "center" } = options;
          element.scrollIntoView({ behavior, block });
          return true;
        },
        _screenshotIsIPC: true,
        screenshot: async function(selector, filename) {
          try {
            const element = selector ? document.querySelector(selector) : document.body;
            if (!element) throw new Error("Element not found: " + selector);
            const rect = element.getBoundingClientRect();
            if (typeof window.vboxScreenshot !== "undefined") {
              return await window.vboxScreenshot.capture({
                selector,
                filename: filename || "screenshot-" + Date.now() + ".png",
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              });
            }
            return { success: false, error: "Screenshot API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        getAttribute: function(selector, attribute) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          return element.getAttribute(attribute);
        },
        setAttribute: function(selector, attribute, value) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          element.setAttribute(attribute, value);
          return true;
        },
        getText: function(selector) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          return element.textContent.trim();
        },
        getHTML: function(selector) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          return element.innerHTML;
        },
        exists: function(selector) {
          return document.querySelector(selector) !== null;
        },
        count: function(selector) {
          return document.querySelectorAll(selector).length;
        },
        query: function(selector, attribute) {
          const elements = document.querySelectorAll(selector);
          if (elements.length === 0) {
            return [];
          }
          const results = [];
          elements.forEach((el, index) => {
            const item = {
              index,
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().substring(0, 200)
            };
            if (attribute) {
              item[attribute] = el.getAttribute(attribute);
            } else {
              if (el.id) item.id = el.id;
              if (el.className) item.class = el.className;
              if (el.href) item.href = el.href;
              if (el.src) item.src = el.src;
              if (el.value !== void 0) item.value = el.value;
            }
            results.push(item);
          });
          return results;
        },
        scrapeLinks: function(options) {
          if (options === void 0) options = {};
          const {
            selector = "a[href]",
            filter = null,
            includeText = true,
            includeAttributes = []
          } = options;
          const links = [];
          const elements = document.querySelectorAll(selector);
          elements.forEach((el, index) => {
            const href = el.getAttribute("href");
            if (!href) return;
            let absoluteUrl;
            try {
              absoluteUrl = new URL(href, window.location.href).href;
            } catch (e) {
              absoluteUrl = href;
            }
            if (filter && typeof filter === "function") {
              if (!filter(absoluteUrl, el)) return;
            }
            const linkData = { index, url: absoluteUrl, href };
            if (includeText) {
              linkData.text = el.textContent.trim();
            }
            includeAttributes.forEach((attr) => {
              const value = el.getAttribute(attr);
              if (value) linkData[attr] = value;
            });
            links.push(linkData);
          });
          return links;
        },
        scrapeImages: function(options) {
          if (options === void 0) options = {};
          const { selector = "img[src]", minWidth = 0, minHeight = 0 } = options;
          const images = [];
          const elements = document.querySelectorAll(selector);
          elements.forEach((el, index) => {
            const src = el.getAttribute("src");
            if (!src) return;
            if (el.complete && el.naturalWidth > 0) {
              if (el.naturalWidth < minWidth || el.naturalHeight < minHeight) return;
            }
            let absoluteUrl;
            try {
              absoluteUrl = new URL(src, window.location.href).href;
            } catch (e) {
              absoluteUrl = src;
            }
            images.push({
              index,
              url: absoluteUrl,
              src,
              alt: el.getAttribute("alt") || "",
              width: el.naturalWidth || 0,
              height: el.naturalHeight || 0,
              loaded: el.complete && el.naturalWidth > 0
            });
          });
          return images;
        },
        extractData: function(selectors) {
          const data = {};
          for (const [key, selector] of Object.entries(selectors)) {
            const element = document.querySelector(selector);
            if (element) {
              data[key] = element.textContent.trim();
            }
          }
          return data;
        },
        extractTable: function(tableSelector) {
          const table = document.querySelector(tableSelector);
          if (!table) return null;
          const headerCells = table.querySelectorAll("thead th, thead td");
          const headers = Array.from(headerCells).map((cell) => cell.textContent.trim());
          const rows = [];
          const bodyRows = table.querySelectorAll("tbody tr");
          bodyRows.forEach((row) => {
            const cells = row.querySelectorAll("td, th");
            const rowData = {};
            cells.forEach((cell, index) => {
              const header = headers[index] || "column_" + index;
              rowData[header] = cell.textContent.trim();
            });
            rows.push(rowData);
          });
          return { headers, rows };
        },
        waitForElement: function(selector, timeout) {
          if (timeout === void 0) timeout = 5e3;
          return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
              resolve(true);
              return;
            }
            const observer = new MutationObserver(() => {
              const el = document.querySelector(selector);
              if (el) {
                observer.disconnect();
                resolve(true);
              }
            });
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });
            setTimeout(() => {
              observer.disconnect();
              reject(new Error("Element not found: " + selector));
            }, timeout);
          });
        },
        autoScroll: function(options) {
          if (options === void 0) options = {};
          const { delay = 1e3, maxScrolls = 10, onScroll = null } = options;
          return new Promise((resolve) => {
            let scrollCount = 0;
            let lastHeight = document.body.scrollHeight;
            function doScroll() {
              window.scrollTo(0, document.body.scrollHeight);
              scrollCount++;
              if (onScroll) onScroll(scrollCount);
              setTimeout(() => {
                const newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight || scrollCount >= maxScrolls) {
                  resolve(scrollCount);
                } else {
                  lastHeight = newHeight;
                  doScroll();
                }
              }, delay);
            }
            doScroll();
          });
        },
        evaluate: function(code) {
          return eval(code);
        },
        toast: function(message, type) {
        },
        ppt: {
          create: function(template) {
            return {
              slides: [],
              title: "VBox Report",
              author: "VBox Script",
              template: template || null,
              addTitleSlide: function(title, subtitle) {
                this.slides.push({ type: "title", title, subtitle: subtitle || "" });
                return this;
              },
              addSlide: function(title, content) {
                this.slides.push({ type: "content", title, content: content || [] });
                return this;
              },
              addText: function(text, options) {
                if (options === void 0) options = {};
                const lastSlide = this.slides[this.slides.length - 1];
                if (lastSlide) {
                  if (!lastSlide.content) lastSlide.content = [];
                  lastSlide.content.push({ type: "text", text, options });
                }
                return this;
              },
              addImage: function(imagePath, options) {
                if (options === void 0) options = {};
                const lastSlide = this.slides[this.slides.length - 1];
                if (lastSlide) {
                  if (!lastSlide.content) lastSlide.content = [];
                  lastSlide.content.push({ type: "image", path: imagePath, options });
                }
                return this;
              },
              addTable: function(rows, options) {
                if (options === void 0) options = {};
                const lastSlide = this.slides[this.slides.length - 1];
                if (lastSlide) {
                  if (!lastSlide.content) lastSlide.content = [];
                  lastSlide.content.push({ type: "table", rows, options });
                }
                return this;
              },
              addChart: function(type, data, options) {
                if (options === void 0) options = {};
                const lastSlide = this.slides[this.slides.length - 1];
                if (lastSlide) {
                  if (!lastSlide.content) lastSlide.content = [];
                  lastSlide.content.push({ type: "chart", chartType: type, data, options });
                }
                return this;
              },
              download: async function(filename) {
                try {
                  if (typeof window.vboxPowerPoint !== "undefined") {
                    const result = await window.vboxPowerPoint.generate({
                      title: this.title,
                      author: this.author,
                      slides: this.slides,
                      template: this.template,
                      filename: filename || "vbox-report.pptx"
                    });
                    if (result && result.success && result.path) {
                      await window.__VBOX_API__.shouldDownload(result.path, result.filename);
                    }
                    return result;
                  }
                  return { success: false, error: "PowerPoint API not available" };
                } catch (error) {
                  return { success: false, error: error.message };
                }
              }
            };
          }
        },
        sendToVBox: function(data) {
          return data;
        },
        shouldDownload: async function(filepath, filename) {
          try {
            if (!filename) {
              filename = filepath.split(/[\\/]/).pop();
            }
            if (typeof window.vboxDownloads !== "undefined") {
              return await window.vboxDownloads.addToDownloads({ filepath, filename });
            }
            return { success: false, error: "Download manager API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        saveFile: async function(content, filename, type) {
          if (type === void 0) type = "text/html";
          try {
            if (typeof window.vboxFile !== "undefined") {
              const result = await window.vboxFile.save(content, filename, type);
              if (result.success) {
                await window.__VBOX_API__.shouldDownload(result.path, result.filename);
              }
              return result;
            }
            return { success: false, error: "File save API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        openInput: async function(config) {
          try {
            if (typeof window.vboxInput !== "undefined") {
              return await window.vboxInput.open(config);
            } else if (typeof window.scriptInputStore !== "undefined") {
              return await window.scriptInputStore.open(config);
            }
            return null;
          } catch (error) {
            return null;
          }
        },
        getActiveProfile: async function() {
          try {
            if (typeof window.vboxContext !== "undefined") {
              return await window.vboxContext.getWorkspaceInfo();
            }
            if (typeof window.workspaceStore !== "undefined" && window.workspaceStore.activeWorkspace) {
              const workspace = window.workspaceStore.activeWorkspace;
              return {
                success: true,
                id: workspace.id,
                name: workspace.name,
                url: window.location.href,
                title: document.title
              };
            }
            return { success: false, error: "Profile info not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        navigate: async function(url) {
          try {
            if (typeof window.vboxNavigation !== "undefined") {
              return await window.vboxNavigation.navigate(url);
            }
            return { success: false, error: "Navigation API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        goBack: async function() {
          try {
            if (typeof window.vboxNavigation !== "undefined") {
              return await window.vboxNavigation.goBack();
            }
            return { success: false, error: "Navigation API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        goForward: async function() {
          try {
            if (typeof window.vboxNavigation !== "undefined") {
              return await window.vboxNavigation.goForward();
            }
            return { success: false, error: "Navigation API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        reload: async function() {
          try {
            if (typeof window.vboxNavigation !== "undefined") {
              return await window.vboxNavigation.reload();
            }
            return { success: false, error: "Navigation API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        press: function(key, options) {
          if (options === void 0) options = {};
          const target = options.selector ? document.querySelector(options.selector) : document.activeElement || document.body;
          if (!target && options.selector) {
            throw new Error("Element not found: " + options.selector);
          }
          const eventInit = {
            key,
            code: key.length === 1 ? "Key" + key.toUpperCase() : key,
            bubbles: true,
            cancelable: true,
            shiftKey: options.shift || false,
            ctrlKey: options.ctrl || false,
            altKey: options.alt || false,
            metaKey: options.meta || false
          };
          target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
          if (key.length === 1) {
            target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
          }
          target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
          return true;
        },
        hover: function(selector) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const eventInit = {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            view: window
          };
          element.dispatchEvent(new MouseEvent("pointerenter", eventInit));
          element.dispatchEvent(new MouseEvent("mouseover", eventInit));
          element.dispatchEvent(new MouseEvent("mouseenter", Object.assign({}, eventInit, { bubbles: false })));
          element.dispatchEvent(new MouseEvent("mousemove", eventInit));
          return true;
        },
        drag: function(sourceSelector, targetSelector) {
          const source = document.querySelector(sourceSelector);
          const target = document.querySelector(targetSelector);
          if (!source) throw new Error("Source not found: " + sourceSelector);
          if (!target) throw new Error("Target not found: " + targetSelector);
          const sourceRect = source.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const dataTransfer = new DataTransfer();
          const dragStartEvent = new DragEvent("dragstart", {
            bubbles: true,
            dataTransfer,
            clientX: sourceRect.left + sourceRect.width / 2,
            clientY: sourceRect.top + sourceRect.height / 2
          });
          source.dispatchEvent(dragStartEvent);
          const dragOverEvent = new DragEvent("dragover", {
            bubbles: true,
            dataTransfer,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          target.dispatchEvent(dragOverEvent);
          const dropEvent = new DragEvent("drop", {
            bubbles: true,
            dataTransfer,
            clientX: targetRect.left + targetRect.width / 2,
            clientY: targetRect.top + targetRect.height / 2
          });
          target.dispatchEvent(dropEvent);
          const dragEndEvent = new DragEvent("dragend", {
            bubbles: true,
            dataTransfer
          });
          source.dispatchEvent(dragEndEvent);
          return true;
        },
        select: function(selector, value) {
          const element = document.querySelector(selector);
          if (!element) throw new Error("Element not found: " + selector);
          if (element.tagName !== "SELECT") throw new Error("Element is not a <select>: " + selector);
          const options = element.options;
          let found = false;
          for (let i = 0; i < options.length; i++) {
            if (options[i].value === value || options[i].textContent.trim() === value) {
              element.selectedIndex = i;
              found = true;
              break;
            }
          }
          if (!found) {
            throw new Error("Option not found: " + value);
          }
          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            "value"
          ).set;
          if (nativeSetter) {
            nativeSetter.call(element, value);
          }
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        },
        getCookies: async function(filter) {
          try {
            if (typeof window.vboxCookies !== "undefined") {
              return await window.vboxCookies.get(filter || {});
            }
            return { success: false, error: "Cookie API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        setCookie: async function(cookie) {
          try {
            if (typeof window.vboxCookies !== "undefined") {
              return await window.vboxCookies.set(cookie);
            }
            return { success: false, error: "Cookie API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        handleDialog: async function(options) {
          try {
            if (typeof window.vboxDialog !== "undefined") {
              return await window.vboxDialog.handle(options || {});
            }
            return { success: false, error: "Dialog API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        clearDialogHandler: async function() {
          try {
            if (typeof window.vboxDialog !== "undefined") {
              return await window.vboxDialog.clear();
            }
            return { success: false, error: "Dialog API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        waitForNetworkIdle: function(options) {
          if (options === void 0) options = {};
          const { timeout = 1e4, idleTime = 1e3 } = options;
          return new Promise((resolve) => {
            let lastRequestTime = Date.now();
            let resolved = false;
            const cleanup = () => {
              if (resolved) return;
              resolved = true;
              try {
                observer.disconnect();
              } catch {
              }
              clearInterval(checkInterval);
              clearTimeout(timeoutTimer);
            };
            let previousEntryCount = performance.getEntriesByType("resource").length;
            const observer = new PerformanceObserver((list) => {
              list.getEntries().forEach(() => {
                lastRequestTime = Date.now();
              });
            });
            try {
              observer.observe({ entryTypes: ["resource"] });
            } catch (e) {
            }
            const checkInterval = setInterval(() => {
              const currentEntries = performance.getEntriesByType("resource").length;
              if (currentEntries > previousEntryCount) {
                lastRequestTime = Date.now();
                previousEntryCount = currentEntries;
              }
              if (Date.now() - lastRequestTime >= idleTime) {
                cleanup();
                resolve({ success: true, idleTime });
              }
            }, 200);
            const timeoutTimer = setTimeout(() => {
              cleanup();
              resolve({ success: false, error: "Network idle timeout" });
            }, timeout);
          });
        },
        getIFrameContent: function(selector) {
          const iframe = document.querySelector(selector);
          if (!iframe) throw new Error("Iframe not found: " + selector);
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            return {
              success: true,
              html: doc.documentElement.outerHTML,
              url: iframe.src || iframe.contentWindow.location.href,
              title: doc.title || ""
            };
          } catch (error) {
            return {
              success: false,
              error: "Cannot access cross-origin iframe: " + error.message,
              url: iframe.src
            };
          }
        },
        listProfiles: async function() {
          try {
            if (typeof window.vboxTabs !== "undefined") {
              return await window.vboxTabs.listProfiles();
            }
            return { success: false, error: "Tab management API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        listTabs: async function() {
          try {
            if (typeof window.vboxTabs !== "undefined") {
              return await window.vboxTabs.listTabs();
            }
            return { success: false, error: "Tab management API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        switchTab: async function(tabId) {
          try {
            if (typeof window.vboxTabs !== "undefined") {
              return await window.vboxTabs.switchTab(tabId);
            }
            return { success: false, error: "Tab management API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        getTabInfo: async function(tabId) {
          try {
            if (typeof window.vboxTabs !== "undefined") {
              return await window.vboxTabs.getPageInfo(tabId || null);
            }
            return { success: false, error: "Tab management API not available" };
          } catch (error) {
            return { success: false, error: error.message };
          }
        }
      };
      window.runVBoxScript = async function(scriptCode) {
        try {
          if (!window.__VBOX_API__) {
            return { success: false, error: "VBox API not available" };
          }
          if (!scriptCode || typeof scriptCode !== "string") {
            return { success: false, error: "Invalid script code" };
          }
          const vbox = window.__VBOX_API__;
          const AsyncFunction = Object.getPrototypeOf(async function() {
          }).constructor;
          const userFunction = new AsyncFunction("vbox", scriptCode);
          const result = await userFunction(vbox);
          try {
            const serialized = JSON.parse(JSON.stringify(result));
            return { success: true, result: serialized };
          } catch (e) {
            return { success: true, result: String(result) };
          }
        } catch (error) {
          return {
            success: false,
            error: error.message || "Unknown error",
            stack: error.stack,
            name: error.name
          };
        }
      };
    }
    module.exports = { init: initVBoxApi };
  }
});

// electron/webview/passwordCapture.cjs
var require_passwordCapture = __commonJS({
  "electron/webview/passwordCapture.cjs"(exports2, module2) {
    function initPasswordCapture2(ipcRenderer2) {
      const CONFIG = {
        debounceDelay: 300,
        // ms to wait before rescanning
        autofillDelay: 500,
        // ms to wait before auto-filling after detection
        maxRetries: 5,
        // max autofill retry attempts (renamed from MAX_AUTOFILL_ATTEMPTS)
        highlightFill: true,
        // briefly highlight filled fields
        highlightColor: "#e8f0fe",
        // light blue (Chrome-like)
        highlightDuration: 1500
        // ms for highlight
      };
      let cachedProfileId = null;
      let lastCapturedUsername = "";
      let lastCapturedPassword = "";
      let credentialsCaptured = false;
      let autofillAttempts = 0;
      let detectedForms = [];
      let isObserving = false;
      let lastClickedSubmitBtn = null;
      const DEBUG = false;
      function log(...args) {
        if (DEBUG) console.log("[PasswordCapture]", ...args);
      }
      const USERNAME_PATTERNS = {
        name: ["email", "user", "login", "account", "username", "user_email", "user_login", "auth_email", "identifier", "userid", "user-name", "user-id", "loginid", "login-id"],
        autocomplete: ["email", "username", "email-address", "user", "login"],
        type: ["email", "tel"],
        placeholder: ["email", "username", "phone", "mobile", "user"]
      };
      const PASSWORD_CHANGE_PATTERNS = {
        name: ["new_password", "newpassword", "confirm_password", "confirmpassword", "password_confirm", "password1", "password2", "new-password", "verify-password"],
        autocomplete: ["new-password"]
      };
      const detectedInputs = /* @__PURE__ */ new WeakSet();
      let detectedButtons = /* @__PURE__ */ new WeakSet();
      function injectDetectionIndicator(passwordInput) {
        if (!passwordInput || detectedInputs.has(passwordInput)) return;
        detectedInputs.add(passwordInput);
      }
      function injectButtonIndicator(btn) {
        if (!btn || detectedButtons.has(btn)) return;
        detectedButtons.add(btn);
      }
      function scanAndIndicateButtons() {
        document.querySelectorAll("[data-vbox-btn-indicator]").forEach((el) => el.remove());
        detectedButtons = /* @__PURE__ */ new WeakSet();
        const visiblePasswordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter((input) => input.offsetParent !== null && !input.disabled);
        if (visiblePasswordInputs.length === 0) return;
        const buttons = /* @__PURE__ */ new Set();
        visiblePasswordInputs.forEach((pwInput) => {
          const form = pwInput.closest("form");
          if (form) {
            form.querySelectorAll('button, input[type="submit"], [role="button"]').forEach((btn) => {
              if (btn.offsetParent !== null && !btn.disabled) buttons.add(btn);
            });
          }
        });
        if (buttons.size === 0) {
          visiblePasswordInputs.forEach((pwInput) => {
            let container = pwInput.parentElement;
            let depth = 0;
            while (container && depth < 15) {
              const foundButtons = container.querySelectorAll('button, input[type="submit"], [role="button"]');
              const visibleButtons = Array.from(foundButtons).filter(
                (btn) => btn.offsetParent !== null && !btn.disabled && btn.type !== "checkbox" && (btn.textContent?.trim().length > 0 || btn.querySelector("span, div"))
              );
              if (visibleButtons.length > 0) {
                visibleButtons.forEach((btn) => buttons.add(btn));
                break;
              }
              container = container.parentElement;
              depth++;
            }
          });
        }
        if (buttons.size === 0) {
          document.querySelectorAll('button[type="submit"], button[type="button"], input[type="submit"]').forEach((btn) => {
            if (btn.offsetParent !== null && !btn.disabled) {
              buttons.add(btn);
            }
          });
        }
        buttons.forEach((btn) => injectButtonIndicator(btn));
      }
      function scanAndIndicate() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach((input) => {
          if (input.offsetParent !== null && !input.disabled) {
            injectDetectionIndicator(input);
          }
        });
      }
      function isLoginForm(form) {
        const passwordFields = form.querySelectorAll('input[type="password"]');
        if (passwordFields.length === 0) return false;
        if (passwordFields.length === 1) return true;
        let score = 0;
        if (passwordFields.length === 2) score -= 1;
        const inputs = form.querySelectorAll("input");
        inputs.forEach((input) => {
          const type = (input.type || "text").toLowerCase();
          const name = (input.name || "").toLowerCase();
          const id = (input.id || "").toLowerCase();
          const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
          const placeholder = (input.placeholder || "").toLowerCase();
          if (type === "email" || type === "tel") score += 1;
          if (USERNAME_PATTERNS.name.some((p) => name.includes(p) || id.includes(p))) score += 1;
          if (autocomplete.includes("username") || autocomplete.includes("email")) score += 2;
          if (USERNAME_PATTERNS.placeholder.some((p) => placeholder.includes(p))) score += 1;
          if (name.includes("confirm") || name.includes("verify") || name.includes("repeat")) score -= 1;
          if (name.includes("first_name") || name.includes("last_name") || name.includes("fullname")) score -= 2;
        });
        const action = (form.action || "").toLowerCase();
        if (action.includes("login") || action.includes("signin") || action.includes("auth")) score += 2;
        if (action.includes("register") || action.includes("signup") || action.includes("create")) score -= 2;
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb) => {
          const name = (cb.name || "").toLowerCase();
          if (name.includes("remember") || name.includes("stay")) score += 1;
        });
        return score >= 1;
      }
      function extractFormData(form) {
        const data = {
          origin: window.location.origin,
          url: window.location.href,
          title: document.title,
          inputs: [],
          usernameField: null,
          passwordField: null,
          newPasswordField: null,
          confirmPasswordField: null,
          isChangePasswordForm: false
        };
        const inputs = form.querySelectorAll("input");
        inputs.forEach((input) => {
          const type = (input.type || "text").toLowerCase();
          const name = (input.name || "").toLowerCase();
          const id = (input.id || "").toLowerCase();
          const autocomplete = (input.getAttribute("autocomplete") || "").toLowerCase();
          const placeholder = (input.placeholder || "").toLowerCase();
          const inputData = {
            type,
            name,
            id,
            autocomplete,
            placeholder,
            value: input.value,
            hasValue: !!input.value,
            element: input
          };
          data.inputs.push(inputData);
          if (type === "password") {
            const isNewPassword = PASSWORD_CHANGE_PATTERNS.name.some((p) => name.includes(p)) || PASSWORD_CHANGE_PATTERNS.autocomplete.includes(autocomplete) || placeholder.includes("new password") || placeholder.includes("confirm");
            if (isNewPassword) {
              if (!data.newPasswordField) {
                data.newPasswordField = inputData;
              } else {
                data.confirmPasswordField = inputData;
              }
            } else if (!data.passwordField) {
              data.passwordField = inputData;
            } else {
              if (!data.newPasswordField) {
                data.newPasswordField = inputData;
                data.isChangePasswordForm = true;
              }
            }
          }
          if (!data.usernameField && type !== "password" && type !== "hidden" && type !== "submit" && type !== "button") {
            const isUsername = USERNAME_PATTERNS.name.some((p) => name.includes(p) || id.includes(p)) || USERNAME_PATTERNS.autocomplete.includes(autocomplete) || USERNAME_PATTERNS.type.includes(type) || USERNAME_PATTERNS.placeholder.some((p) => placeholder.includes(p));
            if (isUsername) {
              data.usernameField = inputData;
            }
          }
        });
        if (data.newPasswordField && data.confirmPasswordField) {
          data.isChangePasswordForm = true;
        }
        if (!data.usernameField && data.passwordField) {
          const passwordInput = form.querySelector('input[type="password"]');
          if (passwordInput) {
            const precedingInputs = Array.from(form.querySelectorAll("input")).filter(
              (i) => i !== passwordInput && i.type !== "hidden" && i.type !== "submit" && i.type !== "button" && i.type !== "checkbox" && i.type !== "radio"
            );
            for (let i = precedingInputs.length - 1; i >= 0; i--) {
              const inp = precedingInputs[i];
              if (["text", "email", "tel", ""].includes(inp.type.toLowerCase())) {
                data.usernameField = {
                  type: (inp.type || "text").toLowerCase(),
                  name: (inp.name || "").toLowerCase(),
                  id: (inp.id || "").toLowerCase(),
                  autocomplete: (inp.getAttribute("autocomplete") || "").toLowerCase(),
                  placeholder: (inp.placeholder || "").toLowerCase(),
                  value: inp.value,
                  hasValue: !!inp.value,
                  element: inp
                };
                break;
              }
            }
          }
        }
        return data;
      }
      function extractCredentials(form) {
        const formData = extractFormData(form);
        return {
          username: formData.usernameField?.value || "",
          password: formData.passwordField?.value || ""
        };
      }
      function setInputValue(element, value) {
        if (!element || value === void 0) return false;
        try {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            "value"
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
          } else {
            element.value = value;
          }
          element.dispatchEvent(new Event("focus", { bubbles: true }));
          element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("keyup", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
          const tracker = element._valueTracker;
          if (tracker) {
            tracker.setValue("");
          }
          return true;
        } catch (e) {
          element.value = value;
          return false;
        }
      }
      function highlightField(element) {
        if (!CONFIG.highlightFill || !element) return;
        try {
          const original = element.style.backgroundColor;
          element.style.backgroundColor = CONFIG.highlightColor;
          element.style.transition = "background-color 0.3s ease";
          setTimeout(() => {
            element.style.backgroundColor = original || "";
          }, CONFIG.highlightDuration);
        } catch (e) {
        }
      }
      function scanForLoginForms() {
        const forms = document.querySelectorAll("form");
        const loginForms = [];
        forms.forEach((form) => {
          if (isLoginForm(form)) {
            const formData = extractFormData(form);
            loginForms.push(formData);
            log("Found login form:", formData);
          }
        });
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach((passwordInput) => {
          const parentForm = passwordInput.closest("form");
          if (!parentForm) {
            const formData = {
              origin: window.location.origin,
              url: window.location.href,
              title: document.title,
              inputs: [],
              usernameField: null,
              passwordField: null,
              standalonePassword: true
            };
            const container = passwordInput.closest("div, section, main, article") || passwordInput.parentElement;
            if (container) {
              const siblings = container.querySelectorAll("input");
              siblings.forEach((input) => {
                if (input !== passwordInput && input.type !== "hidden") {
                  const type = (input.type || "text").toLowerCase();
                  const name = (input.name || "").toLowerCase();
                  if (type === "email" || type === "tel" || type === "text") {
                    if (USERNAME_PATTERNS.name.some((p) => name.includes(p)) || type === "email") {
                      formData.usernameField = {
                        type,
                        name,
                        id: (input.id || "").toLowerCase(),
                        value: input.value,
                        element: input
                      };
                    }
                  }
                  formData.inputs.push({
                    type,
                    name,
                    id: (input.id || "").toLowerCase(),
                    value: input.value,
                    element: input
                  });
                }
              });
            }
            formData.passwordField = {
              type: "password",
              name: (passwordInput.name || "").toLowerCase(),
              id: (passwordInput.id || "").toLowerCase(),
              value: passwordInput.value,
              element: passwordInput
            };
            if (formData.usernameField || formData.inputs.length > 0) {
              loginForms.push(formData);
            }
          }
        });
        detectedForms = loginForms;
        return loginForms;
      }
      function findLoginForm() {
        const forms = document.querySelectorAll("form");
        for (const form of forms) {
          if (isLoginForm(form)) return form;
        }
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        if (passwordInputs.length > 0) {
          return passwordInputs[0].closest('form, div[class*="modal"], div[class*="verify"], div[role="dialog"]') || passwordInputs[0];
        }
        return null;
      }
      function autofillCredentials(credentials) {
        if (!credentials || credentials.length === 0) {
          log("No credentials to fill");
          return { success: false, reason: "No credentials" };
        }
        const cred = credentials[0];
        let filled = false;
        const forms = document.querySelectorAll("form");
        forms.forEach((form) => {
          if (!isLoginForm(form)) return;
          const passwordInput = form.querySelector('input[type="password"]');
          if (!passwordInput) return;
          if (passwordInput.offsetParent === null || passwordInput.disabled) return;
          setInputValue(passwordInput, cred.password);
          highlightField(passwordInput);
          log("Filled password for:", cred.origin);
          const inputs = form.querySelectorAll("input");
          let usernameFilled = false;
          for (const input of inputs) {
            const type = (input.type || "text").toLowerCase();
            const name = (input.name || "").toLowerCase();
            const id = (input.id || "").toLowerCase();
            const ac = (input.getAttribute("autocomplete") || "").toLowerCase();
            const placeholder = (input.placeholder || "").toLowerCase();
            if (type === "password" || type === "hidden") continue;
            if (input.offsetParent === null || input.disabled) continue;
            if (USERNAME_PATTERNS.type.includes(type) || USERNAME_PATTERNS.name.some((p) => name.includes(p) || id.includes(p)) || USERNAME_PATTERNS.autocomplete.includes(ac) || USERNAME_PATTERNS.placeholder.some((p) => placeholder.includes(p))) {
              setInputValue(input, cred.username);
              highlightField(input);
              usernameFilled = true;
              break;
            }
          }
          if (!usernameFilled && cred.username) {
            const allInputs = Array.from(inputs);
            const pwIndex = allInputs.indexOf(passwordInput);
            for (let i = pwIndex - 1; i >= 0; i--) {
              const inp = allInputs[i];
              const type = (inp.type || "text").toLowerCase();
              if (["text", "email", "tel", ""].includes(type) && inp.offsetParent !== null && !inp.disabled) {
                setInputValue(inp, cred.username);
                highlightField(inp);
                break;
              }
            }
          }
          filled = true;
        });
        const standalonePasswords = document.querySelectorAll('input[type="password"]');
        standalonePasswords.forEach((pwInput) => {
          if (pwInput.closest("form")) return;
          if (pwInput.offsetParent === null || pwInput.disabled) return;
          const matchingCred = credentials.find((c) => !c.username || c.username === "") || credentials[0];
          if (matchingCred) {
            setInputValue(pwInput, matchingCred.password);
            highlightField(pwInput);
            if (matchingCred.username) {
              const container = pwInput.closest('div, section, [role="dialog"]') || document.body;
              const nearbyInputs = container.querySelectorAll("input");
              const pwIndex = Array.from(nearbyInputs).indexOf(pwInput);
              for (let i = pwIndex - 1; i >= 0; i--) {
                const inp = nearbyInputs[i];
                const type = (inp.type || "text").toLowerCase();
                if (["text", "email", "tel", ""].includes(type) && inp.offsetParent !== null && !inp.disabled) {
                  setInputValue(inp, matchingCred.username);
                  highlightField(inp);
                  break;
                }
              }
            }
            filled = true;
          }
        });
        return { success: filled, filled: filled ? 1 : 0 };
      }
      async function triggerAutofill() {
        try {
          const loginForm = findLoginForm();
          if (!loginForm) {
            if (autofillAttempts < CONFIG.maxRetries) {
              autofillAttempts++;
              setTimeout(triggerAutofill, CONFIG.autofillDelay * autofillAttempts);
            }
            return;
          }
          const result = await ipcRenderer2.invoke("password-autofill-lookup", {
            profileId: null,
            origin: window.location.origin
          });
          if (result?.success && result.credentials?.length > 0) {
            log(`Autofilling ${result.credentials.length} credentials for ${window.location.origin}`);
            setTimeout(() => {
              autofillCredentials(result.credentials);
              autofillAttempts = 0;
            }, 100);
          }
        } catch (e) {
          console.error("[PasswordCapture] Autofill error:", e);
        }
      }
      function setupSubmitListener() {
        document.addEventListener("submit", (e) => {
          const form = e.target;
          if (!isLoginForm(form)) return;
          const { username, password } = extractCredentials(form);
          if (!password) return;
          credentialsCaptured = true;
          lastCapturedUsername = username;
          lastCapturedPassword = password;
          if (!cachedProfileId) {
            try {
              const ctx = ipcRenderer2.sendSync("get-workspace-context-sync");
              cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            } catch {
            }
          }
          if (!cachedProfileId) return;
          ipcRenderer2.send("password-capture-urgent", {
            profileId: cachedProfileId,
            origin: window.location.origin,
            username,
            password,
            title: document.title,
            url: window.location.href
          });
        }, true);
      }
      function setupPasswordChangeListener() {
        document.addEventListener("submit", (e) => {
          const form = e.target;
          const formData = extractFormData(form);
          if (formData.isChangePasswordForm && formData.newPasswordField?.value) {
            log("Password change detected");
            if (formData.passwordField?.value && formData.newPasswordField.value) {
              const newData = {
                origin: window.location.origin,
                url: window.location.href,
                title: document.title,
                username: formData.usernameField?.value || "",
                password: formData.newPasswordField.value
              };
              credentialsCaptured = true;
              lastCapturedUsername = newData.username;
              lastCapturedPassword = newData.password;
              if (!cachedProfileId) {
                try {
                  const ctx = ipcRenderer2.sendSync("get-workspace-context-sync");
                  cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
                } catch {
                }
              }
              if (cachedProfileId) {
                ipcRenderer2.send("password-capture-urgent", {
                  profileId: cachedProfileId,
                  origin: newData.origin,
                  username: newData.username,
                  password: newData.password,
                  title: newData.title,
                  url: newData.url
                });
              }
            }
          }
        }, true);
      }
      function setupClickCapture() {
        document.addEventListener("click", (e) => {
          handlePasswordClick(e);
        }, true);
        document.addEventListener("mousedown", (e) => {
          const btn = e.target.closest('button, input[type="submit"], [role="button"]');
          if (btn) {
            lastClickedSubmitBtn = btn;
          }
        }, true);
      }
      function handlePasswordClick(e) {
        const btn = e.target.closest('button, input[type="submit"], [role="button"]');
        if (!btn) {
          const parentBtn = e.target.closest("button");
          if (!parentBtn) return;
        }
        const clickedBtn = btn || e.target.closest("button");
        const form = clickedBtn.closest("form");
        let passwordInput = null;
        let usernameInput = null;
        if (form) {
          passwordInput = form.querySelector('input[type="password"]');
        }
        if (!passwordInput) {
          const parent = clickedBtn.parentElement;
          if (parent) {
            const container = parent.parentElement || parent;
            passwordInput = container.querySelector('input[type="password"]');
          }
        }
        if (!passwordInput) {
          const allPasswordInputs = document.querySelectorAll('input[type="password"]');
          for (const input of allPasswordInputs) {
            if (input.offsetParent !== null && !input.disabled) {
              passwordInput = input;
              break;
            }
          }
        }
        if (!passwordInput) {
          log("Click on button but no password input found", { btnText: clickedBtn.textContent?.trim(), form: !!form });
          return;
        }
        const password = passwordInput.value || "";
        if (!password) return;
        log("Click detected near password field", {
          hasPassword: true,
          passwordLength: password.length,
          form: !!form,
          btnText: clickedBtn.textContent?.trim()
        });
        const searchRoot = form || passwordInput.closest("div, section, main, body");
        if (searchRoot) {
          const inputs = searchRoot.querySelectorAll("input");
          for (const input of inputs) {
            const type = (input.type || "text").toLowerCase();
            const name = (input.name || "").toLowerCase();
            const id = (input.id || "").toLowerCase();
            const placeholder = (input.placeholder || "").toLowerCase();
            if (type === "password" || type === "submit" || type === "button") continue;
            if (USERNAME_PATTERNS.type.includes(type) || USERNAME_PATTERNS.name.some((p) => name.includes(p) || id.includes(p)) || USERNAME_PATTERNS.placeholder.some((p) => placeholder.includes(p))) {
              usernameInput = input;
              break;
            }
          }
          if (!usernameInput) {
            const allInputs = Array.from(inputs);
            const pwIdx = allInputs.indexOf(passwordInput);
            for (let i = pwIdx - 1; i >= 0; i--) {
              const inp = allInputs[i];
              const type = (inp.type || "text").toLowerCase();
              if (["text", "email", "tel", ""].includes(type) && inp.value) {
                usernameInput = inp;
                break;
              }
            }
          }
        }
        if (!usernameInput) {
          const hiddenEmails = document.querySelectorAll('input[type="email"][name="identifier"], input[type="email"][name="email"], input[name="identifierId"]');
          for (const input of hiddenEmails) {
            if (input.value) {
              usernameInput = input;
              break;
            }
          }
        }
        const username = usernameInput ? usernameInput.value : "";
        credentialsCaptured = true;
        lastCapturedUsername = username;
        lastCapturedPassword = password;
        if (!cachedProfileId) {
          try {
            const ctx = ipcRenderer2.sendSync("get-workspace-context-sync");
            cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
          } catch (err) {
          }
        }
        log("Sending password-capture-urgent", {
          profileId: cachedProfileId || "(null \u2014 main process will resolve)",
          origin: window.location.origin,
          username: username || "(empty)",
          hasPassword: true
        });
        ipcRenderer2.send("password-capture-urgent", {
          profileId: cachedProfileId || null,
          origin: window.location.origin,
          username,
          password,
          title: document.title,
          url: window.location.href
        });
      }
      function sendCapture() {
        if (!lastCapturedPassword) return;
        let pid = cachedProfileId;
        if (!pid) {
          try {
            const ctx = ipcRenderer2.sendSync("get-workspace-context-sync");
            pid = ctx?.id || ctx?.profileId || ctx?.profile_id;
          } catch {
          }
        }
        if (!pid) return;
        ipcRenderer2.send("password-capture-urgent", {
          profileId: pid,
          origin: window.location.origin,
          username: lastCapturedUsername || "",
          password: lastCapturedPassword,
          title: document.title,
          url: window.location.href
        });
      }
      function setupMutationObserver() {
        if (isObserving) return;
        const observer = new MutationObserver((mutations) => {
          let hasNewForm = false;
          let hasNewPassword = false;
          let hasAttributeChange = false;
          for (const mutation of mutations) {
            if (mutation.type === "childList") {
              for (const node of mutation.addedNodes) {
                if (!node || node.nodeType !== 1) continue;
                if (node.nodeName === "FORM" || node.querySelector && node.querySelector("form")) {
                  hasNewForm = true;
                }
                if (node.nodeName === "INPUT" && node.type === "password") {
                  hasNewPassword = true;
                }
                if (node.querySelector && node.querySelector('input[type="password"]')) {
                  hasNewPassword = true;
                }
              }
            }
            if (mutation.type === "attributes" && mutation.target.nodeName === "INPUT") {
              const input = mutation.target;
              if (input.type === "password") {
                hasNewPassword = true;
              }
            }
            if (hasNewForm || hasNewPassword || hasAttributeChange) break;
          }
          if (hasNewForm || hasNewPassword || hasAttributeChange) {
            setTimeout(() => {
              scanForLoginForms();
              triggerAutofill();
              scanAndIndicate();
              scanAndIndicateButtons();
            }, CONFIG.debounceDelay);
          }
        });
        const target = document.body || document.documentElement;
        if (!target) return;
        observer.observe(target, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["type", "style", "class"]
        });
        isObserving = true;
        log("MutationObserver started");
      }
      function setupInputTracking() {
        document.addEventListener("input", (e) => {
          const input = e.target;
          if (!input || input.tagName !== "INPUT") return;
          const type = (input.type || "text").toLowerCase();
          const form = input.closest("form");
          if (form && isLoginForm(form)) {
            if (type === "password") {
              lastCapturedPassword = input.value || "";
            } else if (type !== "hidden" && type !== "submit" && type !== "button") {
              const name = (input.name || "").toLowerCase();
              const id = (input.id || "").toLowerCase();
              const placeholder = (input.placeholder || "").toLowerCase();
              if (USERNAME_PATTERNS.type.includes(type) || USERNAME_PATTERNS.name.some((p) => name.includes(p) || id.includes(p)) || USERNAME_PATTERNS.placeholder.some((p) => placeholder.includes(p))) {
                lastCapturedUsername = input.value || "";
              }
            }
          } else if (type === "password" && !form) {
            lastCapturedPassword = input.value || "";
            const container = input.closest('div, section, [role="dialog"]') || document.body;
            const nearbyInputs = container.querySelectorAll("input");
            const pwIndex = Array.from(nearbyInputs).indexOf(input);
            for (let i = pwIndex - 1; i >= 0; i--) {
              const inp = nearbyInputs[i];
              const inpType = (inp.type || "text").toLowerCase();
              if (["text", "email", "tel", ""].includes(inpType) && inp.value) {
                lastCapturedUsername = inp.value;
                break;
              }
            }
          }
        }, true);
      }
      function getPageInfo() {
        return {
          origin: window.location.origin,
          href: window.location.href,
          title: document.title,
          hasLoginForm: detectedForms.length > 0,
          formCount: detectedForms.length
        };
      }
      async function init() {
        try {
          try {
            const ctx = await ipcRenderer2.invoke("get-workspace-context");
            cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            log("Init \u2014 workspace context:", {
              success: ctx?.success,
              profileId: cachedProfileId,
              error: ctx?.error
            });
          } catch (e) {
            console.error("[PasswordCapture] Init \u2014 get-workspace-context failed:", e.message);
          }
          setupSubmitListener();
          setupPasswordChangeListener();
          setupClickCapture();
          setupInputTracking();
          setupMutationObserver();
          scanForLoginForms();
          triggerAutofill();
          scanAndIndicate();
          scanAndIndicateButtons();
          setTimeout(() => {
            const iframes = document.querySelectorAll("iframe");
            iframes.forEach((iframe) => {
              try {
                if (iframe.contentDocument) {
                  const passwordFields = iframe.contentDocument.querySelectorAll('input[type="password"]');
                  if (passwordFields.length > 0) {
                    log("Found login form in iframe");
                    triggerAutofill();
                  }
                }
              } catch (e) {
              }
            });
          }, 500);
          log("Password Engine initialized for:", window.location.origin);
        } catch (error) {
          console.error("[PasswordCapture] Init error:", error);
        }
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
      window.addEventListener("beforeunload", () => {
        if (credentialsCaptured) return;
        sendCapture();
      });
      window.addEventListener("pagehide", () => {
        if (credentialsCaptured) return;
        sendCapture();
      });
      window.addEventListener("unload", () => {
        if (credentialsCaptured) return;
        sendCapture();
      });
      document.addEventListener("visibilitychange", () => {
        if (credentialsCaptured) return;
        if (document.visibilityState !== "hidden") return;
        sendCapture();
      });
      window.addEventListener("hashchange", () => {
        credentialsCaptured = false;
        autofillAttempts = 0;
        setTimeout(triggerAutofill, 300);
      });
      window.addEventListener("popstate", () => {
        credentialsCaptured = false;
        autofillAttempts = 0;
        setTimeout(triggerAutofill, 500);
      });
      window.__passwordEngine = {
        scanForLoginForms,
        autofillCredentials,
        getPageInfo,
        requestAutofill: (credentials) => autofillCredentials(credentials),
        triggerAutofill,
        getDetectedForms: () => detectedForms
      };
    }
    module2.exports = { init: initPasswordCapture2 };
  }
});

// electron/webview/stealthBundle.cjs
var require_stealthBundle = __commonJS({
  "electron/webview/stealthBundle.cjs"(exports2, module2) {
    var stealthCode = `/**
 * Stealth Evasion Bundle
 * Auto-generated from puppeteer-extra-plugin-stealth
 * Generated at: 2026-05-29T05:51:52.524Z
 * 
 * Included evasions: chrome.app, chrome.csi, chrome.loadTimes, chrome.runtime, iframe.contentWindow, media.codecs, navigator.hardwareConcurrency, navigator.languages, navigator.permissions, navigator.plugins, navigator.vendor, navigator.webdriver, window.outerdimensions
 * 
 * DO NOT EDIT MANUALLY \u2014 regenerate with: node scripts/extract-stealth.js
 */
(function() {
    'use strict';

    // \u2500\u2500\u2500 chrome.app \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for chrome.app
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"utils => {\\n      if (!window.chrome) {\\n        // Use the exact property descriptor found in headful Chrome\\n        // fetch it via \`Object.getOwnPropertyDescriptor(window, 'chrome')\`\\n        Object.defineProperty(window, 'chrome', {\\n          writable: true,\\n          enumerable: true,\\n          configurable: false, // note!\\n          value: {} // We'll extend that later\\n        })\\n      }\\n\\n      // That means we're running headful and don't need to mock anything\\n      if ('app' in window.chrome) {\\n        return // Nothing to do here\\n      }\\n\\n      const makeError = {\\n        ErrorInInvocation: fn => {\\n          const err = new TypeError(\`Error in invocation of app.\${fn}()\`)\\n          return utils.stripErrorWithAnchor(\\n            err,\\n            \`at \${fn} (eval at <anonymous>\`\\n          )\\n        }\\n      }\\n\\n      // There's a some static data in that property which doesn't seem to change,\\n      // we should periodically check for updates: \`JSON.stringify(window.app, null, 2)\`\\n      const STATIC_DATA = JSON.parse(\\n        \`\\n{\\n  \\"isInstalled\\": false,\\n  \\"InstallState\\": {\\n    \\"DISABLED\\": \\"disabled\\",\\n    \\"INSTALLED\\": \\"installed\\",\\n    \\"NOT_INSTALLED\\": \\"not_installed\\"\\n  },\\n  \\"RunningState\\": {\\n    \\"CANNOT_RUN\\": \\"cannot_run\\",\\n    \\"READY_TO_RUN\\": \\"ready_to_run\\",\\n    \\"RUNNING\\": \\"running\\"\\n  }\\n}\\n        \`.trim()\\n      )\\n\\n      window.chrome.app = {\\n        ...STATIC_DATA,\\n\\n        get isInstalled() {\\n          return false\\n        },\\n\\n        getDetails: function getDetails() {\\n          if (arguments.length) {\\n            throw makeError.ErrorInInvocation(\`getDetails\`)\\n          }\\n          return null\\n        },\\n        getIsInstalled: function getDetails() {\\n          if (arguments.length) {\\n            throw makeError.ErrorInInvocation(\`getIsInstalled\`)\\n          }\\n          return false\\n        },\\n        runningState: function getDetails() {\\n          if (arguments.length) {\\n            throw makeError.ErrorInInvocation(\`runningState\`)\\n          }\\n          return 'cannot_run'\\n        }\\n      }\\n      utils.patchToStringNested(window.chrome.app)\\n    }","_args":[]});
        })();
    } catch(e) { console.warn('[Stealth:chrome.app] Error:', e.message); }

    // \u2500\u2500\u2500 chrome.csi \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for chrome.csi
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"utils => {\\n      if (!window.chrome) {\\n        // Use the exact property descriptor found in headful Chrome\\n        // fetch it via \`Object.getOwnPropertyDescriptor(window, 'chrome')\`\\n        Object.defineProperty(window, 'chrome', {\\n          writable: true,\\n          enumerable: true,\\n          configurable: false, // note!\\n          value: {} // We'll extend that later\\n        })\\n      }\\n\\n      // That means we're running headful and don't need to mock anything\\n      if ('csi' in window.chrome) {\\n        return // Nothing to do here\\n      }\\n\\n      // Check that the Navigation Timing API v1 is available, we need that\\n      if (!window.performance || !window.performance.timing) {\\n        return\\n      }\\n\\n      const { timing } = window.performance\\n\\n      window.chrome.csi = function() {\\n        return {\\n          onloadT: timing.domContentLoadedEventEnd,\\n          startE: timing.navigationStart,\\n          pageT: Date.now() - timing.navigationStart,\\n          tran: 15 // Transition type or something\\n        }\\n      }\\n      utils.patchToString(window.chrome.csi)\\n    }","_args":[]});
        })();
    } catch(e) { console.warn('[Stealth:chrome.csi] Error:', e.message); }

    // \u2500\u2500\u2500 chrome.loadTimes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for chrome.loadTimes
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { opts }) => {\\n        if (!window.chrome) {\\n          // Use the exact property descriptor found in headful Chrome\\n          // fetch it via \`Object.getOwnPropertyDescriptor(window, 'chrome')\`\\n          Object.defineProperty(window, 'chrome', {\\n            writable: true,\\n            enumerable: true,\\n            configurable: false, // note!\\n            value: {} // We'll extend that later\\n          })\\n        }\\n\\n        // That means we're running headful and don't need to mock anything\\n        if ('loadTimes' in window.chrome) {\\n          return // Nothing to do here\\n        }\\n\\n        // Check that the Navigation Timing API v1 + v2 is available, we need that\\n        if (\\n          !window.performance ||\\n          !window.performance.timing ||\\n          !window.PerformancePaintTiming\\n        ) {\\n          return\\n        }\\n\\n        const { performance } = window\\n\\n        // Some stuff is not available on about:blank as it requires a navigation to occur,\\n        // let's harden the code to not fail then:\\n        const ntEntryFallback = {\\n          nextHopProtocol: 'h2',\\n          type: 'other'\\n        }\\n\\n        // The API exposes some funky info regarding the connection\\n        const protocolInfo = {\\n          get connectionInfo() {\\n            const ntEntry =\\n              performance.getEntriesByType('navigation')[0] || ntEntryFallback\\n            return ntEntry.nextHopProtocol\\n          },\\n          get npnNegotiatedProtocol() {\\n            // NPN is deprecated in favor of ALPN, but this implementation returns the\\n            // HTTP/2 or HTTP2+QUIC/39 requests negotiated via ALPN.\\n            const ntEntry =\\n              performance.getEntriesByType('navigation')[0] || ntEntryFallback\\n            return ['h2', 'hq'].includes(ntEntry.nextHopProtocol)\\n              ? ntEntry.nextHopProtocol\\n              : 'unknown'\\n          },\\n          get navigationType() {\\n            const ntEntry =\\n              performance.getEntriesByType('navigation')[0] || ntEntryFallback\\n            return ntEntry.type\\n          },\\n          get wasAlternateProtocolAvailable() {\\n            // The Alternate-Protocol header is deprecated in favor of Alt-Svc\\n            // (https://www.mnot.net/blog/2016/03/09/alt-svc), so technically this\\n            // should always return false.\\n            return false\\n          },\\n          get wasFetchedViaSpdy() {\\n            // SPDY is deprecated in favor of HTTP/2, but this implementation returns\\n            // true for HTTP/2 or HTTP2+QUIC/39 as well.\\n            const ntEntry =\\n              performance.getEntriesByType('navigation')[0] || ntEntryFallback\\n            return ['h2', 'hq'].includes(ntEntry.nextHopProtocol)\\n          },\\n          get wasNpnNegotiated() {\\n            // NPN is deprecated in favor of ALPN, but this implementation returns true\\n            // for HTTP/2 or HTTP2+QUIC/39 requests negotiated via ALPN.\\n            const ntEntry =\\n              performance.getEntriesByType('navigation')[0] || ntEntryFallback\\n            return ['h2', 'hq'].includes(ntEntry.nextHopProtocol)\\n          }\\n        }\\n\\n        const { timing } = window.performance\\n\\n        // Truncate number to specific number of decimals, most of the \`loadTimes\` stuff has 3\\n        function toFixed(num, fixed) {\\n          var re = new RegExp('^-?\\\\\\\\d+(?:.\\\\\\\\d{0,' + (fixed || -1) + '})?')\\n          return num.toString().match(re)[0]\\n        }\\n\\n        const timingInfo = {\\n          get firstPaintAfterLoadTime() {\\n            // This was never actually implemented and always returns 0.\\n            return 0\\n          },\\n          get requestTime() {\\n            return timing.navigationStart / 1000\\n          },\\n          get startLoadTime() {\\n            return timing.navigationStart / 1000\\n          },\\n          get commitLoadTime() {\\n            return timing.responseStart / 1000\\n          },\\n          get finishDocumentLoadTime() {\\n            return timing.domContentLoadedEventEnd / 1000\\n          },\\n          get finishLoadTime() {\\n            return timing.loadEventEnd / 1000\\n          },\\n          get firstPaintTime() {\\n            const fpEntry = performance.getEntriesByType('paint')[0] || {\\n              startTime: timing.loadEventEnd / 1000 // Fallback if no navigation occured (\`about:blank\`)\\n            }\\n            return toFixed(\\n              (fpEntry.startTime + performance.timeOrigin) / 1000,\\n              3\\n            )\\n          }\\n        }\\n\\n        window.chrome.loadTimes = function() {\\n          return {\\n            ...protocolInfo,\\n            ...timingInfo\\n          }\\n        }\\n        utils.patchToString(window.chrome.loadTimes)\\n      }","_args":[{"opts":{}}]});
        })();
    } catch(e) { console.warn('[Stealth:chrome.loadTimes] Error:', e.message); }

    // \u2500\u2500\u2500 chrome.runtime \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for chrome.runtime
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { opts, STATIC_DATA }) => {\\n        if (!window.chrome) {\\n          // Use the exact property descriptor found in headful Chrome\\n          // fetch it via \`Object.getOwnPropertyDescriptor(window, 'chrome')\`\\n          Object.defineProperty(window, 'chrome', {\\n            writable: true,\\n            enumerable: true,\\n            configurable: false, // note!\\n            value: {} // We'll extend that later\\n          })\\n        }\\n\\n        // That means we're running headful and don't need to mock anything\\n        const existsAlready = 'runtime' in window.chrome\\n        // \`chrome.runtime\` is only exposed on secure origins\\n        const isNotSecure = !window.location.protocol.startsWith('https')\\n        if (existsAlready || (isNotSecure && !opts.runOnInsecureOrigins)) {\\n          return // Nothing to do here\\n        }\\n\\n        window.chrome.runtime = {\\n          // There's a bunch of static data in that property which doesn't seem to change,\\n          // we should periodically check for updates: \`JSON.stringify(window.chrome.runtime, null, 2)\`\\n          ...STATIC_DATA,\\n          // \`chrome.runtime.id\` is extension related and returns undefined in Chrome\\n          get id() {\\n            return undefined\\n          },\\n          // These two require more sophisticated mocks\\n          connect: null,\\n          sendMessage: null\\n        }\\n\\n        const makeCustomRuntimeErrors = (preamble, method, extensionId) => ({\\n          NoMatchingSignature: new TypeError(\\n            preamble + \`No matching signature.\`\\n          ),\\n          MustSpecifyExtensionID: new TypeError(\\n            preamble +\\n              \`\${method} called from a webpage must specify an Extension ID (string) for its first argument.\`\\n          ),\\n          InvalidExtensionID: new TypeError(\\n            preamble + \`Invalid extension id: '\${extensionId}'\`\\n          )\\n        })\\n\\n        // Valid Extension IDs are 32 characters in length and use the letter \`a\` to \`p\`:\\n        // https://source.chromium.org/chromium/chromium/src/+/master:components/crx_file/id_util.cc;drc=14a055ccb17e8c8d5d437fe080faba4c6f07beac;l=90\\n        const isValidExtensionID = str =>\\n          str.length === 32 && str.toLowerCase().match(/^[a-p]+$/)\\n\\n        /** Mock \`chrome.runtime.sendMessage\` */\\n        const sendMessageHandler = {\\n          apply: function(target, ctx, args) {\\n            const [extensionId, options, responseCallback] = args || []\\n\\n            // Define custom errors\\n            const errorPreamble = \`Error in invocation of runtime.sendMessage(optional string extensionId, any message, optional object options, optional function responseCallback): \`\\n            const Errors = makeCustomRuntimeErrors(\\n              errorPreamble,\\n              \`chrome.runtime.sendMessage()\`,\\n              extensionId\\n            )\\n\\n            // Check if the call signature looks ok\\n            const noArguments = args.length === 0\\n            const tooManyArguments = args.length > 4\\n            const incorrectOptions = options && typeof options !== 'object'\\n            const incorrectResponseCallback =\\n              responseCallback && typeof responseCallback !== 'function'\\n            if (\\n              noArguments ||\\n              tooManyArguments ||\\n              incorrectOptions ||\\n              incorrectResponseCallback\\n            ) {\\n              throw Errors.NoMatchingSignature\\n            }\\n\\n            // At least 2 arguments are required before we even validate the extension ID\\n            if (args.length < 2) {\\n              throw Errors.MustSpecifyExtensionID\\n            }\\n\\n            // Now let's make sure we got a string as extension ID\\n            if (typeof extensionId !== 'string') {\\n              throw Errors.NoMatchingSignature\\n            }\\n\\n            if (!isValidExtensionID(extensionId)) {\\n              throw Errors.InvalidExtensionID\\n            }\\n\\n            return undefined // Normal behavior\\n          }\\n        }\\n        utils.mockWithProxy(\\n          window.chrome.runtime,\\n          'sendMessage',\\n          function sendMessage() {},\\n          sendMessageHandler\\n        )\\n\\n        /**\\n         * Mock \`chrome.runtime.connect\`\\n         *\\n         * @see https://developer.chrome.com/apps/runtime#method-connect\\n         */\\n        const connectHandler = {\\n          apply: function(target, ctx, args) {\\n            const [extensionId, connectInfo] = args || []\\n\\n            // Define custom errors\\n            const errorPreamble = \`Error in invocation of runtime.connect(optional string extensionId, optional object connectInfo): \`\\n            const Errors = makeCustomRuntimeErrors(\\n              errorPreamble,\\n              \`chrome.runtime.connect()\`,\\n              extensionId\\n            )\\n\\n            // Behavior differs a bit from sendMessage:\\n            const noArguments = args.length === 0\\n            const emptyStringArgument = args.length === 1 && extensionId === ''\\n            if (noArguments || emptyStringArgument) {\\n              throw Errors.MustSpecifyExtensionID\\n            }\\n\\n            const tooManyArguments = args.length > 2\\n            const incorrectConnectInfoType =\\n              connectInfo && typeof connectInfo !== 'object'\\n\\n            if (tooManyArguments || incorrectConnectInfoType) {\\n              throw Errors.NoMatchingSignature\\n            }\\n\\n            const extensionIdIsString = typeof extensionId === 'string'\\n            if (extensionIdIsString && extensionId === '') {\\n              throw Errors.MustSpecifyExtensionID\\n            }\\n            if (extensionIdIsString && !isValidExtensionID(extensionId)) {\\n              throw Errors.InvalidExtensionID\\n            }\\n\\n            // There's another edge-case here: extensionId is optional so we might find a connectInfo object as first param, which we need to validate\\n            const validateConnectInfo = ci => {\\n              // More than a first param connectInfo as been provided\\n              if (args.length > 1) {\\n                throw Errors.NoMatchingSignature\\n              }\\n              // An empty connectInfo has been provided\\n              if (Object.keys(ci).length === 0) {\\n                throw Errors.MustSpecifyExtensionID\\n              }\\n              // Loop over all connectInfo props an check them\\n              Object.entries(ci).forEach(([k, v]) => {\\n                const isExpected = ['name', 'includeTlsChannelId'].includes(k)\\n                if (!isExpected) {\\n                  throw new TypeError(\\n                    errorPreamble + \`Unexpected property: '\${k}'.\`\\n                  )\\n                }\\n                const MismatchError = (propName, expected, found) =>\\n                  TypeError(\\n                    errorPreamble +\\n                      \`Error at property '\${propName}': Invalid type: expected \${expected}, found \${found}.\`\\n                  )\\n                if (k === 'name' && typeof v !== 'string') {\\n                  throw MismatchError(k, 'string', typeof v)\\n                }\\n                if (k === 'includeTlsChannelId' && typeof v !== 'boolean') {\\n                  throw MismatchError(k, 'boolean', typeof v)\\n                }\\n              })\\n            }\\n            if (typeof extensionId === 'object') {\\n              validateConnectInfo(extensionId)\\n              throw Errors.MustSpecifyExtensionID\\n            }\\n\\n            // Unfortunately even when the connect fails Chrome will return an object with methods we need to mock as well\\n            return utils.patchToStringNested(makeConnectResponse())\\n          }\\n        }\\n        utils.mockWithProxy(\\n          window.chrome.runtime,\\n          'connect',\\n          function connect() {},\\n          connectHandler\\n        )\\n\\n        function makeConnectResponse() {\\n          const onSomething = () => ({\\n            addListener: function addListener() {},\\n            dispatch: function dispatch() {},\\n            hasListener: function hasListener() {},\\n            hasListeners: function hasListeners() {\\n              return false\\n            },\\n            removeListener: function removeListener() {}\\n          })\\n\\n          const response = {\\n            name: '',\\n            sender: undefined,\\n            disconnect: function disconnect() {},\\n            onDisconnect: onSomething(),\\n            onMessage: onSomething(),\\n            postMessage: function postMessage() {\\n              if (!arguments.length) {\\n                throw new TypeError(\`Insufficient number of arguments.\`)\\n              }\\n              throw new Error(\`Attempting to use a disconnected port object\`)\\n            }\\n          }\\n          return response\\n        }\\n      }","_args":[{"opts":{"runOnInsecureOrigins":false},"STATIC_DATA":{"OnInstalledReason":{"CHROME_UPDATE":"chrome_update","INSTALL":"install","SHARED_MODULE_UPDATE":"shared_module_update","UPDATE":"update"},"OnRestartRequiredReason":{"APP_UPDATE":"app_update","OS_UPDATE":"os_update","PERIODIC":"periodic"},"PlatformArch":{"ARM":"arm","ARM64":"arm64","MIPS":"mips","MIPS64":"mips64","X86_32":"x86-32","X86_64":"x86-64"},"PlatformNaclArch":{"ARM":"arm","MIPS":"mips","MIPS64":"mips64","X86_32":"x86-32","X86_64":"x86-64"},"PlatformOs":{"ANDROID":"android","CROS":"cros","LINUX":"linux","MAC":"mac","OPENBSD":"openbsd","WIN":"win"},"RequestUpdateCheckStatus":{"NO_UPDATE":"no_update","THROTTLED":"throttled","UPDATE_AVAILABLE":"update_available"}}}]});
        })();
    } catch(e) { console.warn('[Stealth:chrome.runtime] Error:', e.message); }

    // \u2500\u2500\u2500 iframe.contentWindow \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for iframe.contentWindow
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, opts) => {\\n      try {\\n        // Adds a contentWindow proxy to the provided iframe element\\n        const addContentWindowProxy = iframe => {\\n          const contentWindowProxy = {\\n            get(target, key) {\\n              // Now to the interesting part:\\n              // We actually make this thing behave like a regular iframe window,\\n              // by intercepting calls to e.g. \`.self\` and redirect it to the correct thing. :)\\n              // That makes it possible for these assertions to be correct:\\n              // iframe.contentWindow.self === window.top // must be false\\n              if (key === 'self') {\\n                return this\\n              }\\n              // iframe.contentWindow.frameElement === iframe // must be true\\n              if (key === 'frameElement') {\\n                return iframe\\n              }\\n              // Intercept iframe.contentWindow[0] to hide the property 0 added by the proxy.\\n              if (key === '0') {\\n                return undefined\\n              }\\n              return Reflect.get(target, key)\\n            }\\n          }\\n\\n          if (!iframe.contentWindow) {\\n            const proxy = new Proxy(window, contentWindowProxy)\\n            Object.defineProperty(iframe, 'contentWindow', {\\n              get() {\\n                return proxy\\n              },\\n              set(newValue) {\\n                return newValue // contentWindow is immutable\\n              },\\n              enumerable: true,\\n              configurable: false\\n            })\\n          }\\n        }\\n\\n        // Handles iframe element creation, augments \`srcdoc\` property so we can intercept further\\n        const handleIframeCreation = (target, thisArg, args) => {\\n          const iframe = target.apply(thisArg, args)\\n\\n          // We need to keep the originals around\\n          const _iframe = iframe\\n          const _srcdoc = _iframe.srcdoc\\n\\n          // Add hook for the srcdoc property\\n          // We need to be very surgical here to not break other iframes by accident\\n          Object.defineProperty(iframe, 'srcdoc', {\\n            configurable: true, // Important, so we can reset this later\\n            get: function() {\\n              return _srcdoc\\n            },\\n            set: function(newValue) {\\n              addContentWindowProxy(this)\\n              // Reset property, the hook is only needed once\\n              Object.defineProperty(iframe, 'srcdoc', {\\n                configurable: false,\\n                writable: false,\\n                value: _srcdoc\\n              })\\n              _iframe.srcdoc = newValue\\n            }\\n          })\\n          return iframe\\n        }\\n\\n        // Adds a hook to intercept iframe creation events\\n        const addIframeCreationSniffer = () => {\\n          /* global document */\\n          const createElementHandler = {\\n            // Make toString() native\\n            get(target, key) {\\n              return Reflect.get(target, key)\\n            },\\n            apply: function(target, thisArg, args) {\\n              const isIframe =\\n                args && args.length && \`\${args[0]}\`.toLowerCase() === 'iframe'\\n              if (!isIframe) {\\n                // Everything as usual\\n                return target.apply(thisArg, args)\\n              } else {\\n                return handleIframeCreation(target, thisArg, args)\\n              }\\n            }\\n          }\\n          // All this just due to iframes with srcdoc bug\\n          utils.replaceWithProxy(\\n            document,\\n            'createElement',\\n            createElementHandler\\n          )\\n        }\\n\\n        // Let's go\\n        addIframeCreationSniffer()\\n      } catch (err) {\\n        // console.warn(err)\\n      }\\n    }","_args":[]});
        })();
    } catch(e) { console.warn('[Stealth:iframe.contentWindow] Error:', e.message); }

    // \u2500\u2500\u2500 media.codecs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for media.codecs
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"utils => {\\n      /**\\n       * Input might look funky, we need to normalize it so e.g. whitespace isn't an issue for our spoofing.\\n       *\\n       * @example\\n       * video/webm; codecs=\\"vp8, vorbis\\"\\n       * video/mp4; codecs=\\"avc1.42E01E\\"\\n       * audio/x-m4a;\\n       * audio/ogg; codecs=\\"vorbis\\"\\n       * @param {String} arg\\n       */\\n      const parseInput = arg => {\\n        const [mime, codecStr] = arg.trim().split(';')\\n        let codecs = []\\n        if (codecStr && codecStr.includes('codecs=\\"')) {\\n          codecs = codecStr\\n            .trim()\\n            .replace(\`codecs=\\"\`, '')\\n            .replace(\`\\"\`, '')\\n            .trim()\\n            .split(',')\\n            .filter(x => !!x)\\n            .map(x => x.trim())\\n        }\\n        return {\\n          mime,\\n          codecStr,\\n          codecs\\n        }\\n      }\\n\\n      const canPlayType = {\\n        // Intercept certain requests\\n        apply: function(target, ctx, args) {\\n          if (!args || !args.length) {\\n            return target.apply(ctx, args)\\n          }\\n          const { mime, codecs } = parseInput(args[0])\\n          // This specific mp4 codec is missing in Chromium\\n          if (mime === 'video/mp4') {\\n            if (codecs.includes('avc1.42E01E')) {\\n              return 'probably'\\n            }\\n          }\\n          // This mimetype is only supported if no codecs are specified\\n          if (mime === 'audio/x-m4a' && !codecs.length) {\\n            return 'maybe'\\n          }\\n\\n          // This mimetype is only supported if no codecs are specified\\n          if (mime === 'audio/aac' && !codecs.length) {\\n            return 'probably'\\n          }\\n          // Everything else as usual\\n          return target.apply(ctx, args)\\n        }\\n      }\\n\\n      /* global HTMLMediaElement */\\n      utils.replaceWithProxy(\\n        HTMLMediaElement.prototype,\\n        'canPlayType',\\n        canPlayType\\n      )\\n    }","_args":[]});
        })();
    } catch(e) { console.warn('[Stealth:media.codecs] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.hardwareConcurrency \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for navigator.hardwareConcurrency
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { opts }) => {\\n        utils.replaceGetterWithProxy(\\n          Object.getPrototypeOf(navigator),\\n          'hardwareConcurrency',\\n          utils.makeHandler().getterValue(opts.hardwareConcurrency)\\n        )\\n      }","_args":[{"opts":{"hardwareConcurrency":4}}]});
        })();
    } catch(e) { console.warn('[Stealth:navigator.hardwareConcurrency] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.languages \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for navigator.languages
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { opts }) => {\\n        const languages = opts.languages.length\\n          ? opts.languages\\n          : ['en-US', 'en']\\n        utils.replaceGetterWithProxy(\\n          Object.getPrototypeOf(navigator),\\n          'languages',\\n          utils.makeHandler().getterValue(Object.freeze([...languages]))\\n        )\\n      }","_args":[{"opts":{"languages":[]}}]});
        })();
    } catch(e) { console.warn('[Stealth:navigator.languages] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.permissions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for navigator.permissions
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, opts) => {\\n      const isSecure = document.location.protocol.startsWith('https')\\n\\n      // In headful on secure origins the permission should be \\"default\\", not \\"denied\\"\\n      if (isSecure) {\\n        utils.replaceGetterWithProxy(Notification, 'permission', {\\n          apply() {\\n            return 'default'\\n          }\\n        })\\n      }\\n\\n      // Another weird behavior:\\n      // On insecure origins in headful the state is \\"denied\\",\\n      // whereas in headless it's \\"prompt\\"\\n      if (!isSecure) {\\n        const handler = {\\n          apply(target, ctx, args) {\\n            const param = (args || [])[0]\\n\\n            const isNotifications =\\n              param && param.name && param.name === 'notifications'\\n            if (!isNotifications) {\\n              return utils.cache.Reflect.apply(...arguments)\\n            }\\n\\n            return Promise.resolve(\\n              Object.setPrototypeOf(\\n                {\\n                  state: 'denied',\\n                  onchange: null\\n                },\\n                PermissionStatus.prototype\\n              )\\n            )\\n          }\\n        }\\n        // Note: Don't use \`Object.getPrototypeOf\` here\\n        utils.replaceWithProxy(Permissions.prototype, 'query', handler)\\n      }\\n    }","_args":[{}]});
        })();
    } catch(e) { console.warn('[Stealth:navigator.permissions] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.plugins \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for navigator.plugins
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { fns, data }) => {\\n        fns = utils.materializeFns(fns)\\n\\n        // That means we're running headful\\n        const hasPlugins = 'plugins' in navigator && navigator.plugins.length\\n        if (hasPlugins) {\\n          return // nothing to do here\\n        }\\n\\n        const mimeTypes = fns.generateMimeTypeArray(utils, fns)(data.mimeTypes)\\n        const plugins = fns.generatePluginArray(utils, fns)(data.plugins)\\n\\n        // Plugin and MimeType cross-reference each other, let's do that now\\n        // Note: We're looping through \`data.plugins\` here, not the generated \`plugins\`\\n        for (const pluginData of data.plugins) {\\n          pluginData.__mimeTypes.forEach((type, index) => {\\n            plugins[pluginData.name][index] = mimeTypes[type]\\n\\n            Object.defineProperty(plugins[pluginData.name], type, {\\n              value: mimeTypes[type],\\n              writable: false,\\n              enumerable: false, // Not enumerable\\n              configurable: true\\n            })\\n            Object.defineProperty(mimeTypes[type], 'enabledPlugin', {\\n              value:\\n                type === 'application/x-pnacl'\\n                  ? mimeTypes['application/x-nacl'].enabledPlugin // these reference the same plugin, so we need to re-use the Proxy in order to avoid leaks\\n                  : new Proxy(plugins[pluginData.name], {}), // Prevent circular references\\n              writable: false,\\n              enumerable: false, // Important: \`JSON.stringify(navigator.plugins)\`\\n              configurable: true\\n            })\\n          })\\n        }\\n\\n        const patchNavigator = (name, value) =>\\n          utils.replaceProperty(Object.getPrototypeOf(navigator), name, {\\n            get() {\\n              return value\\n            }\\n          })\\n\\n        patchNavigator('mimeTypes', mimeTypes)\\n        patchNavigator('plugins', plugins)\\n\\n        // All done\\n      }","_args":[{"fns":{"generateMimeTypeArray":"(utils, fns) => mimeTypesData => {\\n  return fns.generateMagicArray(utils, fns)(\\n    mimeTypesData,\\n    MimeTypeArray.prototype,\\n    MimeType.prototype,\\n    'type'\\n  )\\n}","generatePluginArray":"(utils, fns) => pluginsData => {\\n  return fns.generateMagicArray(utils, fns)(\\n    pluginsData,\\n    PluginArray.prototype,\\n    Plugin.prototype,\\n    'name'\\n  )\\n}","generateMagicArray":"(utils, fns) =>\\n  function(\\n    dataArray = [],\\n    proto = MimeTypeArray.prototype,\\n    itemProto = MimeType.prototype,\\n    itemMainProp = 'type'\\n  ) {\\n    // Quick helper to set props with the same descriptors vanilla is using\\n    const defineProp = (obj, prop, value) =>\\n      Object.defineProperty(obj, prop, {\\n        value,\\n        writable: false,\\n        enumerable: false, // Important for mimeTypes & plugins: \`JSON.stringify(navigator.mimeTypes)\`\\n        configurable: true\\n      })\\n\\n    // Loop over our fake data and construct items\\n    const makeItem = data => {\\n      const item = {}\\n      for (const prop of Object.keys(data)) {\\n        if (prop.startsWith('__')) {\\n          continue\\n        }\\n        defineProp(item, prop, data[prop])\\n      }\\n      return patchItem(item, data)\\n    }\\n\\n    const patchItem = (item, data) => {\\n      let descriptor = Object.getOwnPropertyDescriptors(item)\\n\\n      // Special case: Plugins have a magic length property which is not enumerable\\n      // e.g. \`navigator.plugins[i].length\` should always be the length of the assigned mimeTypes\\n      if (itemProto === Plugin.prototype) {\\n        descriptor = {\\n          ...descriptor,\\n          length: {\\n            value: data.__mimeTypes.length,\\n            writable: false,\\n            enumerable: false,\\n            configurable: true // Important to be able to use the ownKeys trap in a Proxy to strip \`length\`\\n          }\\n        }\\n      }\\n\\n      // We need to spoof a specific \`MimeType\` or \`Plugin\` object\\n      const obj = Object.create(itemProto, descriptor)\\n\\n      // Virtually all property keys are not enumerable in vanilla\\n      const blacklist = [...Object.keys(data), 'length', 'enabledPlugin']\\n      return new Proxy(obj, {\\n        ownKeys(target) {\\n          return Reflect.ownKeys(target).filter(k => !blacklist.includes(k))\\n        },\\n        getOwnPropertyDescriptor(target, prop) {\\n          if (blacklist.includes(prop)) {\\n            return undefined\\n          }\\n          return Reflect.getOwnPropertyDescriptor(target, prop)\\n        }\\n      })\\n    }\\n\\n    const magicArray = []\\n\\n    // Loop through our fake data and use that to create convincing entities\\n    dataArray.forEach(data => {\\n      magicArray.push(makeItem(data))\\n    })\\n\\n    // Add direct property access  based on types (e.g. \`obj['application/pdf']\`) afterwards\\n    magicArray.forEach(entry => {\\n      defineProp(magicArray, entry[itemMainProp], entry)\\n    })\\n\\n    // This is the best way to fake the type to make sure this is false: \`Array.isArray(navigator.mimeTypes)\`\\n    const magicArrayObj = Object.create(proto, {\\n      ...Object.getOwnPropertyDescriptors(magicArray),\\n\\n      // There's one ugly quirk we unfortunately need to take care of:\\n      // The \`MimeTypeArray\` prototype has an enumerable \`length\` property,\\n      // but headful Chrome will still skip it when running \`Object.getOwnPropertyNames(navigator.mimeTypes)\`.\\n      // To strip it we need to make it first \`configurable\` and can then overlay a Proxy with an \`ownKeys\` trap.\\n      length: {\\n        value: magicArray.length,\\n        writable: false,\\n        enumerable: false,\\n        configurable: true // Important to be able to use the ownKeys trap in a Proxy to strip \`length\`\\n      }\\n    })\\n\\n    // Generate our functional function mocks :-)\\n    const functionMocks = fns.generateFunctionMocks(utils)(\\n      proto,\\n      itemMainProp,\\n      magicArray\\n    )\\n\\n    // We need to overlay our custom object with a JS Proxy\\n    const magicArrayObjProxy = new Proxy(magicArrayObj, {\\n      get(target, key = '') {\\n        // Redirect function calls to our custom proxied versions mocking the vanilla behavior\\n        if (key === 'item') {\\n          return functionMocks.item\\n        }\\n        if (key === 'namedItem') {\\n          return functionMocks.namedItem\\n        }\\n        if (proto === PluginArray.prototype && key === 'refresh') {\\n          return functionMocks.refresh\\n        }\\n        // Everything else can pass through as normal\\n        return utils.cache.Reflect.get(...arguments)\\n      },\\n      ownKeys(target) {\\n        // There are a couple of quirks where the original property demonstrates \\"magical\\" behavior that makes no sense\\n        // This can be witnessed when calling \`Object.getOwnPropertyNames(navigator.mimeTypes)\` and the absense of \`length\`\\n        // My guess is that it has to do with the recent change of not allowing data enumeration and this being implemented weirdly\\n        // For that reason we just completely fake the available property names based on our data to match what regular Chrome is doing\\n        // Specific issues when not patching this: \`length\` property is available, direct \`types\` props (e.g. \`obj['application/pdf']\`) are missing\\n        const keys = []\\n        const typeProps = magicArray.map(mt => mt[itemMainProp])\\n        typeProps.forEach((_, i) => keys.push(\`\${i}\`))\\n        typeProps.forEach(propName => keys.push(propName))\\n        return keys\\n      },\\n      getOwnPropertyDescriptor(target, prop) {\\n        if (prop === 'length') {\\n          return undefined\\n        }\\n        return Reflect.getOwnPropertyDescriptor(target, prop)\\n      }\\n    })\\n\\n    return magicArrayObjProxy\\n  }","generateFunctionMocks":"utils => (\\n  proto,\\n  itemMainProp,\\n  dataArray\\n) => ({\\n  /** Returns the MimeType object with the specified index. */\\n  item: utils.createProxy(proto.item, {\\n    apply(target, ctx, args) {\\n      if (!args.length) {\\n        throw new TypeError(\\n          \`Failed to execute 'item' on '\${\\n            proto[Symbol.toStringTag]\\n          }': 1 argument required, but only 0 present.\`\\n        )\\n      }\\n      // Special behavior alert:\\n      // - Vanilla tries to cast strings to Numbers (only integers!) and use them as property index lookup\\n      // - If anything else than an integer (including as string) is provided it will return the first entry\\n      const isInteger = args[0] && Number.isInteger(Number(args[0])) // Cast potential string to number first, then check for integer\\n      // Note: Vanilla never returns \`undefined\`\\n      return (isInteger ? dataArray[Number(args[0])] : dataArray[0]) || null\\n    }\\n  }),\\n  /** Returns the MimeType object with the specified name. */\\n  namedItem: utils.createProxy(proto.namedItem, {\\n    apply(target, ctx, args) {\\n      if (!args.length) {\\n        throw new TypeError(\\n          \`Failed to execute 'namedItem' on '\${\\n            proto[Symbol.toStringTag]\\n          }': 1 argument required, but only 0 present.\`\\n        )\\n      }\\n      return dataArray.find(mt => mt[itemMainProp] === args[0]) || null // Not \`undefined\`!\\n    }\\n  }),\\n  /** Does nothing and shall return nothing */\\n  refresh: proto.refresh\\n    ? utils.createProxy(proto.refresh, {\\n        apply(target, ctx, args) {\\n          return undefined\\n        }\\n      })\\n    : undefined\\n})"},"data":{"mimeTypes":[{"type":"application/pdf","suffixes":"pdf","description":"","__pluginName":"Chrome PDF Viewer"},{"type":"application/x-google-chrome-pdf","suffixes":"pdf","description":"Portable Document Format","__pluginName":"Chrome PDF Plugin"},{"type":"application/x-nacl","suffixes":"","description":"Native Client Executable","__pluginName":"Native Client"},{"type":"application/x-pnacl","suffixes":"","description":"Portable Native Client Executable","__pluginName":"Native Client"}],"plugins":[{"name":"Chrome PDF Plugin","filename":"internal-pdf-viewer","description":"Portable Document Format","__mimeTypes":["application/x-google-chrome-pdf"]},{"name":"Chrome PDF Viewer","filename":"mhjfbmdgcfjbbpaeojofohoefgiehjai","description":"","__mimeTypes":["application/pdf"]},{"name":"Native Client","filename":"internal-nacl-plugin","description":"","__mimeTypes":["application/x-nacl","application/x-pnacl"]}]}}]});
        })();
    } catch(e) { console.warn('[Stealth:navigator.plugins] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.vendor \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (function() {
            // Inline utils for navigator.vendor
            const utils = {
                replaceProperty: function(obj, prop, descriptor) {
                    return Object.defineProperty(obj, prop, descriptor);
                },
                mockWithProxy: function(obj, prop, target, handler) {
                    obj[prop] = new Proxy(target, handler);
                },
                patchToStringNested: function(obj) {
                    return obj;
                },
                init: function() {}
            };
            (({ _utilsFns, _mainFunction, _args }) => {
        // Add this point we cannot use our utililty functions as they're just strings, we need to materialize them first
        const utils = Object.fromEntries(
          Object.entries(_utilsFns).map(([key, value]) => [key, eval(value)]) // eslint-disable-line no-eval
        )
        utils.init()
        return eval(_mainFunction)(utils, ..._args) // eslint-disable-line no-eval
      })(utils, {"_utilsFns":{"init":"() => {\\n  utils.preloadCache()\\n}","stripProxyFromErrors":"(handler = {}) => {\\n  const newHandler = {\\n    setPrototypeOf: function (target, proto) {\\n      if (proto === null)\\n        throw new TypeError('Cannot convert object to primitive value')\\n      if (Object.getPrototypeOf(target) === Object.getPrototypeOf(proto)) {\\n        throw new TypeError('Cyclic __proto__ value')\\n      }\\n      return Reflect.setPrototypeOf(target, proto)\\n    }\\n  }\\n  // We wrap each trap in the handler in a try/catch and modify the error stack if they throw\\n  const traps = Object.getOwnPropertyNames(handler)\\n  traps.forEach(trap => {\\n    newHandler[trap] = function () {\\n      try {\\n        // Forward the call to the defined proxy handler\\n        return handler[trap].apply(this, arguments || [])\\n      } catch (err) {\\n        // Stack traces differ per browser, we only support chromium based ones currently\\n        if (!err || !err.stack || !err.stack.includes(\`at \`)) {\\n          throw err\\n        }\\n\\n        // When something throws within one of our traps the Proxy will show up in error stacks\\n        // An earlier implementation of this code would simply strip lines with a blacklist,\\n        // but it makes sense to be more surgical here and only remove lines related to our Proxy.\\n        // We try to use a known \\"anchor\\" line for that and strip it with everything above it.\\n        // If the anchor line cannot be found for some reason we fall back to our blacklist approach.\\n\\n        const stripWithBlacklist = (stack, stripFirstLine = true) => {\\n          const blacklist = [\\n            \`at Reflect.\${trap} \`, // e.g. Reflect.get or Reflect.apply\\n            \`at Object.\${trap} \`, // e.g. Object.get or Object.apply\\n            \`at Object.newHandler.<computed> [as \${trap}] \` // caused by this very wrapper :-)\\n          ]\\n          return (\\n            err.stack\\n              .split('\\\\n')\\n              // Always remove the first (file) line in the stack (guaranteed to be our proxy)\\n              .filter((line, index) => !(index === 1 && stripFirstLine))\\n              // Check if the line starts with one of our blacklisted strings\\n              .filter(line => !blacklist.some(bl => line.trim().startsWith(bl)))\\n              .join('\\\\n')\\n          )\\n        }\\n\\n        const stripWithAnchor = (stack, anchor) => {\\n          const stackArr = stack.split('\\\\n')\\n          anchor = anchor || \`at Object.newHandler.<computed> [as \${trap}] \` // Known first Proxy line in chromium\\n          const anchorIndex = stackArr.findIndex(line =>\\n            line.trim().startsWith(anchor)\\n          )\\n          if (anchorIndex === -1) {\\n            return false // 404, anchor not found\\n          }\\n          // Strip everything from the top until we reach the anchor line\\n          // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n          stackArr.splice(1, anchorIndex)\\n          return stackArr.join('\\\\n')\\n        }\\n\\n        // Special cases due to our nested toString proxies\\n        err.stack = err.stack.replace(\\n          'at Object.toString (',\\n          'at Function.toString ('\\n        )\\n        if ((err.stack || '').includes('at Function.toString (')) {\\n          err.stack = stripWithBlacklist(err.stack, false)\\n          throw err\\n        }\\n\\n        // Try using the anchor method, fallback to blacklist if necessary\\n        err.stack = stripWithAnchor(err.stack) || stripWithBlacklist(err.stack)\\n\\n        throw err // Re-throw our now sanitized error\\n      }\\n    }\\n  })\\n  return newHandler\\n}","stripErrorWithAnchor":"(err, anchor) => {\\n  const stackArr = err.stack.split('\\\\n')\\n  const anchorIndex = stackArr.findIndex(line => line.trim().startsWith(anchor))\\n  if (anchorIndex === -1) {\\n    return err // 404, anchor not found\\n  }\\n  // Strip everything from the top until we reach the anchor line (remove anchor line as well)\\n  // Note: We're keeping the 1st line (zero index) as it's unrelated (e.g. \`TypeError\`)\\n  stackArr.splice(1, anchorIndex)\\n  err.stack = stackArr.join('\\\\n')\\n  return err\\n}","replaceProperty":"(obj, propName, descriptorOverrides = {}) => {\\n  return Object.defineProperty(obj, propName, {\\n    // Copy over the existing descriptors (writable, enumerable, configurable, etc)\\n    ...(Object.getOwnPropertyDescriptor(obj, propName) || {}),\\n    // Add our overrides (e.g. value, get())\\n    ...descriptorOverrides\\n  })\\n}","preloadCache":"() => {\\n  if (utils.cache) {\\n    return\\n  }\\n  utils.cache = {\\n    // Used in our proxies\\n    Reflect: {\\n      get: Reflect.get.bind(Reflect),\\n      apply: Reflect.apply.bind(Reflect)\\n    },\\n    // Used in \`makeNativeString\`\\n    nativeToStringStr: Function.toString + '' // => \`function toString() { [native code] }\`\\n  }\\n}","makeNativeString":"(name = '') => {\\n  return utils.cache.nativeToStringStr.replace('toString', name || '')\\n}","patchToString":"(obj, str = '') => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === obj) {\\n        // We either return the optional string verbatim or derive the most desired result automatically\\n        return str || utils.makeNativeString(obj.name)\\n      }\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","patchToStringNested":"(obj = {}) => {\\n  return utils.execRecursively(obj, ['function'], utils.patchToString)\\n}","redirectToString":"(proxyObj, originalObj) => {\\n  const handler = {\\n    apply: function (target, ctx) {\\n      // This fixes e.g. \`HTMLMediaElement.prototype.canPlayType.toString + \\"\\"\`\\n      if (ctx === Function.prototype.toString) {\\n        return utils.makeNativeString('toString')\\n      }\\n\\n      // \`toString\` targeted at our proxied Object detected\\n      if (ctx === proxyObj) {\\n        const fallback = () =>\\n          originalObj && originalObj.name\\n            ? utils.makeNativeString(originalObj.name)\\n            : utils.makeNativeString(proxyObj.name)\\n\\n        // Return the toString representation of our original object if possible\\n        return originalObj + '' || fallback()\\n      }\\n\\n      if (typeof ctx === 'undefined' || ctx === null) {\\n        return target.call(ctx)\\n      }\\n\\n      // Check if the toString protype of the context is the same as the global prototype,\\n      // if not indicates that we are doing a check across different windows., e.g. the iframeWithdirect\` test case\\n      const hasSameProto = Object.getPrototypeOf(\\n        Function.prototype.toString\\n      ).isPrototypeOf(ctx.toString) // eslint-disable-line no-prototype-builtins\\n      if (!hasSameProto) {\\n        // Pass the call on to the local Function.prototype.toString instead\\n        return ctx.toString()\\n      }\\n\\n      return target.call(ctx)\\n    }\\n  }\\n\\n  const toStringProxy = new Proxy(\\n    Function.prototype.toString,\\n    utils.stripProxyFromErrors(handler)\\n  )\\n  utils.replaceProperty(Function.prototype, 'toString', {\\n    value: toStringProxy\\n  })\\n}","replaceWithProxy":"(obj, propName, handler) => {\\n  const originalObj = obj[propName]\\n  const proxyObj = new Proxy(obj[propName], utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.redirectToString(proxyObj, originalObj)\\n\\n  return true\\n}","replaceGetterWithProxy":"(obj, propName, handler) => {\\n  const fn = Object.getOwnPropertyDescriptor(obj, propName).get\\n  const fnStr = fn.toString() // special getter function string\\n  const proxyObj = new Proxy(fn, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { get: proxyObj })\\n  utils.patchToString(proxyObj, fnStr)\\n\\n  return true\\n}","replaceGetterSetter":"(obj, propName, handlerGetterSetter) => {\\n  const ownPropertyDescriptor = Object.getOwnPropertyDescriptor(obj, propName)\\n  const handler = { ...ownPropertyDescriptor }\\n\\n  if (handlerGetterSetter.get !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.get\\n    handler.get = function() {\\n      return handlerGetterSetter.get.call(this, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.get, nativeFn)\\n  }\\n\\n  if (handlerGetterSetter.set !== undefined) {\\n    const nativeFn = ownPropertyDescriptor.set\\n    handler.set = function(newValue) {\\n      handlerGetterSetter.set.call(this, newValue, nativeFn.bind(this))\\n    }\\n    utils.redirectToString(handler.set, nativeFn)\\n  }\\n\\n  Object.defineProperty(obj, propName, handler)\\n}","mockWithProxy":"(obj, propName, pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n\\n  utils.replaceProperty(obj, propName, { value: proxyObj })\\n  utils.patchToString(proxyObj)\\n\\n  return true\\n}","createProxy":"(pseudoTarget, handler) => {\\n  const proxyObj = new Proxy(pseudoTarget, utils.stripProxyFromErrors(handler))\\n  utils.patchToString(proxyObj)\\n\\n  return proxyObj\\n}","splitObjPath":"objPath => ({\\n  // Remove last dot entry (property) ==> \`HTMLMediaElement.prototype\`\\n  objName: objPath.split('.').slice(0, -1).join('.'),\\n  // Extract last dot entry ==> \`canPlayType\`\\n  propName: objPath.split('.').slice(-1)[0]\\n})","replaceObjPathWithProxy":"(objPath, handler) => {\\n  const { objName, propName } = utils.splitObjPath(objPath)\\n  const obj = eval(objName) // eslint-disable-line no-eval\\n  return utils.replaceWithProxy(obj, propName, handler)\\n}","execRecursively":"(obj = {}, typeFilter = [], fn) => {\\n  function recurse(obj) {\\n    for (const key in obj) {\\n      if (obj[key] === undefined) {\\n        continue\\n      }\\n      if (obj[key] && typeof obj[key] === 'object') {\\n        recurse(obj[key])\\n      } else {\\n        if (obj[key] && typeFilter.includes(typeof obj[key])) {\\n          fn.call(this, obj[key])\\n        }\\n      }\\n    }\\n  }\\n  recurse(obj)\\n  return obj\\n}","stringifyFns":"(fnObj = { hello: () => 'world' }) => {\\n  // Object.fromEntries() ponyfill (in 6 lines) - supported only in Node v12+, modern browsers are fine\\n  // https://github.com/feross/fromentries\\n  function fromEntries(iterable) {\\n    return [...iterable].reduce((obj, [key, val]) => {\\n      obj[key] = val\\n      return obj\\n    }, {})\\n  }\\n  return (Object.fromEntries || fromEntries)(\\n    Object.entries(fnObj)\\n      .filter(([key, value]) => typeof value === 'function')\\n      .map(([key, value]) => [key, value.toString()]) // eslint-disable-line no-eval\\n  )\\n}","materializeFns":"(fnStrObj = { hello: \\"() => 'world'\\" }) => {\\n  return Object.fromEntries(\\n    Object.entries(fnStrObj).map(([key, value]) => {\\n      if (value.startsWith('function')) {\\n        // some trickery is needed to make oldschool functions work :-)\\n        return [key, eval(\`() => \${value}\`)()] // eslint-disable-line no-eval\\n      } else {\\n        // arrow functions just work\\n        return [key, eval(value)] // eslint-disable-line no-eval\\n      }\\n    })\\n  )\\n}","makeHandler":"() => ({\\n  // Used by simple \`navigator\` getter evasions\\n  getterValue: value => ({\\n    apply(target, ctx, args) {\\n      // Let's fetch the value first, to trigger and escalate potential errors\\n      // Illegal invocations like \`navigator.__proto__.vendor\` will throw here\\n      utils.cache.Reflect.apply(...arguments)\\n      return value\\n    }\\n  })\\n})","arrayEquals":"(array1, array2) => {\\n  if (array1.length !== array2.length) {\\n    return false\\n  }\\n  for (let i = 0; i < array1.length; ++i) {\\n    if (array1[i] !== array2[i]) {\\n      return false\\n    }\\n  }\\n  return true\\n}","memoize":"fn => {\\n  const cache = []\\n  return function(...args) {\\n    if (!cache.some(c => utils.arrayEquals(c.key, args))) {\\n      cache.push({ key: args, value: fn.apply(this, args) })\\n    }\\n    return cache.find(c => utils.arrayEquals(c.key, args)).value\\n  }\\n}"},"_mainFunction":"(utils, { opts }) => {\\n        utils.replaceGetterWithProxy(\\n          Object.getPrototypeOf(navigator),\\n          'vendor',\\n          utils.makeHandler().getterValue(opts.vendor)\\n        )\\n      }","_args":[{"opts":{"vendor":"Google Inc."}}]});
        })();
    } catch(e) { console.warn('[Stealth:navigator.vendor] Error:', e.message); }

    // \u2500\u2500\u2500 navigator.webdriver \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (() => {
      if (navigator.webdriver === false) {
        // Post Chrome 89.0.4339.0 and already good
      } else if (navigator.webdriver === undefined) {
        // Pre Chrome 89.0.4339.0 and already good
      } else {
        // Pre Chrome 88.0.4291.0 and needs patching
        delete Object.getPrototypeOf(navigator).webdriver
      }
    })();
    } catch(e) { console.warn('[Stealth:navigator.webdriver] Error:', e.message); }

    // \u2500\u2500\u2500 window.outerdimensions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        (() => {
      try {
        if (window.outerWidth && window.outerHeight) {
          return // nothing to do here
        }
        const windowFrame = 85 // probably OS and WM dependent
        window.outerWidth = window.innerWidth
        window.outerHeight = window.innerHeight + windowFrame
      } catch (err) {}
    })();
    } catch(e) { console.warn('[Stealth:window.outerdimensions] Error:', e.message); }

})();
`;
    module2.exports = { stealthCode };
  }
});

// electron/webview/stealthEvasion.cjs
var require_stealthEvasion = __commonJS({
  "electron/webview/stealthEvasion.cjs"(exports2, module2) {
    var { stealthCode } = require_stealthBundle();
    var iframeInterceptScript = `
(function() {
    'use strict';

    // \u2500\u2500\u2500 navigator.userAgentData override \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Electron only reports "Chromium" brand, not "Google Chrome"
    // This is a major detection vector \u2014 must include Google Chrome brand
    //
    // IMPORTANT: For Google login pages (accounts.google.com), we do NOT
    // claim "Google Chrome" because Google can verify this cryptographically.
    // Learned from v-box-latest (Wexond) which removes Chrome component
    // entirely for Google login URLs.
    try {
        const platform = navigator.platform || 'Win32';
        const isMobile = false;
        const platformName = platform.startsWith('Mac') ? 'macOS' :
                            platform.startsWith('Linux') ? 'Linux' : 'Windows';

        // Check if we're on a Google login page
        const isGoogleLogin = /^https:\\/\\/accounts\\.google\\.com(\\/|$)/.test(window.location.href);

        // For Google login: only claim "Chromium" (not "Google Chrome")
        // For all other sites: claim full "Google Chrome" brand
        const brands = isGoogleLogin ? [
            { brand: 'Chromium', version: '132' },
            { brand: 'Not_A Brand', version: '24' }
        ] : [
            { brand: 'Chromium', version: '132' },
            { brand: 'Not_A Brand', version: '24' },
            { brand: 'Google Chrome', version: '132' }
        ];

        const fullVersionList = isGoogleLogin ? [
            { brand: 'Chromium', version: '132.0.6834.210' },
            { brand: 'Not_A Brand', version: '24.0.0.0' }
        ] : [
            { brand: 'Chromium', version: '132.0.6834.210' },
            { brand: 'Not_A Brand', version: '24.0.0.0' },
            { brand: 'Google Chrome', version: '132.0.6834.210' }
        ];

        const uaData = {
            brands: Object.freeze(brands),
            mobile: isMobile,
            platform: platformName,
            getHighEntropyValues: function(hints) {
                return Promise.resolve({
                    brands: Object.freeze(brands),
                    fullVersionList: Object.freeze(fullVersionList),
                    mobile: isMobile,
                    model: '',
                    platform: platformName,
                    platformVersion: platformName === 'Windows' ? '15.0.0' :
                                    platformName === 'macOS' ? '15.5.0' : '',
                    uaFullVersion: '132.0.6834.210',
                    architecture: 'x86',
                    bitness: '64',
                    wow64: false
                });
            },
            toJSON: function() {
                return {
                    brands: this.brands,
                    mobile: this.mobile,
                    platform: this.platform
                };
            }
        };

        // Define on Navigator.prototype (not navigator instance) so
        // Object.getOwnPropertyNames(navigator) returns empty array
        // (matching real Chrome behavior where props are on prototype)
        Object.defineProperty(Navigator.prototype, 'userAgentData', {
            get: function() { return uaData; },
            configurable: true,
            enumerable: true
        });
    } catch(_) {}

    // Ensure chrome object exists on main window
    if (!window.chrome) {
        window.chrome = {};
    }

    // Store reference to the chrome object we want to propagate
    const chromeObj = window.chrome;

    // \u2500\u2500\u2500 Method 1: Patch contentWindow getter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        const origDescriptor = Object.getOwnPropertyDescriptor(
            HTMLIFrameElement.prototype, 'contentWindow'
        );
        
        if (origDescriptor && origDescriptor.get) {
            Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                get: function() {
                    const win = origDescriptor.get.call(this);
                    if (win) {
                        try {
                            // Only patch if chrome is missing or incomplete
                            if (!win.chrome) {
                                win.chrome = chromeObj;
                            }
                        } catch(e) {
                            // Cross-origin iframe \u2014 can't access, that's normal
                        }
                    }
                    return win;
                },
                configurable: true,
                enumerable: true
            });
        }
    } catch(_) {}

    // \u2500\u2500\u2500 Method 2: MutationObserver for dynamic iframes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    try {
        const injectChrome = function(iframe) {
            try {
                if (iframe.contentWindow && !iframe.contentWindow.chrome) {
                    iframe.contentWindow.chrome = chromeObj;
                }
            } catch(e) {
                // Cross-origin \u2014 can't access
            }
        };

        // Watch for dynamically added iframes
        const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.tagName === 'IFRAME') {
                        injectChrome(node);
                    }
                    // Check children too
                    if (node.querySelectorAll) {
                        const iframes = node.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            injectChrome(iframe);
                        }
                    }
                }
            }
        });

        // Start observing as soon as document is available
        const target = document.documentElement || document.body || document;
        observer.observe(target, {
            childList: true,
            subtree: true
        });

        // Also patch existing iframes
        document.querySelectorAll('iframe').forEach(injectChrome);

        // Patch createElement to catch iframes created but not yet in DOM
        const origCreateElement = document.createElement.bind(document);
        document.createElement = function(tagName, options) {
            const element = origCreateElement(tagName, options);
            if (tagName.toLowerCase() === 'iframe') {
                // Try to inject when iframe loads
                element.addEventListener('load', function() {
                    injectChrome(element);
                });
                // Also try immediately in case it's already loaded
                setTimeout(function() { injectChrome(element); }, 0);
            }
            return element;
        };
    } catch(_) {}
})();
`;
    function initStealthEvasion2() {
      if (!stealthCode) {
        console.warn("[Stealth] No evasion code available");
        return;
      }
      const fullScript = stealthCode + "\n" + iframeInterceptScript;
      try {
        const script = document.createElement("script");
        script.textContent = fullScript;
        const target = document.documentElement || document.head || document.body || document;
        if (target.firstChild) {
          target.insertBefore(script, target.firstChild);
        } else {
          target.appendChild(script);
        }
        script.remove();
        console.log("[Stealth] Evasion bundle + iframe intercept injected into main world");
      } catch (_) {
        try {
          document.addEventListener("DOMContentLoaded", function() {
            try {
              const script = document.createElement("script");
              script.textContent = fullScript;
              (document.head || document.documentElement).prepend(script);
              script.remove();
              console.log("[Stealth] Evasion bundle injected (DOMContentLoaded)");
            } catch (_2) {
            }
          }, { once: true });
        } catch (_2) {
        }
      }
    }
    module2.exports = { init: initStealthEvasion2 };
  }
});

// electron/webview/vboxApiStealth.cjs
var require_vboxApiStealth = __commonJS({
  "electron/webview/vboxApiStealth.cjs"(exports2, module2) {
    function initVBoxApiStealth2() {
      const VBOX_SYMBOL = Symbol.for("__vbox_internal__");
      if (typeof window.__VBOX_API__ !== "undefined") {
        window[VBOX_SYMBOL] = window.__VBOX_API__;
        try {
          const descriptor = Object.getOwnPropertyDescriptor(window, "__VBOX_API__");
          if (descriptor && descriptor.configurable) {
            Object.defineProperty(window, "__VBOX_API__", {
              ...descriptor,
              enumerable: false,
              // Hidden from Object.keys() and for...in
              configurable: true
            });
          }
        } catch (_) {
        }
      }
      Object.defineProperty(window, "getVBoxAPI", {
        value: function() {
          return window[VBOX_SYMBOL] || window.__VBOX_API__;
        },
        writable: false,
        enumerable: false,
        // Hidden from Object.keys()
        configurable: false
      });
      const vboxGlobals = [
        "__VBOX_API__",
        "vboxConsole",
        "vboxPowerPoint",
        "vboxDownloads",
        "vboxInput",
        "vboxScreenshot",
        "vboxFile",
        "vboxContext",
        "vboxNavigation",
        "vboxCookies",
        "vboxDialog",
        "vboxTabs",
        "vboxPassword",
        "runVBoxScript"
      ];
      vboxGlobals.forEach((key) => {
        try {
          if (typeof window[key] !== "undefined") {
            const descriptor = Object.getOwnPropertyDescriptor(window, key);
            if (descriptor && descriptor.configurable) {
              Object.defineProperty(window, key, {
                ...descriptor,
                enumerable: false
                // Hide from Object.keys() and for...in loops
              });
            }
          }
        } catch (_) {
        }
      });
    }
    module2.exports = { init: initVBoxApiStealth2 };
  }
});

// electron/webview/scrollbar.cjs
var require_scrollbar = __commonJS({
  "electron/webview/scrollbar.cjs"(exports2, module2) {
    function initScrollbarStyles2() {
      try {
        let injectStyles2 = function() {
          const style = document.createElement("style");
          style.id = "vbox-custom-scrollbar";
          style.textContent = `
                /* Custom scrollbar - Modern rounded style */
                ::-webkit-scrollbar {
                    width: 10px !important;
                    height: 10px !important;
                }

                ::-webkit-scrollbar-track {
                    background: transparent !important;
                }

                ::-webkit-scrollbar-thumb {
                    background: #c1c1c1 !important;
                    border-radius: 10px !important;
                    min-height: 40px !important;
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8 !important;
                }

                /* Dark mode scrollbar */
                @media (prefers-color-scheme: dark) {
                    ::-webkit-scrollbar-thumb {
                        background: #5a5a5a !important;
                    }

                    ::-webkit-scrollbar-thumb:hover {
                        background: #6e6e6e !important;
                    }
                }

                ::-webkit-scrollbar-corner {
                    background: transparent !important;
                }
            `;
          if (document.head) {
            document.head.appendChild(style);
          } else {
            const observer = new MutationObserver(() => {
              if (document.head) {
                document.head.appendChild(style);
                observer.disconnect();
              }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
          }
        };
        var injectStyles = injectStyles2;
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", injectStyles2);
        } else {
          injectStyles2();
        }
      } catch (error) {
      }
    }
    module2.exports = { init: initScrollbarStyles2 };
  }
});

// electron/webview-preload.cjs
var { contextBridge, ipcRenderer } = require("electron");
var { init: initThemeOverride } = require_theme();
var { init: initContextBridge } = require_contextBridge();
var { init: initConsoleOverride } = require_consoleOverride();
var { init: initVBoxApi2 } = require_vboxApi();
var { init: initPasswordCapture } = require_passwordCapture();
var { init: initStealthEvasion } = require_stealthEvasion();
var { init: initVBoxApiStealth } = require_vboxApiStealth();
var { init: initScrollbarStyles } = require_scrollbar();
initStealthEvasion();
initThemeOverride(ipcRenderer);
initContextBridge(contextBridge, ipcRenderer);
initConsoleOverride(ipcRenderer);
initVBoxApi2();
initPasswordCapture(ipcRenderer);
initScrollbarStyles();
if (typeof window.__VBOX_API__ !== "undefined") {
  contextBridge.exposeInMainWorld("__VBOX_API__", window.__VBOX_API__);
}
initVBoxApiStealth();
