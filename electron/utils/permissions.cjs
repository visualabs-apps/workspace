const { getDatabase } = require('../database/index.cjs');

function handlePermissions(session) {
    session.setPermissionRequestHandler(async (webContents, permission, callback) => {
        const url = webContents.getURL();
        

        // Check notification setting for 'notifications' permission
        if (permission === 'notifications') {
            let showNotifications = true;
            
            try {
                const db = getDatabase();
                if (db) {
                    const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
                    const row = stmt.get('showNotifications');
                    if (row) {
                        showNotifications = JSON.parse(row.value);
                    }
                } else {
                }
            } catch (error) {
                console.error('🔔 Error reading showNotifications setting:', error);
            }
            
            
            // Grant or deny permission based on setting
            callback(showNotifications);
            return;
        }

        const allowedPermissions = ['media', 'geolocation', 'fullscreen'];

        if (allowedPermissions.includes(permission)) {
            callback(true);
        } else {
            callback(false);
        }
    });
}

module.exports = { handlePermissions };
