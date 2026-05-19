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

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

// GitHub Public Repo — Auto Update (no token needed for public repos)
const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const GITHUB_REPO  = process.env.GITHUB_REPO  || '';

module.exports = {
    CHROME_UA,
    VERSION_CHECK_INTERVAL,
    GITHUB_OWNER,
    GITHUB_REPO,
};
