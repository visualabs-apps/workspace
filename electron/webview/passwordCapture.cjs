function initPasswordCapture(ipcRenderer) {
    let cachedProfileId = null;
    let lastCapturedUsername = '';
    let lastCapturedPassword = '';
    let credentialsCaptured = false;
    let autofillAttempts = 0;
    const MAX_AUTOFILL_ATTEMPTS = 3;

    const USERNAME_NAMES = ['email', 'user', 'login', 'account', 'username', 'user_email', 'user_login', 'identifier', 'userid', 'user-name', 'user-id', 'loginid', 'login-id'];
    const USERNAME_AUTOCOMPLETE = ['email', 'username', 'email-address', 'user', 'login'];

    function isLoginForm(form) {
        const passwordFields = form.querySelectorAll('input[type="password"]');
        if (passwordFields.length === 0) return false;
        if (passwordFields.length === 1) return true;

        const inputs = form.querySelectorAll('input');
        let score = 0;
        inputs.forEach(input => {
            const name = (input.name || '').toLowerCase();
            const type = (input.type || 'text').toLowerCase();
            const ac = (input.getAttribute('autocomplete') || '').toLowerCase();
            if (type === 'email' || type === 'tel') score++;
            if (USERNAME_NAMES.some(p => name.includes(p))) score++;
            if (ac.includes('username') || ac.includes('email')) score += 2;
            if (name.includes('confirm') || name.includes('verify')) score--;
            if (name.includes('first_name') || name.includes('last_name')) score -= 2;
        });

        return score >= 1;
    }

    function extractCredentials(form) {
        let username = '';
        let password = '';
        const passwordInput = form.querySelector('input[type="password"]');

        if (passwordInput) {
            password = passwordInput.value || '';
        }

        const inputs = form.querySelectorAll('input');
        for (const input of inputs) {
            const type = (input.type || 'text').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const ac = (input.getAttribute('autocomplete') || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();

            if (type === 'password' || type === 'hidden' || type === 'submit' || type === 'button') continue;

            if (
                type === 'email' || type === 'tel' ||
                USERNAME_NAMES.some(p => name.includes(p) || id.includes(p)) ||
                USERNAME_AUTOCOMPLETE.includes(ac) ||
                placeholder.includes('email') || placeholder.includes('username')
            ) {
                username = input.value || '';
                break;
            }
        }

        if (!username && passwordInput) {
            const allInputs = Array.from(inputs);
            const pwIndex = allInputs.indexOf(passwordInput);
            for (let i = pwIndex - 1; i >= 0; i--) {
                const inp = allInputs[i];
                const type = (inp.type || 'text').toLowerCase();
                if (['text', 'email', 'tel', ''].includes(type) && inp.value) {
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
            // Native setter bypass (works for React, Vue, Angular)
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value'
            )?.set;
            
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value);
            } else {
                element.value = value;
            }

            // Trigger all possible events for framework compatibility
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            
            // For React specifically
            const tracker = element._valueTracker;
            if (tracker) {
                tracker.setValue('');
            }
        } catch (e) {
            element.value = value;
        }
    }

    function autofillCredentials(credentials) {
        if (!credentials || credentials.length === 0) return;

        const cred = credentials[0];
        const forms = document.querySelectorAll('form');

        forms.forEach(form => {
            if (!isLoginForm(form)) return;

            const passwordInput = form.querySelector('input[type="password"]');
            if (!passwordInput) return;

            // Check if password field is visible and not disabled
            if (passwordInput.offsetParent === null || passwordInput.disabled) return;

            setInputValue(passwordInput, cred.password);

            const inputs = form.querySelectorAll('input');
            let usernameFilled = false;

            // First pass: try to find username field by attributes
            for (const input of inputs) {
                const type = (input.type || 'text').toLowerCase();
                const name = (input.name || '').toLowerCase();
                const id = (input.id || '').toLowerCase();
                const ac = (input.getAttribute('autocomplete') || '').toLowerCase();
                const placeholder = (input.placeholder || '').toLowerCase();

                if (type === 'password' || type === 'hidden') continue;
                if (input.offsetParent === null || input.disabled) continue;

                if (
                    type === 'email' || type === 'tel' ||
                    USERNAME_NAMES.some(p => name.includes(p) || id.includes(p)) ||
                    USERNAME_AUTOCOMPLETE.includes(ac) ||
                    placeholder.includes('email') || placeholder.includes('username')
                ) {
                    setInputValue(input, cred.username);
                    usernameFilled = true;
                    break;
                }
            }

            // Second pass: fallback to first visible text input before password
            if (!usernameFilled && cred.username) {
                const allInputs = Array.from(inputs);
                const pwIndex = allInputs.indexOf(passwordInput);
                for (let i = pwIndex - 1; i >= 0; i--) {
                    const inp = allInputs[i];
                    const type = (inp.type || 'text').toLowerCase();
                    if (['text', 'email', 'tel', ''].includes(type) && 
                        inp.offsetParent !== null && 
                        !inp.disabled) {
                        setInputValue(inp, cred.username);
                        break;
                    }
                }
            }
        });

        // Handle standalone password inputs (modals, dialogs)
        const standalonePasswords = document.querySelectorAll('input[type="password"]');
        standalonePasswords.forEach(pwInput => {
            if (pwInput.closest('form')) return;
            if (pwInput.offsetParent === null || pwInput.disabled) return;

            const matchingCred = credentials.find(c => !c.username || c.username === '') || credentials[0];
            if (matchingCred) {
                setInputValue(pwInput, matchingCred.password);

                // Try to find username field near password
                if (matchingCred.username) {
                    const container = pwInput.closest('div, section, [role="dialog"]') || document.body;
                    const nearbyInputs = container.querySelectorAll('input');
                    const pwIndex = Array.from(nearbyInputs).indexOf(pwInput);
                    
                    for (let i = pwIndex - 1; i >= 0; i--) {
                        const inp = nearbyInputs[i];
                        const type = (inp.type || 'text').toLowerCase();
                        if (['text', 'email', 'tel', ''].includes(type) && 
                            inp.offsetParent !== null && 
                            !inp.disabled) {
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
                // Retry if form not found yet (for slow-loading pages)
                if (autofillAttempts < MAX_AUTOFILL_ATTEMPTS) {
                    autofillAttempts++;
                    setTimeout(triggerAutofill, 500 * autofillAttempts);
                }
                return;
            }

            const result = await ipcRenderer.invoke('password-autofill-lookup', {
                profileId: null,
                origin: window.location.origin
            });

            if (result?.success && result.credentials?.length > 0) {
                console.log(`[PasswordCapture] Autofilling ${result.credentials.length} credentials for ${window.location.origin}`);
                
                // Delay autofill slightly to ensure DOM is ready
                setTimeout(() => {
                    autofillCredentials(result.credentials);
                    autofillAttempts = 0; // Reset on success
                }, 100);
            }
        } catch (e) {
            console.error('[PasswordCapture] Autofill error:', e);
        }
    }

    function findLoginForm() {
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
            if (isLoginForm(form)) return form;
        }

        // Also check for standalone password inputs (for non-form modals like Shopee)
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        if (passwordInputs.length > 0) {
            // Return the password input's closest container (could be a modal/div)
            return passwordInputs[0].closest('form, div[class*="modal"], div[class*="verify"], div[role="dialog"]') || passwordInputs[0];
        }

        return null;
    }

    function setupSubmitListener() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (!isLoginForm(form)) return;

            const { username, password } = extractCredentials(form);
            if (!password) return; // password is the minimum required

            credentialsCaptured = true;

            if (!cachedProfileId) {
                try {
                    const ctx = ipcRenderer.sendSync('get-workspace-context-sync');
                    cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
                } catch {}
            }

            if (!cachedProfileId) return;

            ipcRenderer.send('password-capture-urgent', {
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
        const forms = document.querySelectorAll('form');
        const passwordFields = document.querySelectorAll('input[type="password"]');
        return { forms: forms.length, passwordFields: passwordFields.length };
    }

    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let hasNewForm = false;
            let hasNewPassword = false;
            let hasAttributeChange = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (!node || node.nodeType !== 1) continue;
                        if (node.nodeName === 'FORM' || (node.querySelector && node.querySelector('form'))) {
                            hasNewForm = true;
                        }
                        if (node.nodeName === 'INPUT' && node.type === 'password') {
                            hasNewPassword = true;
                        }
                        if (node.querySelector && node.querySelector('input[type="password"]')) {
                            hasNewPassword = true;
                        }
                    }
                }
                // Watch for attribute changes (type="text" -> type="password")
                if (mutation.type === 'attributes' && mutation.target.nodeName === 'INPUT') {
                    const input = mutation.target;
                    if (input.type === 'password') {
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
            attributeFilter: ['type', 'style', 'class']
        });
    }

    function setupClickCapture() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button, input[type="submit"], [role="button"]');
            if (!btn) return;

            const form = btn.closest('form');
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

            const password = passwordInput.value || '';
            if (!password) return;

            const searchRoot = form || passwordInput.closest('div, section, main, body');
            if (searchRoot) {
                const inputs = searchRoot.querySelectorAll('input');
                for (const input of inputs) {
                    const type = (input.type || 'text').toLowerCase();
                    const name = (input.name || '').toLowerCase();
                    const id = (input.id || '').toLowerCase();
                    const placeholder = (input.placeholder || '').toLowerCase();

                    if (type === 'password' || type === 'hidden' || type === 'submit' || type === 'button') continue;

                    if (
                        type === 'email' || type === 'tel' ||
                        USERNAME_NAMES.some(p => name.includes(p) || id.includes(p)) ||
                        placeholder.includes('email') || placeholder.includes('username')
                    ) {
                        usernameInput = input;
                        break;
                    }
                }

                if (!usernameInput) {
                    const allInputs = Array.from(inputs);
                    const pwIdx = allInputs.indexOf(passwordInput);
                    for (let i = pwIdx - 1; i >= 0; i--) {
                        const inp = allInputs[i];
                        const type = (inp.type || 'text').toLowerCase();
                        if (['text', 'email', 'tel', ''].includes(type) && inp.value) {
                            usernameInput = inp;
                            break;
                        }
                    }
                }
            }

            const username = usernameInput ? usernameInput.value : '';
            if (!password) return; // password is the minimum required

            credentialsCaptured = true;

            if (!cachedProfileId) {
                try {
                    const ctx = ipcRenderer.sendSync('get-workspace-context-sync');
                    cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
                } catch {}
            }

            if (!cachedProfileId) return;

            ipcRenderer.send('password-capture-urgent', {
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
        if (!lastCapturedPassword) return; // Password is minimum required

        let pid = cachedProfileId;
        if (!pid) {
            try {
                const ctx = ipcRenderer.sendSync('get-workspace-context-sync');
                pid = ctx?.id || ctx?.profileId || ctx?.profile_id;
            } catch {}
        }

        if (!pid) return;

        ipcRenderer.send('password-capture-urgent', {
            profileId: pid,
            origin: window.location.origin,
            username: lastCapturedUsername || '',
            password: lastCapturedPassword,
            title: document.title,
            url: window.location.href
        });
    }

    async function init() {
        try {
            try {
                const ctx = await ipcRenderer.invoke('get-workspace-context');
                cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            } catch (e) {}

            setupSubmitListener();
            setupClickCapture();
            setupMutationObserver();
            triggerAutofill();
            
            // Also setup for iframes (for embedded login forms)
            setTimeout(() => {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        if (iframe.contentDocument) {
                            // Same-origin iframe, we can access it
                            const iframeDoc = iframe.contentDocument;
                            const passwordFields = iframeDoc.querySelectorAll('input[type="password"]');
                            if (passwordFields.length > 0) {
                                console.log('[PasswordCapture] Found login form in iframe');
                                // Trigger autofill for iframe content
                                triggerAutofill();
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe, skip
                    }
                });
            }, 500);
        } catch (error) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    document.addEventListener('input', (e) => {
        const input = e.target;
        if (!input || input.tagName !== 'INPUT') return;

        const type = (input.type || 'text').toLowerCase();
        const form = input.closest('form');

        // Track input in login forms
        if (form && isLoginForm(form)) {
            if (type === 'password') {
                lastCapturedPassword = input.value || '';
            } else if (type !== 'hidden' && type !== 'submit' && type !== 'button') {
                const name = (input.name || '').toLowerCase();
                const id = (input.id || '').toLowerCase();
                const placeholder = (input.placeholder || '').toLowerCase();

                if (
                    type === 'email' || type === 'tel' ||
                    USERNAME_NAMES.some(p => name.includes(p) || id.includes(p)) ||
                    placeholder.includes('email') || placeholder.includes('username')
                ) {
                    lastCapturedUsername = input.value || '';
                }
            }
        } 
        // Also track standalone password inputs (modals, dialogs)
        else if (type === 'password' && !form) {
            lastCapturedPassword = input.value || '';
            
            // Try to find username in nearby inputs
            const container = input.closest('div, section, [role="dialog"]') || document.body;
            const nearbyInputs = container.querySelectorAll('input');
            const pwIndex = Array.from(nearbyInputs).indexOf(input);
            
            for (let i = pwIndex - 1; i >= 0; i--) {
                const inp = nearbyInputs[i];
                const inpType = (inp.type || 'text').toLowerCase();
                if (['text', 'email', 'tel', ''].includes(inpType) && inp.value) {
                    lastCapturedUsername = inp.value;
                    break;
                }
            }
        }
    }, true);

    window.addEventListener('beforeunload', () => {
        if (credentialsCaptured) return;
        sendCapture();
    });

    window.addEventListener('pagehide', () => {
        if (credentialsCaptured) return;
        sendCapture();
    });

    window.addEventListener('unload', () => {
        if (credentialsCaptured) return;
        sendCapture();
    });

    document.addEventListener('visibilitychange', () => {
        if (credentialsCaptured) return;
        if (document.visibilityState !== 'hidden') return;
        sendCapture();
    });

    window.addEventListener('hashchange', () => {
        credentialsCaptured = false;
        autofillAttempts = 0;
        setTimeout(triggerAutofill, 300);
    });

    window.addEventListener('popstate', () => {
        credentialsCaptured = false;
        autofillAttempts = 0;
        setTimeout(triggerAutofill, 500);
    });
}

module.exports = { init: initPasswordCapture };
