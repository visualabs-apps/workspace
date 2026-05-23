/**
 * Origin Validator - Security Layer
 *
 * Validates origins for security:
 * - Prevents phishing (lookalike domains)
 * - Validates protocol
 * - Checks against blocklist
 * - Cross-origin protection for webviews
 */

class OriginValidator {
    constructor() {
        // Blocked origins (dangerous sites)
        this.blockedOrigins = new Set([
            'chrome-extension:',
            'devtools:',
            'about:',
            'file:',
            'blob:',
            'data:',
            'chrome:'
        ]);

        // Known phishing patterns (TLD typosquatting)
        this.suspiciousPatterns = [
            { pattern: /google\.(com\.)?/, shouldContain: 'google' },
            { pattern: /facebook\.(com\.)?/, shouldContain: 'facebook' },
            { pattern: /amazon\.(com\.)?/, shouldContain: 'amazon' },
            { pattern: /apple\.(com\.)?/, shouldContain: 'apple' },
            { pattern: /microsoft\.(com\.)?/, shouldContain: 'microsoft' },
            { pattern: /paypal\.(com\.)?/, shouldContain: 'paypal' },
            { pattern: /netflix\.(com\.)?/, shouldContain: 'netflix' },
            { pattern: /twitter\.(com\.)?/, shouldContain: 'twitter' },
            { pattern: /instagram\.(com\.)?/, shouldContain: 'instagram' }
        ];

        // Common legitimate TLDs for major sites
        this.legitimateTlds = [
            '.com', '.org', '.net', '.io', '.co', '.gov', '.edu'
        ];
    }

    /**
     * Validate an origin URL
     * @param {string} origin
     * @returns {{ valid: boolean, error?: string, warning?: string }}
     */
    validate(origin) {
        if (!origin) {
            return { valid: false, error: 'Origin is required' };
        }

        // Check if blocked
        for (const blocked of this.blockedOrigins) {
            if (origin.startsWith(blocked)) {
                return { valid: false, error: `Origin "${blocked}" is not allowed` };
            }
        }

        // Parse URL
        let url;
        try {
            url = new URL(origin);
        } catch {
            return { valid: false, error: 'Invalid URL format' };
        }

        // Protocol check
        if (!['http:', 'https:'].includes(url.protocol)) {
            return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
        }

        // Block IP addresses (potential honeypot)
        const hostname = url.hostname.toLowerCase();
        if (this.isIpAddress(hostname)) {
            return { valid: false, error: 'IP addresses are not allowed' };
        }

        // Check for suspicious patterns
        const warning = this.checkSuspiciousPatterns(origin, hostname);
        if (warning) {
            return { valid: true, warning };
        }

        // Basic hostname validation
        if (!this.isValidHostname(hostname)) {
            return { valid: false, error: 'Invalid hostname' };
        }

        return { valid: true };
    }

    /**
     * Check if hostname is an IP address
     */
    isIpAddress(hostname) {
        // IPv4
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipv4Regex.test(hostname)) {
            return true;
        }

        // IPv6 (simplified)
        if (hostname.includes(':')) {
            return true;
        }

        return false;
    }

    /**
     * Validate hostname format
     */
    isValidHostname(hostname) {
        if (!hostname || hostname.length === 0 || hostname.length > 253) {
            return false;
        }

        // Each label must be 1-63 chars
        const labels = hostname.split('.');
        for (const label of labels) {
            if (label.length === 0 || label.length > 63) {
                return false;
            }
            // Labels can only contain letters, numbers, and hyphens
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check for suspicious/typosquatting patterns
     */
    checkSuspiciousPatterns(origin, hostname) {
        for (const { pattern, shouldContain } of this.suspiciousPatterns) {
            if (pattern.test(hostname)) {
                // Check if hostname is legitimate
                if (!hostname.includes(shouldContain.toLowerCase())) {
                    return `Warning: This domain looks suspicious (possible phishing attempt)`;
                }
            }
        }

        // Check for excessive hyphens (common in phishing)
        const hyphenCount = (hostname.match(/-/g) || []).length;
        if (hyphenCount > 4) {
            return `Warning: This domain has unusual structure`;
        }

        return null;
    }

    /**
     * Check if two origins can communicate (same origin policy)
     */
    canCommunicate(origin1, origin2) {
        try {
            const url1 = new URL(origin1);
            const url2 = new URL(origin2);

            return url1.origin === url2.origin;
        } catch {
            return false;
        }
    }

    /**
     * Check if target is same-site (prevents CSRF)
     */
    isSameSite(requestOrigin, targetOrigin) {
        try {
            const reqUrl = new URL(requestOrigin);
            const targetUrl = new URL(targetOrigin);

            return reqUrl.hostname === targetUrl.hostname;
        } catch {
            return false;
        }
    }

    /**
     * Get the base domain for a given origin
     */
    getBaseDomain(origin) {
        try {
            const url = new URL(origin);
            const hostname = url.hostname.toLowerCase();
            const parts = hostname.split('.');

            if (parts.length >= 2) {
                return parts.slice(-2).join('.');
            }
            return hostname;
        } catch {
            return null;
        }
    }

    /**
     * Check if origin is localhost or private network
     */
    isLocalNetwork(origin) {
        try {
            const url = new URL(origin);
            const hostname = url.hostname.toLowerCase();

            // Localhost
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return true;
            }

            // Private IP ranges
            const privateRanges = [
                /^10\./,
                /^172\.(1[6-9]|2\d|3[01])\./,
                /^192\.168\./,
                /^169\.254\./, // Link-local
                /^fc00:/,
                /^fe80:/
            ];

            for (const range of privateRanges) {
                if (range.test(hostname)) {
                    return true;
                }
            }

            // .local domains
            if (hostname.endsWith('.local') || hostname.endsWith('.localdomain')) {
                return true;
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Block an origin
     */
    blockOrigin(origin) {
        this.blockedOrigins.add(origin);
    }

    /**
     * Unblock an origin
     */
    unblockOrigin(origin) {
        this.blockedOrigins.delete(origin);
    }
}

// Export singleton
const originValidator = new OriginValidator();
module.exports = { originValidator, OriginValidator };