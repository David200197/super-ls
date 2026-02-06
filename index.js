import { registerExtension } from "./utils/registerExtension.js";

/**
 * @fileoverview SuperLocalStorage - Enhanced localStorage wrapper for Titan Planet
 * that supports complex JavaScript types including Map, Set, Date, circular references,
 * and custom class instances with automatic serialization/deserialization.
 * 
 * Uses native V8 serialization via titan/core for maximum performance.
 * 
 * @author Titan Planet
 * @license MIT
 */

// ============================================================================
// Constants
// ============================================================================

/** @constant {string} Default prefix for all storage keys */
const DEFAULT_PREFIX = '__sls__';

/** @constant {string} Metadata key for identifying serialized class type */
const TYPE_MARKER = '__super_type__';

/** @constant {string} Metadata key for serialized class data */
const DATA_MARKER = '__data__';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * @typedef {Object} SerializedClassWrapper
 * @property {string} __super_type__ - The registered type name of the class
 * @property {Object} __data__ - The serialized properties of the class instance
 */

/**
 * @typedef {new (...args: any[]) => any} ClassConstructor
 * A class constructor function
 */

/**
 * @typedef {function(Object): any} HydrateFunction
 * A function that creates a class instance from serialized data
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {ClassConstructor} Constructor - The class constructor
 * @property {HydrateFunction|null} hydrate - Optional hydrate function
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a value is a primitive (non-object) type
 * @param {any} value - Value to check
 * @returns {boolean} True if value is null, undefined, or a primitive
 */
const isPrimitive = (value) => value === null || typeof value !== 'object';

/**
 * Checks if a serialized object contains class type metadata
 * @param {any} value - Value to check
 * @returns {boolean} True if value has type wrapper markers
 */
const hasTypeWrapper = (value) =>
    value && typeof value === 'object' && value[TYPE_MARKER] && value[DATA_MARKER] !== undefined;

// ============================================================================
// Main Class
// ============================================================================

/**
 * Enhanced localStorage wrapper that supports complex JavaScript types
 * and custom class serialization/deserialization.
 * 
 * Now powered by native V8 serialization for maximum performance.
 * 
 * @class SuperLocalStorage
 * 
 * @example
 * // Basic usage with rich types
 * import superLs from 'super-ls';
 * 
 * const settings = new Map([['theme', 'dark'], ['lang', 'es']]);
 * superLs.set('user_settings', settings);
 * 
 * const recovered = superLs.get('user_settings');
 * t.log(recovered.get('theme')); // 'dark'
 * 
 * @example
 * // Usage with custom classes and hydrate function
 * class Player {
 *     constructor(name, score) {
 *         this.name = name;
 *         this.score = score;
 *     }
 *     addScore(points) {
 *         this.score += points;
 *     }
 * }
 * 
 * superLs.register(Player, (data) => new Player(data.name, data.score));
 * superLs.set('player', new Player('Alice', 100));
 * 
 * const player = superLs.get('player');
 * player.addScore(50); // Methods work!
 * 
 * @example
 * // Temporary in-memory storage (current V8 thread only)
 * superLs.setTemp('cache', expensiveComputation());
 * const cached = superLs.getTemp('cache'); // Fast retrieval, same thread
 */
export class SuperLocalStorage {
    /**
     * Creates a new SuperLocalStorage instance
     * @param {string} [prefix='__sls__'] - Prefix for all storage keys
     */
    constructor(prefix = DEFAULT_PREFIX) {
        /** 
         * Registry mapping type names to class constructors and hydrate functions
         * @type {Map<string, RegistryEntry>}
         * @private
         */
        this.registry = new Map();

        /**
         * Prefix prepended to all storage keys
         * @type {string}
         * @private
         */
        this.prefix = prefix;
    }

    // ========================================================================
    // Public API - Core Storage
    // ========================================================================

