const https = require('https');
const { log } = require('console');
const { VERSION_CHECK_URL } = require('../config/constants.cjs');

function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) < (b[i] || 0)) return -1;
        if ((a[i] || 0) > (b[i] || 0)) return 1;
    }
    return 0;
}

function checkForNewVersion(app, mainWindow, isDevEnvironment) {
    if (isDevEnvironment) return;
    
    const currentVersion = app.getVersion();
    https.get(VERSION_CHECK_URL, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const info = JSON.parse(data);
                if (compareVersions(currentVersion, info.version) < 0) {
                    if (mainWindow) {
                        mainWindow.webContents.send('new-version-available', {
                            version: info.version,
                            notes: info.notes || '',
                            downloadUrl: info.windows?.setup?.url || VERSION_CHECK_URL,
                        });
                    }
                }
            } catch (e) {
                log('Version check parse error:', e.message);
            }
        });
    }).on('error', (e) => {
        log('Version check failed:', e.message);
    });
}

module.exports = { checkForNewVersion };
