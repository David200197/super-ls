// ============================================================================
// TITANPL-SUPERLS RUNTIME TEST SUITE
// ============================================================================

// --- Test Classes ---

class User {
    constructor(name = "", lastName = "") {
        this.name = name;
        this.lastName = lastName;
    }

    get fullName() {
        return this.name + " " + this.lastName;
    }

    greet() {
        return `Hello, I'm ${this.fullName}!`;
    }
}

class Player {
    constructor(name = "", score = 0) {
        this.name = name;
        this.score = score;
    }

    get displayScore() {
        return `Score: ${this.score}`;
    }

    addScore(points) {
        this.score += points;
    }
}

class Weapon {
    constructor(name = "", damage = 0) {
        this.name = name;
        this.damage = damage;
    }

    attack() {
        return `${this.name} deals ${this.damage} damage!`;
    }
}

class Warrior {
    constructor(name = "", weapon = null) {
        this.name = name;
        this.weapon = weapon;
    }

    fight() {
        if (!this.weapon) return `${this.name} has no weapon!`;
        return `${this.name}: ${this.weapon.attack()}`;
    }
}

// Class with required constructor args (needs hydrate)
class ImmutableUser {
    constructor(id, email) {
        if (!id || !email) throw new Error("id and email required!");
        this.id = id;
        this.email = email;
        Object.freeze(this);
    }
}

// --- Test Runner ---

class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    assert(condition, testName, details = null) {
        if (condition) {
            this.passed++;
            this.results.push({ status: "✅ PASS", test: testName });
            t.log(`✅ PASS: ${testName}`);
        } else {
            this.failed++;
            const info = details ? ` (${JSON.stringify(details)})` : "";
            this.results.push({ status: "❌ FAIL", test: testName, details });
            t.log(`❌ FAIL: ${testName}${info}`);
        }
    }

    assertEqual(actual, expected, testName) {
        const condition = actual === expected;
        if (!condition) {
            this.assert(false, testName, { expected, actual });
        } else {
            this.assert(true, testName);
        }
    }

    assertDeepEqual(actual, expected, testName) {
        const condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            this.assert(false, testName, { expected, actual });
        } else {
            this.assert(true, testName);
        }
    }

    assertInstanceOf(obj, cls, testName) {
        this.assert(obj instanceof cls, testName, {
            expected: cls.name,
            actual: obj?.constructor?.name
        });
    }

    summary() {
        const total = this.passed + this.failed;
        t.log("═══════════════════════════════════════════════════════════");
        t.log(`📊 SUMMARY: ${this.passed}/${total} passed, ${this.failed} failed`);
        t.log("═══════════════════════════════════════════════════════════");
        return {
            total,
            passed: this.passed,
            failed: this.failed,
            results: this.results
        };
    }
}

// --- Main Test Export ---

