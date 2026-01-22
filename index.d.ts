/**
 * Interface for classes that can be hydrated (reconstructed) from flat data.
 */
export interface HydratableClass<T = any> {
    /**
     * Optional static method to reconstruct the instance from serialized data.
     * @param data - The serialized data object containing the instance properties
     * @returns A new instance of the class
     */
    hydrate?(data: any): T;
}

/**
 * SuperLocalStorage - Enhanced localStorage wrapper for Titan Planet
 * that supports complex JavaScript types including Map, Set, Date, circular references,
 * and custom class instances with automatic serialization/deserialization.
 * 
 * @example
 * // Basic usage with rich types
 * import superLs from 'super-ls';
 * 
 * const settings = new Map([['theme', 'dark'], ['lang', 'es']]);
 * superLs.set('user_settings', settings);
 * 
 * const recovered = superLs.get('user_settings');
 * console.log(recovered.get('theme')); // 'dark'
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
     * Creates a new SuperLocalStorage instance.
     * @param prefix - Prefix for all storage keys (default: 'sls_')
     */
    constructor(prefix?: string);

    /**
     * Registers a class for serialization/deserialization support.
     * 
     * Once registered, instances of this class can be stored and retrieved
     * with their methods intact.
     * 
     * @param ClassRef - The class constructor to register
     * @param typeName - Optional custom type name (defaults to class name)
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
    register<T>(ClassRef: (new (...args: any[]) => T) & HydratableClass<T>, typeName?: string): void;

    /**
     * Stores a value in localStorage with full type preservation.
     * 
     * Supports: primitives, objects, arrays, Map, Set, Date, RegExp,
     * TypedArrays, BigInt, circular references, undefined, NaN, Infinity,
     * and registered class instances.
     * 
     * @param key - Storage key
     * @param value - Value to store
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
    set(key: string, value: any): void;

    /**
     * Retrieves a value from localStorage with full type restoration.
     * 
     * All types are automatically restored to their original form,
     * including registered class instances with working methods.
     * 
     * @param key - Storage key
     * @returns The stored value with types restored, or null if key doesn't exist
     * 
     * @example
     * const settings = superLs.get<Map<string, string>>('user_settings');
     * if (settings) {
     *     console.log(settings.get('theme')); // Map methods work
     * }
     * 
     * @example
     * const player = superLs.get<Player>('my_player');
     * if (player) {
     *     player.addScore(10); // Class methods work
     * }
     */
    get<T = any>(key: string): T | null;

    /**
     * Removes a value from localStorage.
     * 
     * @param key - Storage key to remove
     * 
     * @example
     * superLs.set('temp_data', { foo: 'bar' });
     * superLs.remove('temp_data');
     * superLs.get('temp_data'); // null
     */
    remove(key: string): void;

    /**
    * Checks if a key exists in localStorage and contains a valid value.
    * 
    * @param {string} key - Storage key to check
    * @returns {boolean} True if the key exists and contains a non-null, non-undefined value
    * 
    * @example
    * superLs.set('user', { name: 'Alice' });
    * superLs.has('user'); // true
    * 
    * superLs.set('count', 42);
    * superLs.has('count'); // true
    * 
    * superLs.set('active', false);
    * superLs.has('active'); // true
    * 
    * superLs.has('nonexistent'); // false
    */
    has(key: string): boolean

    /**
     * Clears all values from localStorage that match the instance prefix.
     * 
     * @example
     * superLs.set('key1', 'value1');
     * superLs.set('key2', 'value2');
     * superLs.clean();
     * // All keys with the instance prefix are now removed
     */
    clean(): void;

    /**
     * Retrieves a value from localStorage, or computes and stores it if not present.
     * 
     * This method implements a "get or create" pattern: if the key exists and contains
     * a valid value, it returns that value. Otherwise, it calls the resolver function,
     * stores the result, and returns it.
     * 
     * @param key - Storage key
     * @param resolver - Function that computes the default value if key doesn't exist
     * @returns The existing value or the newly resolved and stored value
     * 
     * @example
     * // Returns existing settings or creates default ones
     * const settings = superLs.resolve('app_settings', () => ({
     *     theme: 'dark',
     *     language: 'en',
     *     notifications: true
     * }));
     * 
     * @example
     * // Useful for lazy initialization of complex data structures
     * const cache = superLs.resolve('user_cache', () => new Map());
     */
    resolve<T>(key: string, resolver: (value: any) => T): T;
}

/**
 * Default SuperLocalStorage instance for convenient usage.
 * 
 * @example
 * import superLs from 'super-ls';
 * 
 * superLs.set('key', { data: 'value' });
 * const data = superLs.get('key');
 */
declare const superLs: SuperLocalStorage;

export default superLs;