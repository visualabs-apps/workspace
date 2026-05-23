function initThemeOverride(ipcRenderer) {
    try {
        const theme = ipcRenderer.sendSync('get-theme-sync');
        const nativeMatchMedia = window.matchMedia.bind(window);

        let isDark = theme === 'dark' ||
            (theme === 'system' && nativeMatchMedia('(prefers-color-scheme: dark)').matches);

        // Weak references to all MQL objects we've patched, keyed by query string.
        // Used to dispatch live `change` events when theme switches.
        const trackedMqls = new Map();

        function patchMql(mql, query) {
            const isDarkQuery = query === '(prefers-color-scheme: dark)';
            const isLightQuery = query === '(prefers-color-scheme: light)';
            if (!isDarkQuery && !isLightQuery) return;
            try {
                Object.defineProperty(mql, 'matches', {
                    get: () => isDarkQuery ? isDark : !isDark,
                    configurable: true
                });
            } catch (_) {}

            if (!trackedMqls.has(query)) trackedMqls.set(query, new Set());
            trackedMqls.get(query).add(new WeakRef(mql));
        }

        // Override window.matchMedia so every call gets our patched MQL
        window.matchMedia = function (query) {
            const mql = nativeMatchMedia(query);
            patchMql(mql, query);
            return mql;
        };

        // Apply initial override for code that already ran before our patch
        // (e.g. inline scripts evaluated before preload finished)
        if (isDark) {
            try {
                const script = document.createElement('script');
                script.textContent = [
                    '(function(){',
                    '  var nm=window.matchMedia;',
                    '  window.matchMedia=function(q){',
                    '    var m=nm.call(window,q);',
                    '    if(q==="(prefers-color-scheme: dark)"){',
                    '      try{Object.defineProperty(m,"matches",{get:function(){return true},configurable:true});}catch(e){}',
                    '    }',
                    '    if(q==="(prefers-color-scheme: light)"){',
                    '      try{Object.defineProperty(m,"matches",{get:function(){return false},configurable:true});}catch(e){}',
                    '    }',
                    '    return m;',
                    '  };',
                    '})();'
                ].join('');
                (document.documentElement || document.head || document).appendChild(script);
                script.remove();
            } catch (_) {}
        }

        // Live theme update: main process broadcasts this when the user changes theme in settings
        ipcRenderer.on('webview-theme-changed', (_event, newTheme) => {
            const newIsDark = newTheme === 'dark' ||
                (newTheme === 'system' && nativeMatchMedia('(prefers-color-scheme: dark)').matches);

            if (newIsDark === isDark) return;
            isDark = newIsDark;

            // Re-patch all tracked MQLs and dispatch `change` events so that
            // website listeners (e.g. addEventListener('change', ...)) fire immediately.
            for (const [query, refs] of trackedMqls) {
                const dead = [];
                for (const ref of refs) {
                    const mql = ref.deref();
                    if (!mql) { dead.push(ref); continue; }

                    // Re-patch the `matches` getter
                    const isDarkQuery = query === '(prefers-color-scheme: dark)';
                    try {
                        Object.defineProperty(mql, 'matches', {
                            get: () => isDarkQuery ? isDark : !isDark,
                            configurable: true
                        });
                    } catch (_) {}

                    // Dispatch change event
                    try {
                        mql.dispatchEvent(new MediaQueryListEvent('change', {
                            media: query,
                            matches: mql.matches
                        }));
                    } catch (_) {}
                }
                dead.forEach(r => refs.delete(r));
            }

            // Also update any early-patched matchMedia via a quick script injection
            try {
                const script = document.createElement('script');
                const darkStr = isDark ? 'true' : 'false';
                script.textContent = [
                    '(function(){',
                    '  var nm=window.__nativeMatchMedia__||window.matchMedia;',
                    '  ["(prefers-color-scheme: dark)","(prefers-color-scheme: light)"].forEach(function(q){',
                    '    var m=nm.call(window,q);',
                    '    var isD=q==="(prefers-color-scheme: dark)";',
                    '    try{Object.defineProperty(m,"matches",{get:function(){return isD?' + darkStr + ':!' + darkStr + '},configurable:true});}catch(e){}',
                    '  });',
                    '})();'
                ].join('');
                (document.documentElement || document.head || document).appendChild(script);
                script.remove();
            } catch (_) {}
        });

    } catch (_) {
        // Theme override is not critical — fail silently
    }
}

module.exports = { init: initThemeOverride };
