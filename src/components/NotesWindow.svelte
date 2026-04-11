<script>
    import { notesStore } from "../lib/notes.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import { activityTracker } from "../lib/activityTracker.js";
    import { 
        X, 
        Plus, 
        GripHorizontal,
        FileText,
        Pin,
        Search,
        Menu,
        Edit3,
        Trash2
    } from "lucide-svelte";
    import { v4 as uuidv4 } from "uuid";

    let { workspaceId, onClose } = $props();

    // Window state
    let isPinned = $state(false);
    let windowPosition = $state({ x: 100, y: 100 });
    let windowSize = $state({ width: 800, height: 500 });
    let isDragging = $state(false);
    let isResizing = $state(false);

    // Load saved window state on mount
    $effect(() => {
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem('notesWindow-state');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    if (state.windowSize) {
                        windowSize = {
                            width: Math.max(450, state.windowSize.width || 800),
                            height: Math.max(350, state.windowSize.height || 500)
                        };
                    }
                    if (state.windowPosition) {
                        windowPosition = {
                            x: Math.max(0, state.windowPosition.x || 100),
                            y: Math.max(0, state.windowPosition.y || 100)
                        };
                    }
                    if (state.isPinned !== undefined) {
                        isPinned = state.isPinned;
                    }
                } catch (error) {
                    console.error('Error loading notes window state:', error);
                }
            }
        }
    });

    // Save window state when it changes
    function saveWindowState() {
        if (typeof window !== 'undefined') {
            const state = {
                windowSize,
                windowPosition,
                isPinned
            };
            localStorage.setItem('notesWindow-state', JSON.stringify(state));
        }
    }

    // Save state when window size changes
    $effect(() => {
        if (windowSize.width && windowSize.height) {
            saveWindowState();
        }
    });

    // Save state when window position changes
    $effect(() => {
        if (windowPosition.x !== undefined && windowPosition.y !== undefined) {
            saveWindowState();
        }
    });

    // Save state when pin status changes
    $effect(() => {
        saveWindowState();
    });

    // Notes state (changed from tabs to list)
    let notes = $state([]);
    let activeNoteId = $state(null);
    let searchQuery = $state("");

    // Load notes for this workspace
    $effect(() => {
        if (workspaceId) {
            loadNotes();
        }
    });

    async function loadNotes() {
        // Load existing notes
        await notesStore.loadNotes(workspaceId);
        const existingNotes = notesStore.getWorkspaceNotes(workspaceId);
        
        if (existingNotes.length === 0) {
            // Start with empty notes array - don't auto-create
            notes = [];
            activeNoteId = null;
        } else {
            // Convert existing notes to list
            notes = existingNotes.map(note => ({
                id: note.id,
                title: note.title || "New Note",
                content: note.content || "",
                isPinned: note.isPinned || false,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt
            }));
            
            // Sort notes (pinned first, then by updatedAt)
            sortNotes();
            activeNoteId = notes[0]?.id;
        }
    }

    // Get active note
    let activeNote = $derived(
        notes.find(note => note.id === activeNoteId)
    );

    // Filter notes based on search query
    let filteredNotes = $derived.by(() => {
        // If no search query, return all notes
        if (!searchQuery || searchQuery.trim() === "") {
            return notes;
        }
        
        // Filter notes based on search query
        const query = searchQuery.toLowerCase();
        const filtered = notes.filter(note => {
            const title = (note.title || "").toLowerCase();
            const content = (note.content || "").toLowerCase();
            return title.includes(query) || content.includes(query);
        });
        
        return filtered;
    });

    // Get note preview text (first line or first 50 chars)
    function getNotePreview(note) {
        if (!note.content) return "No additional text";
        const firstLine = note.content.split('\n')[0];
        return firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine;
    }

    // Get note title from content (always use first line)
    function getNoteTitle(note) {
        if (note.content) {
            const firstLine = note.content.split('\n')[0].trim();
            if (firstLine) {
                return firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine;
            }
        }
        return "New Note";
    }

    // Add new note
    async function addNewNote() {
        const activeWorkspace = workspaceStore.activeWorkspace;
        const newNote = {
            id: uuidv4(),
            title: "New Note",
            content: "",
            isPinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // Add new note and sort
        notes = [newNote, ...notes];
        sortNotes();
        activeNoteId = newNote.id;
        
        // Save to store
        try {
            await notesStore.addNote(workspaceId, newNote);
            
            // Track note creation activity
            if (activeWorkspace) {
                activityTracker.trackNoteAction(
                    activeWorkspace.id,
                    activeWorkspace.name,
                    'create',
                    notes.length,
                    newNote.title
                );
            }
        } catch (error) {
            console.error("Error saving note:", error);
        }
    }

    // Delete note
    async function deleteNote(noteId) {
        const activeWorkspace = workspaceStore.activeWorkspace;
        const noteToDelete = notes.find(note => note.id === noteId);
        
        if (notes.length === 1) {
            // Don't delete last note, just close window
            onClose();
            return;
        }
        
        notes = notes.filter(note => note.id !== noteId);
        
        // Switch to another note if deleting active note
        if (activeNoteId === noteId) {
            activeNoteId = notes[0]?.id;
        }
        
        // Delete from store
        await notesStore.deleteNote(workspaceId, noteId);
        
        // Track note deletion activity
        if (activeWorkspace && noteToDelete) {
            activityTracker.trackNoteAction(
                activeWorkspace.id,
                activeWorkspace.name,
                'delete',
                notes.length,
                noteToDelete.title
            );
        }
    }

    // Switch note
    function switchNote(noteId) {
        activeNoteId = noteId;
    }

    // Toggle note pin status
    async function toggleNotePin(noteId) {
        const activeWorkspace = workspaceStore.activeWorkspace;
        const noteIndex = notes.findIndex(note => note.id === noteId);
        if (noteIndex === -1) return;
        
        const note = notes[noteIndex];
        const newPinnedStatus = !note.isPinned;
        
        // Update local state
        notes[noteIndex] = {
            ...note,
            isPinned: newPinnedStatus,
            updatedAt: Date.now()
        };
        
        // Re-sort notes (pinned notes first)
        sortNotes();
        
        // Save to store
        try {
            await notesStore.updateNote(workspaceId, noteId, { 
                isPinned: newPinnedStatus,
                updatedAt: Date.now()
            });
            
            // Track note pin/unpin activity
            if (activeWorkspace) {
                activityTracker.trackNoteAction(
                    activeWorkspace.id,
                    activeWorkspace.name,
                    newPinnedStatus ? 'pin' : 'unpin',
                    notes.length,
                    note.title
                );
            }
        } catch (error) {
            console.error("Error updating note pin status:", error);
        }
    }

    // Sort notes: pinned first, then by updatedAt
    function sortNotes() {
        notes = notes.sort((a, b) => {
            // First sort by pinned status
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            
            // Then sort by updatedAt (newest first)
            return b.updatedAt - a.updatedAt;
        });
    }

    // Update note content
    let contentUpdateTimer;
    function handleContentUpdate(content) {
        if (!activeNote) return;
        
        // Extract title from first line
        const firstLine = content.split('\n')[0].trim();
        const newTitle = firstLine || "New Note";
        
        // Update local state immediately
        const noteIndex = notes.findIndex(note => note.id === activeNote.id);
        if (noteIndex !== -1) {
            notes[noteIndex] = {
                ...notes[noteIndex],
                content,
                title: newTitle, // Auto-update title from first line
                updatedAt: Date.now()
            };
            
            // Re-sort notes (pinned notes stay at top)
            sortNotes();
        }
        
        // Debounced save to store
        clearTimeout(contentUpdateTimer);
        contentUpdateTimer = setTimeout(async () => {
            const activeWorkspace = workspaceStore.activeWorkspace;
            
            await notesStore.updateNote(workspaceId, activeNote.id, { 
                content,
                title: newTitle,
                updatedAt: Date.now()
            });
            
            // Track note edit activity (only if content actually changed)
            if (activeWorkspace && (content !== activeNote.content || newTitle !== activeNote.title)) {
                activityTracker.trackNoteAction(
                    activeWorkspace.id,
                    activeWorkspace.name,
                    'edit',
                    notes.length,
                    newTitle
                );
            }
        }, 500);
    }

    // Window controls
    function togglePin() {
        isPinned = !isPinned;
    }

    function closeWindow() {
        const activeWorkspace = workspaceStore.activeWorkspace;
        
        // Track notes window close activity
        if (activeWorkspace) {
            activityTracker.trackNoteAction(
                activeWorkspace.id,
                activeWorkspace.name,
                'close',
                notes.length
            );
        }
        
        onClose();
    }

    // Drag functionality
    function handleDragStart(e) {
        if (isPinned) return; // Don't allow dragging when pinned
        
        isDragging = true;
        const startX = e.clientX - windowPosition.x;
        const startY = e.clientY - windowPosition.y;

        function handleDrag(e) {
            windowPosition = {
                x: e.clientX - startX,
                y: Math.max(0, e.clientY - startY)
            };
        }

        function handleDragEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
        }

        window.addEventListener('mousemove', handleDrag);
        window.addEventListener('mouseup', handleDragEnd);
    }

    // Resize functionality
    function handleResizeStart(e, direction) {
        e.stopPropagation();
        isResizing = true;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = windowSize.width;
        const startHeight = windowSize.height;
        const startLeft = windowPosition.x;
        const startTop = windowPosition.y;

        function handleResize(e) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            // Handle different resize directions
            switch (direction) {
                case 'se': // Southeast (bottom-right)
                    newWidth = Math.max(450, startWidth + deltaX);
                    newHeight = Math.max(350, startHeight + deltaY);
                    break;
                case 'sw': // Southwest (bottom-left)
                    newWidth = Math.max(450, startWidth - deltaX);
                    newHeight = Math.max(350, startHeight + deltaY);
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
                case 'ne': // Northeast (top-right)
                    newWidth = Math.max(450, startWidth + deltaX);
                    newHeight = Math.max(350, startHeight - deltaY);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'nw': // Northwest (top-left)
                    newWidth = Math.max(450, startWidth - deltaX);
                    newHeight = Math.max(350, startHeight - deltaY);
                    newLeft = startLeft + (startWidth - newWidth);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'n': // North (top)
                    newHeight = Math.max(350, startHeight - deltaY);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 's': // South (bottom)
                    newHeight = Math.max(350, startHeight + deltaY);
                    break;
                case 'e': // East (right)
                    newWidth = Math.max(450, startWidth + deltaX);
                    break;
                case 'w': // West (left)
                    newWidth = Math.max(450, startWidth - deltaX);
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
            }

            windowSize = { width: newWidth, height: newHeight };
            windowPosition = { x: newLeft, y: newTop };
        }

        function handleResizeEnd() {
            isResizing = false;
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', handleResizeEnd);
        }

        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', handleResizeEnd);
    }
