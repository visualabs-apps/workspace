import Dexie from 'dexie';

export const db = new Dexie('VlebWorkspaceDB');

// Define database schema
db.version(1).stores({
    notes: 'id, workspaceId, createdAt, updatedAt' // Primary key and indexed props
});

// We can add more tables later if we migrate workspaces/tabs to Dexie.
