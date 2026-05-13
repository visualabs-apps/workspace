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

class ScriptController {
    static async list(event) {
        console.log('📋 scripts-list called');
        try {
            await ensureScriptsDir();
            const files = await fs.readdir(SCRIPTS_DIR);
            const scripts = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(SCRIPTS_DIR, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const script = JSON.parse(content);
                    scripts.push(script);
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
            await ensureScriptsDir();
            const scriptId = scriptData.id || generateScriptId();
            const script = {
                id: scriptId,
                name: scriptData.name,
                description: scriptData.description || '',
                code: scriptData.code,
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
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
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
            const metaPath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
            const codePath = path.join(SCRIPTS_DIR, `${scriptId}.js`);
            
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
