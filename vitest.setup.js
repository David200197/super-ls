// ============================================
// vitest.setup.js - Mock completo de @titanpl/core
// ============================================

import { vi, beforeEach } from 'vitest';

// ============================================
// Mock storage (exportado para los tests)
// ============================================

export const mockStorage = new Map();
export const mockObjectStorage = new Map();
export const mockClassRegistry = new Map();

// ============================================
// Utilidades de test
// ============================================

export function clearAllMocks() {
    mockStorage.clear();
    mockObjectStorage.clear();
    mockClassRegistry.clear();
}

// ============================================
// Mock de @titanpl/core
// ============================================

vi.mock('@titanpl/core', () => {
    // Storage interno (referencias a los exports del setup)
    const _mockStorage = new Map();
    const _mockObjectStorage = new Map();
    const _mockClassRegistry = new Map();

    // Sincronizar con los exports del setup
    globalThis.__titanMockStorage = _mockStorage;
    globalThis.__titanMockObjectStorage = _mockObjectStorage;
    globalThis.__titanMockClassRegistry = _mockClassRegistry;

    // ============================================
    // Serialization
    // ============================================

    function getRegisteredTypeName(val) {
        for (const [typeName, entry] of _mockClassRegistry.entries()) {
            if (val instanceof entry.Constructor) {
                return typeName;
            }
        }
        return null;
    }

    function mockSerialize(value) {
        const seen = new WeakMap();
        let refIndex = 0;

        function process(val) {
            if (val === null) return { __type: 'null' };
            if (val === undefined) return { __type: 'undefined' };
            
            if (typeof val === 'function') {
                throw new Error('Function cannot be serialized');
            }
            
            if (typeof val === 'number') {
                if (Number.isNaN(val)) return { __type: 'NaN' };
                if (val === Infinity) return { __type: 'Infinity' };
                if (val === -Infinity) return { __type: '-Infinity' };
                return val;
            }
            if (typeof val === 'string') return val;
            if (typeof val === 'boolean') return val;
            if (typeof val === 'bigint') return { __type: 'BigInt', value: val.toString() };

            if (typeof val === 'object') {
                if (seen.has(val)) {
                    return { __type: 'ref', index: seen.get(val) };
                }

                const idx = refIndex++;
                seen.set(val, idx);

                const typeName = getRegisteredTypeName(val);
                if (typeName) {
                    const wrapper = {
                        __type: 'RegisteredClass',
                        __super_type__: typeName,
                        __data__: {},
                        __refIdx: idx
                    };
                    for (const key of Object.keys(val)) {
                        wrapper.__data__[key] = process(val[key]);
                    }
                    return wrapper;
                }

                if (val instanceof Date) {
                    return { __type: 'Date', value: val.toISOString() };
                }
                if (val instanceof RegExp) {
                    return { __type: 'RegExp', source: val.source, flags: val.flags };
                }
                if (val instanceof Map) {
                    const entries = [];
                    for (const [k, v] of val.entries()) {
                        entries.push([process(k), process(v)]);
                    }
                    return { __type: 'Map', entries, __refIdx: idx };
                }
                if (val instanceof Set) {
                    const values = [];
                    for (const v of val) {
                        values.push(process(v));
                    }
                    return { __type: 'Set', values, __refIdx: idx };
                }
                if (ArrayBuffer.isView(val)) {
                    return { 
                        __type: 'TypedArray', 
                        arrayType: val.constructor.name,
                        data: Array.from(val)
                    };
                }
                if (Array.isArray(val)) {
                    const arr = [];
                    for (let i = 0; i < val.length; i++) {
                        if (i in val) {
                            arr.push(process(val[i]));
                        } else {
                            arr.push({ __type: 'hole' });
                        }
                    }
                    return { __type: 'Array', values: arr, __refIdx: idx };
                }

                const obj = { __type: 'Object', props: {}, __refIdx: idx };
                for (const key of Object.keys(val)) {
                    obj.props[key] = process(val[key]);
                }
                return obj;
            }

            return val;
        }

        const processed = process(value);
        return new TextEncoder().encode(JSON.stringify(processed));
    }

    function mockDeserialize(bytes) {
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        const refs = new Map();

        function restore(val) {
            if (val === null || typeof val !== 'object') return val;

            if (val.__type === 'null') return null;
            if (val.__type === 'undefined') return undefined;
            if (val.__type === 'NaN') return NaN;
            if (val.__type === 'Infinity') return Infinity;
            if (val.__type === '-Infinity') return -Infinity;
            if (val.__type === 'BigInt') return BigInt(val.value);
            if (val.__type === 'Date') return new Date(val.value);
            if (val.__type === 'RegExp') return new RegExp(val.source, val.flags);
            if (val.__type === 'ref') return refs.get(val.index);
            if (val.__type === 'hole') return undefined;

            if (val.__type === 'RegisteredClass') {
                const wrapper = { __super_type__: val.__super_type__, __data__: {} };
                if (val.__refIdx !== undefined) refs.set(val.__refIdx, wrapper);
                for (const key of Object.keys(val.__data__)) {
                    wrapper.__data__[key] = restore(val.__data__[key]);
                }
                return wrapper;
            }

            if (val.__type === 'TypedArray') {
                return new globalThis[val.arrayType](val.data);
            }

            if (val.__type === 'Map') {
                const map = new Map();
                if (val.__refIdx !== undefined) refs.set(val.__refIdx, map);
                for (const [k, v] of val.entries) {
                    map.set(restore(k), restore(v));
                }
                return map;
            }

            if (val.__type === 'Set') {
                const set = new Set();
                if (val.__refIdx !== undefined) refs.set(val.__refIdx, set);
                for (const v of val.values) {
                    set.add(restore(v));
                }
                return set;
            }

            if (val.__type === 'Array') {
                const arr = [];
                if (val.__refIdx !== undefined) refs.set(val.__refIdx, arr);
                for (let i = 0; i < val.values.length; i++) {
                    if (val.values[i]?.__type !== 'hole') {
                        arr[i] = restore(val.values[i]);
                    }
                }
                return arr;
            }

            if (val.__type === 'Object') {
                const obj = {};
                if (val.__refIdx !== undefined) refs.set(val.__refIdx, obj);
                for (const key of Object.keys(val.props)) {
                    obj[key] = restore(val.props[key]);
                }
                return obj;
            }

            return val;
        }

        return restore(parsed);
    }

    // ============================================
    // Buffer
    // ============================================

    const buffer = {
        toBase64(bytes) {
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(bytes).toString('base64');
            }
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        },

        fromBase64(str) {
            if (typeof Buffer !== 'undefined') {
                return new Uint8Array(Buffer.from(str, 'base64'));
            }
            const binary = atob(str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        },

        fromUtf8: (str) => new TextEncoder().encode(str),
        toUtf8: (bytes) => new TextDecoder().decode(bytes),

        toHex: (bytes) => 
            Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''),

        fromHex(str) {
            const bytes = new Uint8Array(str.length / 2);
            for (let i = 0; i < str.length; i += 2) {
                bytes[i / 2] = parseInt(str.substr(i, 2), 16);
            }
            return bytes;
        }
    };

    // ============================================
    // ls
    // ============================================

    const ls = {
        set: (key, value) => _mockStorage.set(key, value),
        get: (key) => _mockStorage.get(key) ?? null,
        remove: (key) => _mockStorage.delete(key),
        clear: () => _mockStorage.clear(),
        keys: () => Array.from(_mockStorage.keys()),

        serialize: mockSerialize,
        deserialize: mockDeserialize,

        register: (ClassRef, hydrateFn = null, typeName = null) => {
            const name = typeName || ClassRef.name;
            _mockClassRegistry.set(name, { Constructor: ClassRef, hydrate: hydrateFn });
        },

        hydrate: (typeName, data) => {
            const entry = _mockClassRegistry.get(typeName);
            if (!entry) throw new Error(`Class "${typeName}" not registered`);

            const { Constructor, hydrate } = entry;
            if (typeof hydrate === 'function') return hydrate(data);
            if (typeof Constructor.hydrate === 'function') return Constructor.hydrate(data);

            const instance = new Constructor();
            Object.assign(instance, data);
            return instance;
        },

        setObject: (key, value) => _mockObjectStorage.set(key, value),
        getObject: (key) => _mockObjectStorage.get(key)
    };

    // ============================================
    // core
    // ============================================

    const core = { buffer };

    // ============================================
    // log
    // ============================================

    const log = (...args) => console.log(...args);

    // ============================================
    // t object
    // ============================================

    const t = { ls, core, log };
    globalThis.t = t;

    // ============================================
    // Return module
    // ============================================

    return {
        default: t,
        t,
        ls,
        core,
        log
    };
});

// ============================================
// Limpiar mocks antes de cada test
// ============================================

beforeEach(() => {
    // Limpiar el storage interno del mock
    if (globalThis.__titanMockStorage) {
        globalThis.__titanMockStorage.clear();
    }
    if (globalThis.__titanMockObjectStorage) {
        globalThis.__titanMockObjectStorage.clear();
    }
    if (globalThis.__titanMockClassRegistry) {
        globalThis.__titanMockClassRegistry.clear();
    }
});