import { v4 as uuidv4 } from "uuid";
import { workspaceService } from "./workspaceService.js";
import { authStore } from "./auth.svelte.js";

// Store definition - Pure backend integration, NO IndexedDB fallback
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

        // Load notes from backend ONLY
        async loadNotes(workspaceId) {
            if (hasLoaded[workspaceId]) return; // Already loaded

            console.log(`🌐 Loading notes from backend for workspace: ${workspaceId}`);

            try {
                if (!authStore.isLoggedIn) {
                    console.log('🔒 User not logged in, starting with empty notes');
                    internalNotes = {
                        ...internalNotes,
                        [workspaceId]: [],
                    };
                    hasLoaded = { ...hasLoaded, [workspaceId]: true };
                    return;
                }

                const backendNotes = await workspaceService.getNotes(workspaceId);
                const notes = backendNotes.map(note => workspaceService.convertBackendNote(note));
                
                internalNotes = {
                    ...internalNotes,
                    [workspaceId]: notes.sort((a, b) => a.createdAt - b.createdAt),
                };

                hasLoaded = { ...hasLoaded, [workspaceId]: true };
                console.log(`✅ Loaded ${notes.length} notes from backend`);
            } catch (error) {
                console.error("❌ Failed to load notes from backend:", error);
                // Start with empty notes on error
                internalNotes = {
                    ...internalNotes,
                    [workspaceId]: [],
                };
                hasLoaded = { ...hasLoaded, [workspaceId]: true };
            }
        },

        // Add a new sticky note or note tab
        async addNote(workspaceId, noteData = null, x = 100, y = 100, color = "#ffeb3b") {
            const currentNotes = this.getWorkspaceNotes(workspaceId);

            let newNote;
            
            if (noteData && noteData.id) {
                // Adding from NotesWindow (tab format)
                newNote = {
                    id: noteData.id,
                    workspaceId,
                    title: noteData.title || "Untitled",
                    content: noteData.content || "",
                    createdAt: noteData.createdAt || Date.now(),
                    updatedAt: noteData.updatedAt || Date.now(),
                    // Keep old sticky note properties for backward compatibility
                    x: 0,
                    y: 0,
                    width: 250,
                    height: 250,
                    isMinimized: false,
                    color: "#ffeb3b",
                    zIndex: Date.now(),
                };
            } else {
                // Adding traditional sticky note
                newNote = {
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
            }

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

            // Save to backend ONLY
            try {
                if (!authStore.isLoggedIn) {
                    console.log('🔒 User not logged in, cannot save note to backend');
                    throw new Error('User not logged in');
                }

                console.log(`🌐 Saving note to backend: "${newNote.title}"`);
                await workspaceService.storeNote(newNote);
                console.log(`✅ Note saved to backend successfully`);
            } catch (error) {
                console.error("❌ Failed to save note to backend:", error);
                // Remove from local state if backend save failed
                const current = internalNotes[workspaceId] || [];
                internalNotes = {
                    ...internalNotes,
                    [workspaceId]: current.filter(n => n.id !== newNote.id),
                };
                throw error;
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

            // Save to backend ONLY if not skipped
            if (!skipDb) {
                try {
                    if (!authStore.isLoggedIn) {
                        console.log('🔒 User not logged in, cannot update note in backend');
                        return;
                    }

                    console.log(`🌐 Updating note in backend: "${note.title}"`);
                    await workspaceService.storeNote(note);
                    console.log(`✅ Note updated in backend successfully`);
                } catch (error) {
                    console.error("❌ Failed to update note in backend:", error);
                    throw error;
                }
            }
        },

        // Delete a note from backend ONLY
        async deleteNote(workspaceId, noteId) {
            try {
                if (!authStore.isLoggedIn) {
                    console.log('🔒 User not logged in, cannot delete note from backend');
                    throw new Error('User not logged in');
                }

                console.log(`🌐 Deleting note from backend: ${noteId}`);
                await workspaceService.deleteNote(noteId);
                console.log(`✅ Note deleted from backend successfully`);

                // Update local state only after successful backend delete
                const current = internalNotes[workspaceId] || [];
                internalNotes = {
                    ...internalNotes,
                    [workspaceId]: current.filter((n) => n.id !== noteId),
                };
            } catch (error) {
                console.error("❌ Failed to delete note from backend:", error);
                throw error;
            }
        },
    };
}

export const notesStore = createNotesStore();
