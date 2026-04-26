// Todo Store - Full Backend Integration
// Syncs with v-auto-backend todos table

import nativeApi from './nativeApi.js';
import { authStore } from './auth.svelte.js';

function createTodoStore() {
    // Cache for fast access
    let todosCache = $state([]);
    let isLoading = $state(false);
    let lastUpdate = $state(Date.now());

    return {
        get todos() { return todosCache; },
        get isLoading() { return isLoading; },
        get lastUpdate() { return lastUpdate },
        
        get activeTodos() {
            // status: 0=Not Started, 1=In Progress, 2=On Hold, 3=Completed
            return todosCache.filter(t => t.status !== 3); // Not completed
        },
        
        get completedTodos() {
            return todosCache.filter(t => t.status === 3); // Completed
        },

        // Load todos from backend
        async loadTodos() {
            const user = authStore.user;
            if (!user?.id) {
                console.warn('No user logged in');
                return;
            }

            isLoading = true;
            try {
                // Get todos assigned to current user or created by user
                const params = new URLSearchParams();
                params.append('assignedTo', user.id.toString());
                params.append('limit', '100');
                params.append('sortBy', 'createdAt');
                params.append('sortOrder', 'desc');
                
                console.log('📝 Loading todos for user:', user.id);
                
                const response = await nativeApi.get(`/todos?${params.toString()}`);
                
                console.log('📝 Todos response:', response.data);
                
                if (response.data.success) {
                    todosCache = response.data.data.map(item => {
                        // Handle different response structures
                        const todoData = item.todo || item;
                        
                        return {
                            id: todoData.id,
                            text: todoData.title,
                            description: todoData.description,
                            completed: todoData.status === 1 || todoData.status === 3, // 1=In Progress, 3=Completed
                            status: todoData.status,
                            priority: todoData.priority,
                            type: todoData.type,
                            dueDate: todoData.dueDate,
                            createdAt: new Date(todoData.createdAt).getTime(),
                            updatedAt: todoData.updatedAt ? new Date(todoData.updatedAt).getTime() : null,
                            // Additional fields
                            customerId: todoData.customerId,
                            subscriptionId: todoData.subscriptionId,
                            assignedTo: todoData.assignedTo,
                            customer: item.customer,
                            subscription: item.subscription
                        };
                    });
                    lastUpdate = Date.now();
                    console.log('✅ Todos loaded:', todosCache.length, 'items');
                }
            } catch (error) {
                console.error('❌ Failed to load todos:', error);
            } finally {
                isLoading = false;
            }
        },

        // Add new todo
        async addTodo(text, description = null) {
            const user = authStore.user;
            if (!user?.id) {
                console.warn('No user logged in');
                return false;
            }

            try {
                const payload = {
                    type: 3, // 3 = other (personal todo)
                    title: text,
                    description: description,
                    assignedTo: user.id,
                    status: 0, // 0 = Not Started
                    priority: 1, // 1 = Medium
                };
                
                console.log('📝 Creating todo:', payload);
                
                const response = await nativeApi.post('/todos', payload);
                
                console.log('📝 Create response:', response.data);
                
                if (response.data.success) {
                    // Add to cache optimistically
                    const newTodo = {
                        id: response.data.data.todo.id,
                        text: response.data.data.todo.title,
                        description: response.data.data.todo.description,
                        completed: false,
                        status: 0,
                        priority: response.data.data.todo.priority,
                        type: response.data.data.todo.type,
                        dueDate: response.data.data.todo.dueDate,
                        createdAt: new Date(response.data.data.todo.createdAt).getTime(),
                        updatedAt: null,
                        customerId: response.data.data.todo.customerId,
                        subscriptionId: response.data.data.todo.subscriptionId,
                        assignedTo: response.data.data.todo.assignedTo,
                        customer: response.data.data.customer,
                        subscription: response.data.data.subscription
                    };
                    
                    todosCache = [newTodo, ...todosCache];
                    lastUpdate = Date.now();
                    console.log('✅ Todo created');
                    return true;
                }
            } catch (error) {
                console.error('❌ Failed to create todo:', error);
                return false;
            }
        },

        // Toggle todo completion
        async toggleTodo(id) {
            const todo = todosCache.find(t => t.id === id);
            if (!todo) return false;

            try {
                // Toggle between not completed (0,1,2) and completed (3)
                const newStatus = todo.status === 3 ? 0 : 3;
                
                console.log('📝 Toggling todo:', id, 'from status:', todo.status, 'to:', newStatus);
                
                const response = await nativeApi.put(`/todos/${id}`, {
                    status: newStatus
                });
                
                if (response.data.success) {
                    // Update cache
                    const index = todosCache.findIndex(t => t.id === id);
                    if (index !== -1) {
                        todosCache[index] = {
                            ...todosCache[index],
                            status: newStatus,
                            completed: newStatus === 3,
                            updatedAt: Date.now()
                        };
                        todosCache = [...todosCache]; // Trigger reactivity
                        lastUpdate = Date.now();
                    }
                    console.log('✅ Todo toggled');
                    return true;
                }
            } catch (error) {
                console.error('❌ Failed to toggle todo:', error);
                return false;
            }
        },

        // Delete todo
        async deleteTodo(id) {
            try {
                console.log('📝 Deleting todo:', id);
                
                const response = await nativeApi.delete(`/todos/${id}`);
                
                if (response.data.success) {
                    // Remove from cache
                    todosCache = todosCache.filter(t => t.id !== id);
                    lastUpdate = Date.now();
                    console.log('✅ Todo deleted');
                    return true;
                }
            } catch (error) {
                console.error('❌ Failed to delete todo:', error);
                return false;
            }
        },

        // Update todo
        async updateTodo(id, updates) {
            try {
                console.log('📝 Updating todo:', id, updates);
                
                const payload = {};
                if (updates.text !== undefined) payload.title = updates.text;
                if (updates.description !== undefined) payload.description = updates.description;
                if (updates.status !== undefined) payload.status = updates.status;
                if (updates.priority !== undefined) payload.priority = updates.priority;
                if (updates.dueDate !== undefined) payload.dueDate = updates.dueDate;
                
                const response = await nativeApi.put(`/todos/${id}`, payload);
                
                console.log('📝 Update response:', response.data);
                
                if (response.data.success) {
                    // Update cache with proper mapping
                    const index = todosCache.findIndex(t => t.id === id);
                    console.log('📝 Found todo at index:', index);
                    
                    if (index !== -1) {
                        const oldTodo = todosCache[index];
                        const updatedTodo = { ...oldTodo };
                        
                        // Map updates to cache structure
                        if (updates.text !== undefined) updatedTodo.text = updates.text;
                        if (updates.description !== undefined) updatedTodo.description = updates.description;
                        if (updates.status !== undefined) {
                            updatedTodo.status = updates.status;
                            updatedTodo.completed = updates.status === 3;
                            console.log('📝 Updated status:', updatedTodo.status, 'completed:', updatedTodo.completed);
                        }
                        if (updates.priority !== undefined) updatedTodo.priority = updates.priority;
                        if (updates.dueDate !== undefined) updatedTodo.dueDate = updates.dueDate;
                        
                        updatedTodo.updatedAt = Date.now();
                        
                        console.log('📝 Old todo:', oldTodo);
                        console.log('📝 Updated todo:', updatedTodo);
                        
                        // Create new array to trigger reactivity
                        const newCache = [...todosCache];
                        newCache[index] = updatedTodo;
                        todosCache = newCache;
                        
                        lastUpdate = Date.now();
                        console.log('📝 Cache updated, new length:', todosCache.length);
                    }
                    console.log('✅ Todo updated');
                    return true;
                }
                return false;
            } catch (error) {
                console.error('❌ Failed to update todo:', error);
                return false;
            }
        },

        // Refresh from backend
        async refresh() {
            await this.loadTodos();
        }
    };
}

export const todoStore = createTodoStore();
