# 🪐 @titanpl/super-ls

> A supercharged storage adapter for Titan Planet that enables storing complex objects, circular references, and Class instances with automatic rehydration.

`super-ls` extends the capabilities of the native `t.ls` API by using `devalue` for serialization. While standard `t.ls` is limited to simple JSON data, `super-ls` allows you to save and retrieve rich data structures effortlessly.

---

## ✨ Features

- **Rich Data Types**: Store `Map`, `Set`, `Date`, `RegExp`, `BigInt`, `TypedArray`, `undefined`, `NaN`, `Infinity`, and circular references
- **Class Hydration**: Register your custom classes and retrieve fully functional instances with methods intact
- **Dependency Injection Support**: Serialize/deserialize nested class instances and complex object graphs
- **Circular Reference Handling**: Automatic detection and preservation of circular references
- **Drop-in Library**: Works via standard ES module `import` without polluting the global `t` namespace
- **Titan Native Integration**: Built on top of `@titanpl/core`'s `t.ls` for persistence

---

## 📦 Installation

Add `super-ls` to your Titan Planet project:

```bash
npm install titanpl-superls
```

---

## 🚀 Usage

### Basic Usage (Rich Data Types)

Store objects that standard JSON cannot handle:

```javascript
import superLs from "titanpl-superls";

// Maps
const settings = new Map([
    ["theme", "dark"],
    ["language", "en"]
]);
superLs.set("user_settings", settings);

const recovered = superLs.get("user_settings");
console.log(recovered instanceof Map); // true
console.log(recovered.get("theme"));   // "dark"

// Sets
superLs.set("tags", new Set(["javascript", "typescript", "nodejs"]));

// Dates
superLs.set("lastLogin", new Date());

// RegExp
superLs.set("emailPattern", /^[\w-]+@[\w-]+\.\w+$/i);

// BigInt
superLs.set("bigNumber", BigInt("9007199254740991000"));

// Circular References
const obj = { name: "circular" };
obj.self = obj;
superLs.set("circular", obj);

const restored = superLs.get("circular");
console.log(restored.self === restored); // true
```

### Class Hydration

The true power of `super-ls` lies in its ability to restore class instances with their methods intact.

#### 1. Define and Register Your Class

```javascript
import superLs from "titanpl-superls";

class Player {
    constructor(name = "", score = 0) {
        this.name = name;
        this.score = score;
    }

    greet() {
        return `Hello, I am ${this.name}!`;
    }

    addScore(points) {
        this.score += points;
    }
}

// Register before saving or loading
superLs.register(Player);
```

#### 2. Save and Restore

```javascript
const player = new Player("Alice", 100);
superLs.set("player_1", player);

// Later, in a different request...
const restored = superLs.get("player_1");

console.log(restored.name);              // "Alice"
console.log(restored.greet());           // "Hello, I am Alice!"
console.log(restored instanceof Player); // true

restored.addScore(50);                   // Methods work!
console.log(restored.score);             // 150
```

### Dependency Injection Pattern

`super-ls` supports nested class instances, making it perfect for DI patterns:

```javascript
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

// Register ALL classes in the dependency chain
superLs.register(Weapon);
superLs.register(Warrior);

// Create nested instances
const sword = new Weapon("Excalibur", 50);
const arthur = new Warrior("Arthur", sword);

superLs.set("hero", arthur);

// Restore with full dependency graph
const restored = superLs.get("hero");
console.log(restored instanceof Warrior);        // true
console.log(restored.weapon instanceof Weapon);  // true
console.log(restored.fight());                   // "Arthur: Excalibur deals 50 damage!"
```

### Custom Hydration (Complex Constructors)

For classes with required constructor arguments or complex initialization:

```javascript
class ImmutableUser {
    constructor(id, email) {
        if (!id || !email) throw new Error("id and email required!");
        this.id = id;
        this.email = email;
        Object.freeze(this);
    }

    // Static hydrate method for custom reconstruction
    static hydrate(data) {
        return new ImmutableUser(data.id, data.email);
    }
}

superLs.register(ImmutableUser);

const user = new ImmutableUser(1, "alice@example.com");
superLs.set("user", user);

const restored = superLs.get("user"); // Works! Uses hydrate() internally
```

### Custom Type Names

Useful for minified code or avoiding name collisions:

```javascript
// Two modules both export "User" class
import { User as AdminUser } from "./admin";
import { User as CustomerUser } from "./customer";

superLs.register(AdminUser, "AdminUser");
superLs.register(CustomerUser, "CustomerUser");
```

### Multiple Storage Instances

For isolated registries or different prefixes:

```javascript
import { SuperLocalStorage } from "titanpl-superls";

const gameStorage = new SuperLocalStorage("game_");
const userStorage = new SuperLocalStorage("user_");

gameStorage.register(Player);
userStorage.register(Profile);

// Keys are prefixed automatically
gameStorage.set("hero", player);   // Stored as "game_hero"
userStorage.set("current", profile); // Stored as "user_current"
```

---

## 📚 API Reference

### `superLs.set(key, value)`

Stores any JavaScript value in Titan storage.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Storage key |
| `value` | `any` | Data to store |

**Supported types**: primitives, objects, arrays, `Map`, `Set`, `Date`, `RegExp`, `BigInt`, `TypedArray`, `undefined`, `NaN`, `Infinity`, circular references, registered class instances.

```javascript
superLs.set("config", { theme: "dark", items: new Set([1, 2, 3]) });
```

### `superLs.get(key)`

