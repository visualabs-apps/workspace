const { safeStorage } = require('electron');
const { getSecureStore } = require('./safeStorage.cjs');

async function handleDeepLink(url, mainWindow) {
    try {
        const urlObj = new URL(url);

        if (urlObj.protocol === 'visualbox:' && urlObj.hostname === 'auth') {
            const token = urlObj.searchParams.get('token');
            const workspace = urlObj.searchParams.get('workspace') || 'default';

            if (token) {
                // Store token using safeStorage if available
                if (safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
                    const store = getSecureStore();
                    const encrypted = safeStorage.encryptString(token);
                    store.set(`auth_token_${workspace}`, encrypted.toString('base64'));
                }

                if (mainWindow) {
                    mainWindow.webContents.send('auth-success', {
                        token,
                        workspace
                    });

                    mainWindow.show();
                    mainWindow.focus();
                }
            } else {
                console.error('No token in deep link');
                if (mainWindow) {
                    mainWindow.webContents.send('auth-error', {
                        error: 'No token received'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Deep link handling error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('auth-error', {
                error: error.message
            });
        }
    }
}

module.exports = { handleDeepLink };