export const test = (req) => {
    const ext = t["titanpl-superls"];
    const runner = new TestRunner();

    const results = {
        extension: "titanpl-superls",
        loaded: !!ext,
        timestamp: new Date().toISOString()
    };

    if (!ext) {
        results.error = "Extension not loaded";
        return results;
    }

    const superLs = ext.default || ext;

    try {
        t.log("═══════════════════════════════════════════════════════════");
        t.log("🧪 TITANPL-SUPERLS TEST SUITE");
        t.log("═══════════════════════════════════════════════════════════");

        // ================================================================
        // 1. BASIC TYPES
        // ================================================================
        t.log("\n📦 1. BASIC TYPES");
        t.log("───────────────────────────────────────────────────────────");

        // Map
        const testMap = new Map([["theme", "dark"], ["lang", "en"]]);
        superLs.set("test_map", testMap);
        const recoveredMap = superLs.get("test_map");
        runner.assertInstanceOf(recoveredMap, Map, "Map: instanceof Map");
        runner.assertEqual(recoveredMap.get("theme"), "dark", "Map: get('theme') === 'dark'");
        runner.assertEqual(recoveredMap.size, 2, "Map: size === 2");

        // Set
        const testSet = new Set([1, 2, 3, "a", "b"]);
        superLs.set("test_set", testSet);
        const recoveredSet = superLs.get("test_set");
        runner.assertInstanceOf(recoveredSet, Set, "Set: instanceof Set");
        runner.assert(recoveredSet.has(1), "Set: has(1)");
        runner.assert(recoveredSet.has("a"), "Set: has('a')");
        runner.assertEqual(recoveredSet.size, 5, "Set: size === 5");

        // Date
        const testDate = new Date("2024-06-15T10:30:00Z");
        superLs.set("test_date", testDate);
        const recoveredDate = superLs.get("test_date");
        runner.assertInstanceOf(recoveredDate, Date, "Date: instanceof Date");
        runner.assertEqual(recoveredDate.toISOString(), testDate.toISOString(), "Date: toISOString matches");

        // RegExp
        const testRegex = /^test-\d+$/gi;
        superLs.set("test_regex", testRegex);
        const recoveredRegex = superLs.get("test_regex");
        runner.assertInstanceOf(recoveredRegex, RegExp, "RegExp: instanceof RegExp");
        runner.assert(recoveredRegex.test("test-123"), "RegExp: test('test-123') === true");
        runner.assert(!recoveredRegex.test("invalid"), "RegExp: test('invalid') === false");

        // BigInt
        const testBigInt = BigInt("9007199254740991000");
        superLs.set("test_bigint", testBigInt);
        const recoveredBigInt = superLs.get("test_bigint");
        runner.assertEqual(typeof recoveredBigInt, "bigint", "BigInt: typeof === 'bigint'");
        runner.assertEqual(recoveredBigInt.toString(), "9007199254740991000", "BigInt: value matches");

        // undefined, NaN, Infinity
        superLs.set("test_undefined", undefined);
        runner.assertEqual(superLs.get("test_undefined"), undefined, "undefined: recovered correctly");

        superLs.set("test_nan", NaN);
        runner.assert(Number.isNaN(superLs.get("test_nan")), "NaN: recovered correctly");

        superLs.set("test_infinity", Infinity);
        runner.assertEqual(superLs.get("test_infinity"), Infinity, "Infinity: recovered correctly");

        superLs.set("test_neg_infinity", -Infinity);
        runner.assertEqual(superLs.get("test_neg_infinity"), -Infinity, "-Infinity: recovered correctly");

        // ================================================================
        // 2. CIRCULAR REFERENCES
        // ================================================================
        t.log("\n🔄 2. CIRCULAR REFERENCES");
        t.log("───────────────────────────────────────────────────────────");

        const circular = { name: "root", children: [] };
        circular.self = circular;
        circular.children.push({ parent: circular, value: "child1" });

        superLs.set("test_circular", circular);
        const recoveredCircular = superLs.get("test_circular");

        runner.assertEqual(recoveredCircular.name, "root", "Circular: name === 'root'");
        runner.assert(recoveredCircular.self === recoveredCircular, "Circular: self === itself");
        runner.assert(recoveredCircular.children[0].parent === recoveredCircular, "Circular: child.parent === root");

        // ================================================================
        // 3. has(), remove(), clean()
        // ================================================================
        t.log("\n🔧 3. has(), remove(), clean()");
        t.log("───────────────────────────────────────────────────────────");

        superLs.set("test_has", { value: 123 });
        runner.assert(superLs.has("test_has"), "has(): returns true for existing key");
        runner.assert(!superLs.has("nonexistent_key_xyz"), "has(): returns false for missing key");

        superLs.set("test_remove", "to_be_removed");
        runner.assert(superLs.has("test_remove"), "remove(): key exists before remove");
        superLs.remove("test_remove");
        runner.assert(!superLs.has("test_remove"), "remove(): key doesn't exist after remove");

        // ================================================================
        // 4. CLASS HYDRATION (without custom hydrate)
        // ================================================================
        t.log("\n🏗️ 4. CLASS HYDRATION (default)");
        t.log("───────────────────────────────────────────────────────────");

        superLs.register(Player);

        const player = new Player("Alice", 100);
        superLs.set("test_player", player);
        const recoveredPlayer = superLs.get("test_player");

        runner.assertInstanceOf(recoveredPlayer, Player, "Player: instanceof Player");
        runner.assertEqual(recoveredPlayer.name, "Alice", "Player: name === 'Alice'");
        runner.assertEqual(recoveredPlayer.score, 100, "Player: score === 100");
        runner.assertEqual(typeof recoveredPlayer.addScore, "function", "Player: addScore is function");

        recoveredPlayer.addScore(50);
        runner.assertEqual(recoveredPlayer.score, 150, "Player: addScore() works (score === 150)");

        // Test getter
        runner.assertEqual(recoveredPlayer.displayScore, "Score: 150", "Player: getter displayScore works");

        // ================================================================
        // 5. CLASS HYDRATION (with custom hydrate function)
        // ================================================================
        t.log("\n🏗️ 5. CLASS HYDRATION (custom hydrate)");
        t.log("───────────────────────────────────────────────────────────");

        superLs.register(User, (data) => {
            t.log(`   ↳ Hydrating User: ${JSON.stringify(data)}`);
            return new User(data.name, data.lastName);
        });

        const user = new User("David", "Alfonso");
        superLs.set("test_user", user);
        const recoveredUser = superLs.get("test_user");

        runner.assertInstanceOf(recoveredUser, User, "User: instanceof User");
        runner.assertEqual(recoveredUser.name, "David", "User: name === 'David'");
        runner.assertEqual(recoveredUser.lastName, "Alfonso", "User: lastName === 'Alfonso'");
        runner.assertEqual(recoveredUser.fullName, "David Alfonso", "User: getter fullName works");
        runner.assertEqual(recoveredUser.greet(), "Hello, I'm David Alfonso!", "User: greet() method works");

        // ================================================================
        // 6. GETTER SERIALIZATION CHECK
        // ================================================================
        t.log("\n🔍 6. GETTER SERIALIZATION CHECK");
        t.log("───────────────────────────────────────────────────────────");

        // Verify that getters are NOT in serialized data
        let hydrateDataReceived = null;
        superLs.register(class GetterTest {
            constructor(value = 0) {
                this.value = value;
            }
            get computed() {
                return this.value * 2;
            }
        }, (data) => {
            hydrateDataReceived = { ...data };
            const instance = new (class GetterTest {
                constructor(v) { this.value = v; }
                get computed() { return this.value * 2; }
            })(data.value);
            return instance;
        }, "GetterTest");

        const getterTestInstance = new (class {
            constructor() { this.value = 42; }
            get computed() { return this.value * 2; }
        })();
        getterTestInstance.constructor = { name: "GetterTest" };

        // Create a proper instance
        class GetterTestClass {
            constructor(value = 0) {
                this.value = value;
            }
            get computed() {
                return this.value * 2;
            }
        }
        superLs.register(GetterTestClass, (data) => {
            hydrateDataReceived = { ...data };
            return new GetterTestClass(data.value);
        });

        const gtInstance = new GetterTestClass(42);
        superLs.set("test_getter_check", gtInstance);
        superLs.get("test_getter_check");

        runner.assert(hydrateDataReceived !== null, "Getter check: hydrate was called");
        runner.assert("value" in hydrateDataReceived, "Getter check: 'value' property exists in data");
        runner.assert(!("computed" in hydrateDataReceived) || hydrateDataReceived.computed === undefined,
            "Getter check: 'computed' getter is NOT in serialized data");
        t.log(`   ↳ Hydrate data received: ${JSON.stringify(hydrateDataReceived)}`);

        // ================================================================
        // 7. DEPENDENCY INJECTION (nested classes)
        // ================================================================
        t.log("\n💉 7. DEPENDENCY INJECTION (nested classes)");
        t.log("───────────────────────────────────────────────────────────");

        superLs.register(Weapon);
        superLs.register(Warrior);

        const sword = new Weapon("Excalibur", 50);
        const warrior = new Warrior("Arthur", sword);

        superLs.set("test_warrior", warrior);
        const recoveredWarrior = superLs.get("test_warrior");

        runner.assertInstanceOf(recoveredWarrior, Warrior, "DI: Warrior instanceof Warrior");
        runner.assertEqual(recoveredWarrior.name, "Arthur", "DI: Warrior.name === 'Arthur'");
        runner.assertInstanceOf(recoveredWarrior.weapon, Weapon, "DI: Warrior.weapon instanceof Weapon");
        runner.assertEqual(recoveredWarrior.weapon.name, "Excalibur", "DI: Weapon.name === 'Excalibur'");
        runner.assertEqual(recoveredWarrior.weapon.damage, 50, "DI: Weapon.damage === 50");
        runner.assertEqual(recoveredWarrior.fight(), "Arthur: Excalibur deals 50 damage!", "DI: fight() method works");
        runner.assertEqual(recoveredWarrior.weapon.attack(), "Excalibur deals 50 damage!", "DI: nested attack() works");

        // ================================================================
        // 8. IMMUTABLE CLASS (Object.freeze + required params)
        // ================================================================
        t.log("\n🔒 8. IMMUTABLE CLASS (Object.freeze)");
        t.log("───────────────────────────────────────────────────────────");

        superLs.register(ImmutableUser, (data) => new ImmutableUser(data.id, data.email));

        const immutableUser = new ImmutableUser(1, "alice@example.com");
        superLs.set("test_immutable", immutableUser);
        const recoveredImmutable = superLs.get("test_immutable");

        runner.assertInstanceOf(recoveredImmutable, ImmutableUser, "Immutable: instanceof ImmutableUser");
        runner.assertEqual(recoveredImmutable.id, 1, "Immutable: id === 1");
        runner.assertEqual(recoveredImmutable.email, "alice@example.com", "Immutable: email matches");
        runner.assert(Object.isFrozen(recoveredImmutable), "Immutable: Object.isFrozen() === true");

        // ================================================================
        // 9. resolve() - Lazy Initialization
        // ================================================================
        t.log("\n⚡ 9. resolve() - Lazy Initialization");
        t.log("───────────────────────────────────────────────────────────");

        // First call should create
        superLs.remove("test_resolve");
        let resolverCalled = false;
        const resolved1 = superLs.resolve("test_resolve", () => {
            resolverCalled = true;
            return { created: true, timestamp: Date.now() };
        });
        runner.assert(resolverCalled, "resolve(): resolver called on first access");
        runner.assert(resolved1.created === true, "resolve(): returns created value");

        // Second call should retrieve, not create
        resolverCalled = false;
        const resolved2 = superLs.resolve("test_resolve", () => {
            resolverCalled = true;
            return { created: false };
        });
        runner.assert(!resolverCalled, "resolve(): resolver NOT called on second access");
        runner.assertEqual(resolved2.created, true, "resolve(): returns cached value");

        // resolve() with class
        superLs.remove("test_resolve_class");
        const resolvedPlayer = superLs.resolve("test_resolve_class", () => new Player("Guest", 0));
        runner.assertInstanceOf(resolvedPlayer, Player, "resolve(): works with registered class");
        runner.assertEqual(resolvedPlayer.name, "Guest", "resolve(): class instance correct");

        // ================================================================
        // 10. COMPLEX NESTED STRUCTURES
        // ================================================================
        t.log("\n🌳 10. COMPLEX NESTED STRUCTURES");
        t.log("───────────────────────────────────────────────────────────");

        const complexStructure = {
            users: [
                new User("John", "Doe"),
                new User("Jane", "Smith")
            ],
            config: new Map([
                ["debug", true],
                ["version", "1.0.0"]
            ]),
            metadata: {
                created: new Date("2024-01-01"),
                tags: new Set(["important", "active"]),
                nested: {
                    deep: {
                        value: BigInt(12345)
                    }
                }
            }
        };

        superLs.set("test_complex", complexStructure);
        const recoveredComplex = superLs.get("test_complex");

        runner.assert(Array.isArray(recoveredComplex.users), "Complex: users is array");
        runner.assertInstanceOf(recoveredComplex.users[0], User, "Complex: users[0] instanceof User");
        runner.assertEqual(recoveredComplex.users[0].fullName, "John Doe", "Complex: users[0].fullName works");
        runner.assertInstanceOf(recoveredComplex.config, Map, "Complex: config instanceof Map");
        runner.assertEqual(recoveredComplex.config.get("debug"), true, "Complex: config.get('debug')");
        runner.assertInstanceOf(recoveredComplex.metadata.created, Date, "Complex: metadata.created instanceof Date");
        runner.assertInstanceOf(recoveredComplex.metadata.tags, Set, "Complex: metadata.tags instanceof Set");
        runner.assert(recoveredComplex.metadata.tags.has("important"), "Complex: tags.has('important')");
        runner.assertEqual(typeof recoveredComplex.metadata.nested.deep.value, "bigint", "Complex: deep BigInt preserved");

        // ================================================================
        // 11. ARRAY OF CLASS INSTANCES
        // ================================================================
        t.log("\n📚 11. ARRAY OF CLASS INSTANCES");
        t.log("───────────────────────────────────────────────────────────");

        const weapons = [
            new Weapon("Sword", 30),
            new Weapon("Axe", 40),
            new Weapon("Bow", 25)
        ];

        superLs.set("test_weapons_array", weapons);
        const recoveredWeapons = superLs.get("test_weapons_array");

        runner.assert(Array.isArray(recoveredWeapons), "Array: is array");
        runner.assertEqual(recoveredWeapons.length, 3, "Array: length === 3");
        runner.assertInstanceOf(recoveredWeapons[0], Weapon, "Array: [0] instanceof Weapon");
        runner.assertInstanceOf(recoveredWeapons[1], Weapon, "Array: [1] instanceof Weapon");
        runner.assertInstanceOf(recoveredWeapons[2], Weapon, "Array: [2] instanceof Weapon");
        runner.assertEqual(recoveredWeapons[1].attack(), "Axe deals 40 damage!", "Array: [1].attack() works");

        // ================================================================
        // 12. MAP WITH CLASS INSTANCES AS VALUES
        // ================================================================
        t.log("\n🗺️ 12. MAP WITH CLASS INSTANCES");
        t.log("───────────────────────────────────────────────────────────");

        const inventory = new Map();
        inventory.set("primary", new Weapon("Main Sword", 50));
        inventory.set("secondary", new Weapon("Dagger", 20));

        superLs.set("test_inventory", inventory);
        const recoveredInventory = superLs.get("test_inventory");

        runner.assertInstanceOf(recoveredInventory, Map, "Map+Class: instanceof Map");
        runner.assertInstanceOf(recoveredInventory.get("primary"), Weapon, "Map+Class: get('primary') instanceof Weapon");
        runner.assertEqual(recoveredInventory.get("primary").damage, 50, "Map+Class: primary.damage === 50");
        runner.assertEqual(recoveredInventory.get("secondary").attack(), "Dagger deals 20 damage!", "Map+Class: secondary.attack() works");

        // ================================================================
        // SUMMARY
        // ================================================================
        t.log("\n");
        const summary = runner.summary();
        results.tests = summary;

    } catch (e) {
        t.log(`\n💥 CRITICAL ERROR: ${e.message}`);
        t.log(e.stack);
        results.error = String(e);
        results.stack = e.stack;
    }

    return results;
};