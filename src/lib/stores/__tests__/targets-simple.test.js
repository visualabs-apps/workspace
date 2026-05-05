import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Simple test targets store
function createTestTargetsStore() {
  let targets = [];
  let activeTargetId = null;
  let isLoading = false;
  let targetIdCounter = 1;

  return {
    get targets() { return targets; },
    set targets(value) { targets = value; },
    get activeTargetId() { return activeTargetId; },
    set activeTargetId(value) { activeTargetId = value; },
    get isLoading() { return isLoading; },
    set isLoading(value) { isLoading = value; },

    get activeTarget() {
      return targets.find(t => t.id === activeTargetId) || targets[0] || null;
    },

    addTarget(targetData) {
      const newTarget = {
        id: `target-${targetIdCounter++}`,
        name: targetData.name,
        url: targetData.url,
        description: targetData.description || '',
        tags: targetData.tags || [],
        category: targetData.category || 'General',
        priority: targetData.priority || 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...targetData
      };

      targets = [...targets, newTarget];
      
      // Always set the newest target as active
      activeTargetId = newTarget.id;

      return newTarget;
    },

    removeTarget(targetId) {
      targets = targets.filter(t => t.id !== targetId);
      
      if (activeTargetId === targetId) {
        activeTargetId = targets.length > 0 ? targets[0].id : null;
      }

      return true;
    },

    updateTarget(targetId, updates) {
      const index = targets.findIndex(t => t.id === targetId);
      if (index !== -1) {
        targets[index] = {
          ...targets[index],
          ...updates,
          updatedAt: Date.now()
        };
        return targets[index];
      }
      return null;
    },

    setActiveTarget(targetId) {
      if (targets.find(t => t.id === targetId)) {
        activeTargetId = targetId;
        return true;
      }
      return false;
    },

    getTarget(targetId) {
      return targets.find(t => t.id === targetId) || null;
    },

    getTargetsByCategory(category) {
      return targets.filter(t => t.category === category);
    },

    getTargetsByTag(tag) {
      return targets.filter(t => t.tags.includes(tag));
    },

    getTargetsByPriority(priority) {
      return targets.filter(t => t.priority === priority);
    },

    searchTargets(query) {
      if (!query) return targets;
      
      const lowerQuery = query.toLowerCase();
      return targets.filter(t => 
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.url.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    },

    getCategories() {
      return [...new Set(targets.map(t => t.category))];
    },

    getTags() {
      const allTags = targets.flatMap(t => t.tags);
      return [...new Set(allTags)];
    }
  };
}

describe('Targets Store (Simple)', () => {
  let targetsStore;

  beforeEach(() => {
    vi.clearAllMocks();
    targetsStore = createTestTargetsStore();
  });

  test('should initialize with empty targets', () => {
    expect(targetsStore.targets).toEqual([]);
    expect(targetsStore.activeTargetId).toBe(null);
    expect(targetsStore.activeTarget).toBe(null);
    expect(targetsStore.isLoading).toBe(false);
  });

  test('should add new target', () => {
    const targetData = {
      name: 'Test Target',
      url: 'https://example.com',
      description: 'Test description',
      tags: ['test', 'demo'],
      category: 'Testing',
      priority: 'high'
    };

    const newTarget = targetsStore.addTarget(targetData);

    expect(newTarget.name).toBe('Test Target');
    expect(newTarget.url).toBe('https://example.com');
    expect(newTarget.description).toBe('Test description');
    expect(newTarget.tags).toEqual(['test', 'demo']);
    expect(newTarget.category).toBe('Testing');
    expect(newTarget.priority).toBe('high');
    expect(newTarget.createdAt).toBeDefined();
    expect(newTarget.updatedAt).toBeDefined();

    expect(targetsStore.targets).toHaveLength(1);
    expect(targetsStore.activeTargetId).toBe(newTarget.id);
    expect(targetsStore.activeTarget).toEqual(newTarget);
  });

  test('should remove target', async () => {
    const target1 = targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com' });
    await new Promise(resolve => setTimeout(resolve, 1));
    const target2 = targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com' });

    expect(targetsStore.targets).toHaveLength(2);
    expect(targetsStore.activeTargetId).toBe(target2.id);

    const result = targetsStore.removeTarget(target1.id);

    expect(result).toBe(true);
    expect(targetsStore.targets).toHaveLength(1);
    expect(targetsStore.targets[0].name).toBe('Target 2');
    expect(targetsStore.activeTargetId).toBe(target2.id);
  });

  test('should update target', async () => {
    const target = targetsStore.addTarget({ name: 'Original', url: 'https://original.com' });
    await new Promise(resolve => setTimeout(resolve, 1));

    const updatedTarget = targetsStore.updateTarget(target.id, {
      name: 'Updated',
      description: 'New description',
      priority: 'low'
    });

    expect(updatedTarget.name).toBe('Updated');
    expect(updatedTarget.description).toBe('New description');
    expect(updatedTarget.priority).toBe('low');
    expect(updatedTarget.updatedAt).toBeGreaterThanOrEqual(target.updatedAt);
    expect(targetsStore.targets[0].name).toBe('Updated');
  });

  test('should set active target', async () => {
    const target1 = targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com' });
    await new Promise(resolve => setTimeout(resolve, 1));
    const target2 = targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com' });

    expect(targetsStore.activeTargetId).toBe(target2.id);

    const result = targetsStore.setActiveTarget(target1.id);

    expect(result).toBe(true);
    expect(targetsStore.activeTargetId).toBe(target1.id);
    expect(targetsStore.activeTarget.name).toBe('Target 1');
  });

  test('should get target by ID', () => {
    const target = targetsStore.addTarget({ name: 'Test Target', url: 'https://test.com' });

    const found = targetsStore.getTarget(target.id);
    expect(found).toEqual(target);

    const notFound = targetsStore.getTarget('non-existent');
    expect(notFound).toBe(null);
  });

  test('should get targets by category', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com', category: 'Work' });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com', category: 'Work' });
    targetsStore.addTarget({ name: 'Target 3', url: 'https://3.com', category: 'Personal' });

    const workTargets = targetsStore.getTargetsByCategory('Work');
    const personalTargets = targetsStore.getTargetsByCategory('Personal');

    expect(workTargets).toHaveLength(2);
    expect(personalTargets).toHaveLength(1);
    expect(workTargets.every(t => t.category === 'Work')).toBe(true);
    expect(personalTargets[0].category).toBe('Personal');
  });

  test('should get targets by tag', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com', tags: ['important', 'work'] });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com', tags: ['important'] });
    targetsStore.addTarget({ name: 'Target 3', url: 'https://3.com', tags: ['personal'] });

    const importantTargets = targetsStore.getTargetsByTag('important');
    const workTargets = targetsStore.getTargetsByTag('work');

    expect(importantTargets).toHaveLength(2);
    expect(workTargets).toHaveLength(1);
    expect(importantTargets.every(t => t.tags.includes('important'))).toBe(true);
    expect(workTargets[0].tags).toContain('work');
  });

  test('should get targets by priority', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com', priority: 'high' });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com', priority: 'high' });
    targetsStore.addTarget({ name: 'Target 3', url: 'https://3.com', priority: 'low' });

    const highTargets = targetsStore.getTargetsByPriority('high');
    const lowTargets = targetsStore.getTargetsByPriority('low');

    expect(highTargets).toHaveLength(2);
    expect(lowTargets).toHaveLength(1);
    expect(highTargets.every(t => t.priority === 'high')).toBe(true);
    expect(lowTargets[0].priority).toBe('low');
  });

  test('should search targets', () => {
    targetsStore.addTarget({ 
      name: 'Google Search', 
      url: 'https://google.com', 
      description: 'Search engine',
      tags: ['search', 'web']
    });
    targetsStore.addTarget({ 
      name: 'Facebook', 
      url: 'https://facebook.com', 
      description: 'Social network',
      tags: ['social']
    });
    targetsStore.addTarget({ 
      name: 'GitHub', 
      url: 'https://github.com', 
      description: 'Code repository',
      tags: ['code', 'development']
    });

    const searchResults = targetsStore.searchTargets('google');
    const tagResults = targetsStore.searchTargets('code');
    const descResults = targetsStore.searchTargets('social');

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].name).toBe('Google Search');

    expect(tagResults).toHaveLength(1);
    expect(tagResults[0].name).toBe('GitHub');

    expect(descResults).toHaveLength(1);
    expect(descResults[0].name).toBe('Facebook');
  });

  test('should get categories', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com', category: 'Work' });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com', category: 'Personal' });
    targetsStore.addTarget({ name: 'Target 3', url: 'https://3.com', category: 'Work' });

    const categories = targetsStore.getCategories();

    expect(categories).toHaveLength(2);
    expect(categories).toContain('Work');
    expect(categories).toContain('Personal');
  });

  test('should get tags', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com', tags: ['work', 'important'] });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com', tags: ['personal', 'important'] });
    targetsStore.addTarget({ name: 'Target 3', url: 'https://3.com', tags: ['work'] });

    const tags = targetsStore.getTags();

    expect(tags).toHaveLength(3);
    expect(tags).toContain('work');
    expect(tags).toContain('important');
    expect(tags).toContain('personal');
  });

  test('should handle removing active target', async () => {
    const target1 = targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com' });
    await new Promise(resolve => setTimeout(resolve, 1));
    const target2 = targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com' });

    expect(targetsStore.activeTargetId).toBe(target2.id);

    targetsStore.removeTarget(target2.id);

    expect(targetsStore.activeTargetId).toBe(target1.id);
    expect(targetsStore.activeTarget.name).toBe('Target 1');
  });

  test('should handle removing last target', () => {
    const target = targetsStore.addTarget({ name: 'Only Target', url: 'https://only.com' });

    expect(targetsStore.activeTargetId).toBe(target.id);

    targetsStore.removeTarget(target.id);

    expect(targetsStore.targets).toHaveLength(0);
    expect(targetsStore.activeTargetId).toBe(null);
    expect(targetsStore.activeTarget).toBe(null);
  });

  test('should handle invalid active target ID', () => {
    const result = targetsStore.setActiveTarget('non-existent');
    expect(result).toBe(false);
    expect(targetsStore.activeTargetId).toBe(null);
  });

  test('should handle updating non-existent target', () => {
    const result = targetsStore.updateTarget('non-existent', { name: 'Updated' });
    expect(result).toBe(null);
  });

  test('should handle empty search query', () => {
    targetsStore.addTarget({ name: 'Target 1', url: 'https://1.com' });
    targetsStore.addTarget({ name: 'Target 2', url: 'https://2.com' });

    const results = targetsStore.searchTargets('');
    expect(results).toHaveLength(2);
  });
});
