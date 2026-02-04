
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuperLocalStorage } from "../index.js"
import { clearAllMocks, mockStorage } from './__mocks__.js';

// ============================================
// Test Classes
// ============================================
class Player {
    constructor(name = '', score = 0) {
        this.name = name;
        this.score = score;
    }

    greet() {
        return `Hello, I am ${this.name}!`;
    }

    addScore(points) {
        this.score += points;
        return this.score;
    }
}

class GameState {
    constructor() {
        this.level = 1;
        this.players = [];
        this.hydrated = false;
    }

    static hydrate(data) {
        const instance = new GameState();
        instance.level = data.level;
        instance.players = data.players || [];
        instance.hydrated = true;
        return instance;
    }
}

// ============================================
// Dependency Injection Test Classes
// ============================================

// Simple dependency: Weapon class
class Weapon {
    constructor(name = '', damage = 0) {
        this.name = name;
        this.damage = damage;
    }

    attack() {
        return `Attacks with ${this.name} for ${this.damage} damage!`;
    }
}

// Class with single dependency
class Warrior {
    constructor(name = '', weapon = null) {
        this.name = name;
        this.weapon = weapon; // Dependency: Weapon instance
        this.health = 100;
    }

    fight() {
        if (!this.weapon) return `${this.name} has no weapon!`;
        return `${this.name} ${this.weapon.attack()}`;
    }

    getWeaponDamage() {
        return this.weapon?.damage || 0;
    }
}

// Nested dependency: Armor depends on Material
class Material {
    constructor(name = '', resistance = 0) {
        this.name = name;
        this.resistance = resistance;
    }

    getProtection() {
        return this.resistance * 2;
    }
}

class Armor {
    constructor(type = '', material = null) {
        this.type = type;
        this.material = material; // Dependency: Material instance
    }

    getDefense() {
        const baseDefense = this.type === 'heavy' ? 50 : 25;
        return baseDefense + (this.material?.getProtection() || 0);
    }
}

// Class with multiple dependencies
class Knight {
    constructor(name = '') {
        this.name = name;
        this.weapon = null;  // Dependency: Weapon
        this.armor = null;   // Dependency: Armor (which has Material)
        this.level = 1;
    }

    equip(weapon, armor) {
        this.weapon = weapon;
        this.armor = armor;
    }

    getStats() {
        return {
            name: this.name,
            attack: this.weapon?.damage || 0,
            defense: this.armor?.getDefense() || 0,
            level: this.level
        };
    }

    battleCry() {
        return `${this.name} charges with ${this.weapon?.name || 'bare fists'}!`;
    }
}

// Service-like classes (IoC pattern)
class Logger {
    constructor(prefix = '[LOG]') {
        this.prefix = prefix;
        this.logs = [];
    }

    log(message) {
        const entry = `${this.prefix} ${message}`;
        this.logs.push(entry);
        return entry;
    }

    getLogs() {
        return [...this.logs];
    }
}

class Database {
    constructor() {
        this.data = new Map();
        this.connected = false;
    }

    connect() {
        this.connected = true;
    }

    save(key, value) {
        this.data.set(key, value);
    }

    get(key) {
        return this.data.get(key);
    }
}

class UserService {
    constructor(database = null, logger = null) {
        this.database = database;  // Dependency: Database
        this.logger = logger;      // Dependency: Logger
        this.serviceName = 'UserService';
    }

    createUser(id, name) {
        this.logger?.log(`Creating user: ${name}`);
        this.database?.save(id, { id, name });
        return { id, name };
    }

    getUser(id) {
        return this.database?.get(id) || null;
    }

    static hydrate(data) {
        const instance = new UserService();
        instance.serviceName = data.serviceName;

        // Manually reconstruct dependencies if they exist
        if (data.database) {
            instance.database = new Database();
            instance.database.connected = data.database.connected;
            if (data.database.data) {
                instance.database.data = new Map(Object.entries(data.database.data));
            }
        }

        if (data.logger) {
            instance.logger = new Logger(data.logger.prefix);
            instance.logger.logs = data.logger.logs || [];
        }

        return instance;
    }
}

// Circular dependency classes
class Parent {
    constructor(name = '') {
        this.name = name;
        this.children = []; // Will contain Child instances
    }

