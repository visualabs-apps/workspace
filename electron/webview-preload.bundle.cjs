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
      let cachedProfileId = null;
      let lastCapturedUsername = "";
      let lastCapturedPassword = "";
      let credentialsCaptured = false;
      let autofillAttempts = 0;
      const MAX_AUTOFILL_ATTEMPTS = 3;
      const USERNAME_NAMES = ["email", "user", "login", "account", "username", "user_email", "user_login", "identifier", "userid", "user-name", "user-id", "loginid", "login-id"];
      const USERNAME_AUTOCOMPLETE = ["email", "username", "email-address", "user", "login"];
      function isLoginForm(form) {
        const passwordFields = form.querySelectorAll('input[type="password"]');
        if (passwordFields.length === 0) return false;
        if (passwordFields.length === 1) return true;
        const inputs = form.querySelectorAll("input");
        let score = 0;
        inputs.forEach((input) => {
          const name = (input.name || "").toLowerCase();
          const type = (input.type || "text").toLowerCase();
          const ac = (input.getAttribute("autocomplete") || "").toLowerCase();
          if (type === "email" || type === "tel") score++;
          if (USERNAME_NAMES.some((p) => name.includes(p))) score++;
          if (ac.includes("username") || ac.includes("email")) score += 2;
          if (name.includes("confirm") || name.includes("verify")) score--;
          if (name.includes("first_name") || name.includes("last_name")) score -= 2;
        });
        return score >= 1;
      }
      function extractCredentials(form) {
        let username = "";
        let password = "";
        const passwordInput = form.querySelector('input[type="password"]');
        if (passwordInput) {
          password = passwordInput.value || "";
        }
        const inputs = form.querySelectorAll("input");
        for (const input of inputs) {
          const type = (input.type || "text").toLowerCase();
          const name = (input.name || "").toLowerCase();
          const id = (input.id || "").toLowerCase();
          const ac = (input.getAttribute("autocomplete") || "").toLowerCase();
          const placeholder = (input.placeholder || "").toLowerCase();
          if (type === "password" || type === "hidden" || type === "submit" || type === "button") continue;
          if (type === "email" || type === "tel" || USERNAME_NAMES.some((p) => name.includes(p) || id.includes(p)) || USERNAME_AUTOCOMPLETE.includes(ac) || placeholder.includes("email") || placeholder.includes("username")) {
            username = input.value || "";
            break;
          }
        }
        if (!username && passwordInput) {
          const allInputs = Array.from(inputs);
          const pwIndex = allInputs.indexOf(passwordInput);
          for (let i = pwIndex - 1; i >= 0; i--) {
            const inp = allInputs[i];
            const type = (inp.type || "text").toLowerCase();
            if (["text", "email", "tel", ""].includes(type) && inp.value) {
              username = inp.value;
              break;
            }
          }
        }
        return { username, password };
      }
      function setInputValue(element, value) {
        if (!element || !value) return;
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
          element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("keyup", { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
          const tracker = element._valueTracker;
          if (tracker) {
            tracker.setValue("");
          }
        } catch (e) {
          element.value = value;
        }
      }
      function autofillCredentials(credentials) {
        if (!credentials || credentials.length === 0) return;
        const cred = credentials[0];
        const forms = document.querySelectorAll("form");
        forms.forEach((form) => {
          if (!isLoginForm(form)) return;
          const passwordInput = form.querySelector('input[type="password"]');
          if (!passwordInput) return;
          if (passwordInput.offsetParent === null || passwordInput.disabled) return;
          setInputValue(passwordInput, cred.password);
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
            if (type === "email" || type === "tel" || USERNAME_NAMES.some((p) => name.includes(p) || id.includes(p)) || USERNAME_AUTOCOMPLETE.includes(ac) || placeholder.includes("email") || placeholder.includes("username")) {
              setInputValue(input, cred.username);
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
                break;
              }
            }
          }
        });
        const standalonePasswords = document.querySelectorAll('input[type="password"]');
        standalonePasswords.forEach((pwInput) => {
          if (pwInput.closest("form")) return;
          if (pwInput.offsetParent === null || pwInput.disabled) return;
          const matchingCred = credentials.find((c) => !c.username || c.username === "") || credentials[0];
          if (matchingCred) {
            setInputValue(pwInput, matchingCred.password);
            if (matchingCred.username) {
              const container = pwInput.closest('div, section, [role="dialog"]') || document.body;
              const nearbyInputs = container.querySelectorAll("input");
              const pwIndex = Array.from(nearbyInputs).indexOf(pwInput);
              for (let i = pwIndex - 1; i >= 0; i--) {
                const inp = nearbyInputs[i];
                const type = (inp.type || "text").toLowerCase();
                if (["text", "email", "tel", ""].includes(type) && inp.offsetParent !== null && !inp.disabled) {
                  setInputValue(inp, matchingCred.username);
                  break;
                }
              }
            }
          }
        });
      }
      async function triggerAutofill() {
        try {
          const loginForm = findLoginForm();
          if (!loginForm) {
            if (autofillAttempts < MAX_AUTOFILL_ATTEMPTS) {
              autofillAttempts++;
              setTimeout(triggerAutofill, 500 * autofillAttempts);
            }
            return;
          }
          const result = await ipcRenderer2.invoke("password-autofill-lookup", {
            profileId: null,
            origin: window.location.origin
          });
          if (result?.success && result.credentials?.length > 0) {
            console.log(`[PasswordCapture] Autofilling ${result.credentials.length} credentials for ${window.location.origin}`);
            setTimeout(() => {
              autofillCredentials(result.credentials);
              autofillAttempts = 0;
            }, 100);
          }
        } catch (e) {
          console.error("[PasswordCapture] Autofill error:", e);
        }
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
      function setupSubmitListener() {
        document.addEventListener("submit", (e) => {
          const form = e.target;
          if (!isLoginForm(form)) return;
          const { username, password } = extractCredentials(form);
          if (!password) return;
          credentialsCaptured = true;
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
      function scanForLoginForms() {
        const forms = document.querySelectorAll("form");
        const passwordFields = document.querySelectorAll('input[type="password"]');
        return { forms: forms.length, passwordFields: passwordFields.length };
      }
      function setupMutationObserver() {
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
            }, 200);
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
      }
      function setupClickCapture() {
        document.addEventListener("click", (e) => {
          const btn = e.target.closest('button, input[type="submit"], [role="button"]');
          if (!btn) return;
          const form = btn.closest("form");
          let passwordInput = null;
          let usernameInput = null;
          if (form) {
            passwordInput = form.querySelector('input[type="password"]');
          } else {
            const parent = btn.parentElement;
            if (parent) {
              const container = parent.parentElement || parent;
              passwordInput = container.querySelector('input[type="password"]');
            }
          }
          if (!passwordInput) return;
          const password = passwordInput.value || "";
          if (!password) return;
          const searchRoot = form || passwordInput.closest("div, section, main, body");
          if (searchRoot) {
            const inputs = searchRoot.querySelectorAll("input");
            for (const input of inputs) {
              const type = (input.type || "text").toLowerCase();
              const name = (input.name || "").toLowerCase();
              const id = (input.id || "").toLowerCase();
              const placeholder = (input.placeholder || "").toLowerCase();
              if (type === "password" || type === "hidden" || type === "submit" || type === "button") continue;
              if (type === "email" || type === "tel" || USERNAME_NAMES.some((p) => name.includes(p) || id.includes(p)) || placeholder.includes("email") || placeholder.includes("username")) {
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
          const username = usernameInput ? usernameInput.value : "";
          if (!password) return;
          credentialsCaptured = true;
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
      async function init() {
        try {
          try {
            const ctx = await ipcRenderer2.invoke("get-workspace-context");
            cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
          } catch (e) {
          }
          setupSubmitListener();
          setupClickCapture();
          setupMutationObserver();
          triggerAutofill();
          setTimeout(() => {
            const iframes = document.querySelectorAll("iframe");
            iframes.forEach((iframe) => {
              try {
                if (iframe.contentDocument) {
                  const iframeDoc = iframe.contentDocument;
                  const passwordFields = iframeDoc.querySelectorAll('input[type="password"]');
                  if (passwordFields.length > 0) {
                    console.log("[PasswordCapture] Found login form in iframe");
                    triggerAutofill();
                  }
                }
              } catch (e) {
              }
            });
          }, 500);
        } catch (error) {
        }
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
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
            if (type === "email" || type === "tel" || USERNAME_NAMES.some((p) => name.includes(p) || id.includes(p)) || placeholder.includes("email") || placeholder.includes("username")) {
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
    }
    module2.exports = { init: initPasswordCapture2 };
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
var { init: initScrollbarStyles } = require_scrollbar();
initThemeOverride(ipcRenderer);
initContextBridge(contextBridge, ipcRenderer);
initConsoleOverride(ipcRenderer);
initVBoxApi2();
initPasswordCapture(ipcRenderer);
initScrollbarStyles();
if (typeof window.__VBOX_API__ !== "undefined") {
  contextBridge.exposeInMainWorld("__VBOX_API__", window.__VBOX_API__);
}
