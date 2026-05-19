/**
 * autoUpdate.cjs
 * Handles downloading and installing updates from GitHub Public Releases.
 * No auth token needed — uses browser_download_url directly.
 *
 * IPC Channels:
 *  main→renderer  new-version-available     { version, notes, downloadUrl, assetName, assetSize }
 *  renderer→main  start-auto-update         { downloadUrl, assetName }
 *  main→renderer  update-download-progress  { percent, receivedBytes, totalBytes }
 *  main→renderer  update-download-complete  { path }
 *  main→renderer  update-download-error     { error }
 *  renderer→main  install-and-quit          { installerPath }
 *  renderer→main  check-for-updates-now     → returns release info
 */

const { ipcMain, app } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const { GITHUB_OWNER, GITHUB_REPO } = require('../config/constants.cjs');
const { compareVersions, fetchLatestRelease, findWindowsAsset } = require('../utils/versionCheck.cjs');

let isDownloading = false;

// ─── Download helper ─────────────────────────────────────────────────────────

/**
 * Download a public URL to a local file with progress reporting.
 * Follows up to 10 redirects automatically.
 */
function downloadToFile(firstUrl, destPath, onProgress) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(destPath);
        let settled = false;

        function cleanup(err) {
            if (settled) return;
            settled = true;
            fileStream.destroy();
            try { fs.unlinkSync(destPath); } catch (_) { }
            reject(err);
        }

        function follow(url, hopsLeft) {
            if (hopsLeft <= 0) return cleanup(new Error('Too many redirects'));

            const urlObj = new URL(url);
            const lib = urlObj.protocol === 'https:' ? https : http;

            const req = lib.request({
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: { 'User-Agent': 'VisualBox-Updater' },
            }, (res) => {
                if ([301, 302, 307, 308].includes(res.statusCode)) {
                    res.resume();
                    return follow(res.headers.location, hopsLeft - 1);
                }

                if (res.statusCode !== 200) {
                    res.resume();
                    return cleanup(new Error(`HTTP ${res.statusCode} from ${url}`));
                }

                const total = parseInt(res.headers['content-length'] || '0', 10);
                let received = 0;

                res.on('data', chunk => {
                    received += chunk.length;
                    if (onProgress && total > 0) onProgress(received, total);
                });

                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    if (settled) return;
                    settled = true;
                    fileStream.close(() => resolve(destPath));
                });
                fileStream.on('error', cleanup);
            });

            req.on('error', cleanup);
            req.end();
        }

        follow(firstUrl, 10);
    });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

function registerAutoUpdateHandlers(getMainWindow) {

    // ── Manual "Check for Updates" from Settings / UI
    ipcMain.handle('check-for-updates-now', async () => {
        try {
            if (!GITHUB_OWNER || !GITHUB_REPO) {
                return { success: false, error: 'GITHUB_OWNER dan GITHUB_REPO belum diisi di file .env' };
            }

            const currentVersion = app.getVersion();
            const release = await fetchLatestRelease();
            const latestVersion = release.tag_name.replace(/^v/, '');

            if (compareVersions(currentVersion, latestVersion) >= 0) {
                return { success: true, upToDate: true, currentVersion, latestVersion };
            }

            const asset = findWindowsAsset(release.assets);
            return {
                success: true,
                upToDate: false,
                currentVersion,
                latestVersion,
                notes: release.body || '',
                downloadUrl: asset?.browser_download_url || null,
                assetName: asset?.name || null,
                assetSize: asset?.size || 0,
            };
        } catch (err) {
            // Make 404 friendlier
            const msg = err.message.includes('404')
                ? 'Release not found. Please try again later.'
                : err.message;
            return { success: false, error: msg };
        }
    });

    // ── Start downloading the installer
    ipcMain.handle('start-auto-update', async (_event, { downloadUrl, assetName }) => {
        // Block actual download in dev mode — only version detection is allowed
        if (process.env.DEV_ENV === 'true') {
            return {
                success: false,
                devMode: true,
                error: 'Download dinonaktifkan di mode development. Build produksi untuk melakukan update.',
            };
        }

        if (isDownloading) {
            return { success: false, error: 'Download already in progress' };
        }
        if (!downloadUrl) {
            return { success: false, error: 'No download URL provided' };
        }

        const win = getMainWindow();
        if (!win || win.isDestroyed()) {
            return { success: false, error: 'Main window unavailable' };
        }

        isDownloading = true;

        const fileName = assetName || 'VisualBox-Setup.exe';
        const destPath = path.join(os.tmpdir(), fileName);

        // Remove stale temp file
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) { }

        const sendProgress = (received, total) => {
            const w = getMainWindow();
            if (w && !w.isDestroyed()) {
                w.webContents.send('update-download-progress', {
                    percent: Math.round((received / total) * 100),
                    receivedBytes: received,
                    totalBytes: total,
                });
            }
        };

        try {
            await downloadToFile(downloadUrl, destPath, sendProgress);
            isDownloading = false;

            const w = getMainWindow();
            if (w && !w.isDestroyed()) {
                w.webContents.send('update-download-complete', { path: destPath });
            }
            return { success: true, path: destPath };

        } catch (err) {
            isDownloading = false;
            console.error('[AutoUpdate] Download failed:', err.message);

            const w = getMainWindow();
            if (w && !w.isDestroyed()) {
                w.webContents.send('update-download-error', { error: err.message });
            }
            return { success: false, error: err.message };
        }
    });

    // ── Launch installer then quit the app
    ipcMain.handle('install-and-quit', async (_event, { installerPath }) => {
        try {
            if (!installerPath || !fs.existsSync(installerPath)) {
                return { success: false, error: 'Installer not found: ' + installerPath };
            }

            if (process.platform === 'win32') {
                exec(`start "" "${installerPath}"`);
            } else if (process.platform === 'darwin') {
                exec(`open "${installerPath}"`);
            } else {
                exec(`chmod +x "${installerPath}" && "${installerPath}"`);
            }

            // Give the OS time to launch the installer before we quit
            setTimeout(() => app.quit(), 1500);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
}

module.exports = { registerAutoUpdateHandlers };
