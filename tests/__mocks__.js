// ============================================
// __mocks__.js - Test utilities for real @titanpl/core
// ============================================
//
// Uses the real @titanpl/core module (via @tgrv/microgravity)
// instead of mocking. Provides the same utility interface.
//
// ============================================

import { ls } from '@titanpl/core';

// ============================================
// Proxy to real ls storage
// ============================================

export const mockStorage = {
    get: (key) => ls.get(key),
    set: (key, val) => ls.set(key, val),
    has: (key) => ls.get(key) !== null,
    delete: (key) => ls.remove(key),
    clear: () => ls.clear(),
    keys: () => ls.keys(),
};

export const mockObjectStorage = {
    get: (key) => ls.getObject(key),
    set: (key, val) => ls.setObject(key, val),
    has: (key) => ls.getObject(key) !== undefined,
};

// ============================================
// Test Utilities
// ============================================

export function clearAllMocks() {
    ls.clear();
}

export function resetAllMocks() {
    clearAllMocks();
}

export function seedStorage(data) {
    for (const [key, value] of Object.entries(data)) {
        ls.set(key, value);
    }
}