    /**
     * Registers a class for serialization/deserialization support.
     * 
     * Once registered, instances of this class can be stored and retrieved
     * with their methods intact. Uses nativet.ls.register() for optimal performance.
     * 
     * @param {ClassConstructor} ClassRef - The class constructor to register
     * @param {HydrateFunction|string} [hydrateOrTypeName=null] - Hydrate function or custom type name
     * @param {string} [typeName=null] - Custom type name when hydrate function is provided
     * @throws {Error} If ClassRef is not a function/class
     * 
     * @example
     * // Basic registration (uses default constructor + Object.assign)
     * superLs.register(Player);
     * 
     * @example
     * // Registration with hydrate function
     * superLs.register(Player, (data) => new Player(data.name, data.score));
     * 
     * @example
     * // Registration with hydrate function and custom type name
     * superLs.register(Player, (data) => new Player(data.name, data.score), 'GamePlayer');
     * 
     * @example
     * // Registration with only custom type name
     * superLs.register(Player, 'GamePlayer');
     */
    register(ClassRef, hydrateOrTypeName = null, typeName = null) {
        if (typeof ClassRef !== 'function') {
            throw new Error('Invalid class: expected a constructor function');
        }

        let hydrate = null;
        let finalTypeName = null;

        if (typeof hydrateOrTypeName === 'function') {
            hydrate = hydrateOrTypeName;
            finalTypeName = typeName || ClassRef.name;
        } else if (typeof hydrateOrTypeName === 'string') {
            finalTypeName = hydrateOrTypeName;
        } else {
            finalTypeName = ClassRef.name;
        }

        // Store locally for class detection during serialization
        this.registry.set(finalTypeName, {
            Constructor: ClassRef,
            hydrate
        });

        // Delegate to nativet.ls.register() for hydration support
        t.ls.register(ClassRef, hydrate, finalTypeName);
    }

    /**
     * Stores a value in localStorage with full type preservation.
     * 
     * Uses native V8 serialization for optimal performance.
     * Supports: primitives, objects, arrays, Map, Set, Date, RegExp,
     * TypedArrays, BigInt, circular references, undefined, NaN, Infinity,
     * and registered class instances.
     * 
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * 
     * @example
     * // Store various types
     * superLs.set('map', new Map([['key', 'value']]));
     * superLs.set('set', new Set([1, 2, 3]));
     * superLs.set('date', new Date());
     * superLs.set('bigint', BigInt('9007199254740991000'));
     * 
     * @example
     * // Store circular references
     * const obj = { name: 'circular' };
     * obj.self = obj;
     * superLs.set('circular', obj);
     */
    set(key, value) {
        const payload = this._toSerializable(value);
        const bytes = t.ls.serialize(payload);
        const base64 = t.bugger.toBase64(bytes);
        t.ls.set(this.prefix + key, base64);
    }

    /**
     * Retrieves a value from localStorage with full type restoration.
     * 
     * All types are automatically restored to their original form,
     * including registered class instances with working methods.
     * 
     * @template T
     * @param {string} key - Storage key
     * @returns {T|null} The stored value with types restored, or null if key doesn't exist
     * 
     * @example
     * const settings = superLs.get('user_settings');
     * if (settings) {
     *     t.log(settings.get('theme')); // Map methods work
     * }
     */
    get(key) {
        const raw = t.ls.get(this.prefix + key);

        if (!raw) {
            return null;
        }

        const bytes = t.bugger.fromBase64(raw);
        const parsed = t.ls.deserialize(bytes);
        return this._rehydrate(parsed, new WeakMap());
    }

    /**
     * Removes a value from localStorage.
     * 
     * @param {string} key - Storage key to remove
     * @returns {void}
     * 
     * @example
     * superLs.set('temp_data', { foo: 'bar' });
     * superLs.remove('temp_data');
     * superLs.get('temp_data'); // null
     */
    remove(key) {
        t.ls.remove(this.prefix + key);
    }

    /**
     * Clears all values from localStorage.
     * 
     * @returns {void}
     * 
     * @example
     * superLs.set('key1', 'value1');
     * superLs.set('key2', 'value2');
     * superLs.clean();
     * // All keys are now removed
     */
    clean() {
        t.ls.clear();
    }

    /**
     * Checks if a key exists in localStorage and contains a valid value.
     * 
     * @param {string} key - Storage key to check
     * @returns {boolean} True if the key exists and contains a non-null, non-undefined value
     * 
     * @example
     * superLs.set('user', { name: 'Alice' });
     * superLs.has('user'); // true
     * superLs.has('nonexistent'); // false
     */
    has(key) {
        const value = this.get(key);
        return this._checkIfExistValue(value);
    }

    /**
     * Retrieves a value from localStorage, or computes and stores it if not present.
     * 
     * This method implements a "get or create" pattern: if the key exists and contains
     * a valid value, it returns that value. Otherwise, it calls the resolver function,
     * stores the result, and returns it.
     * 
     * @template T
     * @param {string} key - Storage key
     * @param {function(): T} resolver - Function that computes the default value if key doesn't exist
     * @returns {T} The existing value or the newly resolved and stored value
     * 
     * @example
     * // Returns existing settings or creates default ones
     * const settings = superLs.resolve('app_settings', () => ({
     *     theme: 'dark',
     *     language: 'en',
     *     notifications: true
     * }));
     */
    resolve(key, resolver) {
        const value = this.get(key);

        if (this._checkIfExistValue(value)) {
            return value;
        }

        const resolvedValue = resolver();
        this.set(key, resolvedValue);
        return resolvedValue;
    }