Retrieves and deserializes a value with full type restoration.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Storage key |
| **Returns** | `any \| null` | Restored value or `null` if not found |

```javascript
const config = superLs.get("config");
if (config) {
    console.log(config.items instanceof Set); // true
}
```

### `superLs.register(ClassRef, typeName?)`

Registers a class for automatic serialization/deserialization.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ClassRef` | `Function` | Class constructor |
| `typeName` | `string?` | Custom type name (defaults to `ClassRef.name`) |

```javascript
superLs.register(Player);
superLs.register(Enemy, "GameEnemy"); // Custom name
```

### `new SuperLocalStorage(prefix?)`

Creates a new storage instance with isolated registry.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prefix` | `string` | `"sls_"` | Key prefix for all operations |

```javascript
import { SuperLocalStorage } from "titanpl-superls";
const custom = new SuperLocalStorage("myapp_");
```

---

## 🎯 When to Use Static `hydrate()` Method

By default, `super-ls` reconstructs class instances like this:

```javascript
const instance = new Constructor();  // Calls constructor WITHOUT arguments
Object.assign(instance, data);       // Copies properties
```

This works **only if** your constructor can be called without arguments:

```javascript
// ✅ WORKS - has default values
class Player {
    constructor(name = '', score = 0) {
        this.name = name;
        this.score = score;
    }
}
```

But **fails** if constructor requires arguments:

```javascript
// ❌ FAILS - required arguments
class Player {
    constructor(name, score) {
        if (!name) throw new Error('Name is required!');
        this.name = name;
        this.score = score;
    }
}

// super-ls tries: new Player() → 💥 Error!
```

### The Solution

Define a static `hydrate()` method that tells `super-ls` how to reconstruct your class:

```javascript
class Player {
    constructor(name, score) {
        if (!name) throw new Error('Name is required!');
        this.name = name;
        this.score = score;
    }

    static hydrate(data) {
        return new Player(data.name, data.score);
    }
}
```

### Quick Reference

| Constructor Style | Needs `hydrate()`? | Example |
|-------------------|-------------------|---------|
| All params have defaults | ❌ No | `constructor(name = '', score = 0)` |
| No parameters | ❌ No | `constructor()` |
| Required parameters | ✅ Yes | `constructor(name, score)` |
| Has validation | ✅ Yes | `if (!name) throw new Error()` |
| Uses `Object.freeze()` | ✅ Yes | `Object.freeze(this)` |
| Private fields (`#prop`) | ✅ Yes | `this.#secret = value` |
| Destructuring params | ✅ Yes | `constructor({ name, score })` |

### Examples

```javascript
// ✅ NO hydrate needed - has defaults
class Counter {
    constructor(value = 0) {
        this.value = value;
    }
}

// ❌ NEEDS hydrate - required params
class Email {
    constructor(value) {
        if (!value.includes('@')) throw new Error('Invalid');
        this.value = value;
    }
    static hydrate(data) {
        return new Email(data.value);
    }
}

// ❌ NEEDS hydrate - Object.freeze()
class ImmutableConfig {
    constructor(settings) {
        this.settings = settings;
        Object.freeze(this);
    }
    static hydrate(data) {
        return new ImmutableConfig(data.settings);
    }
}

// ❌ NEEDS hydrate - destructuring
class Player {
    constructor({ name, score }) {
        this.name = name;
        this.score = score;
    }
    static hydrate(data) {
        return new Player({ name: data.name, score: data.score });
    }
}
```

---

## ⚠️ Known Limitations

| Limitation | Behavior | Workaround |
|------------|----------|------------|
| **Functions** | Throws error | Store function results, not functions |
| **WeakMap / WeakSet** | Silently becomes `{}` | Use `Map` / `Set` instead |
| **Symbol properties** | Not serialized | Use string keys |
| **Sparse arrays** | Holes become `undefined` | Use dense arrays or objects |
| **Unregistered classes** | Become plain objects (methods lost) | Register all classes |
| **Getters/Setters** | Not serialized as values | Work via prototype after restoration |

---

## 🔧 Under the Hood

`super-ls` uses a two-phase transformation:

### Serialization (`set`)
1. Recursively traverse the value
2. Wrap registered class instances with type metadata (`__super_type__`, `__data__`)
3. Track circular references via `WeakMap`
4. Serialize using `devalue` (handles `Map`, `Set`, `Date`, etc.)
5. Store string in `t.ls`

### Deserialization (`get`)
1. Parse string using `devalue`
2. Recursively traverse parsed data
3. Detect type metadata and restore class instances
4. Create instance using:
   - `hydrate()` if available
   - Otherwise: `new Constructor()` + `Object.assign()`
5. Preserve circular references via placeholder morphing

For detailed technical documentation, see [EXPLAIN.md](./EXPLAIN.md).

---

## 🧪 Testing

The library includes comprehensive test suites:

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

**Test Coverage**: 73 tests across 2 suites
- Normal cases: 36 tests (basic types, class hydration, DI patterns)
- Edge cases: 37 tests (inheritance, circular refs, stress tests)

See [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md) for detailed test descriptions.

---

## 📁 Project Structure

```
super-ls/
├── index.js              # Main implementation
├── index.d.ts            # TypeScript definitions
├── package.json
├── README.md             # This file
├── EXPLAIN.md            # Technical deep-dive
├── TEST_DOCUMENTATION.md # Test suite documentation
└── tests/
    ├── super-ls.normal-cases.spec.js
    └── super-ls.edge-cases.spec.js
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a Pull Request

---

## 📄 License

ISC © Titan Planet