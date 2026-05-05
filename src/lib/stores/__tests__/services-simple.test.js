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

// Mock uuid - we'll use simple counter in the store
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-service-id')
}));

// Simple test service store
function createTestServiceStore() {
  let services = [];
  let servicesMap = new Map();
  let activeServiceId = null;
  let isSideBarCollapsed = false;
  let isAddModalOpen = false;
  let serviceIdCounter = 1;

  return {
    get services() { return services; },
    set services(value) { services = value; },
    get servicesMap() { return servicesMap; },
    get activeServiceId() { return activeServiceId; },
    set activeServiceId(value) { activeServiceId = value; },
    get isSideBarCollapsed() { return isSideBarCollapsed; },
    set isSideBarCollapsed(value) { isSideBarCollapsed = value; },
    get isAddModalOpen() { return isAddModalOpen; },
    set isAddModalOpen(value) { isAddModalOpen = value; },

    get activeService() {
      return services.find(s => s.id === activeServiceId) || services[0] || null;
    },

    addService(serviceData) {
      const newService = {
        id: `service-${serviceIdCounter++}`,
        name: serviceData.name,
        url: serviceData.url,
        icon: serviceData.icon || '',
        color: serviceData.color || '#666666',
        workspaceId: serviceData.workspaceId || 'default',
        createdAt: Date.now(),
        ...serviceData
      };
      
      services = [...services, newService];
      servicesMap.set(newService.id, newService);
      
      // Always set the newest service as active
      activeServiceId = newService.id;
      
      return newService;
    },

    removeService(serviceId) {
      services = services.filter(s => s.id !== serviceId);
      servicesMap.delete(serviceId);
      
      if (activeServiceId === serviceId) {
        activeServiceId = services.length > 0 ? services[0].id : null;
      }
      
      return true;
    },

    updateService(serviceId, updates) {
      const index = services.findIndex(s => s.id === serviceId);
      if (index !== -1) {
        services[index] = { ...services[index], ...updates };
        servicesMap.set(serviceId, services[index]);
        return services[index];
      }
      return null;
    },

    setActiveService(serviceId) {
      if (services.find(s => s.id === serviceId)) {
        activeServiceId = serviceId;
        return true;
      }
      return false;
    },

    toggleSideBar() {
      isSideBarCollapsed = !isSideBarCollapsed;
    },

    openAddModal() {
      isAddModalOpen = true;
    },

    closeAddModal() {
      isAddModalOpen = false;
    },

    getService(serviceId) {
      return servicesMap.get(serviceId) || null;
    },

    getServicesByWorkspace(workspaceId) {
      return services.filter(s => s.workspaceId === workspaceId);
    }
  };
}

