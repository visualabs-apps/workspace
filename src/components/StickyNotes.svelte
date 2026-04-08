<script>
    import { notesStore } from "../lib/notes.svelte.js";
    import {
        GripHorizontal,
        X,
        Palette,
        Maximize2,
        Minus,
        Square,
    } from "lucide-svelte";

    let { workspaceId } = $props();

    // Prevent iframe/webview from stealing mousemove events when cursor moves too fast
    let isDragging = $state(false);

    // Get notes from store
    // Use an effect so that Svelte 5 recognizes dependencies
    // Wait, with $state in the store returning internalNotes, we can just derive it
    let notes = $derived(
        workspaceId ? notesStore.getWorkspaceNotes(workspaceId) : [],
    );

    // Active dropdowns for color pickers (store ID of the note if its palette is open)
    let activeColorPicker = $state(null);

    const STICKY_COLORS = [
        { name: "Yellow", value: "#ffeb3b", text: "#000000" },
        { name: "Green", value: "#ccff90", text: "#000000" },
        { name: "Blue", value: "#80d8ff", text: "#000000" },
        { name: "Pink", value: "#ff8a80", text: "#000000" },
        { name: "Purple", value: "#b388ff", text: "#000000" },
        { name: "Gray", value: "#cfd8dc", text: "#000000" },
    ];

    // Load notes when workspace changes
    $effect(() => {
        if (workspaceId) {
            notesStore.loadNotes(workspaceId);
        }
    });

    function bringToFront(id) {
        notesStore.updateNote(workspaceId, id, { bringToFront: true });
    }

    // Drag Actions (Positioning)
    function dragMousedown(e, note) {
        // Only react to primary mouse button
        if (e.button !== 0) return;

        // Prevent default browser drag/select behaviors which rob the mouseup event
        e.preventDefault();

        bringToFront(note.id);
        isDragging = true;

        let startX = e.clientX;
        let startY = e.clientY;
        let origX = note.x;
        let origY = note.y;

        function handleMousemove(e_m) {
            let dx = e_m.clientX - startX;
            let dy = e_m.clientY - startY;

            let newX = origX + dx;
            let newY = origY + dy;

            // Update purely local CSS state fast without hitting IndexedDB
            notesStore.updateNote(
                workspaceId,
                note.id,
                {
                    x: newX, // Allow free drag anywhere horizontally
                    y: Math.max(0, newY), // But prevent dragging above the very top (so it's not lost out of screen)
                },
                true, // skipDb = true
            );
        }

        function handleMouseup(e_u) {
            window.removeEventListener("mousemove", handleMousemove);
            window.removeEventListener("mouseup", handleMouseup);
            isDragging = false;

            // Commit final position to IndexedDB
            let finalX = origX + (e_u.clientX - startX);
            let finalY = Math.max(0, origY + (e_u.clientY - startY));

            notesStore.updateNote(
                workspaceId,
                note.id,
                { x: finalX, y: finalY },
                false,
            );
        }

        window.addEventListener("mousemove", handleMousemove);
        window.addEventListener("mouseup", handleMouseup);
    }

    // Resize Actions
    function resizeMousedown(e, note) {
        if (e.button !== 0) return;
        e.preventDefault(); // Prevent text selection stealing events
        e.stopPropagation();
        bringToFront(note.id);
        isDragging = true;

        let startX = e.clientX;
        let startY = e.clientY;
        let origW = note.width;
        let origH = note.height;

        function handleMousemove(e_m) {
            let dx = e_m.clientX - startX;
            let dy = e_m.clientY - startY;
            notesStore.updateNote(
                workspaceId,
                note.id,
                {
                    width: Math.max(150, origW + dx),
                    height: Math.max(150, origH + dy),
                },
                true, // skipDb = true
            );
        }

        function handleMouseup(e_u) {
            window.removeEventListener("mousemove", handleMousemove);
            window.removeEventListener("mouseup", handleMouseup);
            isDragging = false;

            // Final DB commit
            let dx = e_u.clientX - startX;
            let dy = e_u.clientY - startY;
            notesStore.updateNote(
                workspaceId,
                note.id,
                {
                    width: Math.max(150, origW + dx),
                    height: Math.max(150, origH + dy),
                },
                false,
            );
        }

        window.addEventListener("mousemove", handleMousemove);
        window.addEventListener("mouseup", handleMouseup);
    }

    // Handle typing
    // Svelte's bind:value doesn't trigger our 'db' update automatically for deep object changes in a store array,
    // so we debounce the Dexie update on typing
    let typingTimer;
    function handleContentUpdate(id, e) {
        bringToFront(id);
        const newText = e.target.value;

        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            notesStore.updateNote(workspaceId, id, { content: newText });
        }, 500); // 500ms debounce
    }

    let titleTimer;
    function handleTitleUpdate(id, e) {
        bringToFront(id);
        const newText = e.target.value;

        clearTimeout(titleTimer);
        titleTimer = setTimeout(() => {
            notesStore.updateNote(workspaceId, id, { title: newText });
        }, 500); // 500ms debounce
    }
