<script>
    import { CheckSquare, Square, Trash2, Plus } from "lucide-svelte";
    import BaseWindow from "../base/BaseWindow.svelte";
    import { todoStore } from "../../lib/stores/todos.svelte.js";
    import { toastStore } from "../../lib/managers/toast.svelte.js";

    let { isOpen = $bindable(false), onClose = () => {} } = $props();

    let todos = $derived(todoStore.activeTodos);
    let completedTodos = $derived(todoStore.completedTodos);

    // Load todos when window opens
    $effect(() => {
        if (isOpen) {
            todoStore.loadTodos();
        }
    });

    async function handleToggleTodo(id) {
        const success = await todoStore.toggleTodo(id);
        if (!success) {
            toastStore.error('Failed to update todo');
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
</script>

<BaseWindow
    bind:isOpen
    windowId="todo-window"
    title="Todo List"
    subtitle="{todos.length} active tasks"
    width="500px"
    height="600px"
    showCloseButton={true}
    showMinimizeButton={true}
    showMaximizeButton={true}
    onClose={onClose}
>
    {#snippet children()}
        <div class="space-y-4">
            <!-- Active Todos -->
            <div>
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckSquare size={18} class="text-blue-500" />
                    Active Tasks ({todos.length})
                </h4>
                
                {#if todos.length === 0}
                    <p class="text-gray-500 text-sm py-8 text-center">No active tasks</p>
                {:else}
                    <div class="space-y-2">
                        {#each todos as todo}
                            <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                                <button
                                    onclick={() => handleToggleTodo(todo.id)}
                                    class="mt-0.5 text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                    <Square size={18} />
                                </button>
                                
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900">{todo.text}</p>
                                    {#if todo.description}
                                        <p class="text-xs text-gray-500 mt-1">{todo.description}</p>
                                    {/if}
                                </div>
                                
                                <button
                                    onclick={() => handleDeleteTodo(todo.id)}
                                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Completed Todos -->
            {#if completedTodos.length > 0}
                <div class="pt-4 border-t border-gray-200">
                    <h4 class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <CheckSquare size={18} class="text-green-500" />
                        Completed ({completedTodos.length})
                    </h4>
                    
                    <div class="space-y-2">
                        {#each completedTodos as todo}
                            <div class="flex items-start gap-3 p-3 bg-green-50 rounded-lg group">
                                <button
                                    onclick={() => handleToggleTodo(todo.id)}
                                    class="mt-0.5 text-green-500 hover:text-gray-400 transition-colors"
                                >
                                    <CheckSquare size={18} />
                                </button>
                                
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm text-gray-500 line-through">{todo.text}</p>
                                </div>
                                
                                <button
                                    onclick={() => handleDeleteTodo(todo.id)}
                                    class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/snippet}

    {#snippet footerSlot()}
        <button
            onclick={() => toastStore.info('Add todo feature coming soon')}
            class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
            <Plus size={16} />
            Add New Task
        </button>
    {/snippet}
</BaseWindow>