</script>

<!-- Window Container -->
<div 
    class="fixed bg-white rounded-lg shadow-2xl border border-gray-300 flex overflow-hidden {isPinned ? 'z-[100]' : 'z-50'} {isResizing ? 'select-none' : ''}"
    style:left="{windowPosition.x}px"
    style:top="{windowPosition.y}px"
    style:width="{windowSize.width}px"
    style:height="{windowSize.height}px"
>
    <!-- Sidebar (Notes List) -->
    <div class="w-80 bg-gray-800 flex flex-col">
        <!-- Header -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="h-12 bg-gray-900 flex items-center justify-between px-4 select-none {isPinned ? 'cursor-default' : 'cursor-move'}"
            onmousedown={handleDragStart}
        >
            <div class="flex items-center gap-2">
                <FileText size={16} class="text-gray-300" />
                <span class="text-sm font-medium text-gray-200">All Notes</span>
                {#if isPinned}
                    <span class="text-xs text-blue-400 bg-blue-900 px-2 py-0.5 rounded">Pinned</span>
                {/if}
            </div>
            
            <div class="flex items-center gap-1">
                <button
                    onclick={addNewNote}
                    class="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                    title="New Note"
                >
                    <Plus size={14} />
                </button>
                <button
                    onclick={togglePin}
                    class="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors {isPinned ? 'text-blue-400 bg-blue-900' : 'text-gray-300 hover:text-white'}"
                    title={isPinned ? "Unpin" : "Pin on top"}
                >
                    <Pin size={14} class={isPinned ? 'fill-current' : ''} />
                </button>
                <button
                    onclick={closeWindow}
                    class="w-7 h-7 rounded hover:bg-red-600 hover:text-white flex items-center justify-center text-gray-300"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>
        </div>

        <!-- Search Bar -->
        <div class="p-3 border-b border-gray-700">
            <div class="relative">
                <Search size={16} class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    bind:value={searchQuery}
                    placeholder="Search all notes and tags"
                    class="w-full pl-10 pr-4 py-2 bg-gray-700 text-gray-200 placeholder-gray-400 rounded-lg border-none outline-none focus:bg-gray-600 transition-colors"
                />
            </div>
        </div>

        <!-- Notes List -->
        <div class="flex-1 overflow-y-auto scrollbar-thin overscroll-contain">
            {#if filteredNotes.length === 0}
                <div class="p-4 text-center text-gray-400">
                    {#if searchQuery}
                        <Search size={32} class="mx-auto mb-2 text-gray-500" />
                        <p class="text-sm">No notes found</p>
                    {:else}
                        <Plus size={32} class="mx-auto mb-2 text-gray-500" />
                        <p class="text-sm">No notes yet</p>
                        <button
                            onclick={addNewNote}
                            class="mt-2 text-blue-400 hover:text-blue-300 text-sm underline"
                        >
                            Create your first note
                        </button>
                    {/if}
                </div>
            {:else}
                {#each filteredNotes as note (note.id)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="group p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors {activeNoteId === note.id ? 'bg-blue-900 border-blue-600' : ''}"
                        onclick={() => switchNote(note.id)}
                        role="button"
                        tabindex="0"
                    >
                        <div class="flex items-start justify-between mb-1">
                            <h3 class="text-sm font-medium text-gray-200 truncate flex-1 {note.isPinned ? 'pr-2' : ''}">
                                {getNoteTitle(note)}
                                {#if note.isPinned}
                                    <span class="inline-block w-2 h-2 bg-yellow-400 rounded-full ml-2"></span>
                                {/if}
                            </h3>
                            <div class="flex items-center gap-1 ml-2">
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        toggleNotePin(note.id);
                                    }}
                                    class="w-5 h-5 rounded hover:bg-yellow-600 flex items-center justify-center text-gray-400 hover:text-white transition-all {note.isPinned ? 'opacity-100 text-yellow-400 bg-yellow-600/20' : 'opacity-60 hover:opacity-100'}"
                                    title={note.isPinned ? "Unpin note" : "Pin note"}
                                >
                                    <Pin size={12} class={note.isPinned ? 'fill-current' : ''} />
                                </button>
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        deleteNote(note.id);
                                    }}
                                    class="w-5 h-5 rounded hover:bg-red-600 flex items-center justify-center text-gray-400 hover:text-white opacity-60 hover:opacity-100 transition-all"
                                    title="Delete note"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 line-clamp-2">{getNotePreview(note)}</p>
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- Editor Area -->
    <div class="flex-1 flex flex-col bg-white">
        {#if activeNote}
            <!-- Editor -->
            <textarea
                value={activeNote.content}
                oninput={(e) => handleContentUpdate(e.target.value)}
                class="flex-1 p-6 resize-none border-none outline-none text-gray-800 leading-relaxed text-base"
                placeholder="Start writing..."
                style="font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6;"
            ></textarea>
        {:else}
            <!-- Empty state -->
            <div class="flex-1 flex items-center justify-center text-gray-400">
                <div class="text-center">
                    <Plus size={48} class="mx-auto mb-4 text-gray-300" />
                    <p class="text-lg mb-2">Select a note to view</p>
                    <p class="text-sm">Choose a note from the list on the left, or create a new one</p>
                </div>
            </div>
        {/if}
    </div>

    <!-- Resize Handles -->
    <!-- Corner handles -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
        onmousedown={(e) => handleResizeStart(e, 'nw')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
        onmousedown={(e) => handleResizeStart(e, 'ne')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
        onmousedown={(e) => handleResizeStart(e, 'sw')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
        onmousedown={(e) => handleResizeStart(e, 'se')}
        title="Resize"
    ></div>

    <!-- Edge handles -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute top-0 left-3 right-3 h-1 cursor-n-resize"
        onmousedown={(e) => handleResizeStart(e, 'n')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize"
        onmousedown={(e) => handleResizeStart(e, 's')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize"
        onmousedown={(e) => handleResizeStart(e, 'w')}
        title="Resize"
    ></div>
    
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize"
        onmousedown={(e) => handleResizeStart(e, 'e')}
        title="Resize"
    ></div>
</div>

<!-- Drag Shield -->
{#if isDragging}
    <div class="fixed inset-0 z-40 cursor-move"></div>
{/if}

<!-- Resize Shield -->
{#if isResizing}
    <div class="fixed inset-0 z-40 cursor-se-resize"></div>
{/if}

<style>
    /* Custom scrollbar for notes list */
    .scrollbar-thin {
        scrollbar-width: thin;
        scrollbar-color: #6b7280 transparent;
        /* Smooth scrolling */
        scroll-behavior: smooth;
        /* Better scroll performance */
        -webkit-overflow-scrolling: touch;
    }
    
    .scrollbar-thin::-webkit-scrollbar {
        width: 8px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-track {
        background: rgba(55, 65, 81, 0.1);
        border-radius: 4px;
        margin: 4px 0;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb {
        background-color: #6b7280;
        border-radius: 4px;
        border: 1px solid rgba(55, 65, 81, 0.2);
        min-height: 20px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        background-color: #9ca3af;
        border-color: rgba(55, 65, 81, 0.3);
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb:active {
        background-color: #d1d5db;
    }

    /* Fade effect for scrollbar */
    .scrollbar-thin::-webkit-scrollbar-thumb {
        transition: background-color 0.2s ease;
    }

    /* Line clamp utility */
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>