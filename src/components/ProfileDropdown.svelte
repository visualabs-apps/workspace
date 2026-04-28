<script>
    import { ChevronDown, Edit, Trash2, Cookie } from "lucide-svelte";
    import { workspaceStore } from "../lib/workspaces.svelte.js";
    import Dropdown from "./Dropdown.svelte";
    import CookieManagerModal from "./CookieManagerModal.svelte";

    let { onClose = () => {}, onEditProfile = () => {}, onDeleteProfile = () => {} } = $props();

    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    let showDropdown = $state(false);
    let showCookieManager = $state(false);
    let currentPartition = $state(null);

    // Get workspace initials
    function getInitials(name) {
        if (!name) return "W";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    function toggleDropdown(e) {
        e.stopPropagation();
        showDropdown = !showDropdown;
        if (!showDropdown) {
            onClose();
        }
    }

    function handleEditProfile() {
        showDropdown = false;
        onEditProfile(activeWorkspace);
    }

    function handleDeleteProfile() {
        showDropdown = false;
        onDeleteProfile(activeWorkspace);
    }

    function handleManageCookies() {
        showDropdown = false;
        if (activeWorkspace?.id) {
            currentPartition = `persist:workspace-${activeWorkspace.id}`;
            showCookieManager = true;
        }
    }
</script>

<Dropdown 
    isOpen={showDropdown} 
    onClose={() => showDropdown = false}
    dropdownId="profile-dropdown"
    trigger={profileTrigger}
>
    {#snippet profileTrigger()}
        <button
            onclick={toggleDropdown}
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
            title="Active Profile"
        >
            <!-- Profile Avatar with color -->
            <div 
                class="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style="background: linear-gradient(135deg, {activeWorkspace?.color?.hex || activeWorkspace?.color?.value || activeWorkspace?.color || '#6366f1'}, {activeWorkspace?.color?.hex || activeWorkspace?.color?.value || activeWorkspace?.color || '#6366f1'}dd);"
            >
                {getInitials(activeWorkspace?.name || "Workspace")}
            </div>
            
            <!-- Profile Name -->
            <span class="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
                {activeWorkspace?.name || "No Profile"}
            </span>
            
            <!-- Dropdown Arrow -->
            <ChevronDown 
                size={14} 
                class="text-gray-500 group-hover:text-gray-700 transition-all {showDropdown ? 'rotate-180' : ''}"
            />
        </button>
    {/snippet}

    {#snippet children()}
        <!-- Menu Items -->
        <div class="py-1">
            <button
                onclick={handleEditProfile}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
                <Edit size={16} class="text-gray-500" />
                Edit Profile
            </button>
            
            <button
                onclick={handleManageCookies}
                class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
                <Cookie size={16} class="text-gray-500" />
                Manage Cookies
            </button>
            
            <div class="border-t border-gray-200 my-1"></div>
            
            <button
                onclick={handleDeleteProfile}
                class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
                <Trash2 size={16} class="text-red-500" />
                Delete Profile
            </button>
        </div>
    {/snippet}
</Dropdown>

<!-- Cookie Manager Modal -->
<CookieManagerModal bind:isOpen={showCookieManager} partition={currentPartition} />