# 🪐 @titanpl/super-ls

> A supercharged storage adapter for Titan Planet that enables storing complex objects, circular references, and Class instances with automatic rehydration.

`super-ls` extends the capabilities of the native `t.ls` API by using `devalue` for serialization. While standard `t.ls` is limited to simple JSON data, `super-ls` allows you to save and retrieve rich data structures effortlessly.

---

## ✨ Features

- **Rich Data Types**: Store `Map`, `Set`, `Date`, `RegExp`, `BigInt`, `TypedArray`, `undefined`, `NaN`, `Infinity`, and circular references
- **Class Hydration**: Register your custom classes and retrieve fully functional instances with methods intact
- **Flexible Hydration**: Pass a hydrate function directly to `register()` for complete control over instance reconstruction
- **Dependency Injection Support**: Serialize/deserialize nested class instances and complex object graphs
- **Circular Reference Handling**: Automatic detection and preservation of circular references
- **Lazy Initialization**: Use `resolve()` for "get or create" patterns
- **Drop-in Library**: Works via standard ES module `import` without polluting the global `t` namespace
- **Titan Native Integration**: Built on top of `@titanpl/core`'s `t.ls` for persistence

---

## 📦 Installation

Add `super-ls` to your Titan Planet project:
```bash
npm install @t8n/super-ls
```

---

## 🚀 Usage

### Basic Usage (Rich Data Types)

Store objects that standard JSON cannot handle:
```javascript
import superLs from "@t8n/super-ls";

// Maps
const settings = new Map([
    ["theme", "dark"],
    ["language", "en"]
]);
superLs.set("user_settings", settings);

const recovered = superLs.get("user_settings");
t.log(recovered instanceof Map); // true
t.log(recovered.get("theme"));   // "dark"

// Sets
superLs.set("tags", new Set(["javascript", "typescript", "nodejs"]));

// Dates
superLs.set("lastLogin", new Date());

// RegExp
superLs.set("emailPattern", /^[\w-]+@[\w-]+\.\w+$/i);

// BigInt
superLs.set("bigNumber", BigInt("9007199254740991000"));

// Remove a specific key
superLs.remove("lastLogin");

// Check if a key exists and has a valid value
superLs.has("lastLogin"); // false
superLs.has("user_settings"); // true

// Clear all storage
superLs.clean();

// Circular References
const obj = { name: "circular" };
obj.self = obj;
superLs.set("circular", obj);

const restored = superLs.get("circular");
t.log(restored.self === restored); // true
```

### Lazy Initialization with `resolve()`

The `resolve()` method implements a "get or create" pattern - perfect for lazy initialization:
```javascript
import superLs from "@t8n/super-ls";

// Returns existing settings or creates default ones
const settings = superLs.resolve("app_settings", () => ({
    theme: "dark",
    language: "en",
    notifications: true
}));

// Perfect for caches and complex data structures
const userCache = superLs.resolve("user_cache", () => new Map());

// Works great with class instances too
superLs.register(Player);
const player = superLs.resolve("current_player", () => new Player("Guest", 0));
```

### Class Hydration

The true power of `super-ls` lies in its ability to restore class instances with their methods intact.

#### 1. Define and Register Your Class
```javascript
import superLs from "@t8n/super-ls";

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

t.log(restored.name);              // "Alice"
t.log(restored.greet());           // "Hello, I am Alice!"
t.log(restored instanceof Player); // true

restored.addScore(50);             // Methods work!
t.log(restored.score);             // 150
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
t.log(restored instanceof Warrior);        // true
t.log(restored.weapon instanceof Weapon);  // true
t.log(restored.fight());                   // "Arthur: Excalibur deals 50 damage!"
```

### Custom Hydration (Complex Constructors)

For classes with required constructor arguments or complex initialization, pass a hydrate function as the second argument to `register()`:
```javascript
class ImmutableUser {
    constructor(id, email) {
        if (!id || !email) throw new Error("id and email required!");
        this.id = id;
        this.email = email;
        Object.freeze(this);
    }
}

// Pass hydrate function as second argument
superLs.register(ImmutableUser, (data) => new ImmutableUser(data.id, data.email));

const user = new ImmutableUser(1, "alice@example.com");
superLs.set("user", user);

const restored = superLs.get("user"); // Works! Uses hydrate function internally
```

### Custom Type Names

