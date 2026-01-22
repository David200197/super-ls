import { describe, it, expect, beforeEach } from 'vitest';
import { SuperLocalStorage } from "../index.js";

// ============================================
// MOCK for Titan Planet's t.ls API
// ============================================
const mockStorage = new Map();

globalThis.t = {
    ls: {
        set(key, value) { mockStorage.set(key, value); },
        get(key) { return mockStorage.get(key) || null; },
        remove(key) { mockStorage.delete(key); },
        clean() { mockStorage.clear(); }
    }
};

// ============================================
// ADDITIONAL API TESTS
// ============================================
describe('SuperLocalStorage - Additional API Methods', () => {
    let superLs;

    beforeEach(() => {
        mockStorage.clear();
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

        it('should use hydrate function for destructuring constructors', () => {
            class Point {
                constructor({ x, y }) {
                    this.x = x;
                    this.y = y;
                }
                distance() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
            }

            superLs.register(Point, (data) => new Point({ x: data.x, y: data.y }));

            const point = new Point({ x: 3, y: 4 });
            superLs.set('point', point);
            const recovered = superLs.get('point');

            expect(recovered).toBeInstanceOf(Point);
            expect(recovered.x).toBe(3);
            expect(recovered.y).toBe(4);
            expect(recovered.distance()).toBe(5);
        });

        it('should support hydrate function with custom type name', () => {
            class User {
                constructor(name) {
                    if (!name) throw new Error('Name required');
                    this.name = name;
                }
            }

            superLs.register(User, (data) => new User(data.name), 'AppUser');

            const user = new User('Alice');
            superLs.set('user', user);
            const recovered = superLs.get('user');

            expect(recovered).toBeInstanceOf(User);
            expect(recovered.name).toBe('Alice');
        });

        it('should handle hydrate function with validation logic', () => {
            class Email {
                constructor(value) {
                    if (!value.includes('@')) throw new Error('Invalid email');
                    this.value = value;
                }
                getDomain() { return this.value.split('@')[1]; }
            }

            superLs.register(Email, (data) => new Email(data.value));

            const email = new Email('test@example.com');
            superLs.set('email', email);
            const recovered = superLs.get('email');

            expect(recovered).toBeInstanceOf(Email);
            expect(recovered.value).toBe('test@example.com');
            expect(recovered.getDomain()).toBe('example.com');
        });

        it('should handle hydrate function with complex nested data', () => {
            class Order {
                constructor(id, items, metadata) {
                    this.id = id;
                    this.items = items;
                    this.metadata = metadata;
                }
                getTotal() { return this.items.reduce((sum, i) => sum + i.price, 0); }
            }

            superLs.register(Order, (data) => new Order(data.id, data.items, data.metadata));

            const order = new Order('ORD-001', [
                { name: 'Item 1', price: 10 },
                { name: 'Item 2', price: 20 }
            ], { createdAt: new Date(), priority: 'high' });

            superLs.set('order', order);
            const recovered = superLs.get('order');

            expect(recovered).toBeInstanceOf(Order);
            expect(recovered.id).toBe('ORD-001');
            expect(recovered.items).toHaveLength(2);
            expect(recovered.getTotal()).toBe(30);
            expect(recovered.metadata.priority).toBe('high');
        });

        it('should handle hydrate function with private-like fields', () => {
            class Counter {
                constructor(initial) {
                    this._count = initial;
                    this._history = [initial];
                }
                increment() {
                    this._count++;
                    this._history.push(this._count);
                }
                get count() { return this._count; }
                get history() { return [...this._history]; }
            }

            superLs.register(Counter, (data) => {
                const counter = new Counter(data._history[0]);
                counter._count = data._count;
                counter._history = data._history;
                return counter;
            });

            const counter = new Counter(0);
            counter.increment();
            counter.increment();
            counter.increment();

            superLs.set('counter', counter);
            const recovered = superLs.get('counter');

            expect(recovered).toBeInstanceOf(Counter);
            expect(recovered.count).toBe(3);
            expect(recovered.history).toEqual([0, 1, 2, 3]);
        });

        it('should handle nested classes both using hydrate functions', () => {
            class Address {
                constructor(city, country) {
                    if (!city || !country) throw new Error('City and country required');
                    this.city = city;
                    this.country = country;
                }
                format() { return `${this.city}, ${this.country}`; }
            }

            class Person {
                constructor(name, address) {
                    if (!name) throw new Error('Name required');
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
});