import { stringify, parse } from 'devalue';
import { registerExtension } from "./utils/registerExtension.js";

/**
 * @fileoverview SuperLocalStorage - Enhanced localStorage wrapper for Titan Planet
 * that supports complex JavaScript types including Map, Set, Date, circular references,
 * and custom class instances with automatic serialization/deserialization.
 * 
 * @author Titan Planet
 * @license MIT
 */

// ============================================================================
// Constants
// ============================================================================

/** @constant {string} Default prefix for all storage keys */
const DEFAULT_PREFIX = 'sls_';

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
 * @typedef {Object} HydratableClass
 * @property {function(Object): any} [hydrate] - Optional static method to create instance from data
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
 * Checks if a value is a TypedArray (Uint8Array, Float32Array, etc.)
 * @param {any} value - Value to check
 * @returns {boolean} True if value is a TypedArray
 */
const isTypedArray = (value) => ArrayBuffer.isView(value) && !(value instanceof DataView);

/**
 * Checks if a serialized object contains class type metadata
 * @param {any} value - Value to check
 * @returns {boolean} True if value has type wrapper markers
 */
const hasTypeWrapper = (value) => value[TYPE_MARKER] && value[DATA_MARKER] !== undefined;

// ============================================================================
// Main Class
// ============================================================================

/**
 * Enhanced localStorage wrapper that supports complex JavaScript types
 * and custom class serialization/deserialization.
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
 * // Usage with custom classes
 * class Player {
 *     constructor(name = '', score = 0) {
 *         this.name = name;
 *         this.score = score;
 *     }
 *     addScore(points) {
 *         this.score += points;
 *     }
 * }
 * 
 * superLs.register(Player);
 * superLs.set('player', new Player('Alice', 100));
 * 
 * const player = superLs.get('player');
 * player.addScore(50); // Methods work!
 */
export class SuperLocalStorage {
    /**
     * Creates a new SuperLocalStorage instance
     * @param {string} [prefix='sls_'] - Prefix for all storage keys
     */
    constructor(prefix = DEFAULT_PREFIX) {
        /** 
         * Registry mapping type names to class constructors
         * @type {Map<string, ClassConstructor>}
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
    // Public API
    // ========================================================================

    /**
     * Registers a class for serialization/deserialization support.
     * 
     * Once registered, instances of this class can be stored and retrieved
     * with their methods intact.
     * 
     * @param {ClassConstructor & HydratableClass} ClassRef - The class constructor to register
     * @param {string} [typeName=null] - Optional custom type name (defaults to class name)
     * @throws {Error} If ClassRef is not a function/class
     * 
     * @example
     * // Basic registration
     * superLs.register(Player);
     * 
     * @example
     * // Registration with custom name (useful for minified code or name collisions)
     * superLs.register(Player, 'GamePlayer');
     * 
     * @example
     * // Class with static hydrate method for complex constructors
     * class Player {
     *     constructor(name, score) {
     *         if (!name) throw new Error('Name required');
     *         this.name = name;
     *         this.score = score;
     *     }
     *     static hydrate(data) {
     *         return new Player(data.name, data.score);
     *     }
     * }
     * superLs.register(Player);
     */
    register(ClassRef, typeName = null) {
        if (typeof ClassRef !== 'function') {
            throw new Error('Invalid class: expected a constructor function');
        }

        const finalName = typeName || ClassRef.name;
        this.registry.set(finalName, ClassRef);
    }

    /**
     * Stores a value in localStorage with full type preservation.
     * 
     * Supports: primitives, objects, arrays, Map, Set, Date, RegExp,
     * TypedArrays, BigInt, circular references, undefined, NaN, Infinity,
     * and registered class instances.
     * 
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @throws {Error} If value contains non-serializable types (functions, WeakMap, WeakSet)
     * 
     * @example
     * // Store various types
     * superLs.set('map', new Map([['key', 'value']]));
     * superLs.set('set', new Set([1, 2, 3]));
     * superLs.set('date', new Date());
     * superLs.set('regex', /pattern/gi);
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
        const serialized = stringify(payload);
        t.ls.set(this.prefix + key, serialized);
    }

    /**
     * Retrieves a value from localStorage with full type restoration.
     * 
     * All types are automatically restored to their original form,
     * including registered class instances with working methods.
     * 
     * @param {string} key - Storage key
     * @returns {any} The stored value with types restored, or null if key doesn't exist
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

        const parsed = parse(raw);
        return this._rehydrate(parsed, new WeakMap());
    }

    /**
   * Removes a value from localStorage.
   * 
   * @param {string} key - Storage key
   */
    remove(key) {
        t.ls.remove(this.prefix + key);
    }

    /**
   * Check if a value from localStorage.
   * 
   * @param {string} key - Storage key
   */
    has(key) {
        const value = t.ls.get(key)
        return value !== null && value !== undefined;
    }

    // ========================================================================
    // Private Methods - Serialization
    // ========================================================================

    /**
     * Recursively converts values to a serializable format.
     * 
     * Registered class instances are wrapped with type metadata.
     * Circular references are preserved using a WeakMap tracker.
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

        // Check registered classes first (before native types)
        const classWrapper = this._tryWrapRegisteredClass(value, seen);
        if (classWrapper) {
            return classWrapper;
        }

        // Handle native types that devalue supports
        if (this._isNativelySerializable(value)) {
            return value;
        }

        // Handle collections and objects
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
        for (const [name, Constructor] of this.registry.entries()) {
            if (value instanceof Constructor) {
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
     * Checks if a value is natively serializable by devalue
     * @param {any} value - Value to check
     * @returns {boolean} True if devalue handles this type natively
     * @private
     */
    _isNativelySerializable(value) {
        return value instanceof Date ||
            value instanceof RegExp ||
            isTypedArray(value);
    }

    /**
     * Serializes collections (Array, Map, Set, Object)
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
     * Serializes an array, preserving sparse array holes
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
     * Serializes a Map, processing both keys and values
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
     * Serializes a Set
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
     * Serializes a plain object or unregistered class instance
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
     * Objects with type metadata are restored to class instances.
     * Circular references are preserved using a WeakMap tracker.
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

        // Handle native types
        if (value instanceof Date || value instanceof RegExp) {
            return value;
        }

        // Handle collections
        return this._rehydrateCollection(value, seen);
    }

    /**
     * Rehydrates a wrapped class instance back to its original class
     * @param {SerializedClassWrapper} value - Wrapped class data
     * @param {WeakMap} seen - Circular reference tracker
     * @returns {any} Restored class instance or original value if class not registered
     * @private
     */
    _rehydrateClass(value, seen) {
        const Constructor = this.registry.get(value[TYPE_MARKER]);

        if (!Constructor) {
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

        // Create instance using hydrate() or default constructor
        const instance = this._createInstance(Constructor, hydratedData);

        // Update placeholder to become the actual instance
        Object.assign(placeholder, instance);
        Object.setPrototypeOf(placeholder, Object.getPrototypeOf(instance));

        return placeholder;
    }

    /**
     * Creates a class instance from hydrated data
     * @param {ClassConstructor & HydratableClass} Constructor - Class constructor
     * @param {Object} data - Hydrated property data
     * @returns {any} New class instance
     * @private
     */
    _createInstance(Constructor, data) {
        if (typeof Constructor.hydrate === 'function') {
            return Constructor.hydrate(data);
        }

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
     * Rehydrates a Map, processing both keys and values
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
registerExtension("titanpl-superls", superLs)

export default superLs;