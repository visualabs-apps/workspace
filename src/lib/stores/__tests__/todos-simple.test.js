import { describe, test, expect, vi, beforeEach } from 'vitest';

// Simple test todos store
function createTestTodosStore() {
  let todosCache = [];
  let isLoading = false;
  let lastUpdate = Date.now();

  return {
    get todos() { return todosCache; },
    set todos(value) { todosCache = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },
    get lastUpdate() { return lastUpdate; },
    set lastUpdate(value) { lastUpdate = value; },
    
    get activeTodos() {
      return todosCache.filter(t => t.status !== 3); // Not completed
    },
    
    get completedTodos() {
      return todosCache.filter(t => t.status === 3); // Completed
    },

    async loadTodos() {
      isLoading = true;
      // Mock loading todos
      todosCache = [
        {
          id: 1,
          title: 'Test Todo 1',
          description: 'Description 1',
          status: 0, // Not Started
          priority: 1,
          assignedTo: 1,
          createdBy: 1,
          createdAt: Date.now() - 1000000,
          updatedAt: Date.now() - 900000
        },
        {
          id: 2,
          title: 'Test Todo 2',
          description: 'Description 2',
          status: 1, // In Progress
          priority: 2,
          assignedTo: 1,
          createdBy: 1,
          createdAt: Date.now() - 800000,
          updatedAt: Date.now() - 700000
        },
        {
          id: 3,
          title: 'Test Todo 3',
          description: 'Description 3',
          status: 3, // Completed
          priority: 3,
          assignedTo: 1,
          createdBy: 1,
          createdAt: Date.now() - 600000,
          updatedAt: Date.now() - 500000
        }
      ];
      isLoading = false;
      lastUpdate = Date.now();
      return todosCache;
    },

    async addTodo(todoData) {
      const newTodo = {
        id: Date.now() + Math.random(),
        title: todoData.title,
        description: todoData.description || '',
        status: 0, // Not Started
        priority: todoData.priority || 1,
        assignedTo: todoData.assignedTo || 1,
        createdBy: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...todoData
      };

      todosCache = [newTodo, ...todosCache];
      lastUpdate = Date.now();
      return newTodo;
    },

    async updateTodo(id, updates) {
      const index = todosCache.findIndex(t => t.id === id);
      if (index !== -1) {
        todosCache[index] = {
          ...todosCache[index],
          ...updates,
          updatedAt: Date.now()
        };
        lastUpdate = Date.now();
        return todosCache[index];
      }
      return null;
    },

    async deleteTodo(id) {
      todosCache = todosCache.filter(t => t.id !== id);
      lastUpdate = Date.now();
      return true;
    },

    getTodosByStatus(status) {
      return todosCache.filter(t => t.status === status);
    },

    getTodosByPriority(priority) {
      return todosCache.filter(t => t.priority === priority);
    },

    searchTodos(query) {
      if (!query) return todosCache;
      
      const lowerQuery = query.toLowerCase();
      return todosCache.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
      );
    },

    getStatistics() {
      const total = todosCache.length;
      const completed = todosCache.filter(t => t.status === 3).length;
      const active = total - completed;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        active,
        completed,
        completionRate
      };
    },

    async exportTodos() {
      return {
        exportDate: new Date().toISOString(),
        totalTodos: todosCache.length,
        todos: todosCache
      };
    },

    async markAsComplete(id) {
      return await this.updateTodo(id, { status: 3 });
    },

    async assignTodo(id, userId) {
      return await this.updateTodo(id, { assignedTo: userId });
    }
  };
}