    addChild(child) {
        this.children.push(child);
        child.parent = this;
    }

    getChildrenNames() {
        return this.children.map(c => c.name);
    }
}

class Child {
    constructor(name = '') {
        this.name = name;
        this.parent = null; // Will reference Parent instance
    }

    getParentName() {
        return this.parent?.name || 'orphan';
    }
}

// ============================================
// TESTS
// ============================================
describe('SuperLocalStorage', () => {
    let superLs = new SuperLocalStorage();

    beforeEach(() => {
        clearAllMocks();
        superLs = new SuperLocalStorage();
    });

    describe('Basic JavaScript Types', () => {
        it('should store and retrieve simple objects', () => {
            const obj = { name: 'Test', value: 123, active: true };
            superLs.set('obj', obj);

            const recovered = superLs.get('obj');

            expect(recovered.name).toBe('Test');
            expect(recovered.value).toBe(123);
            expect(recovered.active).toBe(true);
        });

        it('should store and retrieve arrays', () => {
            const arr = [1, 2, 3, 'four', null];
            superLs.set('arr', arr);

            const recovered = superLs.get('arr');

            expect(recovered).toHaveLength(5);
            expect(recovered[3]).toBe('four');
            expect(recovered[4]).toBeNull();
        });

        it('should store and retrieve Map', () => {
            const map = new Map([['a', 1], ['b', 2]]);
            superLs.set('map', map);

            const recovered = superLs.get('map');

            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.get('a')).toBe(1);
            expect(recovered.size).toBe(2);
        });

        it('should store and retrieve Set', () => {
            const set = new Set([1, 2, 3, 3, 3]);
            superLs.set('set', set);

            const recovered = superLs.get('set');

            expect(recovered).toBeInstanceOf(Set);
            expect(recovered.size).toBe(3);
            expect(recovered.has(2)).toBe(true);
        });

        it('should store and retrieve Date', () => {
            const date = new Date('2024-06-15T12:00:00Z');
            superLs.set('date', date);

            const recovered = superLs.get('date');

            expect(recovered).toBeInstanceOf(Date);
            expect(recovered.toISOString()).toBe(date.toISOString());
        });

        it('should store and retrieve undefined', () => {
            superLs.set('undef', undefined);

            const recovered = superLs.get('undef');

            expect(recovered).toBeUndefined();
        });

        it('should store and retrieve null', () => {
            superLs.set('null', null);

            const recovered = superLs.get('null');

            expect(recovered).toBeNull();
        });

        it('should store and retrieve special numbers (NaN, Infinity)', () => {
            superLs.set('special', { nan: NaN, inf: Infinity, negInf: -Infinity });

            const recovered = superLs.get('special');

            expect(recovered.nan).toBeNaN();
            expect(recovered.inf).toBe(Infinity);
            expect(recovered.negInf).toBe(-Infinity);
        });

        it('should store and retrieve circular references', () => {
            const obj = { name: 'circular' };
            obj.self = obj;
            superLs.set('circular', obj);

            const recovered = superLs.get('circular');

            expect(recovered.name).toBe('circular');
            expect(recovered.self).toBe(recovered);
        });
    });

    describe('Registered Classes', () => {
        beforeEach(() => {
            superLs.register(Player);
            superLs.register(GameState);
        });

        it('should store and retrieve class instances', () => {
            const player = new Player('Alice', 100);
            superLs.set('player', player);

            const recovered = superLs.get('player');

            expect(recovered).toBeInstanceOf(Player);
            expect(recovered.name).toBe('Alice');
            expect(recovered.score).toBe(100);
        });

        it('should preserve class methods', () => {
            const player = new Player('Bob', 50);
            superLs.set('player', player);

            const recovered = superLs.get('player');

            expect(recovered.greet()).toBe('Hello, I am Bob!');
            expect(recovered.addScore(25)).toBe(75);
        });

        it('should use static hydrate() when defined', () => {
            const game = new GameState();
            game.level = 5;
            game.players = ['Alice', 'Bob'];
            superLs.set('game', game);

            const recovered = superLs.get('game');

            expect(recovered).toBeInstanceOf(GameState);
            expect(recovered.hydrated).toBe(true);
            expect(recovered.level).toBe(5);
            expect(recovered.players).toEqual(['Alice', 'Bob']);
        });

        it('should handle multiple instances of the same class', () => {
            superLs.set('p1', new Player('P1', 10));
            superLs.set('p2', new Player('P2', 20));
            superLs.set('p3', new Player('P3', 30));

            const r1 = superLs.get('p1');
            const r2 = superLs.get('p2');
            const r3 = superLs.get('p3');

            expect(r1.name).toBe('P1');
            expect(r2.name).toBe('P2');
            expect(r3.name).toBe('P3');
            expect(r1).not.toBe(r2);
            expect(r2).not.toBe(r3);
        });

        it('should allow registration with custom typeName', () => {
            class CustomClass {
                constructor() { this.val = 42; }
                getValue() { return this.val * 2; }
            }

            superLs.register(CustomClass, 'MyCustomClass');
            const instance = new CustomClass();
            superLs.set('custom', instance);

            const recovered = superLs.get('custom');

            expect(recovered).toBeInstanceOf(CustomClass);
            expect(recovered.val).toBe(42);
            expect(recovered.getValue()).toBe(84);
        });
    });

    // ============================================
    // DEPENDENCY INJECTION TESTS
    // ============================================
    describe('Dependency Injection - Single Dependency', () => {
        beforeEach(() => {
            superLs.register(Weapon);
            superLs.register(Warrior);
        });

        it('should store and retrieve class with single dependency', () => {
            const sword = new Weapon('Excalibur', 50);
            const warrior = new Warrior('Arthur', sword);

            superLs.set('warrior', warrior);
            const recovered = superLs.get('warrior');

            expect(recovered).toBeInstanceOf(Warrior);
            expect(recovered.name).toBe('Arthur');
            expect(recovered.weapon).toBeDefined();
            expect(recovered.weapon.name).toBe('Excalibur');
            expect(recovered.weapon.damage).toBe(50);
        });

        it('should preserve dependency methods', () => {
            const axe = new Weapon('Battle Axe', 75);
            const warrior = new Warrior('Ragnar', axe);

            superLs.set('viking', warrior);
            const recovered = superLs.get('viking');

            expect(recovered.fight()).toBe('Ragnar Attacks with Battle Axe for 75 damage!');
            expect(recovered.getWeaponDamage()).toBe(75);
        });

        it('should handle null dependency gracefully', () => {
            const unarmedWarrior = new Warrior('Peasant', null);

            superLs.set('peasant', unarmedWarrior);
            const recovered = superLs.get('peasant');

            expect(recovered.weapon).toBeNull();
            expect(recovered.fight()).toBe('Peasant has no weapon!');
            expect(recovered.getWeaponDamage()).toBe(0);
        });

        it('should preserve dependency as proper class instance', () => {
            const dagger = new Weapon('Shadow Dagger', 30);
            const assassin = new Warrior('Shadow', dagger);

            superLs.set('assassin', assassin);
            const recovered = superLs.get('assassin');

            // Verify the dependency is a proper Weapon instance
            expect(recovered.weapon).toBeInstanceOf(Weapon);
            expect(recovered.weapon.attack()).toBe('Attacks with Shadow Dagger for 30 damage!');
        });
    });

    describe('Dependency Injection - Nested Dependencies', () => {
        beforeEach(() => {
            superLs.register(Material);
            superLs.register(Armor);
            superLs.register(Weapon);
            superLs.register(Knight);
        });

        it('should store and retrieve class with nested dependencies', () => {
            const steel = new Material('Steel', 25);
            const plateArmor = new Armor('heavy', steel);
            const sword = new Weapon('Longsword', 40);

            const knight = new Knight('Lancelot');
            knight.equip(sword, plateArmor);

            superLs.set('knight', knight);
            const recovered = superLs.get('knight');

            expect(recovered).toBeInstanceOf(Knight);
            expect(recovered.name).toBe('Lancelot');

            // Check weapon dependency
            expect(recovered.weapon).toBeDefined();
            expect(recovered.weapon.name).toBe('Longsword');

            // Check armor dependency
            expect(recovered.armor).toBeDefined();
            expect(recovered.armor.type).toBe('heavy');

            // Check nested material dependency
            expect(recovered.armor.material).toBeDefined();
            expect(recovered.armor.material.name).toBe('Steel');
        });

        it('should preserve nested dependency methods', () => {
            const mithril = new Material('Mithril', 50);
            const elvenArmor = new Armor('light', mithril);
            const bow = new Weapon('Elven Bow', 35);

            const knight = new Knight('Legolas');
            knight.equip(bow, elvenArmor);

            superLs.set('elf', knight);
            const recovered = superLs.get('elf');

            // Test nested method chain
            expect(recovered.armor.material.getProtection()).toBe(100); // 50 * 2
            expect(recovered.armor.getDefense()).toBe(125); // 25 (light) + 100

            const stats = recovered.getStats();
            expect(stats.attack).toBe(35);
            expect(stats.defense).toBe(125);
        });

        it('should preserve nested dependencies as proper class instances', () => {
            const iron = new Material('Iron', 15);
            const chainmail = new Armor('light', iron);
            const mace = new Weapon('War Mace', 45);

            const knight = new Knight('Gawain');
            knight.equip(mace, chainmail);

            superLs.set('knight2', knight);
            const recovered = superLs.get('knight2');

            expect(recovered.weapon).toBeInstanceOf(Weapon);
            expect(recovered.armor).toBeInstanceOf(Armor);
            expect(recovered.armor.material).toBeInstanceOf(Material);
        });
    });

    describe('Dependency Injection - Multiple Dependencies (IoC Pattern)', () => {
        beforeEach(() => {
            superLs.register(Logger);
            superLs.register(Database);
            superLs.register(UserService);
        });

        it('should store and retrieve service with multiple dependencies', () => {
            const logger = new Logger('[UserService]');
            const database = new Database();
            database.connect();

            const userService = new UserService(database, logger);

            superLs.set('userService', userService);
            const recovered = superLs.get('userService');

            expect(recovered).toBeInstanceOf(UserService);
            expect(recovered.serviceName).toBe('UserService');
            expect(recovered.database).toBeDefined();
            expect(recovered.logger).toBeDefined();
        });

        it('should handle service with state in dependencies', () => {
            const logger = new Logger('[APP]');
            logger.log('Application started');
            logger.log('Loading config');

            const database = new Database();
            database.connect();
            database.save('user1', { id: 'user1', name: 'John' });

            const userService = new UserService(database, logger);
            userService.createUser('user2', 'Jane');

            superLs.set('service', userService);
            const recovered = superLs.get('service');

            // Check logger state preserved
            expect(recovered.logger.prefix).toBe('[APP]');
            expect(recovered.logger.logs).toContain('[APP] Application started');
            expect(recovered.logger.logs).toContain('[APP] Creating user: Jane');
        });

        it('should work with services using static hydrate', () => {
            const logger = new Logger('[HYDRATE]');
            logger.log('Test message');

            const database = new Database();
            database.save('key1', { data: 'value1' });

            const service = new UserService(database, logger);

            superLs.set('hydratedService', service);
            const recovered = superLs.get('hydratedService');

            expect(recovered).toBeInstanceOf(UserService);
            // Note: Due to hydrate, logger and database are reconstructed
            expect(recovered.logger).toBeDefined();
            expect(recovered.database).toBeDefined();
        });
    });

    describe('Dependency Injection - Circular Dependencies', () => {
        beforeEach(() => {
            superLs.register(Parent);
            superLs.register(Child);
        });

        it('should handle parent-child circular references', () => {
            const parent = new Parent('John');
            const child1 = new Child('Alice');
            const child2 = new Child('Bob');

            parent.addChild(child1);
            parent.addChild(child2);

            superLs.set('family', parent);
            const recovered = superLs.get('family');

            expect(recovered.name).toBe('John');
            expect(recovered.children).toHaveLength(2);
            expect(recovered.getChildrenNames()).toEqual(['Alice', 'Bob']);
        });

        it('should preserve bidirectional references', () => {
            const parent = new Parent('Mary');
            const child = new Child('Tom');

            parent.addChild(child);

            superLs.set('parentChild', parent);
            const recovered = superLs.get('parentChild');

            // Child should reference back to parent
            const recoveredChild = recovered.children[0];
            expect(recoveredChild.getParentName()).toBe('Mary');
            expect(recoveredChild.parent).toBe(recovered);
        });
    });

    describe('Dependency Injection - Array of Dependencies', () => {
        beforeEach(() => {
            superLs.register(Weapon);
            superLs.register(Warrior);
        });

        it('should handle array of class instances as dependency', () => {
            // Create multiple weapons
            const weapons = [
                new Weapon('Sword', 30),
                new Weapon('Axe', 40),
                new Weapon('Bow', 25)
            ];

            // Store as plain object with array of registered classes
            const armory = { weapons, owner: 'Kingdom' };

            superLs.set('armory', armory);
            const recovered = superLs.get('armory');

            expect(recovered.weapons).toHaveLength(3);
            expect(recovered.weapons[0]).toBeInstanceOf(Weapon);
            expect(recovered.weapons[1].attack()).toBe('Attacks with Axe for 40 damage!');
        });

        it('should handle Map with class instances as values', () => {
            const inventory = new Map();
            inventory.set('primary', new Weapon('Main Sword', 50));
            inventory.set('secondary', new Weapon('Dagger', 20));

            superLs.set('inventory', inventory);
            const recovered = superLs.get('inventory');

            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.get('primary')).toBeInstanceOf(Weapon);
            expect(recovered.get('secondary').damage).toBe(20);
        });
    });

    describe('Complex Cases', () => {
        it('should handle nested objects with Map', () => {
            const nested = {
                level1: {
                    level2: {
                        config: new Map([['theme', 'dark'], ['lang', 'en']])
                    }
                }
            };
            superLs.set('nested', nested);

            const recovered = superLs.get('nested');

            expect(recovered.level1.level2.config).toBeInstanceOf(Map);
            expect(recovered.level1.level2.config.get('theme')).toBe('dark');
        });

        it('should handle arrays with mixed types', () => {
            const arr = [1, 'two', new Date('2024-01-01'), new Set([1, 2, 3])];
            superLs.set('mixed', arr);

            const recovered = superLs.get('mixed');

            expect(recovered[0]).toBe(1);
            expect(recovered[1]).toBe('two');
            expect(recovered[2]).toBeInstanceOf(Date);
            expect(recovered[3]).toBeInstanceOf(Set);
        });

        it('should return null for non-existent keys', () => {
            const result = superLs.get('does_not_exist');

            expect(result).toBeNull();
        });
    });

    describe('README Validation', () => {
        it('Basic Usage: Map with user_settings', () => {
            const myMap = new Map();
            myMap.set("user_id", 12345);
            myMap.set("roles", ["admin", "editor"]);

            superLs.set("user_settings", myMap);
            const recoveredSettings = superLs.get("user_settings");

            expect(recoveredSettings).toBeInstanceOf(Map);
            expect(recoveredSettings.get("user_id")).toBe(12345);
            expect(recoveredSettings.get("roles")).toEqual(["admin", "editor"]);
        });

        it('Class Hydration: Player with methods', () => {
            superLs.register(Player);

            const p1 = new Player("Alice", 100);
            superLs.set("player_1", p1);
            const restoredPlayer = superLs.get("player_1");

            expect(restoredPlayer.name).toBe("Alice");
            expect(restoredPlayer.greet()).toBe("Hello, I am Alice!");
            expect(restoredPlayer).toBeInstanceOf(Player);
        });
    });

    describe('Internals (Under the Hood - V8 Native Serialization)', () => {
        it('should use V8 native serialization with Base64 encoding', () => {
            superLs.set('internal', { a: 1 });

            const raw = mockStorage.get('__sls__internal');

            // Should be a Base64-encoded string
            expect(typeof raw).toBe('string');

            // Should be valid Base64 (decodable)
            expect(() => t.core.buffer.fromBase64(raw)).not.toThrow();

            // Decoded should be Uint8Array
            const bytes = t.core.buffer.fromBase64(raw);
            expect(bytes).toBeInstanceOf(Uint8Array);
        });

        it('should add __super_type__ metadata for registered classes', () => {
            superLs.register(Player);
            superLs.set('meta', new Player('Test', 50));

            const raw = mockStorage.get('__sls__meta');

            // Decode and deserialize
            const bytes = t.core.buffer.fromBase64(raw);
            const parsed = t.ls.deserialize(bytes);

            expect(parsed.__super_type__).toBe('Player');
            expect(parsed.__data__).toBeDefined();
            expect(parsed.__data__.name).toBe('Test');
        });

        it('should use t.ls.serialize for serialization', () => {
            const data = { test: 'value', num: 42 };
            superLs.set('serializeTest', data);

            const raw = mockStorage.get('__sls__serializeTest');
            const bytes = t.core.buffer.fromBase64(raw);
            const deserialized = t.ls.deserialize(bytes);

            expect(deserialized.test).toBe('value');
            expect(deserialized.num).toBe(42);
        });

        it('should handle native V8 types (Map, Set, Date) directly', () => {
            const data = {
                map: new Map([['key', 'value']]),
                set: new Set([1, 2, 3]),
                date: new Date('2024-06-15')
            };
            superLs.set('nativeTypes', data);

            const raw = mockStorage.get('__sls__nativeTypes');
            const bytes = t.core.buffer.fromBase64(raw);
            const deserialized = t.ls.deserialize(bytes);

            // V8 handles these natively
            expect(deserialized.map).toBeInstanceOf(Map);
            expect(deserialized.set).toBeInstanceOf(Set);
            expect(deserialized.date).toBeInstanceOf(Date);
        });
    });

    describe('Direct Serialization API', () => {
        it('should expose serialize() method', () => {
            const data = { name: 'test', values: [1, 2, 3] };
            const bytes = superLs.serialize(data);

            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(bytes.length).toBeGreaterThan(0);
        });

        it('should expose deserialize() method', () => {
            const original = {
                name: 'test',
                map: new Map([['a', 1]]),
                date: new Date()
            };
            const bytes = superLs.serialize(original);
            const restored = superLs.deserialize(bytes);

            expect(restored.name).toBe('test');
            expect(restored.map).toBeInstanceOf(Map);
            expect(restored.map.get('a')).toBe(1);
            expect(restored.date).toBeInstanceOf(Date);
        });

        it('should serialize and deserialize class instances', () => {
            superLs.register(Player);

            const player = new Player('SerializeTest', 999);
            const bytes = superLs.serialize(player);
            const restored = superLs.deserialize(bytes);

            expect(restored).toBeInstanceOf(Player);
            expect(restored.name).toBe('SerializeTest');
            expect(restored.greet()).toBe('Hello, I am SerializeTest!');
        });
    });

    describe('Temporary Storage (In-Memory)', () => {
        it('should store and retrieve with setTemp/getTemp', () => {
            const obj = { cached: true, timestamp: Date.now() };
            superLs.setTemp('cache', obj);

            const retrieved = superLs.getTemp('cache');
            expect(retrieved).toEqual(obj);
        });

        it('should not serialize temp storage (preserves functions)', () => {
            const withFn = {
                value: 42,
                compute: (x) => x * 2
            };
            superLs.setTemp('withFn', withFn);

            const retrieved = superLs.getTemp('withFn');
            expect(typeof retrieved.compute).toBe('function');
            expect(retrieved.compute(5)).toBe(10);
        });

        it('should be independent from persistent storage', () => {
            superLs.set('key', 'persistent');
            superLs.setTemp('key', 'temporary');

            expect(superLs.get('key')).toBe('persistent');
            expect(superLs.getTemp('key')).toBe('temporary');
        });

        it('should support resolveTemp for memoization', () => {
            let computeCount = 0;
            const expensive = () => {
                computeCount++;
                return { result: Math.random() };
            };

            const r1 = superLs.resolveTemp('memoized', expensive);
            const r2 = superLs.resolveTemp('memoized', expensive);

            expect(computeCount).toBe(1);
            expect(r1).toBe(r2);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when registering non-class values', () => {
            expect(() => superLs.register('not a class')).toThrow();
            expect(() => superLs.register(123)).toThrow();
            expect(() => superLs.register(null)).toThrow();
        });

        it('should throw for functions (non-serializable by V8)', () => {
            const data = {
                name: 'test',
                fn: () => 'hello'
            };
            expect(() => superLs.set('withFn', data)).toThrow();
        });
    });
});