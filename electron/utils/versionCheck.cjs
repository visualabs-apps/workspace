const https = require('https');
const { log } = require('console');
const { GITHUB_OWNER, GITHUB_REPO, VERSION_CHECK_INTERVAL } = require('../config/constants.cjs');

function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) < (b[i] || 0)) return -1;
        if ((a[i] || 0) > (b[i] || 0)) return 1;
    }
    return 0;
}

function fetchLatestRelease() {
    return new Promise((resolve, reject) => {
        if (!GITHUB_OWNER || !GITHUB_REPO) {
            return reject(new Error('GITHUB_OWNER and GITHUB_REPO must be set in .env'));
        }

        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
            method: 'GET',
            headers: {
                'User-Agent': 'VisualBox-Updater',
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                // No Authorization header needed for public repos
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    if (res.statusCode !== 200) {
                        return reject(new Error(`GitHub API ${res.statusCode}: ${release.message}`));
                    }
                    resolve(release);
                } catch (e) {
                    reject(new Error('Failed to parse GitHub release response'));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

function findWindowsAsset(assets = []) {
    return (
        assets.find(a => a.name.toLowerCase().includes('setup') && a.name.endsWith('.exe')) ||
        assets.find(a => a.name.endsWith('.exe')) ||
        null
    );
}

function checkForNewVersion(app, mainWindow, isDevEnvironment) {
    if (isDevEnvironment) return;

    const currentVersion = app.getVersion();

    fetchLatestRelease()
        .then(release => {
            const latestVersion = release.tag_name.replace(/^v/, '');

            if (compareVersions(currentVersion, latestVersion) < 0) {
                const asset = findWindowsAsset(release.assets);

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('new-version-available', {
                        version: latestVersion,
                        notes: release.body || '',
                        // For public repos use browser_download_url directly
                        downloadUrl: asset?.browser_download_url || null,
                        assetName:   asset?.name || null,
                        assetSize:   asset?.size || 0,
                    });
                }

                log(`[VersionCheck] New version: v${latestVersion} (current: v${currentVersion})`);
            } else {
                log(`[VersionCheck] Up to date: v${currentVersion}`);
            }
        })
        .catch(err => {
            log('[VersionCheck] Error:', err.message);
        });
}

module.exports = { checkForNewVersion, compareVersions, fetchLatestRelease, findWindowsAsset };
