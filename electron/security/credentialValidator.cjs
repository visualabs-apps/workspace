/**
 * Credential Validator - Security Layer
 *
 * Validates credentials before storage/retrieval:
 * - Sanitize inputs
 * - Validate data types
 * - Check for injection attempts
 * - Rate limiting support
 */

class CredentialValidator {
    constructor() {
        // Dangerous patterns for XSS/injection
        this.dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:/i,
            /on\w+=/i, // onclick, onload, etc.
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /\x00/, // Null bytes
            /\r\n|\r|\n/ // Newlines in single-line fields
        ];

        // Maximum lengths for fields
        this.maxLengths = {
            origin: 2048,
            title: 256,
            username: 256,
            password: 1024,
            notes: 4096
        };
    }

    /**
     * Validate a credential object
     * @param {Object} credential
     * @returns {{ valid: boolean, errors: string[], sanitized: Object }}
     */
    validate(credential) {
        const errors = [];
        const sanitized = {};

        // Required fields check
        if (!credential.profileId) {
            errors.push('Missing profileId');
        }

        if (!credential.origin) {
            errors.push('Missing origin');
        }

        if (!credential.username) {
            errors.push('Missing username');
        }

        // Validate origin
        if (credential.origin) {
            if (!this.isValidOrigin(credential.origin)) {
                errors.push('Invalid origin format');
            } else {
                sanitized.origin = this.sanitizeString(credential.origin, this.maxLengths.origin);
            }
        }

        // Validate username
        if (credential.username) {
            if (this.containsDangerousPattern(credential.username)) {
                errors.push('Username contains dangerous patterns');
            } else {
                sanitized.username = this.sanitizeString(credential.username, this.maxLengths.username);
            }
        }

        // Validate password
        if (credential.password) {
            // Passwords can contain special chars, but check for null bytes
            if (credential.password.includes('\x00')) {
                errors.push('Password contains invalid characters');
            } else {
                sanitized.password = credential.password.substring(0, this.maxLengths.password);
            }
        }

        // Validate title (optional)
        if (credential.title) {
            if (this.containsDangerousPattern(credential.title)) {
                errors.push('Title contains dangerous patterns');
            } else {
                sanitized.title = this.sanitizeString(credential.title, this.maxLengths.title);
            }
        }

        // Validate notes (optional)
        if (credential.notes) {
            if (this.containsDangerousPattern(credential.notes)) {
                errors.push('Notes contain dangerous patterns');
            } else {
                sanitized.notes = credential.notes.substring(0, this.maxLengths.notes);
            }
        }

        // Copy profileId as-is (it's an internal ID, not user input)
        if (credential.profileId) {
            sanitized.profileId = credential.profileId;
        }

        return {
            valid: errors.length === 0,
            errors,
            sanitized
        };
    }

    /**
     * Check if origin is valid
     */
    isValidOrigin(origin) {
        try {
            const url = new URL(origin);

            // Only allow http and https
            if (!['http:', 'https:'].includes(url.protocol)) {
                return false;
            }

            // Block dangerous protocols
            if (['javascript:', 'data:', 'file:', 'blob:'].includes(url.protocol)) {
                return false;
            }

            // Must have a valid hostname
            if (!url.hostname || url.hostname.length < 1) {
                return false;
            }

            // Block localhost in production (optional security)
            // Allow in development

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check for dangerous patterns in a string
     */
    containsDangerousPattern(str) {
        return this.dangerousPatterns.some(pattern => pattern.test(str));
    }

    /**
     * Sanitize a string
     */
    sanitizeString(str, maxLength) {
        if (!str || typeof str !== 'string') {
            return '';
        }

        // Trim and limit length
        let sanitized = str.trim().substring(0, maxLength);

        // Remove null bytes
        sanitized = sanitized.replace(/\x00/g, '');

        // Remove control characters except newlines (allowed in notes)
        sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        return sanitized;
    }

    /**
     * Validate a domain name
     */
    isValidDomain(domain) {
        if (!domain || typeof domain !== 'string') {
            return false;
        }

        // Basic domain validation regex
        const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }

    /**
     * Check if the request is from an allowed origin
     * @param {string} requestOrigin - Origin of the request
     * @param {string[]} allowedOrigins - List of allowed origins
     */
    isOriginAllowed(requestOrigin, allowedOrigins = []) {
        if (!requestOrigin) return false;
        return allowedOrigins.includes(requestOrigin.toLowerCase());
    }

    /**
     * Rate limit check (simple in-memory implementation)
     */
    checkRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
        const now = Date.now();
        const key = `ratelimit_${identifier}`;

        // Simple implementation - in production use Redis or similar
        if (!this.rateLimitStore) {
            this.rateLimitStore = new Map();
        }

        const entry = this.rateLimitStore.get(key);
        if (!entry) {
            this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return { allowed: true, remaining: maxRequests - 1 };
        }

        // Check if window has expired
        if (now > entry.resetTime) {
            this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return { allowed: true, remaining: maxRequests - 1 };
        }

        // Check count
        if (entry.count >= maxRequests) {
            return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
        }

        entry.count++;
        return { allowed: true, remaining: maxRequests - entry.count };
    }

    /**
     * Clear expired rate limit entries
     */
    cleanupRateLimits() {
        if (!this.rateLimitStore) return;

        const now = Date.now();
        for (const [key, entry] of this.rateLimitStore.entries()) {
            if (now > entry.resetTime) {
                this.rateLimitStore.delete(key);
            }
        }
    }
}

// Export singleton
const credentialValidator = new CredentialValidator();
module.exports = { credentialValidator, CredentialValidator };