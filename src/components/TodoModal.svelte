<script>
    import { CheckSquare, Square, Trash2, Calendar, X, Search } from "lucide-svelte";
    import { slide, fade } from 'svelte/transition';
    import { todoStore } from "../lib/todos.svelte.js";
    import { toastStore } from "../lib/toast.svelte.js";
    import { workspaceStore } from "../lib/workspaces.svelte.js";

    let { isOpen = false, onClose = () => {} } = $props();

    let searchText = $state("");
    
    // Filter states
    let showProfileOnly = $state(true); // true = profile tasks, false = all tasks
    let priorityFilter = $state("all"); // "all" | "0" | "1" | "2" | "3"
    let statusFilter = $state("all"); // "all" | "0" | "1" | "2" | "3"
    
    // Get todos from store
    let allTodos = $derived(todoStore.todos);
    let isLoading = $derived(todoStore.isLoading);
    let activeWorkspace = $derived(workspaceStore.activeWorkspace);
    
    // Apply filters
    let filteredTodos = $derived.by(() => {
        let result = allTodos;
        
        // Main filter: by profile (customerId)
        if (showProfileOnly) {
            // If profile doesn't have customerId, show nothing
            if (!activeWorkspace?.customerId) {
                return [];
            }
            result = result.filter(t => t.customerId === activeWorkspace.customerId);
        }
        
        // Search filter
        if (searchText.trim()) {
            const search = searchText.toLowerCase();
            result = result.filter(t => 
                t.text?.toLowerCase().includes(search) || 
                t.description?.toLowerCase().includes(search)
            );
        }
        
        // Priority filter
        if (priorityFilter !== "all") {
            result = result.filter(t => t.priority === Number(priorityFilter));
        }
        
        // Status filter
        if (statusFilter !== "all") {
            result = result.filter(t => t.status === Number(statusFilter));
        }
        
        return result;
    });
    
    let todos = $derived(filteredTodos);
    let activeTodos = $derived(filteredTodos.filter(t => t.status !== 3));
    let completedTodos = $derived(filteredTodos.filter(t => t.status === 3));
    
    // Load todos when modal opens
    $effect(() => {
        if (isOpen) {
            todoStore.loadTodos();
            // Reset filters when opening
            searchText = "";
            showProfileOnly = true;
            priorityFilter = "all";
            statusFilter = "all";
        }
    });

    async function handleToggleTodo(id) {
        const success = await todoStore.toggleTodo(id);
        if (!success) {
            toastStore.error('Failed to update todo');
        }
    }

    async function handleChangeStatus(id, newStatus) {
        console.log('🔄 Changing status:', id, 'to', newStatus);
        const success = await todoStore.updateTodo(id, { status: newStatus });
        if (success) {
            console.log('✅ Status changed successfully');
            toastStore.success('Status berhasil diubah');
        } else {
            console.log('❌ Failed to change status');
            toastStore.error('Gagal mengubah status');
        }
    }

    async function handleDeleteTodo(id) {
        if (!confirm('Delete this todo?')) return;
        
        const success = await todoStore.deleteTodo(id);
        if (success) {
            toastStore.success('Todo deleted');
        } else {
            toastStore.error('Failed to delete todo');
        }
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    function getStatusLabel(status) {
        const labels = {
            0: 'Belum Dimulai',
            1: 'Sedang Berjalan',
            2: 'Ditunda',
            3: 'Selesai'
        };
        return labels[status] || 'Unknown';
    }

    function getStatusColor(status) {
        const colors = {
            0: 'bg-gray-100 text-gray-700',
            1: 'bg-blue-100 text-blue-700',
            2: 'bg-amber-100 text-amber-700',
            3: 'bg-green-100 text-green-700'
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    }
</script>

{#if isOpen}
    <!-- Modal Overlay -->
    <div 
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        transition:fade={{ duration: 200 }}
        onclick={onClose}
    >
        <!-- Modal Content - Fixed Height -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div 
            class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col"
            transition:slide={{ duration: 300, axis: 'y' }}
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header - Fixed -->
            <div class="flex-shrink-0 p-6 border-b border-gray-200 bg-gray-50">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <CheckSquare size={28} class="text-blue-600" />
                        Daftar Tugas
                    </h2>
                    <button
                        onclick={onClose}
                        class="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={22} />
                    </button>
                </div>

                <!-- Search Input -->
                <div class="relative mb-6">
                    <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        bind:value={searchText}
                        placeholder="Cari tugas berdasarkan judul atau deskripsi..."
                        class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    />
                </div>

                <!-- Filters - Vertical Layout -->
                <div class="space-y-4">
                    <!-- View Task Mode -->
                    <div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <span class="text-sm font-semibold text-gray-700 min-w-[120px]">Mode tampilan:</span>
                        <div class="flex gap-2">
                            <button
                                onclick={() => showProfileOnly = false}
                                class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {
                                    !showProfileOnly
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }"
                            >
                                Semua Tugas
                            </button>
                            <button
                                onclick={() => showProfileOnly = true}
                                class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {
                                    showProfileOnly
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }"
                            >
                                Tugas Profil
                                {#if showProfileOnly && activeWorkspace?.customerName}
                                    <span class="ml-1.5 text-xs opacity-80">({activeWorkspace.customerName})</span>
                                {/if}
                            </button>
                        </div>
                    </div>

                    <!-- Priority Filter -->
                    <div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <span class="text-sm font-semibold text-gray-700 min-w-[120px]">Prioritas:</span>
                        <div class="flex gap-2 flex-wrap">
                            {#each [
                                { value: 'all', label: 'Semua', color: 'gray' },
                                { value: '0', label: 'Rendah', color: 'gray' },
                                { value: '1', label: 'Sedang', color: 'blue' },
                                { value: '2', label: 'Tinggi', color: 'orange' },
                                { value: '3', label: 'Mendesak', color: 'red' }
                            ] as filter}
                                <button
                                    onclick={() => priorityFilter = filter.value}
                                    class="px-3 py-1.5 text-xs font-medium rounded-md transition-all {
                                        priorityFilter === filter.value
                                            ? filter.color === 'gray' ? 'bg-gray-700 text-white shadow-sm' :
                                              filter.color === 'blue' ? 'bg-blue-600 text-white shadow-sm' :
                                              filter.color === 'orange' ? 'bg-orange-600 text-white shadow-sm' :
                                              'bg-red-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }"
                                >
                                    {filter.label}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Status Filter -->
                    <div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <span class="text-sm font-semibold text-gray-700 min-w-[120px]">Status:</span>
                        <div class="flex gap-2 flex-wrap">
                            {#each [
                                { value: 'all', label: 'Semua' },
                                { value: '0', label: 'Belum Dimulai' },
                                { value: '1', label: 'Sedang Berjalan' },
                                { value: '2', label: 'Ditunda' },
                                { value: '3', label: 'Selesai' }
                            ] as filter}
                                <button
                                    onclick={() => statusFilter = filter.value}
                                    class="px-3 py-1.5 text-xs font-medium rounded-md transition-all {
                                        statusFilter === filter.value
                                            ? 'bg-gray-700 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }"
                                >
                                    {filter.label}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Stats -->
                    <div class="flex items-center gap-4 text-sm text-gray-600 px-3">
                        <span class="font-medium">{activeTodos.length} aktif</span>
                        <span class="text-gray-300">•</span>
                        <span class="font-medium">{completedTodos.length} selesai</span>
                        <span class="text-gray-300">•</span>
                        <span class="font-medium">{todos.length} total</span>
                    </div>
                </div>
            </div>

            <!-- Content - Scrollable -->
            <div class="flex-1 overflow-y-auto">
                {#if isLoading}
                    <div class="flex items-center justify-center h-full">
                        <div class="text-center">
                            <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p class="text-gray-500">Memuat tugas...</p>
                        </div>
                    </div>
                {:else if todos.length === 0}
                    <div class="flex items-center justify-center h-full">
                        <div class="text-center">
                            <CheckSquare size={64} class="mx-auto mb-4 text-gray-300" />
                            <p class="text-lg font-medium text-gray-700 mb-2">Tidak ada tugas</p>
                            <p class="text-sm text-gray-500">
                                {#if searchText.trim()}
                                    Coba sesuaikan pencarian atau filter Anda
                                {:else if showProfileOnly}
                                    Belum ada tugas untuk profil ini
                                {:else}
                                    Belum ada tugas tersedia
                                {/if}
                            </p>
                        </div>
                    </div>
                {:else}
                    <!-- Active Todos -->
                    {#if activeTodos.length > 0}
                        <div class="border-b border-gray-200">
                            <div class="sticky top-0 bg-gradient-to-b from-white to-gray-50 px-6 py-3 border-b border-gray-200 z-10">
                                <h3 class="text-sm font-bold text-gray-700 uppercase tracking-wider">Tugas Aktif</h3>
                            </div>
                            
                            {#each activeTodos as todo (todo.id)}
                                <div
                                    class="px-6 py-4 hover:bg-blue-50/50 border-b border-gray-100 last:border-b-0 group transition-all"
                                    transition:slide={{ duration: 200 }}
                                >
                                    <div class="flex items-start gap-4">
                                        <button
                                            onclick={() => handleToggleTodo(todo.id)}
                                            class="mt-1 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                                        >
                                            <Square size={20} />
                                        </button>

                                        <div class="flex-1 min-w-0">
                                            <div class="text-base font-medium text-gray-900 mb-1">
                                                {todo.text}
                                            </div>
                                            
                                            {#if todo.description}
                                                <div class="text-sm text-gray-600 mb-2 line-clamp-2">
                                                    {todo.description}
                                                </div>
                                            {/if}

                                            <div class="flex items-center gap-3 flex-wrap">
                                                <span class="inline-flex items-center gap-1.5 text-xs text-gray-500">
                                                    <Calendar size={14} />
                                                    {formatDate(todo.createdAt)}
                                                </span>
                                                
                                                {#if !showProfileOnly && todo.customer?.profile?.name}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                                                        📁 {todo.customer.profile.name}
                                                    </span>
                                                {/if}
                                                
                                                {#if todo.dueDate}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                                                        Due: {new Date(todo.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                {/if}
                                                
                                                {#if todo.priority !== undefined}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium {
                                                        todo.priority === 3 ? 'bg-red-100 text-red-700' :
                                                        todo.priority === 2 ? 'bg-orange-100 text-orange-700' :
                                                        todo.priority === 1 ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }">
                                                        {todo.priority === 3 ? 'Mendesak' : todo.priority === 2 ? 'Tinggi' : todo.priority === 1 ? 'Sedang' : 'Rendah'}
                                                    </span>
                                                {/if}

                                                <!-- Status Dropdown -->
                                                <select
                                                    bind:value={todo.status}
                                                    onchange={(e) => handleChangeStatus(todo.id, Number(e.currentTarget.value))}
                                                    class="status-dropdown px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 {getStatusColor(todo.status)}"
                                                    onclick={(e) => e.stopPropagation()}
                                                >
                                                    <option value={0}>Belum Dimulai</option>
                                                    <option value={1}>Sedang Berjalan</option>
                                                    <option value={2}>Ditunda</option>
                                                    <option value={3}>Selesai</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onclick={() => handleDeleteTodo(todo.id)}
                                            class="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all flex-shrink-0"
                                            title="Delete task"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <!-- Completed Todos -->
                    {#if completedTodos.length > 0}
                        <div>
                            <div class="sticky top-0 bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200 z-10">
                                <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider">Selesai</h3>
                            </div>
                            
                            {#each completedTodos as todo (todo.id)}
                                <div
                                    class="px-6 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 group transition-all"
                                    transition:slide={{ duration: 200 }}
                                >
                                    <div class="flex items-start gap-4">
                                        <button
                                            onclick={() => handleToggleTodo(todo.id)}
                                            class="mt-1 text-green-500 hover:text-gray-400 transition-colors flex-shrink-0"
                                        >
                                            <CheckSquare size={20} />
                                        </button>

                                        <div class="flex-1 min-w-0">
                                            <div class="text-base text-gray-500 line-through mb-1">
                                                {todo.text}
                                            </div>
                                            
                                            <div class="flex items-center gap-3 flex-wrap">
                                                <span class="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                                    <Calendar size={14} />
                                                    {formatDate(todo.createdAt)}
                                                </span>
                                                
                                                {#if !showProfileOnly && todo.customer?.profile?.name}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium opacity-60 bg-purple-100 text-purple-700">
                                                        📁 {todo.customer.profile.name}
                                                    </span>
                                                {/if}
                                                
                                                {#if todo.priority !== undefined}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium opacity-60 {
                                                        todo.priority === 3 ? 'bg-red-100 text-red-700' :
                                                        todo.priority === 2 ? 'bg-orange-100 text-orange-700' :
                                                        todo.priority === 1 ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }">
                                                        {todo.priority === 3 ? 'Mendesak' : todo.priority === 2 ? 'Tinggi' : todo.priority === 1 ? 'Sedang' : 'Rendah'}
                                                    </span>
                                                {/if}

                                                <!-- Status Dropdown for Completed -->
                                                <select
                                                    bind:value={todo.status}
                                                    onchange={(e) => handleChangeStatus(todo.id, Number(e.currentTarget.value))}
                                                    class="status-dropdown px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 opacity-60 {getStatusColor(todo.status)}"
                                                    onclick={(e) => e.stopPropagation()}
                                                >
                                                    <option value={0}>Belum Dimulai</option>
                                                    <option value={1}>Sedang Berjalan</option>
                                                    <option value={2}>Ditunda</option>
                                                    <option value={3}>Selesai</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onclick={() => handleDeleteTodo(todo.id)}
                                            class="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all flex-shrink-0"
                                            title="Delete task"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    /* Custom scrollbar */
    div::-webkit-scrollbar {
        width: 8px;
    }
    
    div::-webkit-scrollbar-track {
        background: #f1f5f9;
    }
    
    div::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }
    
    div::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    /* Status dropdown styling */
    .status-dropdown {
        border: none;
        outline: none;
        min-width: 130px;
        padding-right: 24px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='currentColor' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 6px center;
        background-size: 12px;
    }

    .status-dropdown option {
        background: white;
        color: #374151;
        padding: 8px;
    }
</style>
