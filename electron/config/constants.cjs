/**
 * Application Constants
 */

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const VERSION_CHECK_URL = 'https://visualbox.app/downloads/version.json';
const VERSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

module.exports = {
    CHROME_UA,
    VERSION_CHECK_URL,
    VERSION_CHECK_INTERVAL
};
