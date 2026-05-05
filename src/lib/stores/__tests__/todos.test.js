import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTestTodoStore } from './test-stores.js';

describe('Todo Store', () => {
  let todoStore;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh store instance
    todoStore = createTestTodoStore();
  });

  test('should initialize with empty todos', () => {
    expect(todoStore.todos).toEqual([]);
    expect(todoStore.isLoading).toBe(false);
    expect(todoStore.lastUpdate).toBeDefined();
    expect(todoStore.activeTodos).toEqual([]);
    expect(todoStore.completedTodos).toEqual([]);
  });

  test('should load todos from backend', async () => {
    await todoStore.loadTodos();

    expect(todoStore.todos).toHaveLength(3);
    expect(todoStore.todos[0].title).toBe('Task 1');
    expect(todoStore.isLoading).toBe(false);
  });

  test('should add new todo', async () => {
    const newTodo = {
      title: 'New Task',
      description: 'Task description',
      priority: 1,
      dueDate: '2024-12-31'
    };

    const result = await todoStore.addTodo(newTodo);

    expect(result.title).toBe('New Task');
    expect(result.description).toBe('Task description');
    expect(result.status).toBe(0);
    expect(todoStore.todos).toHaveLength(1);
  });

  test('should update todo', async () => {
    // First add a todo
    const todo = await todoStore.addTodo({ title: 'Original Task' });
    
    const updates = {
      title: 'Updated Task',
      status: 1,
      priority: 2
    };

    const result = await todoStore.updateTodo(todo.id, updates);

    expect(result.title).toBe('Updated Task');
    expect(result.status).toBe(1);
    expect(result.priority).toBe(2);
  });

  test('should delete todo', async () => {
    // First add a todo
    const todo = await todoStore.addTodo({ title: 'Task to Delete' });
    
    const result = await todoStore.deleteTodo(todo.id);

    expect(result).toBe(true);
    expect(todoStore.todos).toHaveLength(0);
  });

  test('should mark todo as complete', async () => {
    // First add a todo
    const todo = await todoStore.addTodo({ title: 'Task to Complete' });
    
    const result = await todoStore.markAsComplete(todo.id);

    expect(result.status).toBe(3);
    expect(todoStore.completedTodos).toHaveLength(1);
  });

  test('should filter active todos', () => {
    todoStore.todos = [
      { id: 1, title: 'Task 1', status: 0 }, // Not Started
      { id: 2, title: 'Task 2', status: 1 }, // In Progress
      { id: 3, title: 'Task 3', status: 2 }, // On Hold
      { id: 4, title: 'Task 4', status: 3 }  // Completed
    ];

    const activeTodos = todoStore.activeTodos;

    expect(activeTodos).toHaveLength(3);
    expect(activeTodos.map(t => t.id)).toEqual([1, 2, 3]);
  });

  test('should filter completed todos', () => {
    todoStore.todos = [
      { id: 1, title: 'Task 1', status: 0 },
      { id: 2, title: 'Task 2', status: 3 },
      { id: 3, title: 'Task 3', status: 3 }
    ];

    const completedTodos = todoStore.completedTodos;

    expect(completedTodos).toHaveLength(2);
    expect(completedTodos.map(t => t.id)).toEqual([2, 3]);
  });

  test('should filter todos by status', () => {
    todoStore.todos = [
      { id: 1, title: 'Task 1', status: 0 },
      { id: 2, title: 'Task 2', status: 1 },
      { id: 3, title: 'Task 3', status: 2 },
      { id: 4, title: 'Task 4', status: 3 }
    ];

    const notStarted = todoStore.getTodosByStatus(0);
    const inProgress = todoStore.getTodosByStatus(1);
    const onHold = todoStore.getTodosByStatus(2);
    const completed = todoStore.getTodosByStatus(3);

    expect(notStarted).toHaveLength(1);
    expect(inProgress).toHaveLength(1);
    expect(onHold).toHaveLength(1);
    expect(completed).toHaveLength(1);
  });

  test('should filter todos by priority', () => {
    todoStore.todos = [
      { id: 1, title: 'Task 1', priority: 1 },
      { id: 2, title: 'Task 2', priority: 2 },
      { id: 3, title: 'Task 3', priority: 1 },
      { id: 4, title: 'Task 4', priority: 3 }
    ];

    const highPriority = todoStore.getTodosByPriority(1);
    const mediumPriority = todoStore.getTodosByPriority(2);
    const lowPriority = todoStore.getTodosByPriority(3);

    expect(highPriority).toHaveLength(2);
    expect(mediumPriority).toHaveLength(1);
    expect(lowPriority).toHaveLength(1);
  });

  test('should search todos', () => {
    todoStore.todos = [
      { id: 1, title: 'Complete project', description: 'Finish the web project' },
      { id: 2, title: 'Review code', description: 'Review pull requests' },
      { id: 3, title: 'Write documentation', description: 'Update API docs' }
    ];

    const searchResults = todoStore.searchTodos('project');

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].id).toBe(1);
  });

  test('should calculate todo statistics', () => {
    todoStore.todos = [
      { id: 1, status: 0, priority: 1 },
      { id: 2, status: 1, priority: 2 },
      { id: 3, status: 3, priority: 1 },
      { id: 4, status: 3, priority: 3 },
      { id: 5, status: 2, priority: 1 }
    ];

    const stats = todoStore.getStatistics();

    expect(stats.total).toBe(5);
    expect(stats.active).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.completionRate).toBe(40); // 2/5 * 100
  });

  test('should handle error conditions gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Test with a store that has no todos (simulating error condition)
    todoStore.todos = [];
    
    await todoStore.loadTodos();

    // Should still complete without errors
    expect(todoStore.isLoading).toBe(false);
    expect(todoStore.todos).toBeDefined();
    
    consoleSpy.mockRestore();
  });

  test('should export todos', async () => {
    // Add some todos first
    await todoStore.addTodo({ title: 'Task 1', status: 0 });
    await todoStore.addTodo({ title: 'Task 2', status: 1 });

    const exported = await todoStore.exportTodos();

    expect(exported).toHaveLength(2);
    expect(exported[0].title).toBe('Task 2'); // Most recent first
  });

  test('should assign todo to user', async () => {
    // First add a todo
    const todo = await todoStore.addTodo({ title: 'Task to Assign' });
    
    const result = await todoStore.assignTodo(todo.id, 2);

    expect(result.assignedTo).toBe(2);
  });
});