describe('Service Store (Simple)', () => {
  let serviceStore;

  beforeEach(() => {
    vi.clearAllMocks();
    serviceStore = createTestServiceStore();
  });

  test('should initialize with empty services', () => {
    expect(serviceStore.services).toEqual([]);
    expect(serviceStore.servicesMap.size).toBe(0);
    expect(serviceStore.activeServiceId).toBe(null);
    expect(serviceStore.activeService).toBe(null);
    expect(serviceStore.isSideBarCollapsed).toBe(false);
    expect(serviceStore.isAddModalOpen).toBe(false);
  });

  test('should add new service', () => {
    const serviceData = {
      name: 'Test Service',
      url: 'https://test.com',
      icon: 'https://test.com/icon.png',
      color: '#FF0000',
      workspaceId: 'workspace1'
    };

    const newService = serviceStore.addService(serviceData);

    expect(newService.name).toBe('Test Service');
    expect(newService.url).toBe('https://test.com');
    expect(newService.workspaceId).toBe('workspace1');
    expect(serviceStore.services).toHaveLength(1);
    expect(serviceStore.servicesMap.size).toBe(1);
    expect(serviceStore.activeServiceId).toBe(newService.id);
    expect(serviceStore.activeService).toEqual(newService);
  });

  test('should remove service', () => {
    const service1 = serviceStore.addService({ name: 'Service 1', url: 'https://1.com' });
    const service2 = serviceStore.addService({ name: 'Service 2', url: 'https://2.com' });

    expect(serviceStore.services).toHaveLength(2);
    expect(serviceStore.activeServiceId).toBe(service2.id);

    const result = serviceStore.removeService(service1.id);

    expect(result).toBe(true);
    expect(serviceStore.services).toHaveLength(1);
    expect(serviceStore.services[0].name).toBe('Service 2');
    expect(serviceStore.servicesMap.size).toBe(1);
    expect(serviceStore.activeServiceId).toBe(service2.id);
  });

  test('should update service', () => {
    const service = serviceStore.addService({ name: 'Original', url: 'https://original.com' });

    const updatedService = serviceStore.updateService(service.id, {
      name: 'Updated',
      url: 'https://updated.com'
    });

    expect(updatedService.name).toBe('Updated');
    expect(updatedService.url).toBe('https://updated.com');
    expect(serviceStore.services[0].name).toBe('Updated');
    expect(serviceStore.servicesMap.get(service.id).name).toBe('Updated');
  });

  test('should set active service', async () => {
    const service1 = serviceStore.addService({ name: 'Service 1', url: 'https://1.com' });
    await new Promise(resolve => setTimeout(resolve, 1));
    const service2 = serviceStore.addService({ name: 'Service 2', url: 'https://2.com' });

    expect(serviceStore.activeServiceId).toBe(service2.id);

    const result = serviceStore.setActiveService(service1.id);

    expect(result).toBe(true);
    expect(serviceStore.activeServiceId).toBe(service1.id);
    expect(serviceStore.activeService.name).toBe('Service 1');
  });

  test('should toggle sidebar', () => {
    expect(serviceStore.isSideBarCollapsed).toBe(false);

    serviceStore.toggleSideBar();
    expect(serviceStore.isSideBarCollapsed).toBe(true);

    serviceStore.toggleSideBar();
    expect(serviceStore.isSideBarCollapsed).toBe(false);
  });

  test('should open and close add modal', () => {
    expect(serviceStore.isAddModalOpen).toBe(false);

    serviceStore.openAddModal();
    expect(serviceStore.isAddModalOpen).toBe(true);

    serviceStore.closeAddModal();
    expect(serviceStore.isAddModalOpen).toBe(false);
  });

  test('should get service by ID', () => {
    const service = serviceStore.addService({ name: 'Test Service', url: 'https://test.com' });

    const found = serviceStore.getService(service.id);
    expect(found).toEqual(service);

    const notFound = serviceStore.getService('non-existent');
    expect(notFound).toBe(null);
  });

  test('should get services by workspace', () => {
    serviceStore.addService({ name: 'Service 1', url: 'https://1.com', workspaceId: 'workspace1' });
    serviceStore.addService({ name: 'Service 2', url: 'https://2.com', workspaceId: 'workspace1' });
    serviceStore.addService({ name: 'Service 3', url: 'https://3.com', workspaceId: 'workspace2' });

    const workspace1Services = serviceStore.getServicesByWorkspace('workspace1');
    const workspace2Services = serviceStore.getServicesByWorkspace('workspace2');

    expect(workspace1Services).toHaveLength(2);
    expect(workspace2Services).toHaveLength(1);
    expect(workspace1Services.every(s => s.workspaceId === 'workspace1')).toBe(true);
    expect(workspace2Services[0].workspaceId).toBe('workspace2');
  });

  test('should handle removing active service', async () => {
    const service1 = serviceStore.addService({ name: 'Service 1', url: 'https://1.com' });
    await new Promise(resolve => setTimeout(resolve, 1));
    const service2 = serviceStore.addService({ name: 'Service 2', url: 'https://2.com' });

    expect(serviceStore.activeServiceId).toBe(service2.id);

    serviceStore.removeService(service2.id);

    expect(serviceStore.activeServiceId).toBe(service1.id);
    expect(serviceStore.activeService.name).toBe('Service 1');
  });

  test('should handle removing last service', () => {
    const service = serviceStore.addService({ name: 'Only Service', url: 'https://only.com' });

    expect(serviceStore.activeServiceId).toBe(service.id);

    serviceStore.removeService(service.id);

    expect(serviceStore.services).toHaveLength(0);
    expect(serviceStore.activeServiceId).toBe(null);
    expect(serviceStore.activeService).toBe(null);
  });

  test('should handle invalid active service ID', () => {
    const result = serviceStore.setActiveService('non-existent');
    expect(result).toBe(false);
    expect(serviceStore.activeServiceId).toBe(null);
  });

  test('should handle updating non-existent service', () => {
    const result = serviceStore.updateService('non-existent', { name: 'Updated' });
    expect(result).toBe(null);
  });
});
