<script>
    import { User, LogOut, ChevronDown } from "lucide-svelte";
    import { authStore } from "../lib/auth.svelte.js";
    import Dropdown from "./Dropdown.svelte";

    let { onClose = () => {} } = $props();

    let user = $derived(authStore.user);
    let showDropdown = $state(false);

    // Get user initials
    function getInitials(name) {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    function handleLogout() {
        if (confirm("Are you sure you want to logout?")) {
            authStore.logout();
        }
        showDropdown = false;
        onClose();
    }

    function toggleDropdown(e) {
        e.stopPropagation();
        showDropdown = !showDropdown;
        if (!showDropdown) {
            onClose();
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
            title="Profile Menu"
        >
            <!-- User Avatar -->
            <div class="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {getInitials(user?.name || user?.email || "User")}
            </div>
            
            <!-- User Name (optional, can be hidden on small screens) -->
            <span class="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
                {user?.name || user?.email || "User"}
            </span>
            
            <!-- Dropdown Arrow -->
            <ChevronDown 
                size={14} 
                class="text-gray-500 group-hover:text-gray-700 transition-all {showDropdown ? 'rotate-180' : ''}"
            />
        </button>
    {/snippet}

    {#snippet children()}
        <!-- User Info Header -->
        <div class="px-4 py-3 border-b border-gray-100">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                    {getInitials(user?.name || user?.email || "User")}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                        {user?.name || "User"}
                    </p>
                    <p class="text-xs text-gray-500 truncate">
                        {user?.email || "user@example.com"}
                    </p>
                </div>
            </div>
        </div>

        <!-- Menu Items -->
        <div class="py-1">
            <!-- My Profile -->
            <button
                onclick={() => {
                    // TODO: Add profile management functionality
                    showDropdown = false;
                    onClose();
                }}
                class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
                <User size={16} />
                <span class="text-sm">My Profile</span>
            </button>
        </div>

        <!-- Separator -->
        <div class="h-px bg-gray-200 my-1"></div>

        <!-- Logout -->
        <div class="py-1">
            <button
                onclick={handleLogout}
                class="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
                <LogOut size={16} />
                <span class="text-sm">Logout</span>
            </button>
        </div>
    {/snippet}
</Dropdown>