    // ========================================================================
    // Public API - Temporary Storage (In-Memory, Current Thread Only)
    // ========================================================================

    /**
     * Stores a value in temporary memory storage (current V8 thread only).
     * 
     * This is useful for caching expensive computations within a single request/action.
     * Data does NOT persist across different requests or threads.
     * 
     * Uses native V8 serialization for complex objects.
     * 
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * 
     * @example
     * // Cache expensive computation for reuse in same request
     * superLs.setTemp('computed_data', heavyComputation());
     * 
     * // Later in the same request...
     * const data = superLs.getTemp('computed_data'); // Fast retrieval
     */
    setTemp(key, value) {
        t.ls.setObject(this.prefix + key, value);
    }

    /**
     * Retrieves a value from temporary memory storage (current V8 thread only).
     * 
     * Returns the value if it exists in the current thread's memory,
     * or undefined if not found.
     * 
     * @template T
     * @param {string} key - Storage key
     * @returns {T|undefined} The stored value or undefined
     * 
     * @example
     * const cached = superLs.getTemp('computed_data');
     * if (cached) {
     *     // Use cached value
     * }
     */
    getTemp(key) {
        returnt.ls.getObject(this.prefix + key);
    }

    /**
     * Checks if a key exists in temporary storage and retrieves it, 
     * or computes and stores it if not present.
     * 
     * Similar to resolve() but for temporary in-memory storage.
     * 
     * @template T
     * @param {string} key - Storage key
     * @param {function(): T} resolver - Function that computes the value if not cached
     * @returns {T} The cached or newly computed value
     * 
     * @example
     * // Memoize expensive operation within current request
     * const result = superLs.resolveTemp('expensive_calc', () => {
     *     return performExpensiveCalculation();
     * });
     */
    resolveTemp(key, resolver) {
        const value = this.getTemp(key);

        if (value !== undefined) {
            return value;
        }

        const resolvedValue = resolver();
        this.setTemp(key, resolvedValue);
        return resolvedValue;
    }

    // ========================================================================
    // Public API - Direct Serialization Utilities
    // ========================================================================

    /**
     * Serializes any JavaScript value to a Uint8Array using native V8 serialization.
     * 
     * Useful when you need the raw bytes for custom storage or transmission.
     * 
     * @param {any} value - Value to serialize
     * @returns {Uint8Array} Serialized bytes
     * 
     * @example
     * const bytes = superLs.serialize({ complex: new Map([['a', 1]]) });
     * // Send bytes over network, store in custom location, etc.
     */
    serialize(value) {
        const payload = this._toSerializable(value);
        returnt.ls.serialize(payload);
    }

    /**
     * Deserializes a Uint8Array back to the original JavaScript value.
     * 
     * Automatically rehydrates registered class instances.
     * 
     * @template T
     * @param {Uint8Array} bytes - Serialized bytes
     * @returns {T} Deserialized and rehydrated value
     * 
     * @example
     * const value = superLs.deserialize(bytes);
     */
    deserialize(bytes) {
        const parsed = t.ls.deserialize(bytes);
        return this._rehydrate(parsed, new WeakMap());
    }

    // ========================================================================
    // Private Methods - Serialization
    // ========================================================================

