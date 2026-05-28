/**
 * Extract Stealth Evasion Scripts from puppeteer-extra-plugin-stealth
 * 
 * This script extracts the JavaScript evasion code from each evasion module
 * and bundles them into a single file that can be injected into Electron webviews.
 * 
 * Usage: node scripts/extract-stealth.js
 * 
 * Output: electron/webview/stealth.bundle.js
 */

const fs = require('fs');
const path = require('path');

// Evasion modules to include (safe for Electron webview)
// Excluded: defaultArgs (Puppeteer-specific), user-agent-override (handled at network level),
//           webgl.vendor (causes mismatch), sourceurl (debugging)
const SELECTED_EVASIONS = [
    'chrome.app',
    'chrome.csi',
    'chrome.loadTimes',
    'chrome.runtime',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.vendor',
    'navigator.webdriver',
    'window.outerdimensions',
];

const evasionsDir = path.join(__dirname, '..', 'node_modules', 'puppeteer-extra-plugin-stealth', 'evasions');

// Storage for extracted scripts
const extractedScripts = [];

// Mock page object to capture evaluateOnNewDocument calls
function createMockPage() {
    const scripts = [];
    return {
        evaluateOnNewDocument: function(fn, ...args) {
            // The function is serialized and will be evaluated in the browser
            // We need to capture the function body and its arguments
            scripts.push({
                fn: fn.toString(),
                args: args
            });
        },
        evaluate: function(fn, ...args) {
            scripts.push({
                fn: fn.toString(),
                args: args
            });
        },
        getScripts: () => scripts
    };
}

// Process each evasion module
SELECTED_EVASIONS.forEach(evasionName => {
    const evasionPath = path.join(evasionsDir, evasionName);
    
    try {
        // Load the evasion module
        const evasionModule = require(evasionPath);
        const plugin = evasionModule({});
        
        // Create mock page
        const mockPage = createMockPage();
        
        // Call onPageCreated with mock page to capture the script
        if (plugin.onPageCreated) {
            plugin.onPageCreated(mockPage);
        }
        
        const scripts = mockPage.getScripts();
        
        if (scripts.length > 0) {
            console.log(`✅ Extracted: ${evasionName} (${scripts.length} script(s))`);
            extractedScripts.push({
                name: evasionName,
                scripts: scripts
            });
        } else {
            console.log(`⚠️  No scripts: ${evasionName}`);
        }
    } catch (err) {
        console.log(`❌ Failed: ${evasionName} — ${err.message}`);
    }
});

// Build the combined stealth script
let combinedScript = `/**
 * Stealth Evasion Bundle
 * Auto-generated from puppeteer-extra-plugin-stealth
 * Generated at: ${new Date().toISOString()}
 * 
 * Included evasions: ${SELECTED_EVASIONS.join(', ')}
 * 
 * DO NOT EDIT MANUALLY — regenerate with: node scripts/extract-stealth.js
 */
(function() {
    'use strict';
`;

extractedScripts.forEach(({ name, scripts }) => {
    combinedScript += `\n    // ─── ${name} ─────────────────────────────────────────\n`;
    
    scripts.forEach(({ fn, args }) => {
        // The function from evaluateOnNewDocument receives utils as first arg
        // and plugin-specific data as subsequent args
        // We need to reconstruct the call
        
        if (args.length > 0) {
            // The function expects arguments — inject them
            // The pattern is: (utils, data) => { ... }
            // We need to inline the data and provide a minimal utils object
            
            combinedScript += `    try {\n`;
            combinedScript += `        (function() {\n`;
            combinedScript += `            // Inline utils for ${name}\n`;
            combinedScript += `            const utils = {\n`;
            combinedScript += `                replaceProperty: function(obj, prop, descriptor) {\n`;
            combinedScript += `                    return Object.defineProperty(obj, prop, descriptor);\n`;
            combinedScript += `                },\n`;
            combinedScript += `                mockWithProxy: function(obj, prop, target, handler) {\n`;
            combinedScript += `                    obj[prop] = new Proxy(target, handler);\n`;
            combinedScript += `                },\n`;
            combinedScript += `                patchToStringNested: function(obj) {\n`;
            combinedScript += `                    return obj;\n`;
            combinedScript += `                },\n`;
            combinedScript += `                init: function() {}\n`;
            combinedScript += `            };\n`;
            
            // Serialize the args
            const serializedArgs = args.map(a => JSON.stringify(a)).join(', ');
            combinedScript += `            (${fn})(utils, ${serializedArgs});\n`;
            combinedScript += `        })();\n`;
            combinedScript += `    } catch(e) { console.warn('[Stealth:${name}] Error:', e.message); }\n`;
        } else {
            // No args — just execute the function directly
            combinedScript += `    try {\n`;
            combinedScript += `        (${fn})();\n`;
            combinedScript += `    } catch(e) { console.warn('[Stealth:${name}] Error:', e.message); }\n`;
        }
    });
});

combinedScript += `\n})();\n`;

// Write the raw bundle (for reference/debugging)
const bundlePath = path.join(__dirname, '..', 'electron', 'webview', 'stealth.bundle.js');
fs.writeFileSync(bundlePath, combinedScript, 'utf8');

// Write a CommonJS module that exports the script as a string
// This allows esbuild to inline it into the preload bundle at build time
// (sandbox: true means fs/path are NOT available at runtime)
const moduleOutput = `/**
 * Stealth Evasion Bundle (Auto-generated)
 * DO NOT EDIT — regenerate with: node scripts/extract-stealth.cjs
 */

// The stealth evasion code as a string, injected into main world via <script> element
const stealthCode = ${JSON.stringify(combinedScript)};

module.exports = { stealthCode };
`;
const modulePath = path.join(__dirname, '..', 'electron', 'webview', 'stealthBundle.cjs');
fs.writeFileSync(modulePath, moduleOutput, 'utf8');

console.log(`\n📦 Bundle written to: ${bundlePath}`);
console.log(`📦 Module written to: ${modulePath}`);
console.log(`📊 Size: ${(Buffer.byteLength(combinedScript) / 1024).toFixed(1)} KB`);
console.log(`✅ Evasions included: ${extractedScripts.length}/${SELECTED_EVASIONS.length}`);
