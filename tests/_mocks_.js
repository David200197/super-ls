// ============================================
// MOCK for Titan Planet's t.ls and t.core APIs
// ============================================

// Persistent storage (simulates Sled DB)
const mockStorage = new Map();

// In-memory storage (simulates V8 thread-local storage)
const mockObjectStorage = new Map();

// Native class registry (simulates t.ls.register)
const mockClassRegistry = new Map();

// ============================================
// V8 Serialization Mock
// ============================================

/**
 * Check if value is an instance of a registered class
 * Returns the type name if found, null otherwise
 */
function getRegisteredTypeName(val) {
    for (const [typeName, entry] of mockClassRegistry.entries()) {
        if (val instanceof entry.Constructor) {
            return typeName;
        }
    }
    return null;
}

/**
 * Mock V8 ValueSerializer
 * In real Titan, this uses native V8 serialization.
 * For testing, we use a combination of JSON + type markers.
 */
function mockSerialize(value) {
    const seen = new WeakMap();
    let refIndex = 0;

    function process(val) {
        if (val === null) return { __type: 'null' };
        if (val === undefined) return { __type: 'undefined' };
        
        // Functions are not serializable - V8 throws
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

            // Check for registered class instances FIRST (before other checks)
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
                const typeName = val.constructor.name;
                return { 
                    __type: 'TypedArray', 
                    arrayType: typeName,
                    data: Array.from(val)
                };
            }
            if (Array.isArray(val)) {
                // Fix: Use for loop to properly detect holes
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

            // Plain object
            const obj = { __type: 'Object', props: {}, __refIdx: idx };
            for (const key of Object.keys(val)) {
                obj.props[key] = process(val[key]);
            }
            return obj;
        }

        return val;
    }

    const processed = process(value);
    const json = JSON.stringify(processed);
    return new TextEncoder().encode(json);
}

/**
 * Mock V8 ValueDeserializer
 */
function mockDeserialize(bytes) {
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
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

        // Registered class - restore as wrapper object for SuperLocalStorage to rehydrate
        if (val.__type === 'RegisteredClass') {
            const wrapper = {
                __super_type__: val.__super_type__,
                __data__: {}
            };
            if (val.__refIdx !== undefined) refs.set(val.__refIdx, wrapper);
            for (const key of Object.keys(val.__data__)) {
                wrapper.__data__[key] = restore(val.__data__[key]);
            }
            return wrapper;
        }

        if (val.__type === 'TypedArray') {
            const TypedArrayConstructor = globalThis[val.arrayType];
            return new TypedArrayConstructor(val.data);
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
                if (val.values[i]?.__type === 'hole') {
                    // Sparse array hole - leave as empty slot
                } else {
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
// Buffer Utilities Mock
// ============================================

const mockBuffer = {
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

    fromUtf8(str) {
        return new TextEncoder().encode(str);
    },

    toUtf8(bytes) {
        return new TextDecoder().decode(bytes);
    },

    toHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    fromHex(str) {
        const bytes = new Uint8Array(str.length / 2);
        for (let i = 0; i < str.length; i += 2) {
            bytes[i / 2] = parseInt(str.substr(i, 2), 16);
        }
        return bytes;
    }
};

// ============================================
// Main Mock Object
// ============================================

globalThis.t = {
    ls: {
        set(key, value) { 
            mockStorage.set(key, value); 
        },
        get(key) { 
            return mockStorage.get(key) || null; 
        },
        remove(key) { 
            mockStorage.delete(key); 
        },
        clear() { 
            mockStorage.clear(); 
        },
        keys() {
            return Array.from(mockStorage.keys());
        },

        serialize(value) {
            return mockSerialize(value);
        },
        deserialize(bytes) {
            return mockDeserialize(bytes);
        },

        register(ClassRef, hydrateFn = null, typeName = null) {
            const name = typeName || ClassRef.name;
            mockClassRegistry.set(name, { Constructor: ClassRef, hydrate: hydrateFn });
        },

        hydrate(typeName, data) {
            const entry = mockClassRegistry.get(typeName);
            if (!entry) {
                throw new Error(`Class "${typeName}" not registered`);
            }

            const { Constructor, hydrate } = entry;

            if (typeof hydrate === 'function') {
                return hydrate(data);
            }

            if (typeof Constructor.hydrate === 'function') {
                return Constructor.hydrate(data);
            }

            const instance = new Constructor();
            Object.assign(instance, data);
            return instance;
        },

        setObject(key, value) {
            mockObjectStorage.set(key, value);
        },
        getObject(key) {
            return mockObjectStorage.get(key);
        }
    },

    core: {
        buffer: mockBuffer
    },

    log(...args) {
        console.log(...args);
    }
};

// ============================================
// Test Utilities
// ============================================

function clearAllMocks() {
    mockStorage.clear();
    mockObjectStorage.clear();
    mockClassRegistry.clear();
}

function getMockState() {
    return {
        storage: mockStorage,
        objectStorage: mockObjectStorage,
        classRegistry: mockClassRegistry
    };
}

// ============================================
// Exports
// ============================================

export { 
    mockStorage, 
    mockObjectStorage, 
    mockClassRegistry,
    mockBuffer,
    mockSerialize,
    mockDeserialize,
    clearAllMocks,
    getMockState
};