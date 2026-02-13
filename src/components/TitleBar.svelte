<script>
    import { activeWorkspace } from "../lib/workspaces.svelte.js"; // Optional: show title
</script>

<div
    class="w-full h-[30px] shrink-0 flex items-center bg-transparent z-50 select-none"
    style="-webkit-app-region: drag"
>
    <!-- Left side could have breadcrumbs or title if needed -->
    <!-- But since Sidebar is on the left, this TitleBar is visually inside the 'Content Area' to the right of Sidebar -->
    <!-- So we don't need to offset for sidebar width here, it's just in the flex flow -->

    <div class="flex-1"></div>

    <!-- Right side is reserved for Window Controls (approx 140px) -->
    <div class="w-[140px] h-full" style="-webkit-app-region: no-drag"></div>
</div>

<style>
    /* Ensure drag region works */
    div {
        -webkit-app-region: drag;
    }
</style>
