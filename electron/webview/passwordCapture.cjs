/**
 * Unified Password Capture & Auto-Fill Engine
 *
 * Merged from passwordCapture.cjs + passwordEngine.cjs into a single consistent engine.
 *
 * Architecture:
 *   passwordCapture (preload context) → IPC → main process (passwordService)
 *   Also exposes window.__passwordEngine for page-level access
 *
 * Features:
 *   - MutationObserver for dynamic form detection (SPA support)
 *   - Login form recognition with heuristic scoring
 *   - Change-password form detection
 *   - Auto-fill credentials (with framework compatibility)
 *   - "Save Password?" capture on form submit & click
 *   - Visual indicators for detected fields/buttons
 *   - Password change detection
 *   - Iframe scanning
 */

function initPasswordCapture(ipcRenderer) {
    // ── Configuration ──────────────────────────────────────
    const CONFIG = {
        debounceDelay: 300,         // ms to wait before rescanning
        autofillDelay: 500,         // ms to wait before auto-filling after detection
        maxRetries: 5,              // max autofill retry attempts (renamed from MAX_AUTOFILL_ATTEMPTS)
        highlightFill: true,        // briefly highlight filled fields
        highlightColor: '#e8f0fe',  // light blue (Chrome-like)
        highlightDuration: 1500     // ms for highlight
    };

    // ── State ──────────────────────────────────────────────
    let cachedProfileId = null;
    let lastCapturedUsername = '';
    let lastCapturedPassword = '';
    let credentialsCaptured = false;
    let autofillAttempts = 0;
    let detectedForms = [];
    let isObserving = false;
    let lastClickedSubmitBtn = null;

    const DEBUG = false;

    function log(...args) {
        if (DEBUG) console.log('[PasswordCapture]', ...args);
    }

    // ── Unified Patterns (merged from both engines) ───────
    const USERNAME_PATTERNS = {
        name: ['email', 'user', 'login', 'account', 'username', 'user_email', 'user_login', 'auth_email', 'identifier', 'userid', 'user-name', 'user-id', 'loginid', 'login-id'],
        autocomplete: ['email', 'username', 'email-address', 'user', 'login'],
        type: ['email', 'tel'],
        placeholder: ['email', 'username', 'phone', 'mobile', 'user']
    };

    const PASSWORD_CHANGE_PATTERNS = {
        name: ['new_password', 'newpassword', 'confirm_password', 'confirmpassword', 'password_confirm', 'password1', 'password2', 'new-password', 'verify-password'],
        autocomplete: ['new-password']
    };

    // Track which password inputs already have the indicator
    const detectedInputs = new WeakSet();
    // Track which buttons already have the indicator
    let detectedButtons = new WeakSet();

    // ── Visual Indicators ──────────────────────────────────

    /**
     * Inject a visual indicator below a detected password input
     * to confirm the password manager has detected it.
     */
    function injectDetectionIndicator(passwordInput) {
        if (!passwordInput || detectedInputs.has(passwordInput)) return;
        detectedInputs.add(passwordInput);

        // DISABLED: Visual indicator embed hidden — detection logic still active
        // try {
        //     const indicator = document.createElement('div');
        //     indicator.setAttribute('data-vbox-indicator', 'true');
        //     indicator.textContent = '🔐 Detected by Password Manager';
        //     Object.assign(indicator.style, {
        //         fontSize: '11px',
        //         color: '#22c55e',
        //         padding: '2px 8px',
        //         marginTop: '2px',
        //         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        //         pointerEvents: 'none',
        //         userSelect: 'none',
        //         zIndex: '999999',
        //         position: 'relative',
        //         display: 'inline-block',
        //         opacity: '0.85',
        //     });
        //
        //     // Insert after the password input or its closest wrapper
        //     const parent = passwordInput.parentElement;
        //     if (parent) {
        //         // Try to find the best insertion point
        //         // For custom inputs (like Shopee's eds-input), insert after the input wrapper
        //         const wrapper = passwordInput.closest('.eds-input__inner') ||
        //                        passwordInput.closest('.eds-input') ||
        //                        parent;
        //         if (wrapper && wrapper.parentElement) {
        //             wrapper.parentElement.insertBefore(indicator, wrapper.nextSibling);
        //         } else {
        //             parent.insertBefore(indicator, passwordInput.nextSibling);
        //         }
        //     }
        // } catch (e) {
        //     // Ignore DOM errors
        // }
    }

    /**
     * Inject a "Button Detected" label on/near a submit button
     */
    function injectButtonIndicator(btn) {
        if (!btn || detectedButtons.has(btn)) return;
        detectedButtons.add(btn);

        // DISABLED: Visual indicator embed hidden — detection logic still active
        // try {
        //     const label = document.createElement('div');
        //     label.setAttribute('data-vbox-btn-indicator', 'true');
        //     label.textContent = '🔐 Button Detected';
        //     Object.assign(label.style, {
        //         fontSize: '10px',
        //         color: '#3b82f6',
        //         padding: '1px 6px',
        //         marginTop: '1px',
        //         fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        //         pointerEvents: 'none',
        //         userSelect: 'none',
        //         zIndex: '999999',
        //         position: 'relative',
        //         display: 'inline-block',
        //         opacity: '0.8',
        //     });
        //
        //     // Insert after the button
        //     if (btn.nextSibling) {
        //         btn.parentNode.insertBefore(label, btn.nextSibling);
        //     } else {
        //         btn.parentNode.appendChild(label);
        //     }
        // } catch (e) {}
    }

    /**
     * Scan for submit buttons near password fields and inject indicators.
     * Only shows indicators when there's a VISIBLE password input on the page.
     */
    function scanAndIndicateButtons() {
        // Remove old button indicators first
        document.querySelectorAll('[data-vbox-btn-indicator]').forEach(el => el.remove());
        detectedButtons = new WeakSet();

        // Only proceed if there's a visible password input
        const visiblePasswordInputs = Array.from(document.querySelectorAll('input[type="password"]'))
            .filter(input => input.offsetParent !== null && !input.disabled);

        if (visiblePasswordInputs.length === 0) return;

        // Strategy 1: Find buttons within the same form
        const buttons = new Set();
        visiblePasswordInputs.forEach(pwInput => {
            const form = pwInput.closest('form');
            if (form) {
                form.querySelectorAll('button, input[type="submit"], [role="button"]').forEach(btn => {
                    if (btn.offsetParent !== null && !btn.disabled) buttons.add(btn);
                });
            }
        });

        // Strategy 2: If no buttons found in forms, search broader containers
        if (buttons.size === 0) {
            visiblePasswordInputs.forEach(pwInput => {
                let container = pwInput.parentElement;
                let depth = 0;
                while (container && depth < 15) {
                    const foundButtons = container.querySelectorAll('button, input[type="submit"], [role="button"]');
                    const visibleButtons = Array.from(foundButtons).filter(btn =>
                        btn.offsetParent !== null && !btn.disabled &&
                        btn.type !== 'checkbox' &&
                        (btn.textContent?.trim().length > 0 || btn.querySelector('span, div'))
                    );
                    if (visibleButtons.length > 0) {
                        visibleButtons.forEach(btn => buttons.add(btn));
                        break;
                    }
                    container = container.parentElement;
                    depth++;
                }
            });
        }

        // Strategy 3: If still no buttons, search the entire page for visible submit-like buttons
        if (buttons.size === 0) {
            document.querySelectorAll('button[type="submit"], button[type="button"], input[type="submit"]').forEach(btn => {
                if (btn.offsetParent !== null && !btn.disabled) {
                    buttons.add(btn);
                }
            });
        }

        // Inject indicators on found buttons
        buttons.forEach(btn => injectButtonIndicator(btn));
    }

    /**
     * Scan all password inputs and inject indicators
     */
    function scanAndIndicate() {
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            if (input.offsetParent !== null && !input.disabled) {
                injectDetectionIndicator(input);
            }
        });
    }

    // ── Form Detection (merged best of both engines) ──────

    /**
     * Check if a form looks like a login form.
     * Uses scoring heuristics (Chrome-like approach).
     *
     * Merged scoring from both engines:
     *   - Single password field → likely login (+2)
     *   - Two password fields → likely registration/change (-1)
     *   - Email/tel type inputs (+1)
     *   - Username-like name attributes (+1)
     *   - Autocomplete username/email hints (+2)
     *   - Confirm/verify fields → negative signal (-1)
     *   - Name fields → registration signal (-2)
     *   - Form action hints (login/signin/auth) (+2)
     *   - Form action hints (register/signup/create) (-2)
     *   - "Remember me" checkbox (+1)
     */
    function isLoginForm(form) {
        const passwordFields = form.querySelectorAll('input[type="password"]');
        if (passwordFields.length === 0) return false;
        if (passwordFields.length === 1) return true; // Fast path

        // Multiple password fields — use scoring
        let score = 0;

        // Two password fields → likely registration or change password
        if (passwordFields.length === 2) score -= 1;

        // Check for username-like fields
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            const type = (input.type || 'text').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();

            // Positive signals
            if (type === 'email' || type === 'tel') score += 1;
            if (USERNAME_PATTERNS.name.some(p => name.includes(p) || id.includes(p))) score += 1;
            if (autocomplete.includes('username') || autocomplete.includes('email')) score += 2;
            if (USERNAME_PATTERNS.placeholder.some(p => placeholder.includes(p))) score += 1;

            // Negative signals (registration)
            if (name.includes('confirm') || name.includes('verify') || name.includes('repeat')) score -= 1;
            if (name.includes('first_name') || name.includes('last_name') || name.includes('fullname')) score -= 2;
        });

        // Check form action for hints
        const action = (form.action || '').toLowerCase();
        if (action.includes('login') || action.includes('signin') || action.includes('auth')) score += 2;
        if (action.includes('register') || action.includes('signup') || action.includes('create')) score -= 2;

        // Check for "remember me" checkbox (login indicator)
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const name = (cb.name || '').toLowerCase();
            if (name.includes('remember') || name.includes('stay')) score += 1;
        });

        return score >= 1;
    }

    /**
     * Extract detailed form data from a form element.
     * Includes password change detection fields.
     */
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

        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            const type = (input.type || 'text').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();

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

            // Detect password fields
            if (type === 'password') {
                const isNewPassword = PASSWORD_CHANGE_PATTERNS.name.some(p => name.includes(p)) ||
                    PASSWORD_CHANGE_PATTERNS.autocomplete.includes(autocomplete) ||
                    placeholder.includes('new password') ||
                    placeholder.includes('confirm');

                if (isNewPassword) {
                    if (!data.newPasswordField) {
                        data.newPasswordField = inputData;
                    } else {
                        data.confirmPasswordField = inputData;
                    }
                } else if (!data.passwordField) {
                    data.passwordField = inputData;
                } else {
                    // Multiple password fields without new-password markers
                    // likely a change password form
                    if (!data.newPasswordField) {
                        data.newPasswordField = inputData;
                        data.isChangePasswordForm = true;
                    }
                }
            }

            // Detect username field
            if (!data.usernameField && type !== 'password' && type !== 'hidden' && type !== 'submit' && type !== 'button') {
                const isUsername =
                    USERNAME_PATTERNS.name.some(p => name.includes(p) || id.includes(p)) ||
                    USERNAME_PATTERNS.autocomplete.includes(autocomplete) ||
                    USERNAME_PATTERNS.type.includes(type) ||
                    USERNAME_PATTERNS.placeholder.some(p => placeholder.includes(p));

                if (isUsername) {
                    data.usernameField = inputData;
                }
            }
        });

        // If we have new/confirm password fields, mark as change password
        if (data.newPasswordField && data.confirmPasswordField) {
            data.isChangePasswordForm = true;
        }

        // Fallback: if no username detected but we have a text input before password
        if (!data.usernameField && data.passwordField) {
            const passwordInput = form.querySelector('input[type="password"]');
            if (passwordInput) {
                const precedingInputs = Array.from(form.querySelectorAll('input')).filter(i =>
                    i !== passwordInput &&
                    i.type !== 'hidden' &&
                    i.type !== 'submit' &&
                    i.type !== 'button' &&
                    i.type !== 'checkbox' &&
                    i.type !== 'radio'
                );
                // Take the last text-like input before the password field
                for (let i = precedingInputs.length - 1; i >= 0; i--) {
                    const inp = precedingInputs[i];
                    if (['text', 'email', 'tel', ''].includes(inp.type.toLowerCase())) {
                        data.usernameField = {
                            type: (inp.type || 'text').toLowerCase(),
                            name: (inp.name || '').toLowerCase(),
                            id: (inp.id || '').toLowerCase(),
                            autocomplete: (inp.getAttribute('autocomplete') || '').toLowerCase(),
                            placeholder: (inp.placeholder || '').toLowerCase(),
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

    /**
     * Extract credentials (username + password) from a form.
     * Simplified wrapper over extractFormData for backward compatibility.
     */
    function extractCredentials(form) {
        const formData = extractFormData(form);
        return {
            username: formData.usernameField?.value || '',
            password: formData.passwordField?.value || ''
        };
    }

    // ── Value Setting (merged best of both) ────────────────

    /**
     * Set input value with framework compatibility.
     * Uses native setter bypass for React/Vue/Angular/Svelte.
     * Dispatches full event sequence including keyboard events.
     */
    function setInputValue(element, value) {
        if (!element || value === undefined) return false;

        try {
            // Native setter bypass (works for React, Vue, Angular, Svelte)
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                'value'
            )?.set;

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value);
            } else {
                element.value = value;
            }

            // Dispatch full event sequence for framework compatibility
            element.dispatchEvent(new Event('focus', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

            // Keyboard events (some frameworks need this)
            element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

            // For React specifically
            const tracker = element._valueTracker;
            if (tracker) {
                tracker.setValue('');
            }

            return true;
        } catch (e) {
            element.value = value;
            return false;
        }
    }

    /**
     * Highlight a filled field briefly (Chrome-like visual feedback)
     */
    function highlightField(element) {
        if (!CONFIG.highlightFill || !element) return;

        try {
            const original = element.style.backgroundColor;
            element.style.backgroundColor = CONFIG.highlightColor;
            element.style.transition = 'background-color 0.3s ease';

            setTimeout(() => {
                element.style.backgroundColor = original || '';
            }, CONFIG.highlightDuration);
        } catch (e) {}
    }

    // ── Form Scanning ──────────────────────────────────────

    /**
     * Scan page for login forms (both inside <form> and standalone)
     */
    function scanForLoginForms() {
        const forms = document.querySelectorAll('form');
        const loginForms = [];

        forms.forEach(form => {
            if (isLoginForm(form)) {
                const formData = extractFormData(form);
                loginForms.push(formData);
                log('Found login form:', formData);
            }
        });

        // Also detect standalone password fields (not inside a form)
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(passwordInput => {
            const parentForm = passwordInput.closest('form');
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

                // Find nearby username fields (siblings or parent containers)
                const container = passwordInput.closest('div, section, main, article') || passwordInput.parentElement;
                if (container) {
                    const siblings = container.querySelectorAll('input');
                    siblings.forEach(input => {
                        if (input !== passwordInput && input.type !== 'hidden') {
                            const type = (input.type || 'text').toLowerCase();
                            const name = (input.name || '').toLowerCase();

                            if (type === 'email' || type === 'tel' || type === 'text') {
                                if (USERNAME_PATTERNS.name.some(p => name.includes(p)) || type === 'email') {
                                    formData.usernameField = {
                                        type,
                                        name,
                                        id: (input.id || '').toLowerCase(),
                                        value: input.value,
                                        element: input
                                    };
                                }
                            }
                            formData.inputs.push({
                                type,
                                name,
                                id: (input.id || '').toLowerCase(),
                                value: input.value,
                                element: input
                            });
                        }
                    });
                }

                formData.passwordField = {
                    type: 'password',
                    name: (passwordInput.name || '').toLowerCase(),
                    id: (passwordInput.id || '').toLowerCase(),
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

    /**
     * Find the first login form on the page (form or standalone password input)
     */
    function findLoginForm() {
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
            if (isLoginForm(form)) return form;
        }

        // Also check for standalone password inputs (for non-form modals like Shopee)
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        if (passwordInputs.length > 0) {
            return passwordInputs[0].closest('form, div[class*="modal"], div[class*="verify"], div[role="dialog"]') || passwordInputs[0];
        }

        return null;
    }

    // ── Auto-fill Engine ───────────────────────────────────

    /**
     * Auto-fill credentials into detected forms.
     * Handles both form-based and standalone password inputs.
     */
    function autofillCredentials(credentials) {
        if (!credentials || credentials.length === 0) {
            log('No credentials to fill');
            return { success: false, reason: 'No credentials' };
        }

        const cred = credentials[0]; // Use best-matching credential
        let filled = false;

        // Fill form-based login forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!isLoginForm(form)) return;

            const passwordInput = form.querySelector('input[type="password"]');
            if (!passwordInput) return;

            // Check if password field is visible and not disabled
            if (passwordInput.offsetParent === null || passwordInput.disabled) return;

            // Fill password
            setInputValue(passwordInput, cred.password);
            highlightField(passwordInput);
            log('Filled password for:', cred.origin);

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
                    USERNAME_PATTERNS.type.includes(type) ||
                    USERNAME_PATTERNS.name.some(p => name.includes(p) || id.includes(p)) ||
                    USERNAME_PATTERNS.autocomplete.includes(ac) ||
                    USERNAME_PATTERNS.placeholder.some(p => placeholder.includes(p))
                ) {
                    setInputValue(input, cred.username);
                    highlightField(input);
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
                        highlightField(inp);
                        break;
                    }
                }
            }

            filled = true;
        });

        // Handle standalone password inputs (modals, dialogs)
        const standalonePasswords = document.querySelectorAll('input[type="password"]');
        standalonePasswords.forEach(pwInput => {
            if (pwInput.closest('form')) return;
            if (pwInput.offsetParent === null || pwInput.disabled) return;

            const matchingCred = credentials.find(c => !c.username || c.username === '') || credentials[0];
            if (matchingCred) {
                setInputValue(pwInput, matchingCred.password);
                highlightField(pwInput);

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

    /**
     * Trigger auto-fill for the current page.
     * Called on page load and when new forms are detected.
     */
    async function triggerAutofill() {
        try {
            const loginForm = findLoginForm();
            if (!loginForm) {
                // Retry if form not found yet (for slow-loading pages)
                if (autofillAttempts < CONFIG.maxRetries) {
                    autofillAttempts++;
                    setTimeout(triggerAutofill, CONFIG.autofillDelay * autofillAttempts);
                }
                return;
            }

            const result = await ipcRenderer.invoke('password-autofill-lookup', {
                profileId: null,
                origin: window.location.origin
            });

            if (result?.success && result.credentials?.length > 0) {
                log(`Autofilling ${result.credentials.length} credentials for ${window.location.origin}`);

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

    // ── Capture Handlers ───────────────────────────────────

    /**
     * Setup form submit listener for password capture.
     * Captures credentials on form submit (capture phase — fires before site's handlers).
     */
    function setupSubmitListener() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (!isLoginForm(form)) return;

            const { username, password } = extractCredentials(form);
            if (!password) return; // password is the minimum required

            credentialsCaptured = true;
            lastCapturedUsername = username;
            lastCapturedPassword = password;

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
        }, true); // capture phase to catch before potential prevention
    }

    /**
     * Setup password change detection.
     * Detects when a user changes their password and captures the new password.
     */
    function setupPasswordChangeListener() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const formData = extractFormData(form);

            if (formData.isChangePasswordForm && formData.newPasswordField?.value) {
                log('Password change detected');

                // If there's an old password and new password, this is a change
                if (formData.passwordField?.value && formData.newPasswordField.value) {
                    const newData = {
                        origin: window.location.origin,
                        url: window.location.href,
                        title: document.title,
                        username: formData.usernameField?.value || '',
                        password: formData.newPasswordField.value
                    };

                    credentialsCaptured = true;
                    lastCapturedUsername = newData.username;
                    lastCapturedPassword = newData.password;

                    if (!cachedProfileId) {
                        try {
                            const ctx = ipcRenderer.sendSync('get-workspace-context-sync');
                            cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
                        } catch {}
                    }

                    if (cachedProfileId) {
                        ipcRenderer.send('password-capture-urgent', {
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

    /**
     * Setup click capture for password detection.
     * Captures credentials when user clicks a submit-like button near a password field.
     */
    function setupClickCapture() {
        // Primary click handler (capture phase — fires before site's handlers)
        document.addEventListener('click', (e) => {
            handlePasswordClick(e);
        }, true);

        // Backup: mousedown handler (fires even if click is prevented)
        document.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('button, input[type="submit"], [role="button"]');
            if (btn) {
                lastClickedSubmitBtn = btn;
            }
        }, true);
    }

    function handlePasswordClick(e) {
        const btn = e.target.closest('button, input[type="submit"], [role="button"]');
        if (!btn) {
            const parentBtn = e.target.closest('button');
            if (!parentBtn) return;
        }

        const clickedBtn = btn || e.target.closest('button');
        const form = clickedBtn.closest('form');
        let passwordInput = null;
        let usernameInput = null;

        if (form) {
            passwordInput = form.querySelector('input[type="password"]');
        }

        // Broader search: look for ANY visible password input on the page
        // (for sites like Google that don't use standard <form> structure)
        if (!passwordInput) {
            const parent = clickedBtn.parentElement;
            if (parent) {
                const container = parent.parentElement || parent;
                passwordInput = container.querySelector('input[type="password"]');
            }
        }

        // Last resort: find any visible password input on the entire page
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
            log('Click on button but no password input found', { btnText: clickedBtn.textContent?.trim(), form: !!form });
            return;
        }

        const password = passwordInput.value || '';
        if (!password) return;

        log('Click detected near password field', {
            hasPassword: true,
            passwordLength: password.length,
            form: !!form,
            btnText: clickedBtn.textContent?.trim()
        });

        // Search for username — try multiple strategies
        const searchRoot = form || passwordInput.closest('div, section, main, body');
        if (searchRoot) {
            const inputs = searchRoot.querySelectorAll('input');
            for (const input of inputs) {
                const type = (input.type || 'text').toLowerCase();
                const name = (input.name || '').toLowerCase();
                const id = (input.id || '').toLowerCase();
                const placeholder = (input.placeholder || '').toLowerCase();

                if (type === 'password' || type === 'submit' || type === 'button') continue;

                if (
                    USERNAME_PATTERNS.type.includes(type) ||
                    USERNAME_PATTERNS.name.some(p => name.includes(p) || id.includes(p)) ||
                    USERNAME_PATTERNS.placeholder.some(p => placeholder.includes(p))
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

        // Broader search: check hidden email inputs on the entire page
        // (Google login puts email in a hidden <input type="email" name="identifier">)
        if (!usernameInput) {
            const hiddenEmails = document.querySelectorAll('input[type="email"][name="identifier"], input[type="email"][name="email"], input[name="identifierId"]');
            for (const input of hiddenEmails) {
                if (input.value) {
                    usernameInput = input;
                    break;
                }
            }
        }

        const username = usernameInput ? usernameInput.value : '';

        credentialsCaptured = true;
        lastCapturedUsername = username;
        lastCapturedPassword = password;

        // Try to get profileId — multiple fallback strategies
        if (!cachedProfileId) {
            try {
                const ctx = ipcRenderer.sendSync('get-workspace-context-sync');
                cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
            } catch (err) {}
        }

        // Send capture even if profileId is null — main process will try to resolve it
        log('Sending password-capture-urgent', {
            profileId: cachedProfileId || '(null — main process will resolve)',
            origin: window.location.origin,
            username: username || '(empty)',
            hasPassword: true
        });

        ipcRenderer.send('password-capture-urgent', {
            profileId: cachedProfileId || null,
            origin: window.location.origin,
            username,
            password,
            title: document.title,
            url: window.location.href
        });
    }

    /**
     * Send captured credentials on page unload.
     */
    function sendCapture() {
        if (!lastCapturedPassword) return;

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

    // ── MutationObserver ───────────────────────────────────

    function setupMutationObserver() {
        if (isObserving) return;

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
            attributeFilter: ['type', 'style', 'class']
        });

        isObserving = true;
        log('MutationObserver started');
    }

    // ── Input Tracking ─────────────────────────────────────

    function setupInputTracking() {
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
                        USERNAME_PATTERNS.type.includes(type) ||
                        USERNAME_PATTERNS.name.some(p => name.includes(p) || id.includes(p)) ||
                        USERNAME_PATTERNS.placeholder.some(p => placeholder.includes(p))
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
    }

    // ── Utility ────────────────────────────────────────────

    function getPageInfo() {
        return {
            origin: window.location.origin,
            href: window.location.href,
            title: document.title,
            hasLoginForm: detectedForms.length > 0,
            formCount: detectedForms.length
        };
    }

    // ── Initialization ─────────────────────────────────────

    async function init() {
        try {
            try {
                const ctx = await ipcRenderer.invoke('get-workspace-context');
                cachedProfileId = ctx?.id || ctx?.profileId || ctx?.profile_id;
                log('Init — workspace context:', {
                    success: ctx?.success,
                    profileId: cachedProfileId,
                    error: ctx?.error
                });
            } catch (e) {
                console.error('[PasswordCapture] Init — get-workspace-context failed:', e.message);
            }

            // Setup all listeners
            setupSubmitListener();
            setupPasswordChangeListener();
            setupClickCapture();
            setupInputTracking();
            setupMutationObserver();

            // Initial scan and autofill
            scanForLoginForms();
            triggerAutofill();
            scanAndIndicate();
            scanAndIndicateButtons();

            // Also setup for iframes (for embedded login forms)
            setTimeout(() => {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try {
                        if (iframe.contentDocument) {
                            const passwordFields = iframe.contentDocument.querySelectorAll('input[type="password"]');
                            if (passwordFields.length > 0) {
                                log('Found login form in iframe');
                                triggerAutofill();
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe, skip
                    }
                });
            }, 500);

            log('Password Engine initialized for:', window.location.origin);
        } catch (error) {
            console.error('[PasswordCapture] Init error:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ── Navigation / Lifecycle Handlers ────────────────────

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

    // ── Expose API to page context ─────────────────────────
    // (for external access, e.g., from devtools or extensions)
    window.__passwordEngine = {
        scanForLoginForms,
        autofillCredentials,
        getPageInfo,
        requestAutofill: (credentials) => autofillCredentials(credentials),
        triggerAutofill,
        getDetectedForms: () => detectedForms
    };
}

module.exports = { init: initPasswordCapture };
