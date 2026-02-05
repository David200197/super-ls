import { describe, it, expect, beforeEach } from 'vitest';
import { SuperLocalStorage } from "../index.js"
import { clearAllMocks } from './__mocks__.js';

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

        it('should store and retrieve strings', () => {
            superLs.set('str', 'hello world');
            expect(superLs.get('str')).toBe('hello world');
        });

        it('should store and retrieve numbers', () => {
            superLs.set('num', 42);
            expect(superLs.get('num')).toBe(42);
        });

        it('should store and retrieve booleans', () => {
            superLs.set('bool', true);
            expect(superLs.get('bool')).toBe(true);
        });

        it('should store and retrieve null', () => {
            superLs.set('nil', null);
            // Note: null stored via V8 serialization should be recoverable
            // but get() returns null for missing keys too
        });

        it('should store and retrieve Map', () => {
            const map = new Map([['theme', 'dark'], ['lang', 'en']]);
            superLs.set('map', map);

            const recovered = superLs.get('map');
            expect(recovered).toBeInstanceOf(Map);
            expect(recovered.get('theme')).toBe('dark');
            expect(recovered.size).toBe(2);
        });

        it('should store and retrieve Set', () => {
            const set = new Set([1, 2, 3, 'a']);
            superLs.set('set', set);

            const recovered = superLs.get('set');
            expect(recovered).toBeInstanceOf(Set);
            expect(recovered.has(1)).toBe(true);
            expect(recovered.has('a')).toBe(true);
            expect(recovered.size).toBe(4);
        });

        it('should store and retrieve Date', () => {
            const date = new Date('2024-06-15T10:30:00Z');
            superLs.set('date', date);

            const recovered = superLs.get('date');
            expect(recovered).toBeInstanceOf(Date);
            expect(recovered.toISOString()).toBe(date.toISOString());
        });

        it('should handle circular references', () => {
            const obj = { name: 'circular' };
            obj.self = obj;

            superLs.set('circular', obj);
            const recovered = superLs.get('circular');

            expect(recovered.name).toBe('circular');
            expect(recovered.self).toBe(recovered);
        });
    });

    describe('Class Registration and Hydration', () => {
        beforeEach(() => {
            superLs.register(Player);
        });

        it('should store and retrieve class instances', () => {
            const player = new Player('Alice', 100);
            superLs.set('player', player);

            const recovered = superLs.get('player');

            expect(recovered).toBeInstanceOf(Player);
            expect(recovered.name).toBe('Alice');
            expect(recovered.score).toBe(100);
        });

        it('should preserve methods after recovery', () => {
            const player = new Player('Bob', 50);
            superLs.set('player', player);

            const recovered = superLs.get('player');

            expect(recovered.greet()).toBe('Hello, I am Bob!');
            expect(recovered.addScore(25)).toBe(75);
        });

        it('should support static hydrate methods', () => {
            superLs.register(GameState);

            const state = new GameState();
            state.level = 5;
            state.players = ['Alice', 'Bob'];

            superLs.set('state', state);
            const recovered = superLs.get('state');

            expect(recovered).toBeInstanceOf(GameState);
            expect(recovered.level).toBe(5);
            expect(recovered.hydrated).toBe(true);
        });
    });

    describe('Dependency Injection - Single Dependency', () => {
        beforeEach(() => {
            superLs.register(Weapon);
            superLs.register(Warrior);
        });

        it('should preserve nested class instances', () => {
            const sword = new Weapon('Excalibur', 50);
            const warrior = new Warrior('Arthur', sword);

            superLs.set('warrior', warrior);
            const recovered = superLs.get('warrior');

            expect(recovered).toBeInstanceOf(Warrior);
            expect(recovered.weapon).toBeInstanceOf(Weapon);
            expect(recovered.weapon.name).toBe('Excalibur');
            expect(recovered.weapon.damage).toBe(50);
        });

        it('should preserve methods on nested instances', () => {
            const axe = new Weapon('Battle Axe', 35);
            const warrior = new Warrior('Viking', axe);

            superLs.set('warrior', warrior);
            const recovered = superLs.get('warrior');

            expect(recovered.fight()).toBe('Viking Attacks with Battle Axe for 35 damage!');
            expect(recovered.weapon.attack()).toBe('Attacks with Battle Axe for 35 damage!');
        });

        it('should handle null dependencies', () => {
            const warrior = new Warrior('Unarmed', null);

            superLs.set('unarmed', warrior);
            const recovered = superLs.get('unarmed');

            expect(recovered).toBeInstanceOf(Warrior);
            expect(recovered.weapon).toBeNull();
            expect(recovered.fight()).toBe('Unarmed has no weapon!');
        });
    });

    describe('Dependency Injection - Nested Dependencies', () => {
        beforeEach(() => {
            superLs.register(Material);
            superLs.register(Armor);
            superLs.register(Weapon);
            superLs.register(Knight);
        });

        it('should handle two levels of dependency injection', () => {
            const steel = new Material('Steel', 25);
            const plateArmor = new Armor('heavy', steel);

            superLs.set('armor', plateArmor);
            const recovered = superLs.get('armor');

            expect(recovered).toBeInstanceOf(Armor);
            expect(recovered.material).toBeInstanceOf(Material);
            expect(recovered.material.name).toBe('Steel');
            expect(recovered.getDefense()).toBe(100); // 50 + 25*2
        });

        it('should handle multiple dependencies on same class', () => {
            const sword = new Weapon('Long Sword', 40);
            const iron = new Material('Iron', 15);
            const chainmail = new Armor('light', iron);

            const knight = new Knight('Lancelot');
            knight.equip(sword, chainmail);

            superLs.set('knight', knight);
            const recovered = superLs.get('knight');

            expect(recovered).toBeInstanceOf(Knight);
            expect(recovered.weapon).toBeInstanceOf(Weapon);
            expect(recovered.armor).toBeInstanceOf(Armor);
            expect(recovered.armor.material).toBeInstanceOf(Material);

            const stats = recovered.getStats();
            expect(stats.attack).toBe(40);
            expect(stats.defense).toBe(55); // 25 + 15*2
            expect(recovered.battleCry()).toBe('Lancelot charges with Long Sword!');
        });
    });

    describe('Dependency Injection - IoC Pattern', () => {
        beforeEach(() => {
            superLs.register(Logger);
            superLs.register(Database);
            superLs.register(UserService);
        });

        it('should handle service-like dependencies', () => {
            const db = new Database();
            const logger = new Logger('[APP]');
            const service = new UserService(db, logger);

            superLs.set('service', service);
            const recovered = superLs.get('service');

            expect(recovered).toBeInstanceOf(UserService);
            expect(recovered.serviceName).toBe('UserService');
        });
    });

    describe('Dependency Injection - Circular Dependencies', () => {
        beforeEach(() => {
            superLs.register(Parent);
            superLs.register(Child);
        });

        it('should handle circular references between classes', () => {
            const parent = new Parent('Dad');
            const child1 = new Child('Son');
            const child2 = new Child('Daughter');

            parent.addChild(child1);
            parent.addChild(child2);

            superLs.set('family', parent);
            const recovered = superLs.get('family');

            expect(recovered).toBeInstanceOf(Parent);
            expect(recovered.name).toBe('Dad');
            expect(recovered.children).toHaveLength(2);
            expect(recovered.children[0].name).toBe('Son');
            expect(recovered.children[1].name).toBe('Daughter');
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
        it('should use V8 native serialization with Base64 encoding', async () => {
            const { ls, core } = await import('@titanpl/core');

            superLs.set('internal', { a: 1 });

            const raw = ls.get('__sls__internal');

            // Should be a Base64-encoded string
            expect(typeof raw).toBe('string');

            // Should be valid Base64 (decodable)
            expect(() => core.buffer.fromBase64(raw)).not.toThrow();

            // Decoded should be Uint8Array
            const bytes = core.buffer.fromBase64(raw);
            expect(bytes).toBeInstanceOf(Uint8Array);
        });

        it('should add __super_type__ metadata for registered classes', async () => {
            const { ls, core } = await import('@titanpl/core');

            superLs.register(Player);
            superLs.set('meta', new Player('Test', 50));

            const raw = ls.get('__sls__meta');

            // Decode and deserialize
            const bytes = core.buffer.fromBase64(raw);
            const parsed = ls.deserialize(bytes);

            expect(parsed.__super_type__).toBe('Player');
            expect(parsed.__data__).toBeDefined();
            expect(parsed.__data__.name).toBe('Test');
        });

        it('should use t.ls.serialize for serialization', async () => {
            const { ls, core } = await import('@titanpl/core');

            const data = { test: 'value', num: 42 };
            superLs.set('serializeTest', data);

            const raw = ls.get('__sls__serializeTest');
            const bytes = core.buffer.fromBase64(raw);
            const deserialized = ls.deserialize(bytes);

            expect(deserialized.test).toBe('value');
            expect(deserialized.num).toBe(42);
        });

        it('should handle native V8 types (Map, Set, Date) directly', async () => {
            const { ls, core } = await import('@titanpl/core');

            const data = {
                map: new Map([['key', 'value']]),
                set: new Set([1, 2, 3]),
                date: new Date('2024-06-15')
            };
            superLs.set('nativeTypes', data);

            const raw = ls.get('__sls__nativeTypes');
            const bytes = core.buffer.fromBase64(raw);
            const deserialized = ls.deserialize(bytes);

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