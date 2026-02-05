import { describe, it, expect, beforeEach } from 'vitest';
import { SuperLocalStorage } from "../index.js";
import { clearAllMocks } from './__mocks__.js';

// ============================================
// ADDITIONAL API TESTS
// ============================================
describe('SuperLocalStorage - Additional API Methods', () => {
    let superLs;

    beforeEach(() => {
        clearAllMocks();
        superLs = new SuperLocalStorage();
    });

    // ==========================================
    // has() METHOD
    // ==========================================
    describe('has() method', () => {
        it('should return true for existing key with object value', () => {
            superLs.set('user', { name: 'Alice' });
            expect(superLs.has('user')).toBe(true);
        });

        it('should return true for existing key with number value', () => {
            superLs.set('count', 42);
            expect(superLs.has('count')).toBe(true);
        });

        it('should return true for existing key with zero value', () => {
            superLs.set('zero', 0);
            expect(superLs.has('zero')).toBe(true);
        });

        it('should return true for existing key with false value', () => {
            superLs.set('active', false);
            expect(superLs.has('active')).toBe(true);
        });

        it('should return true for existing key with empty string value', () => {
            superLs.set('empty', '');
            expect(superLs.has('empty')).toBe(true);
        });

        it('should return true for existing key with empty array', () => {
            superLs.set('arr', []);
            expect(superLs.has('arr')).toBe(true);
        });

        it('should return true for existing key with empty object', () => {
            superLs.set('obj', {});
            expect(superLs.has('obj')).toBe(true);
        });

        it('should return false for non-existent key', () => {
            expect(superLs.has('nonexistent')).toBe(false);
        });

        it('should return false after key is removed', () => {
            superLs.set('temp', 'value');
            expect(superLs.has('temp')).toBe(true);
            superLs.remove('temp');
            expect(superLs.has('temp')).toBe(false);
        });

        it('should return true for class instances', () => {
            class Player {
                constructor(name = '') { this.name = name; }
            }
            superLs.register(Player);
            superLs.set('player', new Player('Alice'));
            expect(superLs.has('player')).toBe(true);
        });

        it('should return true for Map and Set', () => {
            superLs.set('map', new Map([['a', 1]]));
            superLs.set('set', new Set([1, 2, 3]));
            expect(superLs.has('map')).toBe(true);
            expect(superLs.has('set')).toBe(true);
        });
    });

    // ==========================================
    // remove() METHOD
    // ==========================================
    describe('remove() method', () => {
        it('should remove existing key', () => {
            superLs.set('toRemove', { data: 'value' });
            expect(superLs.get('toRemove')).not.toBeNull();

            superLs.remove('toRemove');
            expect(superLs.get('toRemove')).toBeNull();
        });

        it('should not throw when removing non-existent key', () => {
            expect(() => superLs.remove('nonexistent')).not.toThrow();
        });

        it('should only remove specified key', () => {
            superLs.set('key1', 'value1');
            superLs.set('key2', 'value2');
            superLs.set('key3', 'value3');

            superLs.remove('key2');

            expect(superLs.get('key1')).toBe('value1');
            expect(superLs.get('key2')).toBeNull();
            expect(superLs.get('key3')).toBe('value3');
        });

        it('should remove class instances', () => {
            class Item {
                constructor(name = '') { this.name = name; }
            }
            superLs.register(Item);
            superLs.set('item', new Item('Sword'));

            expect(superLs.get('item')).toBeInstanceOf(Item);
            superLs.remove('item');
            expect(superLs.get('item')).toBeNull();
        });

        it('should remove Map and Set', () => {
            superLs.set('map', new Map([['key', 'value']]));
            superLs.set('set', new Set([1, 2, 3]));

            superLs.remove('map');
            superLs.remove('set');

            expect(superLs.get('map')).toBeNull();
            expect(superLs.get('set')).toBeNull();
        });
    });

    // ==========================================
    // clean() METHOD
    // ==========================================
    describe('clean() method', () => {
        it('should remove all keys', () => {
            superLs.set('key1', 'value1');
            superLs.set('key2', 'value2');
            superLs.set('key3', 'value3');

            superLs.clean();

            expect(superLs.get('key1')).toBeNull();
            expect(superLs.get('key2')).toBeNull();
            expect(superLs.get('key3')).toBeNull();
        });

        it('should not throw when storage is empty', () => {
            expect(() => superLs.clean()).not.toThrow();
        });

        it('should remove class instances', () => {
            class Player {
                constructor(name = '') { this.name = name; }
            }
            superLs.register(Player);

            superLs.set('player1', new Player('Alice'));
            superLs.set('player2', new Player('Bob'));

            superLs.clean();

            expect(superLs.get('player1')).toBeNull();
            expect(superLs.get('player2')).toBeNull();
        });

        it('should remove mixed types', () => {
            superLs.set('string', 'hello');
            superLs.set('number', 42);
            superLs.set('map', new Map([['a', 1]]));
            superLs.set('set', new Set([1, 2]));
            superLs.set('date', new Date());

            superLs.clean();

            expect(superLs.get('string')).toBeNull();
            expect(superLs.get('number')).toBeNull();
            expect(superLs.get('map')).toBeNull();
            expect(superLs.get('set')).toBeNull();
            expect(superLs.get('date')).toBeNull();
        });
    });

    // ==========================================
    // resolve() METHOD
    // ==========================================
    describe('resolve() method', () => {
        it('should return existing value if key exists', () => {
            superLs.set('existing', { theme: 'dark' });

            const result = superLs.resolve('existing', () => ({ theme: 'light' }));

            expect(result.theme).toBe('dark');
        });

        it('should call resolver and store result if key does not exist', () => {
            const result = superLs.resolve('newKey', () => ({ theme: 'dark', lang: 'en' }));

            expect(result.theme).toBe('dark');
            expect(result.lang).toBe('en');

            // Verify it was stored
            const stored = superLs.get('newKey');
            expect(stored.theme).toBe('dark');
        });

        it('should not call resolver if key exists', () => {
            superLs.set('existing', 'original');

            let resolverCalled = false;
            const result = superLs.resolve('existing', () => {
                resolverCalled = true;
                return 'new value';
            });

            expect(resolverCalled).toBe(false);
            expect(result).toBe('original');
        });

        it('should call resolver only once for new key', () => {
            let callCount = 0;
            const resolver = () => {
                callCount++;
                return { count: callCount };
            };

            const result1 = superLs.resolve('counter', resolver);
            const result2 = superLs.resolve('counter', resolver);

            expect(callCount).toBe(1);
            expect(result1.count).toBe(1);
            expect(result2.count).toBe(1);
        });

        it('should work with Map as resolved value', () => {
            const result = superLs.resolve('cache', () => new Map());

            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);

            // Verify stored value is also a Map
            const stored = superLs.get('cache');
            expect(stored).toBeInstanceOf(Map);
        });

        it('should work with Set as resolved value', () => {
            const result = superLs.resolve('tags', () => new Set(['default']));

            expect(result).toBeInstanceOf(Set);
            expect(result.has('default')).toBe(true);
        });

        it('should work with class instances', () => {
            class Config {
                constructor(env = 'dev') { this.env = env; }
                isDev() { return this.env === 'dev'; }
            }
            superLs.register(Config);

            const result = superLs.resolve('config', () => new Config('production'));

            expect(result).toBeInstanceOf(Config);
            expect(result.env).toBe('production');
            expect(result.isDev()).toBe(false);
        });

        it('should return existing class instance without calling resolver', () => {
            class Player {
                constructor(name = '', score = 0) {
                    this.name = name;
                    this.score = score;
                }
            }
            superLs.register(Player);
            superLs.set('player', new Player('Alice', 100));

            const result = superLs.resolve('player', () => new Player('Guest', 0));

            expect(result.name).toBe('Alice');
            expect(result.score).toBe(100);
        });

        it('should handle resolver returning primitive values', () => {
            const num = superLs.resolve('number', () => 42);
            const str = superLs.resolve('string', () => 'hello');
            const bool = superLs.resolve('boolean', () => true);

            expect(num).toBe(42);
            expect(str).toBe('hello');
            expect(bool).toBe(true);
        });

        it('should handle resolver returning array', () => {
            const result = superLs.resolve('list', () => [1, 2, 3]);

            expect(result).toEqual([1, 2, 3]);
        });

        it('should work with complex nested structures', () => {
            const result = superLs.resolve('appState', () => ({
                user: null,
                settings: new Map([['theme', 'dark']]),
                history: [],
                flags: new Set(['feature1'])
            }));

            expect(result.user).toBeNull();
            expect(result.settings.get('theme')).toBe('dark');
            expect(result.flags.has('feature1')).toBe(true);
        });

        it('should preserve falsy values (0, false, empty string) as existing', () => {
            superLs.set('zero', 0);
            superLs.set('false', false);
            superLs.set('emptyStr', '');

            const zeroResult = superLs.resolve('zero', () => 999);
            const falseResult = superLs.resolve('false', () => true);
            const emptyResult = superLs.resolve('emptyStr', () => 'default');

            expect(zeroResult).toBe(0);
            expect(falseResult).toBe(false);
            expect(emptyResult).toBe('');
        });
    });

    // ==========================================
    // setTemp() / getTemp() METHODS (In-Memory)
    // ==========================================
    describe('setTemp() / getTemp() methods (in-memory storage)', () => {
        it('should store and retrieve simple values', () => {
            superLs.setTemp('tempKey', 'tempValue');
            expect(superLs.getTemp('tempKey')).toBe('tempValue');
        });

        it('should store and retrieve objects', () => {
            const obj = { name: 'Alice', score: 100 };
            superLs.setTemp('tempObj', obj);

            const retrieved = superLs.getTemp('tempObj');
            expect(retrieved).toEqual(obj);
        });

        it('should store and retrieve class instances without registration', () => {
            class Player {
                constructor(name) { this.name = name; }
                greet() { return `Hello, ${this.name}`; }
            }

            const player = new Player('Bob');
            superLs.setTemp('tempPlayer', player);

            const retrieved = superLs.getTemp('tempPlayer');
            // In-memory storage preserves the exact reference
            expect(retrieved).toBeInstanceOf(Player);
            expect(retrieved.greet()).toBe('Hello, Bob');
        });

        it('should return undefined for non-existent key', () => {
            expect(superLs.getTemp('nonexistent')).toBeUndefined();
        });

        it('should store Map and Set without serialization', () => {
            const map = new Map([['a', 1], ['b', 2]]);
            const set = new Set([1, 2, 3]);

            superLs.setTemp('tempMap', map);
            superLs.setTemp('tempSet', set);

            expect(superLs.getTemp('tempMap')).toBeInstanceOf(Map);
            expect(superLs.getTemp('tempMap').get('a')).toBe(1);
            expect(superLs.getTemp('tempSet')).toBeInstanceOf(Set);
            expect(superLs.getTemp('tempSet').has(2)).toBe(true);
        });

        it('should overwrite existing temp value', () => {
            superLs.setTemp('key', 'value1');
            superLs.setTemp('key', 'value2');
            expect(superLs.getTemp('key')).toBe('value2');
        });

        it('should be independent from persistent storage', () => {
            superLs.set('key', 'persistent');
            superLs.setTemp('key', 'temporary');

            expect(superLs.get('key')).toBe('persistent');
            expect(superLs.getTemp('key')).toBe('temporary');
        });

        it('should store circular references without issues', () => {
            const obj = { name: 'circular' };
            obj.self = obj;

            superLs.setTemp('circular', obj);
            const retrieved = superLs.getTemp('circular');

            expect(retrieved.self).toBe(retrieved);
        });

        it('should store functions (unlike persistent storage)', () => {
            const fn = (x) => x * 2;
            superLs.setTemp('func', fn);

            const retrieved = superLs.getTemp('func');
            expect(typeof retrieved).toBe('function');
            expect(retrieved(5)).toBe(10);
        });
    });

    // ==========================================
    // resolveTemp() METHOD
    // ==========================================
    describe('resolveTemp() method', () => {
        it('should return existing temp value if key exists', () => {
            superLs.setTemp('existing', { cached: true });

            const result = superLs.resolveTemp('existing', () => ({ cached: false }));

            expect(result.cached).toBe(true);
        });

        it('should call resolver and store result if key does not exist', () => {
            let computed = false;
            const result = superLs.resolveTemp('computed', () => {
                computed = true;
                return { value: 42 };
            });

            expect(computed).toBe(true);
            expect(result.value).toBe(42);

            // Verify it was stored
            expect(superLs.getTemp('computed').value).toBe(42);
        });

        it('should not call resolver if key exists', () => {
            superLs.setTemp('existing', 'original');

            let resolverCalled = false;
            const result = superLs.resolveTemp('existing', () => {
                resolverCalled = true;
                return 'new value';
            });

            expect(resolverCalled).toBe(false);
            expect(result).toBe('original');
        });

        it('should work as memoization for expensive operations', () => {
            let computeCount = 0;
            const expensiveComputation = () => {
                computeCount++;
                return { result: Math.random() };
            };

            const result1 = superLs.resolveTemp('expensive', expensiveComputation);
            const result2 = superLs.resolveTemp('expensive', expensiveComputation);
            const result3 = superLs.resolveTemp('expensive', expensiveComputation);

            expect(computeCount).toBe(1);
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should handle undefined as non-existent (calls resolver)', () => {
            // undefined means not stored, so resolver should be called
            const result = superLs.resolveTemp('undef', () => 'resolved');
            expect(result).toBe('resolved');
        });

        it('should work with class instances', () => {
            class Cache {
                constructor() {
                    this.data = new Map();
                    this.created = Date.now();
                }
                set(k, v) { this.data.set(k, v); }
                get(k) { return this.data.get(k); }
            }

            const cache = superLs.resolveTemp('cache', () => new Cache());
            cache.set('key', 'value');

            // Second call should return same instance
            const sameCache = superLs.resolveTemp('cache', () => new Cache());
            expect(sameCache.get('key')).toBe('value');
            expect(sameCache.created).toBe(cache.created);
        });
    });

    // ==========================================
    // serialize() / deserialize() METHODS
    // ==========================================
    describe('serialize() / deserialize() methods', () => {
        it('should serialize and deserialize simple values', () => {
            const original = { name: 'Alice', age: 30 };
            const bytes = superLs.serialize(original);

            expect(bytes).toBeInstanceOf(Uint8Array);

            const restored = superLs.deserialize(bytes);
            expect(restored).toEqual(original);
        });

        it('should handle Map', () => {
            const original = new Map([['a', 1], ['b', 2]]);
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Map);
            expect(restored.get('a')).toBe(1);
            expect(restored.get('b')).toBe(2);
        });

        it('should handle Set', () => {
            const original = new Set([1, 2, 3]);
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Set);
            expect(restored.has(1)).toBe(true);
            expect(restored.has(2)).toBe(true);
            expect(restored.has(3)).toBe(true);
        });

        it('should handle Date', () => {
            const original = new Date('2024-01-15T10:30:00Z');
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Date);
            expect(restored.toISOString()).toBe(original.toISOString());
        });

        it('should handle RegExp', () => {
            const original = /test\d+/gi;
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(RegExp);
            expect(restored.source).toBe(original.source);
            expect(restored.flags).toBe(original.flags);
        });

        it('should handle BigInt', () => {
            const original = BigInt('9007199254740991000');
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBe(original);
        });

        it('should handle TypedArray', () => {
            const original = new Uint8Array([1, 2, 3, 4, 5]);
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Uint8Array);
            expect(Array.from(restored)).toEqual([1, 2, 3, 4, 5]);
        });

        it('should handle circular references', () => {
            const original = { name: 'circular' };
            original.self = original;

            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored.name).toBe('circular');
            expect(restored.self).toBe(restored);
        });

        it('should handle registered class instances', () => {
            class Player {
                constructor(name = '', score = 0) {
                    this.name = name;
                    this.score = score;
                }
                greet() { return `I am ${this.name}`; }
            }
            superLs.register(Player);

            const original = new Player('Alice', 100);
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Player);
            expect(restored.name).toBe('Alice');
            expect(restored.score).toBe(100);
            expect(restored.greet()).toBe('I am Alice');
        });

        it('should handle complex nested structures', () => {
            class Item {
                constructor(name = '') { this.name = name; }
            }
            superLs.register(Item);

            const original = {
                items: [new Item('Sword'), new Item('Shield')],
                metadata: new Map([['version', 1]]),
                tags: new Set(['game', 'rpg']),
                created: new Date()
            };

            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored.items[0]).toBeInstanceOf(Item);
            expect(restored.items[0].name).toBe('Sword');
            expect(restored.metadata).toBeInstanceOf(Map);
            expect(restored.tags).toBeInstanceOf(Set);
            expect(restored.created).toBeInstanceOf(Date);
        });

        it('should handle special values (NaN, Infinity, undefined)', () => {
            const original = {
                nan: NaN,
                inf: Infinity,
                negInf: -Infinity,
                undef: undefined
            };

            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(Number.isNaN(restored.nan)).toBe(true);
            expect(restored.inf).toBe(Infinity);
            expect(restored.negInf).toBe(-Infinity);
            expect(restored.undef).toBeUndefined();
        });

        it('should produce bytes usable for custom storage/transmission', () => {
            const data = { message: 'Hello, World!' };
            const bytes = superLs.serialize(data);

            // Simulate transmission (convert to base64 and back)
            const { core } = await import('@titanpl/core');
            const base64 = core.buffer.toBase64(bytes);
            const receivedBytes = core.buffer.fromBase64(base64);

            const restored = superLs.deserialize(receivedBytes);
            expect(restored.message).toBe('Hello, World!');
        });
    });

    // ==========================================
    // register() WITH HYDRATE FUNCTION
    // ==========================================
    describe('register() with hydrate function as second argument', () => {
        it('should use hydrate function for class with required constructor args', () => {
            class User {
                constructor(id, email) {
                    if (!id || !email) throw new Error('id and email required!');
                    this.id = id;
                    this.email = email;
                }
                getInfo() { return `${this.id}: ${this.email}`; }
            }

            superLs.register(User, (data) => new User(data.id, data.email));

            const user = new User(1, 'alice@example.com');
            superLs.set('user', user);
            const recovered = superLs.get('user');

            expect(recovered).toBeInstanceOf(User);
            expect(recovered.id).toBe(1);
            expect(recovered.email).toBe('alice@example.com');
            expect(recovered.getInfo()).toBe('1: alice@example.com');
        });

        it('should use hydrate function for immutable objects', () => {
            class ImmutableConfig {
                constructor(settings) {
                    this.settings = settings;
                    Object.freeze(this);
                }
                get(key) { return this.settings[key]; }
            }

            superLs.register(ImmutableConfig, (data) => new ImmutableConfig(data.settings));

            const config = new ImmutableConfig({ theme: 'dark', lang: 'en' });
            superLs.set('config', config);
            const recovered = superLs.get('config');

            expect(recovered).toBeInstanceOf(ImmutableConfig);
            expect(recovered.get('theme')).toBe('dark');
            expect(Object.isFrozen(recovered)).toBe(true);
        });

        it('should use hydrate function with dependency injection', () => {
            class Address {
                constructor(city = '', country = '') {
                    this.city = city;
                    this.country = country;
                }
                format() { return `${this.city}, ${this.country}`; }
            }

            class Person {
                constructor(name = '', address = null) {
                    this.name = name;
                    this.address = address;
                }
                getLocation() { return this.address?.format() || 'Unknown'; }
            }

            superLs.register(Address, (data) => new Address(data.city, data.country));
            superLs.register(Person, (data) => new Person(data.name, data.address));

            const address = new Address('Madrid', 'Spain');
            const person = new Person('Carlos', address);

            superLs.set('person', person);
            const recovered = superLs.get('person');

            expect(recovered).toBeInstanceOf(Person);
            expect(recovered.name).toBe('Carlos');
            expect(recovered.address).toBeInstanceOf(Address);
            expect(recovered.getLocation()).toBe('Madrid, Spain');
        });

        it('should prioritize hydrate function over static hydrate method', () => {
            class Hybrid {
                constructor(value = 'default') {
                    this.value = value;
                    this.source = 'constructor';
                }
                static hydrate(data) {
                    const instance = new Hybrid(data.value);
                    instance.source = 'static';
                    return instance;
                }
            }

            // Register with hydrate function - should take priority
            superLs.register(Hybrid, (data) => {
                const instance = new Hybrid(data.value);
                instance.source = 'function';
                return instance;
            });

            const hybrid = new Hybrid('test');
            superLs.set('hybrid', hybrid);
            const recovered = superLs.get('hybrid');

            expect(recovered).toBeInstanceOf(Hybrid);
            expect(recovered.value).toBe('test');
            expect(recovered.source).toBe('function'); // Function takes priority
        });

        it('should fall back to static hydrate if no function provided', () => {
            class WithStaticHydrate {
                constructor(value = 'default') {
                    this.value = value;
                    this.hydrated = false;
                }
                static hydrate(data) {
                    const instance = new WithStaticHydrate(data.value);
                    instance.hydrated = true;
                    return instance;
                }
            }

            // Register without hydrate function
            superLs.register(WithStaticHydrate);

            const instance = new WithStaticHydrate('test');
            superLs.set('instance', instance);
            const recovered = superLs.get('instance');

            expect(recovered).toBeInstanceOf(WithStaticHydrate);
            expect(recovered.value).toBe('test');
            expect(recovered.hydrated).toBe(true); // Static method was used
        });

        it('should work with only custom type name (backward compatible)', () => {
            class SimpleClass {
                constructor() { this.simple = true; }
                isSimple() { return this.simple; }
            }

            // Old API: register(Class, typeName)
            superLs.register(SimpleClass, 'MySimpleClass');

            const instance = new SimpleClass();
            superLs.set('simple', instance);
            const recovered = superLs.get('simple');

            expect(recovered).toBeInstanceOf(SimpleClass);
            expect(recovered.isSimple()).toBe(true);
        });

        it('should handle array of instances with hydrate functions', () => {
            class Task {
                constructor(id, title) {
                    if (!id) throw new Error('ID required');
                    this.id = id;
                    this.title = title;
                    this.done = false;
                }
                complete() { this.done = true; }
            }

            superLs.register(Task, (data) => {
                const task = new Task(data.id, data.title);
                task.done = data.done;
                return task;
            });

            const tasks = [
                new Task(1, 'Task 1'),
                new Task(2, 'Task 2'),
                new Task(3, 'Task 3')
            ];
            tasks[1].complete();

            superLs.set('tasks', tasks);
            const recovered = superLs.get('tasks');

            expect(recovered).toHaveLength(3);
            expect(recovered[0]).toBeInstanceOf(Task);
            expect(recovered[1]).toBeInstanceOf(Task);
            expect(recovered[2]).toBeInstanceOf(Task);
            expect(recovered[0].done).toBe(false);
            expect(recovered[1].done).toBe(true);
            expect(recovered[2].done).toBe(false);
        });

        it('should handle Map with class instances using hydrate functions', () => {
            class Product {
                constructor(sku, name, price) {
                    if (!sku) throw new Error('SKU required');
                    this.sku = sku;
                    this.name = name;
                    this.price = price;
                }
                getDisplayPrice() { return `$${this.price.toFixed(2)}`; }
            }

            superLs.register(Product, (data) => new Product(data.sku, data.name, data.price));

            const catalog = new Map();
            catalog.set('SKU001', new Product('SKU001', 'Widget', 9.99));
            catalog.set('SKU002', new Product('SKU002', 'Gadget', 19.99));

            superLs.set('catalog', catalog);
            const recovered = superLs.get('catalog');

            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.size).toBe(2);
            expect(recovered.get('SKU001')).toBeInstanceOf(Product);
            expect(recovered.get('SKU001').getDisplayPrice()).toBe('$9.99');
            expect(recovered.get('SKU002').name).toBe('Gadget');
        });
    });

    // ==========================================
    // NATIVE INTEGRATION TESTS
    // ==========================================
    describe('Native integration (t.ls and t.core)', () => {
        it('should use t.ls.serialize for serialization', () => {
            const { ls, core } = await import('@titanpl/core');

            const data = { test: 'value' };
            superLs.set('native', data);

            // Verify data is stored as base64 encoded V8 serialized bytes
            const raw = ls.get('__sls__native');
            expect(typeof raw).toBe('string');

            // Should be valid base64
            expect(() => core.buffer.fromBase64(raw)).not.toThrow();
        });

        it('should register classes with native t.ls.register', () => {
            class NativeClass {
                constructor(value = '') { this.value = value; }
            }

            superLs.register(NativeClass);

            // Class should be usable through native hydration
            const instance = new NativeClass('test');
            superLs.set('native', instance);
            const recovered = superLs.get('native');

            expect(recovered).toBeInstanceOf(NativeClass);
            expect(recovered.value).toBe('test');
        });

        it('should use t.core.buffer for encoding/decoding', () => {
            const { core } = await import('@titanpl/core');

            const testData = 'Hello, World!';
            const bytes = core.buffer.fromUtf8(testData);
            const base64 = core.buffer.toBase64(bytes);
            const decodedBytes = core.buffer.fromBase64(base64);
            const result = core.buffer.toUtf8(decodedBytes);

            expect(result).toBe(testData);
        });

        it('should use t.ls.setObject/getObject for temp storage', () => {
            const { ls } = await import('@titanpl/core');

            const obj = { temp: true };
            superLs.setTemp('tempKey', obj);

            // Verify it's in the object storage
            const stored = ls.getObject('__sls__tempKey');
            expect(stored).toBeDefined();
        });
    });
});