</script>

<div class="pointer-events-none absolute inset-0 z-40 overflow-hidden">
    <!-- Shield layer: blocks Webviews from eating mouse events during fast drags -->
    {#if isDragging}
        <div
            class="absolute inset-0 z-[100] cursor-grabbing"
            style="pointer-events: auto;"
        ></div>
    {/if}

    {#each notes as note (note.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="pointer-events-auto absolute flex flex-col rounded-md shadow-lg transition-shadow hover:shadow-2xl"
            style:transform="translate3d({note.x}px, {note.y}px, 0)"
            style:left="0px"
            style:top="0px"
            style:width="{note.width}px"
            style:height={note.isMinimized ? "auto" : note.height + "px"}
            style:z-index={note.zIndex || 1}
            style:background-color={note.color}
            style="will-change: transform, width, height;"
            onmousedown={() => bringToFront(note.id)}
        >
            <!-- Header: Draggable handle & Actions -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="flex h-8 w-full cursor-grab items-center justify-between px-2 active:cursor-grabbing opacity-50 hover:opacity-100 transition-opacity bg-black/10"
                onmousedown={(e) => dragMousedown(e, note)}
            >
                <div
                    class="flex items-center gap-1 text-black flex-1 min-w-0 mr-2"
                >
                    <GripHorizontal size={14} class="shrink-0" />
                    <input
                        type="text"
                        class="bg-transparent border-none text-xs font-bold focus:outline-none w-full text-black placeholder-black/50 overflow-hidden text-ellipsis"
                        value={note.title || ""}
                        placeholder={`Note`}
                        onmousedown={(e) => e.stopPropagation()}
                        oninput={(e) => handleTitleUpdate(note.id, e)}
                    />
                </div>

                <div class="flex items-center gap-1 text-black">
                    <!-- Color Picker Toggle -->
                    <div class="relative">
                        <button
                            onmousedown={(e) => e.stopPropagation()}
                            onclick={() =>
                                (activeColorPicker =
                                    activeColorPicker === note.id
                                        ? null
                                        : note.id)}
                            class="rounded p-1 hover:bg-black/20"
                            title="Change Color"
                        >
                            <Palette size={14} />
                        </button>

                        <!-- Color Palette Popup -->
                        {#if activeColorPicker === note.id}
                            <div
                                class="absolute right-0 top-full mt-1 flex w-[120px] flex-wrap gap-1 rounded bg-white p-2 shadow-xl border border-gray-200 z-50"
                            >
                                {#each STICKY_COLORS as c}
                                    <button
                                        class="h-6 w-6 rounded-full border border-gray-300 transition-transform hover:scale-110"
                                        style:background-color={c.value}
                                        title={c.name}
                                        onclick={() => {
                                            notesStore.updateNote(
                                                workspaceId,
                                                note.id,
                                                { color: c.value },
                                            );
                                            activeColorPicker = null;
                                        }}
                                    ></button>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Toggle Minimize -->
                    <button
                        onmousedown={(e) => e.stopPropagation()}
                        onclick={() =>
                            notesStore.updateNote(workspaceId, note.id, {
                                isMinimized: !note.isMinimized,
                            })}
                        class="rounded p-1 hover:bg-black/20"
                        title={note.isMinimized ? "Maximize" : "Minimize"}
                    >
                        {#if note.isMinimized}
                            <Square size={14} />
                        {:else}
                            <Minus size={14} />
                        {/if}
                    </button>

                    <!-- Delete note -->
                    <button
                        onmousedown={(e) => e.stopPropagation()}
                        onclick={() =>
                            notesStore.deleteNote(workspaceId, note.id)}
                        class="rounded p-1 hover:bg-red-500 hover:text-white"
                        title="Delete Note"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <!-- Content -->
            {#if !note.isMinimized}
                <textarea
                    class="flex-1 resize-none bg-transparent p-3 text-sm focus:outline-none placeholder-black/40 text-black leading-relaxed"
                    placeholder="Tulis catatan..."
                    value={note.content}
                    oninput={(e) => handleContentUpdate(note.id, e)}
                ></textarea>

                <!-- Resize handle (bottom-right) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="absolute bottom-1 right-1 cursor-nwse-resize p-1 text-black/30 hover:text-black/70"
                    onmousedown={(e) => resizeMousedown(e, note)}
                >
                    <Maximize2 size={12} class="rotate-90" />
                </div>
            {/if}
        </div>
    {/each}
</div>
