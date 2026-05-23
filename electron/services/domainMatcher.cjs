/**
 * Domain Matcher Service
 *
 * Handles domain matching logic for password auto-fill:
 * - Exact domain match
 * - Subdomain matching (e.g., mail.google.com matches google.com)
 * - Path matching (optional)
 * - Private domain matching (e.g., github.io pages)
 */

class DomainMatcher {
    /**
     * Parse origin URL and extract components
     */
    parseOrigin(origin) {
        try {
            const url = new URL(origin);
            return {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port,
                pathname: url.pathname,
                origin: url.origin
            };
        } catch {
            return null;
        }
    }

    /**
     * Check if two domains match
     * @param {string} credentialOrigin - The origin stored in credential
     * @param {string} pageOrigin - The origin of the current page
     * @returns {boolean}
     */
    matches(credentialOrigin, pageOrigin) {
        const credParsed = this.parseOrigin(credentialOrigin);
        const pageParsed = this.parseOrigin(pageOrigin);

        if (!credParsed || !pageParsed) {
            return false;
        }

        // Protocol must match (prefer HTTPS)
        if (credParsed.protocol !== pageParsed.protocol) {
            // Allow HTTP to HTTPS upgrade for the same domain
            if (!(credParsed.protocol === 'http:' && pageParsed.protocol === 'https:')) {
                return false;
            }
        }

        // Hostname matching
        const hostnameMatch = this.matchHostname(credParsed.hostname, pageParsed.hostname);
        if (!hostnameMatch) {
            return false;
        }

        return true;
    }

    /**
     * Match hostnames with subdomain support
     */
    matchHostname(credentialHostname, pageHostname) {
        const cred = credentialHostname.toLowerCase();
        const page = pageHostname.toLowerCase();

        // Exact match
        if (cred === page) {
            return true;
        }

        // Subdomain: credential is parent domain
        // e.g., credential = google.com, page = mail.google.com
        if (page.endsWith('.' + cred)) {
            return true;
        }

        // Parent domain: credential is subdomain
        // e.g., credential = mail.google.com, page = google.com
        // (This is less common but useful)
        if (cred.endsWith('.' + page)) {
            return true;
        }

        // Private domain handling (e.g., github.io, herokuapp.com)
        // foo.github.io should match bar.github.io
        if (this.isPublicSuffix(cred) && this.hasSameBaseDomain(cred, page)) {
            return true;
        }

        return false;
    }

    /**
     * Check if domain is a known public suffix
     */
    isPublicSuffix(hostname) {
        const publicSuffixes = [
            'github.io',
            'github.com',
            'herokuapp.com',
            'azurewebsites.net',
            'cloudfront.net',
            'appspot.com',
            'firebaseapp.com',
            'wpcomgt0.gst0.g.co',
            'gitlab.io',
            'bitbucket.io',
            'surge.sh',
            'vercel.app',
            'now.sh',
            'netlify.app',
            'pages.dev'
        ];

        const lower = hostname.toLowerCase();
        return publicSuffixes.some(suffix => lower.endsWith('.' + suffix) || lower === suffix);
    }

    /**
     * Check if two hostnames share the same base domain
     * (for public suffix domains)
     */
    hasSameBaseDomain(hostname1, hostname2) {
        const parts1 = hostname1.split('.');
        const parts2 = hostname2.split('.');

        if (parts1.length < 2 || parts2.length < 2) {
            return false;
        }

        // Get the last two parts for common public suffixes
        const base1 = parts1.slice(-2).join('.');
        const base2 = parts2.slice(-2).join('.');

        return base1 === base2;
    }

    /**
     * Get the root domain for a given hostname
     */
    getRootDomain(hostname) {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return hostname;
    }

    /**
     * Extract possible match origins for a page
     * (for generating suggestions)
     */
    getPossibleOrigins(pageOrigin) {
        const parsed = this.parseOrigin(pageOrigin);
        if (!parsed) return [];

        const origins = [pageOrigin];

        // Add HTTPS version if using HTTP
        if (parsed.protocol === 'http:') {
            origins.push('https://' + parsed.hostname + (parsed.port ? ':' + parsed.port : ''));
        }

        // For subdomains, add parent domain
        const parts = parsed.hostname.split('.');
        if (parts.length > 2) {
            const parentDomain = parts.slice(1).join('.');
            origins.push(parsed.protocol + '//' + parentDomain);
        }

        return [...new Set(origins)];
    }

    /**
     * Calculate match confidence score
     */
    getMatchScore(credentialOrigin, pageOrigin) {
        const credParsed = this.parseOrigin(credentialOrigin);
        const pageParsed = this.parseOrigin(pageOrigin);

        if (!credParsed || !pageParsed) {
            return 0;
        }

        let score = 0;

        // Protocol match
        if (credParsed.protocol === pageParsed.protocol) {
            score += 20;
        } else {
            score += 10; // Partial credit for http->https
        }

        // Hostname match type
        if (credParsed.hostname === pageParsed.hostname) {
            score += 50; // Exact match
        } else if (pageParsed.hostname.endsWith('.' + credParsed.hostname)) {
            score += 40; // Subdomain
        } else if (credParsed.hostname.endsWith('.' + pageParsed.hostname)) {
            score += 30; // Parent domain
        }

        // Port match
        if (!credParsed.port && !pageParsed.port) {
            score += 10;
        } else if (credParsed.port === pageParsed.port) {
            score += 10;
        }

        return Math.min(score, 100);
    }
}

// Export singleton
const domainMatcher = new DomainMatcher();
module.exports = { domainMatcher, DomainMatcher };