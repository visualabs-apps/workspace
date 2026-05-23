/**
 * Form Detection & Auto-Fill Engine (Chrome-like Password Manager)
 *
 * This script runs in the context of web pages via webview-preload.
 * It detects login forms and enables Chrome-like password management.
 *
 * Features:
 *   - MutationObserver for dynamic form detection (SPA support)
 *   - Login form recognition with heuristic scoring
 *   - Change-password form detection
 *   - Auto-fill credentials (with framework compatibility)
 *   - "Save Password?" capture on form submit
 *   - Password change detection
 *
 * Architecture:
 *   passwordEngine (in page) → window.vboxPassword (preload bridge) → IPC → main process
 */

(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────
    const CONFIG = {
        debounceDelay: 300,         // ms to wait before rescanning
        autofillDelay: 500,         // ms to wait before auto-filling after detection
        maxRetries: 5,              // max autofill retry attempts
        highlightFill: true,        // briefly highlight filled fields
        highlightColor: '#e8f0fe',  // light blue (Chrome-like)
        highlightDuration: 1500     // ms for highlight
    };

    // ── State ──────────────────────────────────────────────
    let detectedForms = [];
    let currentOrigin = window.location.origin;
    let isObserving = false;
    let autofillAttempted = false;
    let lastCapturedUsername = '';
    let lastCapturedPassword = '';

    const DEBUG = false;

    function log(...args) {
        if (DEBUG) console.log('[PasswordEngine]', ...args);
    }

    // ── Username Field Detection Heuristics ────────────────
    const USERNAME_PATTERNS = {
        name: ['email', 'user', 'login', 'account', 'username', 'user_email', 'user_login', 'auth_email', 'identifier'],
        autocomplete: ['email', 'username', 'email-address'],
        type: ['email', 'tel'],
        placeholder: ['email', 'username', 'phone', 'mobile', 'user']
    };

    const PASSWORD_CHANGE_PATTERNS = {
        name: ['new_password', 'newpassword', 'confirm_password', 'confirmpassword', 'password_confirm', 'password1', 'password2', 'new-password', 'verify-password'],
        autocomplete: ['new-password']
    };

    // ── Form Data Extraction ───────────────────────────────

    /**
     * Extract form data from a form element
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
                element: input  // keep reference for autofill
            };

            data.inputs.push(inputData);

            // Detect password fields
            if (type === 'password') {
                // Check if this is a "new password" field (change password form)
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

    // ── Login Form Detection ───────────────────────────────

    /**
     * Check if a form looks like a login form
     * Uses scoring heuristics (Chrome-like approach)
     */
    function isLoginForm(form) {
        let score = 0;

        const passwordFields = form.querySelectorAll('input[type="password"]');
        if (passwordFields.length === 0) return false;

        // Single password field → likely login
        if (passwordFields.length === 1) score += 2;

        // Two password fields → likely registration or change password
        if (passwordFields.length === 2) score -= 1;

        // Check for username-like fields
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            const type = (input.type || 'text').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();

            if (type === 'email' || type === 'tel') score += 1;
            if (USERNAME_PATTERNS.name.some(p => name.includes(p))) score += 1;
            if (autocomplete.includes('username') || autocomplete.includes('email')) score += 2;

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

    // ── Page Scanner ───────────────────────────────────────

    /**
     * Scan page for login forms
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

    // ── Auto-fill Engine ───────────────────────────────────

    /**
     * Get native value setter for framework compatibility (React, Vue, Svelte)
     */
    function getNativeValueSetter(element) {
        try {
            if (element.tagName === 'TEXTAREA') {
                return Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            }
            return Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        } catch {
            return null;
        }
    }

    /**
     * Set input value with framework compatibility
     */
    function setInputValue(element, value) {
        if (!element || value === undefined) return false;

        const nativeSetter = getNativeValueSetter(element);
        if (nativeSetter) {
            nativeSetter.call(element, value);
        } else {
            element.value = value;
        }

        // Dispatch events for frameworks
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        // Also dispatch KeyboardEvent sequence (some frameworks need this)
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        return true;
    }

    /**
     * Highlight a filled field briefly (Chrome-like visual feedback)
     */
    function highlightField(element) {
        if (!CONFIG.highlightFill || !element) return;

        const original = element.style.backgroundColor;
        element.style.backgroundColor = CONFIG.highlightColor;
        element.style.transition = 'background-color 0.3s ease';

        setTimeout(() => {
            element.style.backgroundColor = original || '';
        }, CONFIG.highlightDuration);
    }

    /**
     * Auto-fill credentials into detected forms
     */
    function autofillCredentials(credentials) {
        if (!credentials || credentials.length === 0) {
            log('No credentials to fill');
            return { success: false, reason: 'No credentials' };
        }

        const forms = scanForLoginForms();
        if (forms.length === 0) {
            return { success: false, reason: 'No login forms found' };
        }

        let filled = false;
        const cred = credentials[0]; // Use best-matching credential

        forms.forEach(formData => {
            // Fill username
            if (formData.usernameField?.element && cred.username) {
                setInputValue(formData.usernameField.element, cred.username);
                highlightField(formData.usernameField.element);
                log('Filled username:', cred.username);
            }

            // Fill password
            if (formData.passwordField?.element && cred.password) {
                setInputValue(formData.passwordField.element, cred.password);
                highlightField(formData.passwordField.element);
                log('Filled password for:', cred.origin);
                filled = true;
            }
        });

        return { success: filled, filled: filled ? 1 : 0 };
    }

    // ── MutationObserver ───────────────────────────────────

    function setupMutationObserver() {
        if (isObserving) return;

        const observer = new MutationObserver((mutations) => {
            let shouldRescan = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeName === 'FORM' || (node.querySelector && node.querySelector('form'))) {
                            shouldRescan = true;
                            break;
                        }
                        // Also check for input fields added outside forms
                        if (node.nodeName === 'INPUT' && node.type === 'password') {
                            shouldRescan = true;
                            break;
                        }
                    }
                }
                if (shouldRescan) break;
            }

            if (shouldRescan) {
                log('New form detected, rescanning...');
                debounce(() => {
                    scanForLoginForms();
                    // Try auto-fill if not yet attempted
                    if (!autofillAttempted) {
                        triggerAutofill();
                    }
                }, CONFIG.debounceDelay)();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        isObserving = true;
        log('MutationObserver started');
    }

    // ── Form Submit Listener (Capture Flow) ────────────────

    function setupSubmitListener() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (!isLoginForm(form)) return;

            const formData = extractFormData(form);
            log('Login form submitted:', formData);

            const username = formData.usernameField?.value || '';
            const password = formData.passwordField?.value || '';

            if (username && password) {
                lastCapturedUsername = username;
                lastCapturedPassword = password;

                // Send to main process via preload bridge
                if (window.vboxPassword?.onLoginSubmit) {
                    window.vboxPassword.onLoginSubmit(formData);
                }
            }
        }, true); // capture phase to catch before potential prevention
    }

    // ── Password Change Detection ──────────────────────────

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
                        usernameField: formData.usernameField,
                        passwordField: {
                            ...formData.newPasswordField,
                            value: formData.newPasswordField.value
                        }
                    };

                    if (window.vboxPassword?.onLoginSubmit) {
                        window.vboxPassword.onLoginSubmit(newData);
                    }
                }
            }
        }, true);
    }

    // ── Input Listeners ────────────────────────────────────

    function setupInputListeners() {
        document.addEventListener('input', (e) => {
            const target = e.target;
            if (target.type === 'password' && target.value) {
                log('Password field updated');
            }
        }, true);
    }

    // ── Auto-fill Trigger ──────────────────────────────────

    /**
     * Trigger auto-fill for the current page
     * Called on page load and when new forms are detected
     */
    async function triggerAutofill() {
        if (autofillAttempted) return;
        if (!window.vboxPassword?.requestAutofill) {
            log('vboxPassword bridge not available');
            return;
        }

        autofillAttempted = true;

        try {
            const result = await window.vboxPassword.requestAutofill(currentOrigin);

            if (result.success && result.credentials?.length > 0) {
                log(`Found ${result.credentials.length} credentials, auto-filling...`);
                autofillCredentials(result.credentials);
            } else {
                log('No credentials found for auto-fill');
            }
        } catch (error) {
            console.error('[PasswordEngine] Autofill error:', error);
        }
    }

    // ── Utility ────────────────────────────────────────────

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
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

    function hasSavedCredentials() {
        return new Promise((resolve) => {
            if (window.vboxPassword?.checkCredentials) {
                window.vboxPassword.checkCredentials(window.location.origin)
                    .then(result => resolve(result.hasCredentials))
                    .catch(() => resolve(false));
            } else {
                resolve(false);
            }
        });
    }

    // ── Initialization ─────────────────────────────────────

    function init() {
        scanForLoginForms();
        setupMutationObserver();
        setupSubmitListener();
        setupPasswordChangeListener();
        setupInputListeners();

        log('Password Engine initialized for:', currentOrigin);

        // Trigger auto-fill after a short delay (wait for page to settle)
        setTimeout(() => {
            triggerAutofill();
        }, CONFIG.autofillDelay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Reset autofill flag on navigation
    window.addEventListener('hashchange', () => {
        autofillAttempted = false;
        currentOrigin = window.location.origin;
        setTimeout(triggerAutofill, CONFIG.autofillDelay);
    });

    // Expose API to preload/page context
    window.__passwordEngine = {
        scanForLoginForms,
        autofillCredentials,
        getPageInfo,
        requestAutofill: (credentials) => autofillCredentials(credentials),
        hasSavedCredentials,
        getDetectedForms: () => detectedForms,
        triggerAutofill
    };

})();