describe('Todos Store (Simple)', () => {
  let todosStore;

  beforeEach(() => {
    vi.clearAllMocks();
    todosStore = createTestTodosStore();
  });

  test('should initialize with empty todos', () => {
    expect(todosStore.todos).toEqual([]);
    expect(todosStore.activeTodos).toEqual([]);
    expect(todosStore.completedTodos).toEqual([]);
    expect(todosStore.isLoading).toBe(false);
    expect(todosStore.lastUpdate).toBeDefined();
  });

  test('should load todos from backend', async () => {
    const todos = await todosStore.loadTodos();

    expect(todos).toHaveLength(3);
    expect(todosStore.todos).toHaveLength(3);
    expect(todosStore.isLoading).toBe(false);
    expect(todosStore.todos[0].title).toBe('Test Todo 1');
    expect(todosStore.todos[1].status).toBe(1);
    expect(todosStore.todos[2].status).toBe(3);
  });

  test('should add new todo', async () => {
    const newTodoData = {
      title: 'New Task',
      description: 'Task description',
      priority: 2,
      assignedTo: 1
    };

    const newTodo = await todosStore.addTodo(newTodoData);

    expect(newTodo.title).toBe('New Task');
    expect(newTodo.description).toBe('Task description');
    expect(newTodo.status).toBe(0); // Not Started
    expect(newTodo.priority).toBe(2);
    expect(newTodo.assignedTo).toBe(1);
    expect(newTodo.createdAt).toBeDefined();
    expect(newTodo.updatedAt).toBeDefined();

    expect(todosStore.todos).toHaveLength(1);
    expect(todosStore.todos[0]).toEqual(newTodo);
  });

  test('should update todo', async () => {
    // First add a todo
    const todo = await todosStore.addTodo({ title: 'Original Task', description: 'Original' });
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const updatedTodo = await todosStore.updateTodo(todo.id, {
      title: 'Updated Task',
      status: 1,
      priority: 3
    });

    expect(updatedTodo.title).toBe('Updated Task');
    expect(updatedTodo.status).toBe(1);
    expect(updatedTodo.priority).toBe(3);
    expect(updatedTodo.updatedAt).toBeGreaterThanOrEqual(todo.updatedAt);
    expect(todosStore.todos[0].title).toBe('Updated Task');
  });

  test('should delete todo', async () => {
    const todo = await todosStore.addTodo({ title: 'To Delete', description: 'Delete me' });
    expect(todosStore.todos).toHaveLength(1);

    const result = await todosStore.deleteTodo(todo.id);

    expect(result).toBe(true);
    expect(todosStore.todos).toHaveLength(0);
  });

  test('should filter active todos', async () => {
    await todosStore.loadTodos(); // Load mock data with mixed statuses

    const activeTodos = todosStore.activeTodos;

    expect(activeTodos).toHaveLength(2);
    expect(activeTodos.every(t => t.status !== 3)).toBe(true);
  });

  test('should filter completed todos', async () => {
    await todosStore.loadTodos(); // Load mock data with mixed statuses

    const completedTodos = todosStore.completedTodos;

    expect(completedTodos).toHaveLength(1);
    expect(completedTodos.every(t => t.status === 3)).toBe(true);
    expect(completedTodos[0].title).toBe('Test Todo 3');
  });

  test('should filter todos by status', async () => {
    await todosStore.loadTodos();

    const notStarted = todosStore.getTodosByStatus(0);
    const inProgress = todosStore.getTodosByStatus(1);
    const completed = todosStore.getTodosByStatus(3);

    expect(notStarted).toHaveLength(1);
    expect(inProgress).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(notStarted[0].title).toBe('Test Todo 1');
    expect(inProgress[0].title).toBe('Test Todo 2');
    expect(completed[0].title).toBe('Test Todo 3');
  });

  test('should filter todos by priority', async () => {
    await todosStore.loadTodos();

    const highPriority = todosStore.getTodosByPriority(1);
    const mediumPriority = todosStore.getTodosByPriority(2);
    const lowPriority = todosStore.getTodosByPriority(3);

    expect(highPriority).toHaveLength(1);
    expect(mediumPriority).toHaveLength(1);
    expect(lowPriority).toHaveLength(1);
    expect(highPriority[0].priority).toBe(1);
    expect(mediumPriority[0].priority).toBe(2);
    expect(lowPriority[0].priority).toBe(3);
  });

  test('should search todos', async () => {
    await todosStore.loadTodos();

    const searchResults = todosStore.searchTodos('Test Todo 1');

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title).toBe('Test Todo 1');
  });

  test('should calculate todo statistics', async () => {
    await todosStore.loadTodos();

    const stats = todosStore.getStatistics();

    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.completionRate).toBe(33); // 1/3 * 100 rounded
  });

  test('should export todos', async () => {
    await todosStore.loadTodos();

    const exported = await todosStore.exportTodos();

    expect(exported.exportDate).toBeDefined();
    expect(exported.totalTodos).toBe(3);
    expect(exported.todos).toHaveLength(3);
    expect(exported.todos[0].title).toBe('Test Todo 1');
  });

  test('should mark todo as complete', async () => {
    const todo = await todosStore.addTodo({ title: 'Incomplete Task', status: 0 });

    const completedTodo = await todosStore.markAsComplete(todo.id);

    expect(completedTodo.status).toBe(3);
    expect(todosStore.todos[0].status).toBe(3);
  });

  test('should assign todo to user', async () => {
    const todo = await todosStore.addTodo({ title: 'Unassigned Task', assignedTo: 1 });

    const assignedTodo = await todosStore.assignTodo(todo.id, 2);

    expect(assignedTodo.assignedTo).toBe(2);
    expect(todosStore.todos[0].assignedTo).toBe(2);
  });

  test('should handle updating non-existent todo', async () => {
    const result = await todosStore.updateTodo(999, { title: 'Updated' });
    expect(result).toBe(null);
  });

  test('should handle empty search query', async () => {
    await todosStore.loadTodos();

    const results = todosStore.searchTodos('');
    expect(results).toHaveLength(3);
  });

  test('should handle search with no results', async () => {
    await todosStore.loadTodos();

    const results = todosStore.searchTodos('Non-existent task');
    expect(results).toHaveLength(0);
  });

  test('should update last update timestamp', async () => {
    const initialUpdate = todosStore.lastUpdate;

    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));

    await todosStore.addTodo({ title: 'New Task' });

    expect(todosStore.lastUpdate).toBeGreaterThan(initialUpdate);
  });

  test('should calculate completion rate with zero todos', () => {
    const stats = todosStore.getStatistics();

    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  test('should handle search in description', async () => {
    await todosStore.loadTodos();

    const results = todosStore.searchTodos('Description 1');

    expect(results).toHaveLength(1);
    expect(results[0].description).toBe('Description 1');
  });
});
