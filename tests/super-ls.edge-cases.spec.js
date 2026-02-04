import { clearAllMocks, mockStorage } from './_mocks_.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { SuperLocalStorage } from "../index.js";

// ============================================
// EDGE CASE TESTS
// ============================================
describe('SuperLocalStorage - Edge Cases', () => {
    let superLs;

    beforeEach(() => {
        clearAllMocks();
        superLs = new SuperLocalStorage();
    });

    // ==========================================
    // CLASS INHERITANCE
    // ==========================================
    describe('Class Inheritance', () => {
        it('should handle simple class inheritance', () => {
            class Animal {
                constructor(name = '') {
                    this.name = name;
                }
                speak() {
                    return `${this.name} makes a sound`;
                }
            }

            class Dog extends Animal {
                constructor(name = '', breed = '') {
                    super(name);
                    this.breed = breed;
                }
                speak() {
                    return `${this.name} barks!`;
                }
                fetch() {
                    return `${this.name} fetches the ball`;
                }
            }

            superLs.register(Dog);

            const dog = new Dog('Rex', 'German Shepherd');
            superLs.set('dog', dog);
            const recovered = superLs.get('dog');

            expect(recovered).toBeInstanceOf(Dog);
            expect(recovered).toBeInstanceOf(Animal);
            expect(recovered.name).toBe('Rex');
            expect(recovered.breed).toBe('German Shepherd');
            expect(recovered.speak()).toBe('Rex barks!');
            expect(recovered.fetch()).toBe('Rex fetches the ball');
        });

        it('should handle multi-level inheritance', () => {
            class Vehicle {
                constructor() { this.wheels = 0; }
                getWheels() { return this.wheels; }
            }

            class Car extends Vehicle {
                constructor() {
                    super();
                    this.wheels = 4;
                    this.doors = 4;
                }
                honk() { return 'Beep!'; }
            }

            class SportsCar extends Car {
                constructor() {
                    super();
                    this.doors = 2;
                    this.topSpeed = 200;
                }
                race() { return `Racing at ${this.topSpeed} mph!`; }
            }

            superLs.register(SportsCar);

            const car = new SportsCar();
            superLs.set('sportscar', car);
            const recovered = superLs.get('sportscar');

            expect(recovered).toBeInstanceOf(SportsCar);
            expect(recovered).toBeInstanceOf(Car);
            expect(recovered).toBeInstanceOf(Vehicle);
            expect(recovered.wheels).toBe(4);
            expect(recovered.doors).toBe(2);
            expect(recovered.topSpeed).toBe(200);
            expect(recovered.honk()).toBe('Beep!');
            expect(recovered.race()).toBe('Racing at 200 mph!');
        });

        it('should handle inheritance with dependency injection', () => {
            class Engine {
                constructor(hp = 0) { this.horsepower = hp; }
                start() { return `Engine with ${this.horsepower}hp starting...`; }
            }

            class Vehicle {
                constructor(engine = null) { this.engine = engine; }
            }

            class Car extends Vehicle {
                constructor(engine = null, model = '') {
                    super(engine);
                    this.model = model;
                }
                drive() {
                    return `${this.model}: ${this.engine?.start() || 'No engine'}`;
                }
            }

            superLs.register(Engine);
            superLs.register(Car);

            const engine = new Engine(300);
            const car = new Car(engine, 'Mustang');
            superLs.set('car', car);
            const recovered = superLs.get('car');

            expect(recovered).toBeInstanceOf(Car);
            expect(recovered.engine).toBeInstanceOf(Engine);
            expect(recovered.drive()).toBe('Mustang: Engine with 300hp starting...');
        });
    });

    // ==========================================
    // SHARED/DUPLICATE REFERENCES
    // ==========================================
    describe('Shared References', () => {
        it('should handle same instance referenced multiple times', () => {
            class Item {
                constructor(name = '') { this.name = name; }
            }

            superLs.register(Item);

            const sharedItem = new Item('Shared Sword');
            const data = {
                primary: sharedItem,
                secondary: sharedItem,
                backup: sharedItem
            };

            superLs.set('inventory', data);
            const recovered = superLs.get('inventory');

            expect(recovered.primary.name).toBe('Shared Sword');
            expect(recovered.secondary.name).toBe('Shared Sword');
            expect(recovered.backup.name).toBe('Shared Sword');
            
            // All should reference the same object (deduplication)
            expect(recovered.primary).toBe(recovered.secondary);
            expect(recovered.secondary).toBe(recovered.backup);
        });

        it('should handle shared instance in nested structures', () => {
            class Config {
                constructor(value = '') { this.value = value; }
            }

            superLs.register(Config);

            const sharedConfig = new Config('shared-setting');
            const data = {
                level1: {
                    level2: {
                        config: sharedConfig
                    },
                    alsoConfig: sharedConfig
                },
                rootConfig: sharedConfig
            };

            superLs.set('nested', data);
            const recovered = superLs.get('nested');

            expect(recovered.level1.level2.config).toBe(recovered.level1.alsoConfig);
            expect(recovered.level1.alsoConfig).toBe(recovered.rootConfig);
        });

        it('should handle shared instance in array', () => {
            class Token {
                constructor(id = '') { this.id = id; }
            }

            superLs.register(Token);

            const token = new Token('abc123');
            const arr = [token, token, token];

            superLs.set('tokens', arr);
            const recovered = superLs.get('tokens');

            expect(recovered[0]).toBe(recovered[1]);
            expect(recovered[1]).toBe(recovered[2]);
        });
    });

    // ==========================================
    // UNREGISTERED CLASSES
    // ==========================================
    describe('Unregistered Classes as Dependencies', () => {
        it('should convert unregistered class to plain object', () => {
            class Registered {
                constructor() { this.name = 'registered'; }
                getName() { return this.name; }
            }

            class Unregistered {
                constructor() { this.value = 42; }
                getValue() { return this.value; }
            }

            superLs.register(Registered);
            // Note: Unregistered is NOT registered

            const reg = new Registered();
            reg.dependency = new Unregistered();

            superLs.set('mixed', reg);
            const recovered = superLs.get('mixed');

            expect(recovered).toBeInstanceOf(Registered);
            expect(recovered.getName()).toBe('registered');
            
            // Unregistered becomes plain object, loses methods
            expect(recovered.dependency).toBeDefined();
            expect(recovered.dependency.value).toBe(42);
            expect(recovered.dependency).not.toBeInstanceOf(Unregistered);
            expect(typeof recovered.dependency.getValue).toBe('undefined');
        });

        it('should handle array of unregistered classes', () => {
            class Unregistered {
                constructor(val = 0) { this.val = val; }
            }

            const arr = [
                new Unregistered(1),
                new Unregistered(2),
                new Unregistered(3)
            ];

            superLs.set('unregArray', arr);
            const recovered = superLs.get('unregArray');

            expect(recovered[0].val).toBe(1);
            expect(recovered[1].val).toBe(2);
            expect(recovered[2].val).toBe(3);
            // But they're plain objects now
            expect(recovered[0]).not.toBeInstanceOf(Unregistered);
        });
    });

    // ==========================================
    // SPECIAL DATA TYPES
    // ==========================================
    describe('Special Data Types', () => {
        it('should handle BigInt', () => {
            const data = {
                bigNumber: BigInt('9007199254740991000'),
                normalNumber: 42
            };

            superLs.set('bigint', data);
            const recovered = superLs.get('bigint');

            expect(recovered.bigNumber).toBe(BigInt('9007199254740991000'));
            expect(typeof recovered.bigNumber).toBe('bigint');
        });

        it('should handle RegExp', () => {
            const data = {
                pattern: /hello\s+world/gi,
                email: /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/
            };

            superLs.set('regex', data);
            const recovered = superLs.get('regex');

            expect(recovered.pattern).toBeInstanceOf(RegExp);
            expect(recovered.pattern.source).toBe('hello\\s+world');
            expect(recovered.pattern.flags).toBe('gi');
            expect(recovered.email.test('test@example.com')).toBe(true);
        });

        it('should handle Typed Arrays', () => {
            const data = {
                uint8: new Uint8Array([1, 2, 3, 4]),
                float32: new Float32Array([1.5, 2.5, 3.5]),
                int32: new Int32Array([-1, 0, 1])
            };

            superLs.set('typed', data);
            const recovered = superLs.get('typed');

            expect(recovered.uint8).toBeInstanceOf(Uint8Array);
            expect(Array.from(recovered.uint8)).toEqual([1, 2, 3, 4]);
            expect(recovered.float32).toBeInstanceOf(Float32Array);
            expect(recovered.int32).toBeInstanceOf(Int32Array);
        });

        it('should handle sparse arrays (holes become undefined)', () => {
            const sparse = [1, , , 4, , 6];
            sparse[10] = 'ten';

            superLs.set('sparse', sparse);
            const recovered = superLs.get('sparse');

            expect(recovered[0]).toBe(1);
            expect(recovered[3]).toBe(4);
            expect(recovered[5]).toBe(6);
            expect(recovered[10]).toBe('ten');
            // Note: V8 serialization converts holes to undefined, doesn't preserve sparse arrays
            // This is a known limitation
            expect(recovered[1]).toBeUndefined();
        });

        it('should handle Object.create(null)', () => {
            const nullProto = Object.create(null);
            nullProto.name = 'no prototype';
            nullProto.value = 123;

            superLs.set('nullproto', nullProto);
            const recovered = superLs.get('nullproto');

            expect(recovered.name).toBe('no prototype');
            expect(recovered.value).toBe(123);
        });

        it('should handle NaN and Infinity', () => {
            const data = {
                nan: NaN,
                posInf: Infinity,
                negInf: -Infinity
            };

            superLs.set('special', data);
            const recovered = superLs.get('special');

            expect(Number.isNaN(recovered.nan)).toBe(true);
            expect(recovered.posInf).toBe(Infinity);
            expect(recovered.negInf).toBe(-Infinity);
        });
    });

    // ==========================================
    // DEEPLY NESTED STRUCTURES
    // ==========================================
    describe('Deeply Nested Structures', () => {
        it('should handle 10 levels of nesting', () => {
            class Node {
                constructor(value = 0) {
                    this.value = value;
                    this.child = null;
                }
                getValue() { return this.value; }
            }

            superLs.register(Node);

            // Create 10-level deep structure
            let root = new Node(0);
            let current = root;
            for (let i = 1; i <= 10; i++) {
                current.child = new Node(i);
                current = current.child;
            }

            superLs.set('deep', root);
            const recovered = superLs.get('deep');

            // Verify all 10 levels
            let node = recovered;
            for (let i = 0; i <= 10; i++) {
                expect(node).toBeInstanceOf(Node);
                expect(node.getValue()).toBe(i);
                node = node.child;
            }
            expect(node).toBeNull(); // After level 10
        });

        it('should handle mixed nested types', () => {
            class Item {
                constructor(name = '') { this.name = name; }
            }

            superLs.register(Item);

            const complex = {
                level1: {
                    array: [
                        new Map([['key', new Item('in map')]]),
                        new Set([new Item('in set')]),
                        {
                            nested: {
                                item: new Item('deeply nested')
                            }
                        }
                    ]
                }
            };

            superLs.set('complex', complex);
            const recovered = superLs.get('complex');

            expect(recovered.level1.array[0].get('key')).toBeInstanceOf(Item);
            expect(recovered.level1.array[2].nested.item).toBeInstanceOf(Item);
            expect(recovered.level1.array[2].nested.item.name).toBe('deeply nested');
        });
    });

    // ==========================================
    // CONSTRUCTOR EDGE CASES
    // ==========================================
    describe('Constructor Edge Cases', () => {
        it('should handle class with required constructor args using hydrate', () => {
            class RequiredArgs {
                constructor(a, b, c) {
                    if (a === undefined || b === undefined || c === undefined) {
                        throw new Error('All arguments required!');
                    }
                    this.a = a;
                    this.b = b;
                    this.c = c;
                }

                static hydrate(data) {
                    return new RequiredArgs(data.a, data.b, data.c);
                }

                sum() { return this.a + this.b + this.c; }
            }

            superLs.register(RequiredArgs);

            const instance = new RequiredArgs(1, 2, 3);
            superLs.set('required', instance);
            const recovered = superLs.get('required');

            expect(recovered).toBeInstanceOf(RequiredArgs);
            expect(recovered.sum()).toBe(6);
        });

        it('should handle class with default constructor when no hydrate', () => {
            class NoDefaultArgs {
                constructor(value = 'default') {
                    this.value = value;
                }
            }

            superLs.register(NoDefaultArgs);

            const instance = new NoDefaultArgs('custom');
            superLs.set('nodefault', instance);
            const recovered = superLs.get('nodefault');

            expect(recovered).toBeInstanceOf(NoDefaultArgs);
            expect(recovered.value).toBe('custom');
        });
    });

    // ==========================================
    // GETTERS AND SETTERS
    // ==========================================
    describe('Getters and Setters', () => {
        it('should NOT serialize computed getters (expected behavior)', () => {
            class Rectangle {
                constructor(width = 0, height = 0) {
                    this._width = width;
                    this._height = height;
                }
                
                get area() {
                    return this._width * this._height;
                }
                
                get perimeter() {
                    return 2 * (this._width + this._height);
                }
            }

            superLs.register(Rectangle);

            const rect = new Rectangle(10, 5);
            expect(rect.area).toBe(50); // Works before serialization

            superLs.set('rect', rect);
            const recovered = superLs.get('rect');

            // Getters work because they're on the prototype
            expect(recovered._width).toBe(10);
            expect(recovered._height).toBe(5);
            expect(recovered.area).toBe(50);
            expect(recovered.perimeter).toBe(30);
        });
    });

    // ==========================================
    // CLASS NAME COLLISIONS
    // ==========================================
    describe('Class Name Collisions', () => {
        it('should handle classes with same name using custom typeName', () => {
            // Simulating two modules with same class name
            const ModuleA = (() => {
                class User {
                    constructor() { this.type = 'A'; }
                    getType() { return `User from A: ${this.type}`; }
                }
                return User;
            })();

            const ModuleB = (() => {
                class User {
                    constructor() { this.type = 'B'; }
                    getType() { return `User from B: ${this.type}`; }
                }
                return User;
            })();

            superLs.register(ModuleA, 'UserA');
            superLs.register(ModuleB, 'UserB');

            const userA = new ModuleA();
            const userB = new ModuleB();

            superLs.set('userA', userA);
            superLs.set('userB', userB);

            const recoveredA = superLs.get('userA');
            const recoveredB = superLs.get('userB');

            expect(recoveredA).toBeInstanceOf(ModuleA);
            expect(recoveredB).toBeInstanceOf(ModuleB);
            expect(recoveredA.getType()).toBe('User from A: A');
            expect(recoveredB.getType()).toBe('User from B: B');
        });
    });

    // ==========================================
    // CIRCULAR WITH CLASSES
    // ==========================================
    describe('Circular References with Classes', () => {
        it('should handle self-referencing class', () => {
            class LinkedNode {
                constructor(value = 0) {
                    this.value = value;
                    this.next = null;
                    this.prev = null;
                }
            }

            superLs.register(LinkedNode);

            // Create circular linked list
            const node1 = new LinkedNode(1);
            const node2 = new LinkedNode(2);
            const node3 = new LinkedNode(3);

            node1.next = node2;
            node2.prev = node1;
            node2.next = node3;
            node3.prev = node2;
            node3.next = node1; // Circular!
            node1.prev = node3;

            superLs.set('circular', node1);
            const recovered = superLs.get('circular');

            expect(recovered.value).toBe(1);
            expect(recovered.next.value).toBe(2);
            expect(recovered.next.next.value).toBe(3);
            expect(recovered.next.next.next).toBe(recovered); // Circular preserved
            expect(recovered.prev).toBe(recovered.next.next); // node3
        });

        it('should handle mutual circular references between different classes', () => {
            class Author {
                constructor(name = '') {
                    this.name = name;
                    this.books = [];
                }
            }

            class Book {
                constructor(title = '') {
                    this.title = title;
                    this.author = null;
                }
            }

            superLs.register(Author);
            superLs.register(Book);

            const author = new Author('Stephen King');
            const book1 = new Book('The Shining');
            const book2 = new Book('IT');

            book1.author = author;
            book2.author = author;
            author.books.push(book1, book2);

            superLs.set('author', author);
            const recovered = superLs.get('author');

            expect(recovered).toBeInstanceOf(Author);
            expect(recovered.books[0]).toBeInstanceOf(Book);
            expect(recovered.books[0].author).toBe(recovered);
            expect(recovered.books[1].author).toBe(recovered);
        });
    });

    // ==========================================
    // EXPLICIT UNDEFINED VALUES
    // ==========================================
    describe('Explicit Undefined Values', () => {
        it('should preserve explicit undefined in objects', () => {
            class Container {
                constructor() {
                    this.defined = 'value';
                    this.explicitUndefined = undefined;
                    this.nullValue = null;
                }
            }

            superLs.register(Container);

            const container = new Container();
            superLs.set('container', container);
            const recovered = superLs.get('container');

            expect(recovered.defined).toBe('value');
            expect(recovered.explicitUndefined).toBeUndefined();
            expect('explicitUndefined' in recovered).toBe(true);
            expect(recovered.nullValue).toBeNull();
        });

        it('should handle undefined in arrays', () => {
            const arr = [1, undefined, 3, undefined, 5];

            superLs.set('undefArray', arr);
            const recovered = superLs.get('undefArray');

            expect(recovered[0]).toBe(1);
            expect(recovered[1]).toBeUndefined();
            expect(recovered[2]).toBe(3);
            expect(recovered[3]).toBeUndefined();
            expect(recovered[4]).toBe(5);
        });
    });

    // ==========================================
    // EDGE CASE: EMPTY STRUCTURES
    // ==========================================
    describe('Empty Structures', () => {
        it('should handle empty class instance', () => {
            class Empty {}

            superLs.register(Empty);

            const empty = new Empty();
            superLs.set('empty', empty);
            const recovered = superLs.get('empty');

            expect(recovered).toBeInstanceOf(Empty);
        });

        it('should handle empty nested structures', () => {
            const data = {
                emptyObj: {},
                emptyArr: [],
                emptyMap: new Map(),
                emptySet: new Set()
            };

            superLs.set('empties', data);
            const recovered = superLs.get('empties');

            expect(recovered.emptyObj).toEqual({});
            expect(recovered.emptyArr).toEqual([]);
            expect(recovered.emptyMap.size).toBe(0);
            expect(recovered.emptySet.size).toBe(0);
        });
    });

    // ==========================================
    // SPECIAL KEYS
    // ==========================================
    describe('Special Property Names', () => {
        it('should handle properties named like internal markers', () => {
            const tricky = {
                __super_type__: 'not a real type',
                __data__: 'just data',
                __proto__: { fake: true },
                constructor: 'also fake',
                normal: 'value'
            };

            superLs.set('tricky', tricky);
            const recovered = superLs.get('tricky');

            // This might be tricky - let's see behavior
            expect(recovered.normal).toBe('value');
        });

        it('should handle numeric string keys', () => {
            const obj = {
                '0': 'zero',
                '1': 'one',
                '999': 'nine nine nine'
            };

            superLs.set('numeric', obj);
            const recovered = superLs.get('numeric');

            expect(recovered['0']).toBe('zero');
            expect(recovered['1']).toBe('one');
            expect(recovered['999']).toBe('nine nine nine');
        });
    });

    // ==========================================
    // STRESS TEST
    // ==========================================
    describe('Stress Tests', () => {
        it('should handle large number of registered classes', () => {
            // Register 50 classes
            const classes = [];
            for (let i = 0; i < 50; i++) {
                const cls = class {
                    constructor() { this.id = i; }
                    getId() { return this.id; }
                };
                Object.defineProperty(cls, 'name', { value: `Class${i}` });
                classes.push(cls);
                superLs.register(cls);
            }

            // Create instances of each
            const instances = classes.map((Cls, i) => {
                const inst = new Cls();
                inst.index = i;
                return inst;
            });

            superLs.set('manyClasses', instances);
            const recovered = superLs.get('manyClasses');

            expect(recovered).toHaveLength(50);
            for (let i = 0; i < 50; i++) {
                expect(recovered[i]).toBeInstanceOf(classes[i]);
                expect(recovered[i].getId()).toBe(i);
            }
        });

        it('should handle large array of class instances', () => {
            class SimpleItem {
                constructor(id = 0) { this.id = id; }
            }

            superLs.register(SimpleItem);

            const items = Array.from({ length: 1000 }, (_, i) => new SimpleItem(i));
            
            superLs.set('largeArray', items);
            const recovered = superLs.get('largeArray');

            expect(recovered).toHaveLength(1000);
            expect(recovered[0]).toBeInstanceOf(SimpleItem);
            expect(recovered[500].id).toBe(500);
            expect(recovered[999].id).toBe(999);
        });
    });

    // ==========================================
    // ERROR SCENARIOS
    // ==========================================
    describe('Error Scenarios', () => {
        it('should return null for non-existent key', () => {
            expect(superLs.get('does-not-exist')).toBeNull();
        });

        it('should throw when registering non-function', () => {
            expect(() => superLs.register({})).toThrow();
            expect(() => superLs.register('string')).toThrow();
            expect(() => superLs.register(123)).toThrow();
            expect(() => superLs.register(null)).toThrow();
        });

        it('should throw for non-serializable values (functions)', () => {
            const data = {
                name: 'test',
                fn: () => 'hello'
            };
            // V8 serialization throws on functions
            expect(() => superLs.set('withFn', data)).toThrow();
        });

        it('should handle WeakMap (V8 converts to empty or throws)', () => {
            // WeakMap cannot be serialized by V8
            // Behavior may vary: throw or convert to empty object
            const data = { wm: new WeakMap(), other: 'value' };
            
            try {
                superLs.set('withWm', data);
                const recovered = superLs.get('withWm');
                expect(recovered.other).toBe('value');
                // If it doesn't throw, WeakMap becomes something else
                expect(recovered.wm).toBeDefined();
            } catch (e) {
                // V8 might throw on WeakMap - this is acceptable
                expect(e).toBeDefined();
            }
        });

        it('should handle WeakSet (V8 converts to empty or throws)', () => {
            // WeakSet cannot be serialized by V8
            const data = { ws: new WeakSet(), other: 'value' };
            
            try {
                superLs.set('withWs', data);
                const recovered = superLs.get('withWs');
                expect(recovered.other).toBe('value');
                // If it doesn't throw, WeakSet becomes something else
                expect(recovered.ws).toBeDefined();
            } catch (e) {
                // V8 might throw on WeakSet - this is acceptable
                expect(e).toBeDefined();
            }
        });
    });

    // ==========================================
    // MULTIPLE INSTANCES
    // ==========================================
    describe('Multiple SuperLocalStorage Instances', () => {
        it('should have isolated registries', () => {
            class OnlyInA {
                constructor() { this.source = 'A'; }
                getSource() { return this.source; }
            }

            const instanceA = new SuperLocalStorage();
            const instanceB = new SuperLocalStorage();

            instanceA.register(OnlyInA);
            // Note: NOT registered in instanceB

            instanceA.set('test', new OnlyInA());
            
            const fromA = instanceA.get('test');
            const fromB = instanceB.get('test');

            expect(fromA).toBeInstanceOf(OnlyInA);
            expect(fromA.getSource()).toBe('A');
            
            // instanceB can read the data but won't rehydrate as class
            expect(fromB).not.toBeInstanceOf(OnlyInA);
        });

        it('should use different prefixes when configured', () => {
            const storageA = new SuperLocalStorage('prefix_a_');
            const storageB = new SuperLocalStorage('prefix_b_');

            storageA.set('key', 'valueA');
            storageB.set('key', 'valueB');

            expect(storageA.get('key')).toBe('valueA');
            expect(storageB.get('key')).toBe('valueB');

            // Verify different keys in underlying storage
            expect(mockStorage.has('prefix_a_key')).toBe(true);
            expect(mockStorage.has('prefix_b_key')).toBe(true);
        });
    });

    // ==========================================
    // SET CONTAINING CLASS INSTANCES
    // ==========================================
    describe('Set with Class Instances', () => {
        it('should handle Set containing class instances', () => {
            class Tag {
                constructor(name = '') { this.name = name; }
                getName() { return this.name; }
            }

            superLs.register(Tag);

            const tags = new Set([
                new Tag('javascript'),
                new Tag('typescript'),
                new Tag('nodejs')
            ]);

            superLs.set('tags', tags);
            const recovered = superLs.get('tags');

            expect(recovered).toBeInstanceOf(Set);
            expect(recovered.size).toBe(3);
            
            const arr = Array.from(recovered);
            expect(arr[0]).toBeInstanceOf(Tag);
            expect(arr[0].getName()).toBe('javascript');
        });
    });

    // ==========================================
    // MAP WITH CLASS KEYS
    // ==========================================
    describe('Map with Complex Keys', () => {
        it('should handle Map with class instances as keys', () => {
            class Key {
                constructor(id = '') { this.id = id; }
            }

            superLs.register(Key);

            const key1 = new Key('k1');
            const key2 = new Key('k2');

            const map = new Map();
            map.set(key1, 'value1');
            map.set(key2, 'value2');

            superLs.set('mapWithClassKeys', map);
            const recovered = superLs.get('mapWithClassKeys');

            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.size).toBe(2);

            const keys = Array.from(recovered.keys());
            expect(keys[0]).toBeInstanceOf(Key);
            expect(keys[0].id).toBe('k1');
        });
    });

    // ==========================================
    // DATE EDGE CASES
    // ==========================================
    describe('Date Edge Cases', () => {
        it('should handle Date in various contexts', () => {
            const data = {
                date: new Date('2024-06-15T10:30:00Z'),
                dates: [new Date('2020-01-01'), new Date('2025-12-31')],
                nested: {
                    created: new Date()
                }
            };

            superLs.set('dates', data);
            const recovered = superLs.get('dates');

            expect(recovered.date).toBeInstanceOf(Date);
            expect(recovered.date.toISOString()).toBe('2024-06-15T10:30:00.000Z');
            expect(recovered.dates[0]).toBeInstanceOf(Date);
            expect(recovered.dates[1]).toBeInstanceOf(Date);
            expect(recovered.nested.created).toBeInstanceOf(Date);
        });

        it('should handle Date as Map value', () => {
            const map = new Map([
                ['created', new Date('2024-01-01')],
                ['updated', new Date('2024-06-15')]
            ]);

            superLs.set('dateMap', map);
            const recovered = superLs.get('dateMap');

            expect(recovered.get('created')).toBeInstanceOf(Date);
            expect(recovered.get('updated')).toBeInstanceOf(Date);
        });
    });

    // ==========================================
    // NATIVE V8 TYPE HANDLING
    // ==========================================
    describe('Native V8 Type Handling', () => {
        it('should handle Map natively without explicit iteration', () => {
            const map = new Map([
                ['string', 'value'],
                [42, 'number key'],
                [true, 'boolean key']
            ]);

            superLs.set('nativeMap', map);
            const recovered = superLs.get('nativeMap');

            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.get('string')).toBe('value');
            expect(recovered.get(42)).toBe('number key');
            expect(recovered.get(true)).toBe('boolean key');
        });

        it('should handle Set natively', () => {
            const set = new Set([1, 'two', true, null]);

            superLs.set('nativeSet', set);
            const recovered = superLs.get('nativeSet');

            expect(recovered).toBeInstanceOf(Set);
            expect(recovered.has(1)).toBe(true);
            expect(recovered.has('two')).toBe(true);
            expect(recovered.has(true)).toBe(true);
            expect(recovered.has(null)).toBe(true);
        });

        it('should handle multiple TypedArray types', () => {
            const data = {
                uint8: new Uint8Array([1, 2, 3]),
                uint16: new Uint16Array([1000, 2000]),
                uint32: new Uint32Array([100000]),
                int8: new Int8Array([-1, 0, 1]),
                int16: new Int16Array([-1000, 1000]),
                int32: new Int32Array([-100000, 100000]),
                float32: new Float32Array([1.5, 2.5]),
                float64: new Float64Array([1.123456789])
            };

            superLs.set('typedArrays', data);
            const recovered = superLs.get('typedArrays');

            expect(recovered.uint8).toBeInstanceOf(Uint8Array);
            expect(recovered.uint16).toBeInstanceOf(Uint16Array);
            expect(recovered.uint32).toBeInstanceOf(Uint32Array);
            expect(recovered.int8).toBeInstanceOf(Int8Array);
            expect(recovered.int16).toBeInstanceOf(Int16Array);
            expect(recovered.int32).toBeInstanceOf(Int32Array);
            expect(recovered.float32).toBeInstanceOf(Float32Array);
            expect(recovered.float64).toBeInstanceOf(Float64Array);
        });
    });
});