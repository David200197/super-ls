// ============================================
// __mock__.js - Test utilities for @titanpl/core mock
// ============================================
//
// El mock real está en vitest.setup.js
// Este archivo exporta utilidades para acceder al storage en tests
//
// ============================================

// ============================================
// Accessors al storage interno del mock (via globalThis)
// ============================================

export const getMockStorage = () => globalThis.__titanMockStorage || new Map();
export const getMockObjectStorage = () => globalThis.__titanMockObjectStorage || new Map();
export const getMockClassRegistry = () => globalThis.__titanMockClassRegistry || new Map();

// ============================================
// Proxy objects para compatibilidad con API de Map
// ============================================

export const mockStorage = { 
    get: (key) => getMockStorage().get(key),
    set: (key, val) => getMockStorage().set(key, val),
    has: (key) => getMockStorage().has(key),
    delete: (key) => getMockStorage().delete(key),
    clear: () => getMockStorage().clear(),
    keys: () => getMockStorage().keys(),
    values: () => getMockStorage().values(),
    entries: () => getMockStorage().entries(),
    get size() { return getMockStorage().size; },
    forEach: (cb) => getMockStorage().forEach(cb),
};

export const mockObjectStorage = {
    get: (key) => getMockObjectStorage().get(key),
    set: (key, val) => getMockObjectStorage().set(key, val),
    has: (key) => getMockObjectStorage().has(key),
    delete: (key) => getMockObjectStorage().delete(key),
    clear: () => getMockObjectStorage().clear(),
    keys: () => getMockObjectStorage().keys(),
    values: () => getMockObjectStorage().values(),
    entries: () => getMockObjectStorage().entries(),
    get size() { return getMockObjectStorage().size; },
    forEach: (cb) => getMockObjectStorage().forEach(cb),
};

export const mockClassRegistry = {
    get: (key) => getMockClassRegistry().get(key),
    set: (key, val) => getMockClassRegistry().set(key, val),
    has: (key) => getMockClassRegistry().has(key),
    delete: (key) => getMockClassRegistry().delete(key),
    clear: () => getMockClassRegistry().clear(),
    keys: () => getMockClassRegistry().keys(),
    values: () => getMockClassRegistry().values(),
    entries: () => getMockClassRegistry().entries(),
    get size() { return getMockClassRegistry().size; },
    forEach: (cb) => getMockClassRegistry().forEach(cb),
};

// ============================================
// Test Utilities
// ============================================

export function clearAllMocks() {
    if (globalThis.__titanMockStorage) {
        globalThis.__titanMockStorage.clear();
    }
    if (globalThis.__titanMockObjectStorage) {
        globalThis.__titanMockObjectStorage.clear();
    }
    if (globalThis.__titanMockClassRegistry) {
        globalThis.__titanMockClassRegistry.clear();
    }
}

export function resetAllMocks() {
    clearAllMocks();
}

export function getMockState() {
    return {
        storage: getMockStorage(),
        objectStorage: getMockObjectStorage(),
        classRegistry: getMockClassRegistry()
    };
}

export function seedStorage(data) {
    const storage = getMockStorage();
    for (const [key, value] of Object.entries(data)) {
        storage.set(key, value);
    }
}

export function seedObjectStorage(data) {
    const storage = getMockObjectStorage();
    for (const [key, value] of Object.entries(data)) {
        storage.set(key, value);
    }
}