    /**
     * Recursively converts values to a serializable format.
     * 
     * V8 natively handles Map, Set, Date, TypedArray, circular references.
     * Only registered class instances need special wrapping with metadata.
     * 
     * @param {any} value - Value to convert
     * @param {WeakMap} [seen=new WeakMap()] - Tracks processed objects for circular reference handling
     * @returns {any} Serializable representation of the value
     * @private
     */
    _toSerializable(value, seen = new WeakMap()) {
        if (isPrimitive(value)) {
            return value;
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        // Check registered classes first - wrap with metadata
        const classWrapper = this._tryWrapRegisteredClass(value, seen);
        if (classWrapper) {
            return classWrapper;
        }

        // V8 serialize handles these natively - no transformation needed
        if (this._isV8Native(value)) {
            return value;
        }

        // Handle collections that may contain registered classes
        return this._serializeCollection(value, seen);
    }

    /**
     * Attempts to wrap a registered class instance with type metadata
     * @param {any} value - Value to check and potentially wrap
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {SerializedClassWrapper|null} Wrapped class or null if not a registered class
     * @private
     */
    _tryWrapRegisteredClass(value, seen) {
        for (const [name, entry] of this.registry.entries()) {
            if (value instanceof entry.Constructor) {
                const wrapper = {
                    [TYPE_MARKER]: name,
                    [DATA_MARKER]: {}
                };

                seen.set(value, wrapper);

                for (const key of Object.keys(value)) {
                    wrapper[DATA_MARKER][key] = this._toSerializable(value[key], seen);
                }

                return wrapper;
            }
        }
        return null;
    }

    /**
     * Checks if V8 serialization handles this type natively
     * @param {any} value - Value to check
     * @returns {boolean} True if V8 handles this type without transformation
     * @private
     */
    _isV8Native(value) {
        return value instanceof Date ||
            value instanceof RegExp ||
            value instanceof Map ||
            value instanceof Set ||
            ArrayBuffer.isView(value);
    }

    /**
     * Serializes collections that may contain registered class instances
     * @param {any} value - Collection to serialize
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {any} Serialized collection
     * @private
     */
    _serializeCollection(value, seen) {
        if (Array.isArray(value)) {
            return this._serializeArray(value, seen);
        }

        if (value instanceof Map) {
            return this._serializeMap(value, seen);
        }

        if (value instanceof Set) {
            return this._serializeSet(value, seen);
        }

        return this._serializeObject(value, seen);
    }

    /**
     * Serializes an array, processing each element for registered classes
     * @param {Array} value - Array to serialize
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Array} Serialized array
     * @private
     */
    _serializeArray(value, seen) {
        const arr = [];
        seen.set(value, arr);

        for (let i = 0; i < value.length; i++) {
            if (i in value) {
                arr[i] = this._toSerializable(value[i], seen);
            }
        }

        if (value.length > arr.length) {
            arr.length = value.length;
        }

        return arr;
    }

    /**
     * Serializes a Map, processing values for registered classes
     * @param {Map} value - Map to serialize
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Map} Serialized Map
     * @private
     */
    _serializeMap(value, seen) {
        const newMap = new Map();
        seen.set(value, newMap);

        for (const [k, v] of value.entries()) {
            newMap.set(
                this._toSerializable(k, seen),
                this._toSerializable(v, seen)
            );
        }

        return newMap;
    }

    /**
     * Serializes a Set, processing values for registered classes
     * @param {Set} value - Set to serialize
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Set} Serialized Set
     * @private
     */
    _serializeSet(value, seen) {
        const newSet = new Set();
        seen.set(value, newSet);

        for (const item of value) {
            newSet.add(this._toSerializable(item, seen));
        }

        return newSet;
    }

    /**
     * Serializes a plain object, processing properties for registered classes
     * @param {Object} value - Object to serialize
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Object} Serialized object
     * @private
     */
    _serializeObject(value, seen) {
        const obj = {};
        seen.set(value, obj);

        for (const key of Object.keys(value)) {
            obj[key] = this._toSerializable(value[key], seen);
        }

        return obj;
    }

    // ========================================================================
    // Private Methods - Deserialization (Rehydration)
    // ========================================================================

    /**
     * Recursively rehydrates serialized data back to original types.
     * 
     * Uses nativet.ls.hydrate() for registered class instances.
     * V8 deserialize already restores Map, Set, Date, etc.
     * 
     * @param {any} value - Value to rehydrate
     * @param {WeakMap} seen - Tracks processed objects for circular reference handling
     * @returns {any} Rehydrated value with original types restored
     * @private
     */
    _rehydrate(value, seen) {
        if (isPrimitive(value)) {
            return value;
        }

        if (seen.has(value)) {
            return seen.get(value);
        }

        // Check for wrapped class instances
        if (hasTypeWrapper(value)) {
            return this._rehydrateClass(value, seen);
        }

        // V8 deserialize already restores these types
        if (value instanceof Date || value instanceof RegExp) {
            return value;
        }

        // Handle collections that may contain wrapped classes
        return this._rehydrateCollection(value, seen);
    }

    /**
     * Rehydrates a wrapped class instance using nativet.ls.hydrate()
     * @param {SerializedClassWrapper} value - Wrapped class data
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {any} Restored class instance
     * @private
     */
    _rehydrateClass(value, seen) {
        const typeName = value[TYPE_MARKER];
        const entry = this.registry.get(typeName);

        if (!entry) {
            // Class not registered - return as plain object
            return this._rehydrateObject(value, seen);
        }

        // Use placeholder for circular reference support
        const placeholder = {};
        seen.set(value, placeholder);

        // Rehydrate nested data first
        const hydratedData = {};
        for (const key of Object.keys(value[DATA_MARKER])) {
            hydratedData[key] = this._rehydrate(value[DATA_MARKER][key], seen);
        }

        // Use nativet.ls.hydrate() if available, otherwise fallback to local logic
        let instance;
        try {
            instance = t.ls.hydrate(typeName, hydratedData);
        } catch {
            // Fallback to local hydration logic
            instance = this._createInstance(entry, hydratedData);
        }

        // Update placeholder to become the actual instance
        Object.assign(placeholder, instance);
        Object.setPrototypeOf(placeholder, Object.getPrototypeOf(instance));

        // Preserve object state (frozen/sealed/non-extensible)
        if (Object.isFrozen(instance)) {
            Object.freeze(placeholder);
        } else if (Object.isSealed(instance)) {
            Object.seal(placeholder);
        } else if (!Object.isExtensible(instance)) {
            Object.preventExtensions(placeholder);
        }

        return placeholder;
    }

    /**
     * Creates a class instance from hydrated data (fallback)
     * @param {RegistryEntry} entry - Registry entry with Constructor and optional hydrate function
     * @param {Object} data - Hydrated property data
     * @returns {any} New class instance
     * @private
     */
    _createInstance(entry, data) {
        const { Constructor, hydrate } = entry;

        // Priority 1: Use hydrate function from register()
        if (typeof hydrate === 'function') {
            return hydrate(data);
        }

        // Priority 2: Static hydrate method on class
        if (typeof Constructor.hydrate === 'function') {
            return Constructor.hydrate(data);
        }

        // Priority 3: Default constructor + Object.assign
        const instance = new Constructor();
        Object.assign(instance, data);
        return instance;
    }

    /**
     * Rehydrates collections (Array, Map, Set, Object)
     * @param {any} value - Collection to rehydrate
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {any} Rehydrated collection
     * @private
     */
    _rehydrateCollection(value, seen) {
        if (Array.isArray(value)) {
            return this._rehydrateArray(value, seen);
        }

        if (value instanceof Map) {
            return this._rehydrateMap(value, seen);
        }

        if (value instanceof Set) {
            return this._rehydrateSet(value, seen);
        }

        if (value.constructor === Object) {
            return this._rehydrateObject(value, seen);
        }

        return value;
    }

    /**
     * Rehydrates an array
     * @param {Array} value - Array to rehydrate
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Array} Rehydrated array
     * @private
     */
    _rehydrateArray(value, seen) {
        const arr = [];
        seen.set(value, arr);

        for (let i = 0; i < value.length; i++) {
            arr[i] = this._rehydrate(value[i], seen);
        }

        return arr;
    }

    /**
     * Rehydrates a Map
     * @param {Map} value - Map to rehydrate
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Map} Rehydrated Map
     * @private
     */
    _rehydrateMap(value, seen) {
        const newMap = new Map();
        seen.set(value, newMap);

        for (const [k, v] of value.entries()) {
            newMap.set(
                this._rehydrate(k, seen),
                this._rehydrate(v, seen)
            );
        }

        return newMap;
    }

    /**
     * Rehydrates a Set
     * @param {Set} value - Set to rehydrate
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Set} Rehydrated Set
     * @private
     */
    _rehydrateSet(value, seen) {
        const newSet = new Set();
        seen.set(value, newSet);

        for (const item of value) {
            newSet.add(this._rehydrate(item, seen));
        }

        return newSet;
    }

    /**
     * Rehydrates a plain object
     * @param {Object} value - Object to rehydrate
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {Object} Rehydrated object
     * @private
     */
    _rehydrateObject(value, seen) {
        const obj = {};
        seen.set(value, obj);

        for (const key of Object.keys(value)) {
            obj[key] = this._rehydrate(value[key], seen);
        }

        return obj;
    }

    /**
     * Checks if a value exists (is not null or undefined)
     * @param {any} value - Value to check
     * @returns {boolean} True if value is not null and not undefined
     * @private
     */
    _checkIfExistValue(value) {
        return value !== undefined && value !== null;
    }
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default SuperLocalStorage instance for convenient usage
 * @type {SuperLocalStorage}
 */
const superLs = new SuperLocalStorage();

// Titan Planet Extension Registration
registerExtension("titanpl-superls", superLs);

export default superLs;