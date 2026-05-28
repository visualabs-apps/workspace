/**
 * Application Constants
 */

const fs = require('fs');
const path = require('path');

// Simple .env loader — no external dotenv dependency needed
function loadEnvFile() {
    try {
        const envPath = path.join(__dirname, '..', '..', '.env');
        if (!fs.existsSync(envPath)) return;
        const content = fs.readFileSync(envPath, 'utf8');
        content.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) return;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        });
    } catch (_) {}
}
loadEnvFile();

const CHROME_VERSION = '132.0.0.0';
const CHROME_VERSION_FULL = '132.0.6834.210';

// Platform-aware User-Agent strings
const UA_WINDOWS = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
const UA_MAC = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

// Select UA based on current platform
const CHROME_UA = process.platform === 'darwin' ? UA_MAC : UA_WINDOWS;

// Platform-aware Client Hints — must include "Google Chrome" brand
const SEC_CH_UA = `"Chromium";v="132", "Not_A Brand";v="24", "Google Chrome";v="132"`;
// For Google login: don't claim "Google Chrome" (Google can verify this cryptographically)
const SEC_CH_UA_GOOGLE = `"Chromium";v="132", "Not_A Brand";v="24"`;
const SEC_CH_UA_PLATFORM = process.platform === 'darwin' ? '"macOS"' : '"Windows"';

// Accept-Language header (natural browsing pattern)
const ACCEPT_LANGUAGE = 'en-US,en;q=0.9';

// ─── Per-URL stealth logic (learned from v-box-latest/Wexond) ─────────
// Google login URLs that need special UA handling.
// For these URLs, we remove the Chrome component from the UA string
// because Google can verify the Chrome version against the actual Chromium engine.
// If the version doesn't match → blocked. Solution: don't claim Chrome at all.
const GOOGLE_LOGIN_PATTERNS = [
    /^https:\/\/accounts\.google\.com(\/|$)/,
];

/**
 * Returns the appropriate User-Agent for a given URL.
 * For Google login pages, removes the Chrome component entirely (like v-box-latest).
 * For all other pages, returns the full Chrome UA.
 */
function getUserAgentForURL(url) {
    if (!url) return CHROME_UA;
    const isGoogleLogin = GOOGLE_LOGIN_PATTERNS.some(p => p.test(url));
    if (isGoogleLogin) {
        // Remove Chrome version component — Google can't verify what isn't there
        return CHROME_UA.replace(/ Chrome\/[^\s]+/, '');
    }
    return CHROME_UA;
}

/**
 * Returns the appropriate sec-ch-ua header for a given URL.
 * For Google login pages, only claims "Chromium" (not "Google Chrome").
 */
function getSecChUaForURL(url) {
    if (!url) return SEC_CH_UA;
    const isGoogleLogin = GOOGLE_LOGIN_PATTERNS.some(p => p.test(url));
    if (isGoogleLogin) {
        return SEC_CH_UA_GOOGLE;
    }
    return SEC_CH_UA;
}

const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

// GitHub Public Repo — Auto Update (no token needed for public repos)
// Fallback values are hardcoded because .env is not present in production builds.
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'visualabs-id';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'v-box-release';

module.exports = {
    CHROME_UA,
    CHROME_VERSION,
    SEC_CH_UA,
    SEC_CH_UA_GOOGLE,
    SEC_CH_UA_PLATFORM,
    ACCEPT_LANGUAGE,
    VERSION_CHECK_INTERVAL,
    GITHUB_OWNER,
    GITHUB_REPO,
    getUserAgentForURL,
    getSecChUaForURL,
};
