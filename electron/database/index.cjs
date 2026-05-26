const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

let db = null;

function initDatabase(app) {
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'vbox.db');
        
        
        fs.mkdirSync(userDataPath, { recursive: true });
        
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        
        // Create tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS profile_colors (
                profile_id INTEGER PRIMARY KEY,
                color TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS tabs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                title TEXT,
                favicon TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                title TEXT NOT NULL,
                favicon TEXT,
                created_at INTEGER NOT NULL,
                UNIQUE(profile_id, url)
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS passwords (
                id TEXT PRIMARY KEY,
                profile_id INTEGER NOT NULL,
                origin TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                url TEXT DEFAULT '',
                username TEXT DEFAULT '',
                password_encrypted TEXT,
                notes TEXT DEFAULT '',
                favicon TEXT DEFAULT '',
                stored_in_keytar INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        // Migration: Add new columns if they don't exist
        try {
            db.exec(`ALTER TABLE passwords ADD COLUMN origin TEXT NOT NULL DEFAULT ''`);
        } catch (e) {
            // Column already exists, ignore
        }

        try {
            db.exec(`ALTER TABLE passwords ADD COLUMN stored_in_keytar INTEGER DEFAULT 0`);
        } catch (e) {
            // Column already exists, ignore
        }

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_passwords_profile_id ON passwords(profile_id);
            CREATE INDEX IF NOT EXISTS idx_passwords_origin ON passwords(origin);
        `);

        // Never-save list (domains where user clicked "Never save")
        db.exec(`
            CREATE TABLE IF NOT EXISTS password_never_save (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                origin TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(profile_id, origin)
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_never_save_profile ON password_never_save(profile_id);
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS favicons (
                domain TEXT PRIMARY KEY,
                icon BLOB NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                gid TEXT,
                profile_id INTEGER,
                filename TEXT NOT NULL,
                url TEXT NOT NULL,
                save_path TEXT NOT NULL,
                total_bytes INTEGER NOT NULL DEFAULT 0,
                received_bytes INTEGER NOT NULL DEFAULT 0,
                download_speed INTEGER NOT NULL DEFAULT 0,
                state TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                mime_type TEXT,
                file_exists INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS ai_chat_messages (
                id TEXT PRIMARY KEY,
                profile_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                pricing_json TEXT,
                is_error INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            )
        `);
        
        // Migration: Add gid and download_speed columns if they don't exist
        try {
            db.exec(`ALTER TABLE downloads ADD COLUMN gid TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }
        
        try {
            db.exec(`ALTER TABLE downloads ADD COLUMN download_speed INTEGER NOT NULL DEFAULT 0`);
        } catch (e) {
            // Column already exists, ignore
        }
        
        // Clean up old downloads with invalid timestamps (before year 2000)
        const cleanupResult = db.prepare(`
            DELETE FROM downloads WHERE start_time < 946684800000
        `).run();
        
        if (cleanupResult.changes > 0) {
        }
        
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tabs_profile_id ON tabs(profile_id);
            CREATE INDEX IF NOT EXISTS idx_tabs_position ON tabs(profile_id, position);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_id ON bookmarks(profile_id);
            CREATE INDEX IF NOT EXISTS idx_downloads_profile_id ON downloads(profile_id);
            CREATE INDEX IF NOT EXISTS idx_downloads_state ON downloads(state);
            CREATE INDEX IF NOT EXISTS idx_passwords_profile_id ON passwords(profile_id);
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_profile_id ON ai_chat_messages(profile_id);
            CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(profile_id, created_at);
        `);
        
        // Cleanup orphaned downloads (downloads that were interrupted by app close)
        const orphanedDownloads = db.prepare(`
            SELECT * FROM downloads 
            WHERE state IN ('progressing', 'paused') 
            AND (julianday('now') - julianday(start_time/1000, 'unixepoch')) > 1
        `).all();
        
        if (orphanedDownloads.length > 0) {
            
            // Mark as failed or keep as paused for manual resume
            const updateStmt = db.prepare(`
                UPDATE downloads 
                SET state = 'interrupted', end_time = ? 
                WHERE state IN ('progressing', 'paused')
                AND (julianday('now') - julianday(start_time/1000, 'unixepoch')) > 1
            `);
            updateStmt.run(Date.now());
            
        }
        
        return db;
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        throw error;
    }
}

function getDatabase() {
    return db;
}

module.exports = {
    initDatabase,
    getDatabase
};
