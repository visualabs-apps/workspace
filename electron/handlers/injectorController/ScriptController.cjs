const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

const SCRIPTS_DIR = path.join(app.getPath('userData'), 'inject-scripts');

async function ensureScriptsDir() {
    try {
        await fs.mkdir(SCRIPTS_DIR, { recursive: true });
    } catch (error) {
        console.error('Failed to create scripts directory:', error);
    }
}

function generateScriptId() {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize script ID to prevent path traversal attacks
 * @param {string} scriptId 
 * @returns {string} sanitized ID
 */
function sanitizeScriptId(scriptId) {
    if (typeof scriptId !== 'string') return '';
    // Remove any path traversal characters
    return scriptId.replace(/[\/\\\.]/g, '').replace(/\.\./g, '');
}

/**
 * Validate script data before saving
 * @param {object} scriptData 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateScriptData(scriptData) {
    if (!scriptData || typeof scriptData !== 'object') {
        return { valid: false, error: 'Invalid script data' };
    }
    
    // Validate name
    if (scriptData.name && typeof scriptData.name === 'string' && scriptData.name.length > 255) {
        return { valid: false, error: 'Script name too long (max 255 characters)' };
    }
    
    // Validate code size (max 5MB)
    const MAX_CODE_SIZE = 5 * 1024 * 1024;
    if (scriptData.code && typeof scriptData.code === 'string' && scriptData.code.length > MAX_CODE_SIZE) {
        return { valid: false, error: 'Script code too large (max 5MB)' };
    }
    
    // Validate script ID format if provided
    if (scriptData.id) {
        if (typeof scriptData.id !== 'string') {
            return { valid: false, error: 'Invalid script ID' };
        }
        // Must match expected format: script_TIMESTAMP_RANDOM
        if (!/^script_\d+_[a-z0-9]+$/.test(scriptData.id)) {
            return { valid: false, error: 'Invalid script ID format' };
        }
    }
    
    return { valid: true };
}

class ScriptController {
    static async list(event) {
        console.log('📋 scripts-list called');
        try {
            await ensureScriptsDir();
            const files = await fs.readdir(SCRIPTS_DIR);
            const scripts = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(SCRIPTS_DIR, file);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const script = JSON.parse(content);
                        scripts.push(script);
                    } catch (parseError) {
                        console.error(`Failed to parse script file ${file}:`, parseError);
                        // Skip malformed files instead of failing the entire list
                    }
                }
            }
            
            return { success: true, scripts };
        } catch (error) {
            console.error('Failed to list scripts:', error);
            return { success: false, error: error.message, scripts: [] };
        }
    }

    static async save(event, scriptData) {
        try {
            // Validate input
            const validation = validateScriptData(scriptData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            
            await ensureScriptsDir();
            const scriptId = scriptData.id || generateScriptId();
            const script = {
                id: scriptId,
                name: scriptData.name || 'Untitled Script',
                description: scriptData.description || '',
                code: scriptData.code || '',
                urlPattern: scriptData.urlPattern || '*',
                autoRun: scriptData.autoRun || false,
                createdAt: scriptData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
            await fs.writeFile(metaPath, JSON.stringify(script, null, 2));
            
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            await fs.writeFile(codePath, script.code);
            
            return { success: true, script };
        } catch (error) {
            console.error('Failed to save script:', error);
            return { success: false, error: error.message };
        }
    }

    static async load(event, scriptId) {
        try {
            if (!scriptId || typeof scriptId !== 'string') {
                return { success: false, error: 'Invalid script ID' };
            }
            
            const sanitizedId = sanitizeScriptId(scriptId);
            if (!sanitizedId) {
                return { success: false, error: 'Invalid script ID' };
            }
            
            const metaPath = path.join(SCRIPTS_DIR, `${sanitizedId}.json`);
            const content = await fs.readFile(metaPath, 'utf-8');
            const script = JSON.parse(content);
            
            return { success: true, script };
        } catch (error) {
            console.error('Failed to load script:', error);
            return { success: false, error: error.message };
        }
    }

    static async delete(event, scriptId) {
        try {
            if (!scriptId || typeof scriptId !== 'string') {
                return { success: false, error: 'Invalid script ID' };
            }
            
            const sanitizedId = sanitizeScriptId(scriptId);
            if (!sanitizedId) {
                return { success: false, error: 'Invalid script ID' };
            }
            
            const metaPath = path.join(SCRIPTS_DIR, `${sanitizedId}.json`);
            const codePath = path.join(SCRIPTS_DIR, `${sanitizedId}.js`);
            
            await fs.unlink(metaPath);
            await fs.unlink(codePath).catch(() => {});
            
            return { success: true };
        } catch (error) {
            console.error('Failed to delete script:', error);
            return { success: false, error: error.message };
        }
    }

    static async getDirectory(event) {
        return { success: true, path: SCRIPTS_DIR };
    }
}

module.exports = { ScriptController, SCRIPTS_DIR };
