function initContextBridge(contextBridge, ipcRenderer) {
    contextBridge.exposeInMainWorld('vboxConsole', {
        log: (message) => {
            console.log(message);
            ipcRenderer.send('webview-console-log', { level: 'log', args: [message] });
        },
        error: (message) => {
            console.error(message);
            ipcRenderer.send('webview-console-log', { level: 'error', args: [message] });
        },
        warn: (message) => {
            console.warn(message);
            ipcRenderer.send('webview-console-log', { level: 'warn', args: [message] });
        },
        info: (message) => {
            console.info(message);
            ipcRenderer.send('webview-console-log', { level: 'info', args: [message] });
        }
    });

    contextBridge.exposeInMainWorld('vboxPowerPoint', {
        generate: (pptData) => ipcRenderer.invoke('generate-powerpoint', pptData),
        processTemplate: (templateName, variables, outputFilename) => {
            return ipcRenderer.invoke('ppt-process-template', { templateName, variables, outputFilename });
        },
        listTemplates: () => ipcRenderer.invoke('ppt-list-templates')
    });

    contextBridge.exposeInMainWorld('vboxDownloads', {
        addToDownloads: (fileInfo) => ipcRenderer.invoke('script-add-to-downloads', fileInfo)
    });

    contextBridge.exposeInMainWorld('vboxInput', {
        open: async (config) => {
            try {
                const serializedConfig = JSON.parse(JSON.stringify(config));
                const result = await ipcRenderer.invoke('script-open-input', serializedConfig);
                return result;
            } catch (error) {
                return { success: false, message: error.message || 'IPC Error', data: null };
            }
        }
    });

    contextBridge.exposeInMainWorld('vboxScreenshot', {
        capture: async (options) => {
            try {
                return await ipcRenderer.invoke('webview-screenshot', options);
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    });

    contextBridge.exposeInMainWorld('vboxFile', {
        save: async (content, filename, type = 'text/html') => {
            try {
                return await ipcRenderer.invoke('save-file', { content, filename, type });
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    });

    contextBridge.exposeInMainWorld('vboxContext', {
        getWorkspaceInfo: async () => {
            try {
                return await ipcRenderer.invoke('get-workspace-context');
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    });

    contextBridge.exposeInMainWorld('vboxNavigation', {
        navigate: (url) => ipcRenderer.invoke('webview-navigate', url),
        goBack: () => ipcRenderer.invoke('webview-go-back'),
        goForward: () => ipcRenderer.invoke('webview-go-forward'),
        reload: () => ipcRenderer.invoke('webview-reload')
    });

    contextBridge.exposeInMainWorld('vboxCookies', {
        get: (filter) => ipcRenderer.invoke('webview-get-cookies', filter || {}),
        set: (cookie) => ipcRenderer.invoke('webview-set-cookie', cookie)
    });

    contextBridge.exposeInMainWorld('vboxDialog', {
        handle: (options) => ipcRenderer.invoke('webview-handle-dialog', options || {}),
        clear: () => ipcRenderer.invoke('webview-clear-dialog-handler')
    });

    contextBridge.exposeInMainWorld('vboxTabs', {
        listProfiles: () => ipcRenderer.invoke('webview-list-profiles'),
        listTabs: () => ipcRenderer.invoke('webview-list-tabs'),
        switchTab: (tabId) => ipcRenderer.invoke('webview-switch-tab', tabId),
        getPageInfo: (tabId) => ipcRenderer.invoke('webview-get-page-info', tabId || null)
    });

    contextBridge.exposeInMainWorld('vboxPassword', {
        onLoginSubmit: async (formData) => {
            try {
                const ctx = await ipcRenderer.invoke('get-workspace-context');
                const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;

                if (!profileId) {
                    return { success: false, error: 'No active profile' };
                }

                const username = formData.usernameField?.value || '';
                const password = formData.passwordField?.value || '';

                if (!username || !password) {
                    return { success: false, error: 'Missing username or password' };
                }

                const result = await ipcRenderer.invoke('password-capture-submit', {
                    profileId,
                    origin: formData.origin || window.location.origin,
                    username,
                    password,
                    title: formData.title || document.title,
                    url: formData.url || window.location.href
                });

                if (result.success && result.captured) {
                    ipcRenderer.send('password-show-save-prompt', {
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
                const ctx = await ipcRenderer.invoke('get-workspace-context');
                const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;

                if (!profileId) return { hasCredentials: false };

                const result = await ipcRenderer.invoke('password-autofill-lookup', {
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
                const ctx = await ipcRenderer.invoke('get-workspace-context');
                const profileId = ctx?.id || ctx?.profileId || ctx?.profile_id;

                if (!profileId) return { success: false, credentials: [] };

                return await ipcRenderer.invoke('password-autofill-lookup', {
                    profileId,
                    origin
                });
            } catch (error) {
                return { success: false, credentials: [] };
            }
        },

        generatePassword: async (options = {}) => {
            try {
                return await ipcRenderer.invoke('password-generate', options);
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    });
}

module.exports = { init: initContextBridge };
