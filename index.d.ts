/**
 * Interface for classes that can be hydrated (reconstructed) from flat data.
 */
export interface HydratableClass<T = any> {
    /**
     * Optional static method to reconstruct the instance from serialized data.
     */
    hydrate?(data: any): T;
}

/**
 * SuperLocalStorage - Enhanced localStorage wrapper for Titan Planet
 */
export class SuperLocalStorage {
    /**
     * Creates a new SuperLocalStorage instance.
     * @param prefix - Prefix for all storage keys (default: 'sls_')
     */
    constructor(prefix?: string);

    /**
     * Registers a class for serialization/deserialization support.
     * 
     * @param ClassRef - The class constructor to register.
     * @param typeName - Optional custom type name (defaults to class name).
     * 
     * @example
     * class Player { ... }
     * superLs.register(Player);
     */
    register<T>(ClassRef: (new (...args: any[]) => T) & HydratableClass<T>, typeName?: string): void;

    /**
     * Stores a value in localStorage with full type preservation.
     * Supports: primitives, objects, arrays, Map, Set, Date, RegExp, BigInt,
     * circular references, and registered class instances.
     * 
     * @param key - Storage key.
     * @param value - Value to store.
     */
    set(key: string, value: any): void;

    /**
     * Retrieves a value from localStorage with full type restoration.
     * 
     * @param key - Storage key.
     * @returns The stored value with types restored, or null if key doesn't exist.
     * 
     * @example
     * const player = superLs.get<Player>('my_player');
     */
    get<T = any>(key: string): T | null;

    /**
    * Removes a value from localStorage.
    * @param key - Storage key.
    */
    remove(key: string): void;

    /**
    * Check if a value from localStorage.
    * 
    * @param {string} key - Storage key
    */
    has(key: string): boolean
}

/**
 * Default SuperLocalStorage instance for convenient usage.
 */
declare const superLs: SuperLocalStorage;

export default superLs;