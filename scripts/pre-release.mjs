import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function ask(rl, question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function bumpVersion(version, type) {
    const [major, minor, patch] = version.split('.').map(Number);
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
    return version;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = pkg.version;

console.log('\n╔══════════════════════════════════════════╗');
console.log('║        🚀  VisualBox Release        ║');
console.log('╚══════════════════════════════════════════╝\n');
console.log(`📌 Current version: ${currentVersion}\n`);

// ─── Step 1: Version bump ────────────────────────────────────────────────────

console.log('Choose version bump type:');
console.log('  [1] Keep current  →  ' + currentVersion);
console.log('  [2] Patch         →  ' + bumpVersion(currentVersion, 'patch') + '  (bug fixes)');
console.log('  [3] Minor         →  ' + bumpVersion(currentVersion, 'minor') + '  (new features)');
console.log('  [4] Major         →  ' + bumpVersion(currentVersion, 'major') + '  (breaking changes)');
console.log('  [5] Custom        →  enter manually\n');

const bumpChoice = (await ask(rl, 'Your choice [1-5]: ')).trim();

let newVersion = currentVersion;

if (bumpChoice === '2') {
    newVersion = bumpVersion(currentVersion, 'patch');
} else if (bumpChoice === '3') {
    newVersion = bumpVersion(currentVersion, 'minor');
} else if (bumpChoice === '4') {
    newVersion = bumpVersion(currentVersion, 'major');
} else if (bumpChoice === '5') {
    const custom = (await ask(rl, 'Enter custom version (e.g. 1.2.3): ')).trim();
    if (/^\d+\.\d+\.\d+$/.test(custom)) {
        newVersion = custom;
    } else {
        console.error('❌ Invalid version format. Must be x.y.z');
        rl.close();
        process.exit(1);
    }
}

// ─── Step 2: Release notes ───────────────────────────────────────────────────

console.log('\n📝 Enter release notes/description.');
console.log('   (You can use multiple lines. Type END on a new line to finish.)\n');

let notes = '';
let line = '';
while ((line = (await ask(rl, '')).trim()) !== 'END') {
    notes += (notes ? '\n' : '') + line;
}

if (!notes.trim()) {
    notes = `Release version ${newVersion}`;
}

rl.close();

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────');
console.log(`  Version  : ${currentVersion} → ${newVersion}`);
console.log(`  Notes    :\n${notes.split('\n').map(l => '    ' + l).join('\n')}`);
console.log('──────────────────────────────────────────\n');

// ─── Step 4: Bump version in files ───────────────────────────────────────────

if (newVersion !== currentVersion) {
    console.log(`🔄 Bumping version to ${newVersion}...`);

    // package.json update
    pkg.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log('   ✅ package.json updated');
}

// ─── Step 5: Run the actual build ────────────────────────────────────────────

console.log('\n🏗️  Starting Electron production build...\n');
try {
    execSync('npm run dist:win', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (e) {
    console.error('\n❌ Build failed! Aborting release.');
    process.exit(1);
}

console.log('\n🎉 Release complete!');
console.log(`   Version: ${newVersion}`);
