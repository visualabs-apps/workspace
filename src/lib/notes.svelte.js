import { v4 as uuidv4 } from "uuid";
import { db } from "./db.js";

// Store definition
function createNotesStore() {
    let internalNotes = $state({}); // { workspaceId: [note1, note2] }
    let hasLoaded = $state({}); // { workspaceId: boolean }
    let notesVisibility = $state({}); // { workspaceId: boolean }

    return {
        get notes() {
            return internalNotes;
        },

        // Get notes for a specific workspace (reactive derived)
        getWorkspaceNotes(workspaceId) {
            return internalNotes[workspaceId] || [];
        },

        // Notes visibility methods
        isNotesVisible(workspaceId) {
            return notesVisibility[workspaceId] || false;
        },

        toggleNotesVisibility(workspaceId) {
            notesVisibility = {
                ...notesVisibility,
                [workspaceId]: !this.isNotesVisible(workspaceId)
            };
        },

        setNotesVisibility(workspaceId, visible) {
            notesVisibility = {
                ...notesVisibility,
                [workspaceId]: visible
            };
        },

        // Ensure we load notes from Dexie for a specific workspace
        async loadNotes(workspaceId) {
            if (hasLoaded[workspaceId]) return; // Already loaded

            try {
                // Fetch from Dexie IndexedDB
                const data = await db.notes.where("workspaceId").equals(workspaceId).toArray();

                internalNotes = {
                    ...internalNotes,
                    [workspaceId]: data.sort((a, b) => a.createdAt - b.createdAt),
                };

                hasLoaded = { ...hasLoaded, [workspaceId]: true };
            } catch (err) {
                console.error("Failed to load notes for workspace:", workspaceId, err);
            }
        },

        // Add a new sticky note
        async addNote(workspaceId, x = 100, y = 100, color = "#ffeb3b") {
            const currentNotes = this.getWorkspaceNotes(workspaceId);

            const newNote = {
                id: uuidv4(),
                workspaceId,
                title: `Note ${currentNotes.length + 1}`,
                content: "",
                x,
                y,
                width: 250,
                height: 250,
                isMinimized: false,
                color,
                zIndex: Date.now(),
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // Calculate z-index to put it on top of others
            if (currentNotes.length > 0) {
                const maxZ = Math.max(...currentNotes.map(n => n.zIndex || 0));
                newNote.zIndex = maxZ + 1;
            }

            // Update local state optimistic UI
            const current = internalNotes[workspaceId] || [];
            internalNotes = {
                ...internalNotes,
                [workspaceId]: [...current, newNote],
            };

            // Show notes when adding a new note
            this.setNotesVisibility(workspaceId, true);

            // Save to Dexie
            try {
                await db.notes.add(newNote);
            } catch (error) {
                console.error("Failed to add note to DB", error);
            }

            return newNote;
        },

        // Save note updates (content, position, size, etc.)
        async updateNote(workspaceId, noteId, updates, skipDb = false) {
            // Update local state by directly mutating the state proxy
            // Svelte 5 handles deep reactivity efficiently
            const current = internalNotes[workspaceId];
            if (!current) return;
            const note = current.find((n) => n.id === noteId);

            if (!note) return;

            // Bring to front if selected/updated
            let newZIndex = note.zIndex;
            if (updates.bringToFront) {
                const maxZ = Math.max(...current.map(n => n.zIndex || 0));
                newZIndex = maxZ + 1;
                delete updates.bringToFront;
                updates.zIndex = newZIndex;
            }

            updates.updatedAt = Date.now();

            // Direct object assignment (triggers Svelte 5 reactivity without array allocations)
            Object.assign(note, updates);

            // Save to Dexie if not skipped
            if (!skipDb) {
                try {
                    await db.notes.update(noteId, updates);
                } catch (error) {
                    console.error("Failed to update note in DB", error);
                }
            }
        },

        // Delete a note
        async deleteNote(workspaceId, noteId) {
            // Update local state
            const current = internalNotes[workspaceId] || [];
            internalNotes = {
                ...internalNotes,
                [workspaceId]: current.filter((n) => n.id !== noteId),
            };

            // Delete from Dexie
            try {
                await db.notes.delete(noteId);
            } catch (error) {
                console.error("Failed to delete note from DB", error);
            }
        },
    };
}

export const notesStore = createNotesStore();