Useful for minified code or avoiding name collisions:
```javascript
// Two modules both export "User" class
import { User as AdminUser } from "./admin";
import { User as CustomerUser } from "./customer";

// Without hydrate function - just type name
superLs.register(AdminUser, "AdminUser");
superLs.register(CustomerUser, "CustomerUser");

// With hydrate function and custom type name
superLs.register(AdminUser, (data) => new AdminUser(data.id), "AdminUser");
superLs.register(CustomerUser, (data) => new CustomerUser(data.id), "CustomerUser");
```

### Multiple Storage Instances

For isolated registries or different prefixes:
```javascript
import { SuperLocalStorage } from "@t8n/super-ls";

const gameStorage = new SuperLocalStorage("game_");
const userStorage = new SuperLocalStorage("user_");

gameStorage.register(Player);
userStorage.register(Profile);

// Keys are prefixed automatically
gameStorage.set("hero", player);     // Stored as "game_hero"
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
    t.log(config.items instanceof Set); // true
}
```

### `superLs.remove(key)`

Removes a value from storage.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Storage key to remove |
```javascript
superLs.set("temp_data", { foo: "bar" });
superLs.remove("temp_data");
superLs.get("temp_data"); // null
```

### `superLs.has(key)`

Checks if a key exists in storage and contains a valid value.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Storage key to check |
| **Returns** | `boolean` | `true` if key exists and contains a non-null, non-undefined value |
```javascript
superLs.set("user", { name: "Alice" });
superLs.has("user"); // true

superLs.set("count", 42);
superLs.has("count"); // true

superLs.set("active", false);
superLs.has("active"); // true

superLs.set("name", "Bob");
superLs.has("name"); // true

superLs.has("nonexistent"); // false
```

### `superLs.clean()`

Clears all values from storage that match the instance prefix.
```javascript
superLs.set("key1", "value1");
superLs.set("key2", "value2");
superLs.clean();
// All keys with the instance prefix are now removed
```

### `superLs.resolve(key, resolver)`

Retrieves a value from storage, or computes and stores it if not present. Implements a "get or create" pattern for lazy initialization.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Storage key |
| `resolver` | `function` | Function that computes the default value if key doesn't exist |
| **Returns** | `any` | The existing value or the newly resolved and stored value |
```javascript
// Returns existing settings or creates default ones
const settings = superLs.resolve("app_settings", () => ({
    theme: "dark",
    language: "en",
    notifications: true
}));

// Useful for lazy initialization of complex data structures
const cache = superLs.resolve("user_cache", () => new Map());

// Works with registered classes
superLs.register(Player);
const player = superLs.resolve("player", () => new Player("Guest", 0));
```

### `superLs.register(ClassRef, hydrateOrTypeName?, typeName?)`

Registers a class for automatic serialization/deserialization.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ClassRef` | `Function` | Class constructor |
| `hydrateOrTypeName` | `function \| string?` | Hydrate function or custom type name |
| `typeName` | `string?` | Custom type name (when hydrate function is provided) |

**Overloads:**
```javascript
// Basic registration (uses default constructor + Object.assign)
superLs.register(Player);

// With hydrate function
superLs.register(Player, (data) => new Player(data.name, data.score));

// With hydrate function and custom type name
superLs.register(Player, (data) => new Player(data.name, data.score), "GamePlayer");

// With only custom type name (backward compatible)
superLs.register(Player, "GamePlayer");
```

### `new SuperLocalStorage(prefix?)`

Creates a new storage instance with isolated registry.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prefix` | `string` | `"__sls__"` | Key prefix for all operations |
```javascript
import { SuperLocalStorage } from "@t8n/super-ls";
const custom = new SuperLocalStorage("myapp_");
```

---

## 🎯 When to Use the Hydrate Function

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

Pass a hydrate function as the second argument to `register()`:
```javascript
class Player {
    constructor(name, score) {
        if (!name) throw new Error('Name is required!');
        this.name = name;
        this.score = score;
    }
}

// Hydrate function tells super-ls how to reconstruct the class
superLs.register(Player, (data) => new Player(data.name, data.score));
```

### Quick Reference

| Constructor Style | Needs hydrate? | Example |
|-------------------|----------------|---------|
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
superLs.register(Counter);

// ✅ NEEDS hydrate - required params
class Email {
    constructor(value) {
        if (!value.includes('@')) throw new Error('Invalid');
        this.value = value;
    }
}
superLs.register(Email, (data) => new Email(data.value));

// ✅ NEEDS hydrate - Object.freeze()
class ImmutableConfig {
    constructor(settings) {
        this.settings = settings;
        Object.freeze(this);
    }
}
superLs.register(ImmutableConfig, (data) => new ImmutableConfig(data.settings));

