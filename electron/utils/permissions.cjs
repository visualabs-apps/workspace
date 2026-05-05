const { getDatabase } = require('../database/index.cjs');

function handlePermissions(session) {
    session.setPermissionRequestHandler(async (webContents, permission, callback) => {
        const url = webContents.getURL();
        
        console.log(`🔔 Permission request: ${permission} from ${url}`);

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
                    console.log(`🔔 Notification setting from DB: ${showNotifications}`);
                } else {
                    console.log('🔔 Database not initialized, defaulting to true');
                }
            } catch (error) {
                console.error('🔔 Error reading showNotifications setting:', error);
            }
            
            console.log(`🔔 Notification permission ${showNotifications ? 'GRANTED' : 'DENIED'} for ${url}`);
            
            // Grant or deny permission based on setting
            callback(showNotifications);
            return;
        }

        const allowedPermissions = ['media', 'geolocation', 'fullscreen'];

        if (allowedPermissions.includes(permission)) {
            console.log(`✅ Permission granted: ${permission} for ${url}`);
            callback(true);
        } else {
            console.log(`❌ Permission denied: ${permission} for ${url}`);
            callback(false);
        }
    });
}

module.exports = { handlePermissions };
