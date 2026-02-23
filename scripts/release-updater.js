import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const packageJsonPath = path.resolve(__dirname, '../package.json');
const distDir = path.resolve(__dirname, '../dist-electron');
const laravelDownloadDir = path.resolve(__dirname, '../../laravel/public/downloads/workspace');
const versionJsonPath = path.join(laravelDownloadDir, 'version.json');
const envPath = path.resolve(__dirname, '../../laravel/.env');

console.log('📦 Starting release script for Workspace...');

// Ensure laravel output dir exists
if (!fs.existsSync(laravelDownloadDir)) {
    console.log(`Creating directory: ${laravelDownloadDir}`);
    fs.mkdirSync(laravelDownloadDir, { recursive: true });
}

// 1. Read package.json for Version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const appName = packageJson.productName || 'V-LEB Workspace';
console.log(`📌 App Version found: ${version}`);

// 2. Find the installer files
if (!fs.existsSync(distDir)) {
    console.error(`❌ Dist directory not found: ${distDir}`);
    console.error('Make sure you ran "npm run dist:win" first!');
    process.exit(1);
}

const files = fs.readdirSync(distDir);
console.log('� Files in dist directory:', files);

// Look for Setup installer (NSIS)
const setupFile = files.find(f => f.includes('Setup') && f.endsWith('.exe'));
const portableFile = files.find(f => f.includes('Portable') && f.endsWith('.exe'));

if (!setupFile) {
    console.error('❌ Could not find Setup installer!');
    console.error('       Found files:', files);
    process.exit(1);
}

console.log(`📎 Found installer: ${setupFile}`);
if (portableFile) {
    console.log(`� Found portable: ${portableFile}`);
}

// 3. Copy files to Laravel Directory
const setupSource = path.join(distDir, setupFile);
const setupDest = path.join(laravelDownloadDir, setupFile);

console.log('🚚 Copying installer to Laravel directory...');
fs.copyFileSync(setupSource, setupDest);
console.log(`✅ Copied: ${setupFile}`);

// Copy portable if exists
if (portableFile) {
    const portableSource = path.join(distDir, portableFile);
    const portableDest = path.join(laravelDownloadDir, portableFile);
    fs.copyFileSync(portableSource, portableDest);
    console.log(`✅ Copied: ${portableFile}`);
}

// 4. Build version.json
let appUrl = 'https://app.v-leb.local';
try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/APP_URL=(.*)/);
        if (match && match[1]) {
            appUrl = match[1].trim().replace(/"/g, '');
        }
    }
} catch (e) {
    console.log('⚠️ Could not read APP_URL from .env, using default: ' + appUrl);
}

const setupUrl = `${appUrl}/downloads/workspace/${setupFile}`;
const portableUrl = portableFile ? `${appUrl}/downloads/workspace/${portableFile}` : null;

let versionConfig = {
    version: version,
    notes: `Rilis versi ${version} dengan perbaikan performa dan keamanan.`,
    pub_date: new Date().toISOString(),
    windows: {
        setup: {
            url: setupUrl,
            filename: setupFile
        }
    }
};

if (portableUrl) {
    versionConfig.windows.portable = {
        url: portableUrl,
        filename: portableFile
    };
}

// Merge with existing to preserve notes if they were edited
if (fs.existsSync(versionJsonPath)) {
    try {
        const existingConfig = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
        if (existingConfig.version === version) {
            console.log('ℹ️ Version matches existing, keeping old release notes.');
            versionConfig.notes = existingConfig.notes;
        }
    } catch (e) {
        console.log('⚠️ Warning: Could not parse existing version.json');
    }
}

console.log('📝 Creating version.json...');
fs.writeFileSync(versionJsonPath, JSON.stringify(versionConfig, null, 2));

// 5. Create latest.yml for electron-updater
const latestYml = `version: ${version}
files:
  - url: ${setupFile}
    sha512: ""
path: ${setupFile}
sha512: ""
releaseDate: ${new Date().toISOString()}`;

const latestYmlPath = path.join(laravelDownloadDir, 'latest.yml');
fs.writeFileSync(latestYmlPath, latestYml);
console.log('📝 Created latest.yml for electron-updater');

console.log('🎉 Done! Workspace build has been exported to Laravel.');
console.log(`🔗 Download URL: ${setupUrl}`);
if (portableUrl) {
    console.log(`🔗 Portable URL: ${portableUrl}`);
}