// ✅ NEEDS hydrate - destructuring
class Player {
    constructor({ name, score }) {
        this.name = name;
        this.score = score;
    }
}
superLs.register(Player, (data) => new Player({ name: data.name, score: data.score }));
```

---

## 🔷 TypeScript Usage

### Type Definitions

`super-ls` includes full TypeScript support with generic types:

```typescript
import superLs from "@t8n/super-ls";

// Generic get() for type inference
const player = superLs.get<Player>("player_1");
player?.greet(); // TypeScript knows this method exists

// Register with full type safety
superLs.register<Player>(Player, (data) => new Player(data.name, data.score));
```

### HydrateFunction Type

The `HydrateFunction<T, H>` type is defined as:

```typescript
type PropertiesOnly<T> = {
    [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K]
};

type HydrateFunction<T, H = PropertiesOnly<T>> = (data: H) => T;
```

By default, it automatically extracts only the non-function properties from your class:

```typescript
class Player {
    name: string;
    score: number;
    
    constructor(name: string, score: number) {
        this.name = name;
        this.score = score;
    }
    
    greet(): string {
        return `Hello, I am ${this.name}!`;
    }
}

// TypeScript infers: data is { name: string; score: number }
// Methods like greet() are automatically excluded
superLs.register(Player, (data) => new Player(data.name, data.score));
```

### Custom Data Type

The second generic parameter `H` allows you to specify a custom data type:

```typescript
// Define exactly what properties exist in serialized data
interface PlayerData {
    name: string;
    score: number;
}

// Use explicit type for the hydrate data
superLs.register<Player, PlayerData>(Player, (data) => new Player(data.name, data.score));
```

### ⚠️ Getter Limitation

**Important**: TypeScript cannot distinguish between getters and regular `readonly` properties at the type level. Both appear identical to the type system:

```typescript
class Player {
    name: string;
    score: number;
    readonly id: string = crypto.randomUUID();  // Regular readonly property (IS serialized)
    
    get fullName(): string {              // Getter (NOT serialized)
        return `Player: ${this.name}`;
    }
    
    get displayScore(): string {          // Getter (NOT serialized)
        return `Score: ${this.score}`;
    }
}

// TypeScript sees data as:
// { name: string; score: number; id: string; fullName: string; displayScore: string }
//                                            ^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
//                                            These appear in the type but WON'T exist at runtime!

superLs.register(Player, (data) => {
    // data.fullName is typed as string, but is actually undefined at runtime
    // data.displayScore is typed as string, but is actually undefined at runtime
    return new Player(data.name, data.score);
});
```

**Why this happens**: TypeScript's type system treats `get fullName(): string` and `readonly fullName: string` identically. There's no type-level metadata to differentiate them.

**Workarounds**:

1. **Simply ignore getter properties** in your hydrate function (recommended):
   ```typescript
   superLs.register(Player, (data) => {
       // Just don't use data.fullName - it won't exist anyway
       return new Player(data.name, data.score);
   });
   ```

2. **Define an explicit data type** using the second generic parameter:
   ```typescript
   interface PlayerData {
       name: string;
       score: number;
   }
   
   superLs.register<Player, PlayerData>(Player, (data) => new Player(data.name, data.score));
   ```

3. **Use `Omit` to exclude getters** manually:
   ```typescript
   type PlayerSerializable = Omit<PropertiesOnly<Player>, 'fullName' | 'displayScore'>;
   
   superLs.register<Player, PlayerSerializable>(Player, (data) => new Player(data.name, data.score));
   ```

> **Note**: This is a TypeScript limitation, not a `super-ls` limitation. At runtime, `super-ls` correctly serializes only actual properties and ignores getters.

---

## ⚠️ Known Limitations

| Limitation | Behavior | Workaround |
|------------|----------|------------|
| **Functions** | Throws error | Store function results, not functions |
| **WeakMap / WeakSet** | Silently becomes `{}` | Use `Map` / `Set` instead |
| **Symbol properties** | Not serialized | Use string keys |
| **Sparse arrays** | Holes become `undefined` | Use dense arrays or objects |
| **Unregistered classes** | Become plain objects (methods lost) | Register all classes |
| **Getters/Setters** | Not serialized (computed at runtime) | Use hydrate function to recompute |
| **TypeScript getters** | Appear in `HydrateFunction<T>` data type but are `undefined` at runtime | Ignore them in hydrate or use explicit data type with second generic `H` (see [TypeScript Usage](#-typescript-usage)) |

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
4. Create instance using (in priority order):
   - Hydrate function passed to `register()` if available
   - Static `hydrate()` method on the class (backward compatible)
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