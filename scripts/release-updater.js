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

// Read pre-release notes if available (set by pre-release.mjs)
const tempNotesPath = path.resolve(__dirname, '.release-notes.tmp');
let preReleaseNotes = null;
if (fs.existsSync(tempNotesPath)) {
    try {
        preReleaseNotes = JSON.parse(fs.readFileSync(tempNotesPath, 'utf8'));
    } catch (e) { /* ignore */ }
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

// Look for Setup installer (NSIS) - get the latest version
const setupFiles = files.filter(f => f.includes('Setup') && f.endsWith('.exe'));
const portableFiles = files.filter(f => f.includes('Portable') && f.endsWith('.exe'));

// Sort by version number (extract version from filename)
const sortByVersion = (files) => {
    return files.sort((a, b) => {
        const versionA = a.match(/(\d+\.\d+\.\d+)/)?.[1] || '0.0.0';
        const versionB = b.match(/(\d+\.\d+\.\d+)/)?.[1] || '0.0.0';
        
        const parseVersion = (v) => v.split('.').map(Number);
        const [majorA, minorA, patchA] = parseVersion(versionA);
        const [majorB, minorB, patchB] = parseVersion(versionB);
        
        if (majorA !== majorB) return majorB - majorA;
        if (minorA !== minorB) return minorB - minorA;
        return patchB - patchA;
    });
};

const setupFile = sortByVersion(setupFiles)[0]; // Get latest version
const portableFile = sortByVersion(portableFiles)[0]; // Get latest version

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

// Remove old files first
const existingFiles = fs.readdirSync(laravelDownloadDir);
const oldSetupFiles = existingFiles.filter(f => f.includes('Setup') && f.endsWith('.exe'));
const oldPortableFiles = existingFiles.filter(f => f.includes('Portable') && f.endsWith('.exe'));

// Remove old setup files
oldSetupFiles.forEach(file => {
    const filePath = path.join(laravelDownloadDir, file);
    fs.unlinkSync(filePath);
    console.log(`🗑️ Removed old file: ${file}`);
});

// Remove old portable files
oldPortableFiles.forEach(file => {
    const filePath = path.join(laravelDownloadDir, file);
    fs.unlinkSync(filePath);
    console.log(`🗑️ Removed old file: ${file}`);
});

// Copy new files
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
// Determine APP_URL based on environment
let appUrl = 'https://leb.visualabs.id'; // Default to production

// Try to read from .env.production first, then .env
const envProductionPath = path.resolve(__dirname, '../.env.production');
if (fs.existsSync(envProductionPath)) {
    try {
        const envContent = fs.readFileSync(envProductionPath, 'utf8');
        const match = envContent.match(/VITE_LARAVEL_URL=(.*)/);
        if (match && match[1]) {
            appUrl = match[1].trim().replace(/"/g, '');
            console.log(`📍 Using APP_URL from .env.production: ${appUrl}`);
        }
    } catch (e) {
        console.log('⚠️ Could not read .env.production, using default: ' + appUrl);
    }
} else {
    console.log(`📍 Using default production URL: ${appUrl}`);
}

const setupUrl = `${appUrl}/downloads/workspace/${setupFile}`;
const portableUrl = portableFile ? `${appUrl}/downloads/workspace/${portableFile}` : null;

let versionConfig = {
    version: version,
    notes: preReleaseNotes?.notes || `Rilis versi ${version} dengan perbaikan performa dan keamanan.`,
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

// Preserve old notes only if version is same AND no new notes provided
if (!preReleaseNotes && fs.existsSync(versionJsonPath)) {
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

// 5. Copy latest.yml from electron-builder output (contains correct sha512)
const latestYmlSource = path.join(distDir, 'latest.yml');
const latestYmlPath = path.join(laravelDownloadDir, 'latest.yml');
if (fs.existsSync(latestYmlSource)) {
    fs.copyFileSync(latestYmlSource, latestYmlPath);
    console.log('📝 Copied latest.yml (with correct sha512) from dist-electron');
} else {
    console.warn('⚠️ latest.yml not found in dist-electron, skipping...');
}

console.log('🎉 Done! Workspace build has been exported to Laravel.');
console.log(`🔗 Download URL: ${setupUrl}`);
if (portableUrl) {
    console.log(`🔗 Portable URL: ${portableUrl}`);
}
