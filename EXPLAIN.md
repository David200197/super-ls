# SuperLocalStorage - Technical Deep Dive

> A comprehensive guide to understanding the internal architecture and implementation details of SuperLocalStorage.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Serialization Pipeline](#serialization-pipeline)
4. [Deserialization Pipeline](#deserialization-pipeline)
5. [Circular Reference Handling](#circular-reference-handling)
6. [Class Registration System](#class-registration-system)
7. [Hydration Strategies](#hydration-strategies)
8. [Getters and Computed Properties](#getters-and-computed-properties)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [TypeScript Considerations](#typescript-considerations)
11. [Design Decisions](#design-decisions)

---

## Architecture Overview

SuperLocalStorage acts as a middleware layer between your application and Titan Planet's `t.ls` storage API. It leverages the [devalue](https://github.com/Rich-Harris/devalue) library for serialization while adding custom class hydration support.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SuperLocalStorage                           │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │  Class Registry │    │  Serialization  │    │ Rehydration │  │
│  │   (Map<name,    │    │   Pipeline      │    │  Pipeline   │  │
│  │    {Constructor,│    │                 │    │             │  │
│  │     hydrate?}>) │    │                 │    │             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    devalue (stringify/parse)                     │
│         Handles: Map, Set, Date, RegExp, BigInt, etc.           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      t.ls (Titan Planet API)                     │
│                    Native string key-value store                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Type Markers

Custom class instances are wrapped with metadata markers before serialization:

```javascript
// Constants used for metadata
const TYPE_MARKER = '__super_type__';  // Stores the registered class name
const DATA_MARKER = '__data__';        // Stores the serialized properties
```

### 2. The Wrapper Structure

When a registered class instance is serialized, it becomes:

```javascript
// Original instance
const player = new Player('Alice', 100);

// After _toSerializable() transformation
{
    __super_type__: 'Player',      // Class identifier
    __data__: {                     // All own enumerable properties (NOT getters)
        name: 'Alice',
        score: 100
    }
}
```

### 3. The Registry

A `Map` that associates type names with their constructors and optional hydrate functions:

```javascript
this.registry = new Map();
// After registration:
// 'Player' → { Constructor: class Player { ... }, hydrate: null }
// 'User'   → { Constructor: class User { ... }, hydrate: (data) => new User(data.name) }
```

---

## Serialization Pipeline

The `set(key, value)` method triggers the serialization pipeline:

```
set(key, value)
       │
       ▼
_toSerializable(value, seen)
       │
       ├─── isPrimitive? ──────────────────► return value
       │
       ├─── seen.has(value)? ──────────────► return seen.get(value)  [circular ref]
       │
       ├─── _tryWrapRegisteredClass() ─────► { __super_type__, __data__ }
       │           │
       │           └─── Object.keys() extracts ONLY own enumerable properties
       │                (getters are NOT included - see Getters section)
       │
       ├─── _isNativelySerializable()? ────► return value  [Date, RegExp, TypedArray]
       │
       └─── _serializeCollection()
                   │
                   ├─── Array  → _serializeArray()
                   ├─── Map    → _serializeMap()
                   ├─── Set    → _serializeSet()
                   └─── Object → _serializeObject()
                            │
                            └─── recursively process all values
       │
       ▼
stringify(payload)  ← devalue library
       │
       ▼
t.ls.set(prefixedKey, serializedString)
```

### Key Methods Explained

#### `_toSerializable(value, seen)`

The main recursive transformation function. It:

1. **Short-circuits primitives** - Returns immediately for `null`, `undefined`, numbers, strings, booleans
2. **Handles circular references** - Uses `WeakMap` to track already-processed objects
3. **Prioritizes registered classes** - Checks class registry BEFORE native types
4. **Delegates to specialists** - Routes to type-specific serializers

```javascript
_toSerializable(value, seen = new WeakMap()) {
    if (isPrimitive(value)) return value;
    if (seen.has(value)) return seen.get(value);  // Circular reference!
    
    const classWrapper = this._tryWrapRegisteredClass(value, seen);
    if (classWrapper) return classWrapper;
    
    if (this._isNativelySerializable(value)) return value;
    
    return this._serializeCollection(value, seen);
}
```

#### `_tryWrapRegisteredClass(value, seen)`

Checks if the value is an instance of any registered class:

```javascript
_tryWrapRegisteredClass(value, seen) {
    for (const [name, { Constructor }] of this.registry.entries()) {
        if (value instanceof Constructor) {
            // Create wrapper FIRST (for circular ref tracking)
            const wrapper = {
                [TYPE_MARKER]: name,
                [DATA_MARKER]: {}
            };
            
            // Register in seen map BEFORE recursing (prevents infinite loops)
            seen.set(value, wrapper);
            
            // IMPORTANT: Object.keys() returns ONLY own enumerable properties
            // Getters are NOT included because they are defined on the prototype
            for (const key of Object.keys(value)) {
                wrapper[DATA_MARKER][key] = this._toSerializable(value[key], seen);
            }
            
            return wrapper;
        }
    }
    return null;  // Not a registered class
}
```

---

## Deserialization Pipeline

The `get(key)` method triggers the deserialization pipeline:

```
get(key)
    │
    ▼
t.ls.get(prefixedKey)
    │
    ├─── null? ────────────────────────────► return null
    │
    ▼
parse(raw)  ← devalue library (restores Map, Set, Date, etc.)
    │
    ▼
_rehydrate(parsed, seen)
    │
    ├─── isPrimitive? ─────────────────────► return value
    │
    ├─── seen.has(value)? ─────────────────► return seen.get(value)  [circular ref]
    │
    ├─── hasTypeWrapper()? ────────────────► _rehydrateClass()
    │           │
    │           ├─── Create placeholder object
    │           ├─── Register in seen map
    │           ├─── Recursively rehydrate __data__ properties
    │           ├─── Create instance via:
    │           │      1. hydrate function (if provided to register())
    │           │      2. static hydrate() method (backward compatible)
    │           │      3. new Constructor() + Object.assign()
    │           └─── Morph placeholder into instance
    │
    ├─── Date or RegExp? ──────────────────► return value
    │
    └─── _rehydrateCollection()
                │
                ├─── Array  → _rehydrateArray()
                ├─── Map    → _rehydrateMap()
                ├─── Set    → _rehydrateSet()
                └─── Object → _rehydrateObject()
```

### Key Methods Explained

#### `_rehydrateClass(value, seen)`

The most complex method - restores class instances:

```javascript
_rehydrateClass(value, seen) {
    const entry = this.registry.get(value[TYPE_MARKER]);
    
    if (!entry) {
        // Class not registered - treat as plain object
        return this._rehydrateObject(value, seen);
    }
    
    const { Constructor, hydrate } = entry;
    
    // CRITICAL: Create placeholder BEFORE recursing
    // This placeholder will be used for circular references
    const placeholder = {};
    seen.set(value, placeholder);
    
    // Recursively rehydrate all nested data
    const hydratedData = {};
    for (const key of Object.keys(value[DATA_MARKER])) {
        hydratedData[key] = this._rehydrate(value[DATA_MARKER][key], seen);
    }
    
    // Create the actual instance (see Hydration Strategies section)
    const instance = this._createInstance(Constructor, hydratedData, hydrate);
    
    // MAGIC: Transform placeholder into the actual instance
    // Any circular references pointing to placeholder now point to instance
    Object.assign(placeholder, instance);
    Object.setPrototypeOf(placeholder, Object.getPrototypeOf(instance));
    
    return placeholder;
}
```

#### `_createInstance(Constructor, data, hydrate)`

Handles instance creation with multiple strategies:

```javascript
_createInstance(Constructor, data, hydrate) {
    // Priority 1: Hydrate function passed to register()
    if (typeof hydrate === 'function') {
        return hydrate(data);
    }
    
    // Priority 2: Static hydrate() method on class (backward compatible)
    if (typeof Constructor.hydrate === 'function') {
        return Constructor.hydrate(data);
    }
    
    // Priority 3: Default - create empty instance and assign properties
    const instance = new Constructor();
    Object.assign(instance, data);
    return instance;
}
```

---

## Circular Reference Handling

Circular references are handled through a `WeakMap` called `seen` that tracks processed objects.

### The Problem

```javascript
const parent = new Parent('John');
const child = new Child('Jane');
parent.child = child;
child.parent = parent;  // Circular!
```

Without protection, recursion would be infinite:
```
serialize(parent)
  → serialize(parent.child)
    → serialize(child.parent)
      → serialize(parent.child)  // Infinite loop!
```

### The Solution: Pre-registration

```javascript
_tryWrapRegisteredClass(value, seen) {
    // 1. Create wrapper structure
    const wrapper = { __super_type__: name, __data__: {} };
    
    // 2. Register BEFORE recursing into properties
    seen.set(value, wrapper);
    
    // 3. Now safe to recurse - if we encounter this object again,
    //    seen.has(value) returns true and we return the existing wrapper
    for (const key of Object.keys(value)) {
        wrapper[DATA_MARKER][key] = this._toSerializable(value[key], seen);
    }
}
```

### Rehydration with Placeholders

During deserialization, we use a "placeholder morphing" technique:

```javascript
// 1. Create empty placeholder
const placeholder = {};
seen.set(value, placeholder);

// 2. Recurse - any circular refs get the placeholder
const hydratedData = { /* ... recursive calls ... */ };

// 3. Create real instance
const instance = new Constructor();
Object.assign(instance, hydratedData);

// 4. MORPH placeholder into instance
Object.assign(placeholder, instance);                    // Copy properties
Object.setPrototypeOf(placeholder, Constructor.prototype); // Set prototype

// Now placeholder IS the instance, and all circular refs work!
```

### Visual Example

```
Before morphing:
┌────────────────┐     ┌────────────────┐
│ parent         │     │ child          │
│ ┌────────────┐ │     │ ┌────────────┐ │
│ │ child: ────┼─┼─────┼─►placeholder │ │
│ └────────────┘ │     │ └────────────┘ │
│ ┌────────────┐ │     │ ┌────────────┐ │
│ │ name:'John'│ │     │ │ parent: ───┼─┼──► placeholder (for parent)
│ └────────────┘ │     │ └────────────┘ │
└────────────────┘     └────────────────┘

After morphing (placeholder becomes actual Child instance):
┌────────────────┐     ┌────────────────┐
│ parent         │     │ child (was     │
│ (Child inst.)  │     │  placeholder)  │
│ ┌────────────┐ │     │ ┌────────────┐ │
│ │ child: ────┼─┼─────┼─► Child inst │ │
│ └────────────┘ │     │ └────────────┘ │
└────────────────┘     └────────────────┘
```

---

## Class Registration System

### Registration Flow

```javascript
// Basic registration
superLs.register(Player);
// Internally:
// 1. Validate: typeof Player === 'function' ✓
// 2. Get name: Player.name → 'Player'
// 3. Store: registry.set('Player', { Constructor: Player, hydrate: null })

// With custom type name
superLs.register(Player, 'GamePlayer');
// registry.set('GamePlayer', { Constructor: Player, hydrate: null })

// With hydrate function
superLs.register(Player, (data) => new Player(data.name, data.score));
// registry.set('Player', { Constructor: Player, hydrate: (data) => ... })

// With hydrate function AND custom type name
superLs.register(Player, (data) => new Player(data.name, data.score), 'GamePlayer');
// registry.set('GamePlayer', { Constructor: Player, hydrate: (data) => ... })
```

### Registration Overload Resolution

```javascript
register(ClassRef, hydrateOrTypeName, typeName) {
    // Validate ClassRef is a function/class
    if (typeof ClassRef !== 'function') {
        throw new Error('ClassRef must be a class or constructor function');
    }
    
    let hydrate = null;
    let name = ClassRef.name;
    
    // Determine what second argument is
    if (typeof hydrateOrTypeName === 'function') {
        // register(Class, hydrateFunction) or register(Class, hydrateFunction, typeName)
        hydrate = hydrateOrTypeName;
        if (typeof typeName === 'string') {
            name = typeName;
        }
    } else if (typeof hydrateOrTypeName === 'string') {
        // register(Class, typeName)
        name = hydrateOrTypeName;
    }
    
    this.registry.set(name, { Constructor: ClassRef, hydrate });
}
```

### Why Custom Names?

1. **Minification** - In production, `Player.name` might become `t` or `n`
2. **Name Collisions** - Two modules might export `class User`
3. **Versioning** - `UserV1`, `UserV2` for migration scenarios

---

## Hydration Strategies

SuperLocalStorage supports three hydration strategies, applied in priority order:

### Strategy 1: Hydrate Function (Recommended)

Pass a hydrate function as the second argument to `register()`:

```javascript
class ImmutableUser {
    constructor(id, email) {
        if (!id || !email) throw new Error('Required!');
        this.id = id;
        this.email = email;
        Object.freeze(this);
    }
}

// The hydrate function receives serialized data and returns a class instance
superLs.register(ImmutableUser, (data) => new ImmutableUser(data.id, data.email));
```

**When to use:**
- Constructor requires arguments
- Constructor has validation logic
- Class uses `Object.freeze()` or `Object.seal()`
- Class has private fields (`#prop`)
- Constructor uses destructuring

### Strategy 2: Static `hydrate()` Method (Backward Compatible)

Define a static `hydrate()` method on your class:

```javascript
class ImmutableUser {
    constructor(id, email) {
        if (!id || !email) throw new Error('Required!');
        this.id = id;
        this.email = email;
        Object.freeze(this);
    }
    
    static hydrate(data) {
        return new ImmutableUser(data.id, data.email);
    }
}

superLs.register(ImmutableUser);  // No hydrate function needed
```

**Note:** This approach is maintained for backward compatibility. The hydrate function approach (Strategy 1) is preferred as it keeps hydration logic separate from the class definition.

### Strategy 3: Default (Constructor + Object.assign)

For simple classes with parameterless or default-parameter constructors:

```javascript
class Player {
    constructor(name = '', score = 0) {
        this.name = name;
        this.score = score;
    }
    
    greet() {
        return `Hello, ${this.name}!`;
    }
}

superLs.register(Player);  // Works! Constructor can be called without args
```

**How it works:**
```javascript
const instance = new Constructor();  // Calls with no arguments
Object.assign(instance, data);       // Copies all properties from data
```

**Requirements:**
- Constructor must be callable without arguments
- No validation that throws on empty values
- No `Object.freeze()` or `Object.seal()`

### Hydration Strategy Comparison

| Strategy | Use Case | Pros | Cons |
|----------|----------|------|------|
| Hydrate function | Complex constructors | Full control, explicit | Extra code at registration |
| Static `hydrate()` | Legacy/self-contained classes | Keeps logic with class | Couples serialization to class |
| Default | Simple DTOs | Zero configuration | Limited to simple constructors |

### Hydration Data Shape

The `data` parameter passed to hydrate functions contains **only own enumerable properties** of the original instance:

```javascript
class Player {
    name;           // ✅ Included in data
    score;          // ✅ Included in data
    #secret;        // ❌ NOT included (private)
    
    get fullName() { // ❌ NOT included (getter on prototype)
        return `Player: ${this.name}`;
    }
    
    greet() {       // ❌ NOT included (method on prototype)
        return 'Hi!';
    }
}

// When hydrating, data will be: { name: '...', score: ... }
// Private fields and getters/methods are NOT present
```

---

## Getters and Computed Properties

### Why Getters Are Not Serialized

JavaScript getters are **not** serialized because:

1. **They're on the prototype**, not the instance
2. **`Object.keys()` doesn't include them**
3. **They're computed values**, not stored data

```javascript
class Player {
    constructor(name, score) {
        this.name = name;    // Own property - SERIALIZED
        this.score = score;  // Own property - SERIALIZED
    }
    
    get fullName() {         // Prototype getter - NOT SERIALIZED
        return `Player: ${this.name}`;
    }
    
    get displayScore() {     // Prototype getter - NOT SERIALIZED
        return `Score: ${this.score}`;
    }
}

const player = new Player('Alice', 100);

// What Object.keys() sees:
Object.keys(player);  // ['name', 'score']  - NO getters!

// What gets serialized:
{
    __super_type__: 'Player',
    __data__: {
        name: 'Alice',
        score: 100
        // fullName and displayScore are NOT here
    }
}
```

### Getter Behavior at Runtime

After deserialization, getters work correctly because:

1. The class prototype is restored via `Object.setPrototypeOf()`
2. Getters are defined on the prototype
3. When accessed, they compute their value from the restored properties

```javascript
superLs.register(Player);
superLs.set('player', new Player('Alice', 100));

const restored = superLs.get('player');
console.log(restored.fullName);     // "Player: Alice" - WORKS!
console.log(restored.displayScore); // "Score: 100" - WORKS!
```

### The Serialization vs. Computation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      INSTANCE PROPERTIES                         │
│                   (Stored via Object.keys())                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  name: 'Alice'     ────────────────────►  SERIALIZED ✅     │ │
│  │  score: 100        ────────────────────►  SERIALIZED ✅     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PROTOTYPE (Player.prototype)                  │
│                  (NOT included in Object.keys())                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  get fullName()    ────────────────────►  NOT SERIALIZED ❌ │ │
│  │  get displayScore()────────────────────►  NOT SERIALIZED ❌ │ │
│  │  greet()           ────────────────────►  NOT SERIALIZED ❌ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  After rehydration, prototype is restored via:                   │
│  Object.setPrototypeOf(placeholder, Player.prototype)            │
│  So getters and methods WORK on the restored instance!           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Complete Serialization Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUT: { player: Player { name: 'Alice', weapon: Weapon { dmg: 50 } } }│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _toSerializable() - Process root object                                │
│  seen = WeakMap { }                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│ key: 'player'    │    │ Player instance  │    │ Weapon instance      │
│ (string, skip)   │    │ IS registered    │    │ IS registered        │
└──────────────────┘    │ Wrap it!         │    │ Wrap it!             │
                        └──────────────────┘    └──────────────────────┘
                                    │                         │
                                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  OUTPUT (before devalue):                                               │
│  {                                                                      │
│    player: {                                                            │
│      __super_type__: 'Player',                                          │
│      __data__: {                                                        │
│        name: 'Alice',                                                   │
│        weapon: {                                                        │
│          __super_type__: 'Weapon',                                      │
│          __data__: { dmg: 50 }                                          │
│        }                                                                │
│      }                                                                  │
│    }                                                                    │
│  }                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ devalue.stringify()
┌─────────────────────────────────────────────────────────────────────────┐
│  STORED STRING: '[{"player":1},{"__super_type__":2,"__data__":3},...'   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Complete Deserialization Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STORED STRING: '[{"player":1},{"__super_type__":2,"__data__":3},...'   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ devalue.parse()
┌─────────────────────────────────────────────────────────────────────────┐
│  PARSED (with __super_type__ markers intact):                           │
│  { player: { __super_type__: 'Player', __data__: { ... } } }            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _rehydrate() - Detect __super_type__ marker                            │
│  Look up 'Player' in registry → Found!                                  │
│  Check for hydrate function → use if present                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _rehydrateClass():                                                     │
│  1. placeholder = {}                                                    │
│  2. seen.set(original, placeholder)                                     │
│  3. hydratedData = { name: 'Alice', weapon: <recurse...> }              │
│  4. instance = hydrate(hydratedData)     // If hydrate function exists  │
│     OR instance = new Player(); Object.assign(instance, hydratedData)   │
│  5. Object.assign(placeholder, instance)                                │
│  6. Object.setPrototypeOf(placeholder, Player.prototype)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  OUTPUT: { player: Player { name: 'Alice', weapon: Weapon { dmg: 50 } } │
│  ✓ player instanceof Player                                             │
│  ✓ player.weapon instanceof Weapon                                      │
│  ✓ player.attack() works (methods restored via prototype)               │
│  ✓ player.fullName works (getter restored via prototype)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TypeScript Considerations

### Type Definitions

SuperLocalStorage includes full TypeScript support:

```typescript
// PropertiesOnly<T> extracts non-function properties from a class
type PropertiesOnly<T> = {
    [K in keyof T as T[K] extends Function ? never : K]: T[K]
};

// HydrateFunction receives only the serializable properties
type HydrateFunction<T> = (data: PropertiesOnly<T>) => T;
```

### The Getter Problem in TypeScript

**Important limitation**: TypeScript **cannot distinguish** between getters and regular `readonly` properties at the type level.

```typescript
class Player {
    name: string;
    score: number;
    readonly id: string = crypto.randomUUID();  // Regular property
    
    get fullName(): string {    // Getter
        return `Player: ${this.name}`;
    }
}

// TypeScript sees both 'id' and 'fullName' as: readonly string
// There's no type-level metadata to differentiate them!
```

### Implications for HydrateFunction

Because TypeScript can't detect getters, `PropertiesOnly<T>` includes them:

```typescript
// TypeScript thinks data has these properties:
// { name: string; score: number; id: string; fullName: string }
//                                            ^^^^^^^^^^
//                                            Getter appears here!

superLs.register(Player, (data) => {
    // data.fullName is typed as string
    // BUT at runtime, it's actually undefined!
    console.log(data.fullName);  // undefined (not in serialized data)
    
    return new Player(data.name, data.score);
});
```

### Workarounds

**Option 1: Ignore getter properties (recommended)**

Simply don't access getter properties in your hydrate function:

```typescript
superLs.register(Player, (data) => {
    // Only use actual properties, ignore what TypeScript says about getters
    return new Player(data.name, data.score);
});
```

**Option 2: Define explicit data interface**

```typescript
interface PlayerData {
    name: string;
    score: number;
    id: string;
}

superLs.register(Player, (data: PlayerData) => {
    return new Player(data.name, data.score);
});
```

**Option 3: Use Omit to exclude getters**

```typescript
type PlayerSerializable = Omit<PropertiesOnly<Player>, 'fullName' | 'displayScore'>;

superLs.register(Player, (data: PlayerSerializable) => {
    return new Player(data.name, data.score);
});
```

### Why This Limitation Exists

TypeScript's type system represents both of these identically:

```typescript
// These produce identical type signatures:
class A {
    readonly value: string = 'hello';
}

class B {
    get value(): string { return 'hello'; }
}

// For both: keyof A === keyof B === 'value'
// And: A['value'] === B['value'] === string
```

There's no type-level metadata that indicates "this is a getter" vs "this is a regular property". This is a fundamental limitation of TypeScript's structural type system.

### Runtime vs. Type System

| Aspect | Runtime Behavior | TypeScript Type |
|--------|------------------|-----------------|
| Own property (`this.x = 1`) | ✅ Serialized | ✅ In type |
| Getter (`get x()`) | ❌ Not serialized | ⚠️ In type (incorrectly) |
| Method (`x() {}`) | ❌ Not serialized | ❌ Excluded by `PropertiesOnly` |
| `readonly` property | ✅ Serialized | ✅ In type |

**Key insight**: At runtime, `super-ls` behaves correctly. The TypeScript type is simply more permissive than reality for getters.

---

## Design Decisions

### 1. Why Check Registered Classes First?

```javascript
// In _toSerializable():
const classWrapper = this._tryWrapRegisteredClass(value, seen);
if (classWrapper) return classWrapper;

if (this._isNativelySerializable(value)) return value;
```

**Reason**: A registered class might extend `Date` or another native type. By checking registered classes first, we ensure custom serialization takes precedence.

### 2. Why Use `Object.setPrototypeOf()` Instead of Returning the Instance Directly?

```javascript
// We do this:
Object.assign(placeholder, instance);
Object.setPrototypeOf(placeholder, Object.getPrototypeOf(instance));
return placeholder;

// Instead of:
return instance;
```

**Reason**: Circular references already point to `placeholder`. If we return `instance`, those references become stale. By morphing `placeholder` into `instance`, all existing references remain valid.

### 3. Why Separate `_serializeX` and `_rehydrateX` Methods?

**Reasons**:
- **Single Responsibility**: Each method handles one type
- **Testability**: Individual methods can be unit tested
- **Readability**: Clear what each method does
- **Extensibility**: Easy to add new type handlers

### 4. Why Use `WeakMap` for `seen`?

```javascript
_toSerializable(value, seen = new WeakMap())
```

**Reasons**:
- **Memory efficiency**: WeakMap allows garbage collection of processed objects
- **No memory leaks**: References don't prevent cleanup
- **Object keys**: WeakMap allows objects as keys (regular Map would work but less efficiently)

### 5. Why `Object.keys()` Instead of `for...in`?

```javascript
for (const key of Object.keys(value)) {
    // ...
}
```

**Reason**: `Object.keys()` returns only own enumerable properties. `for...in` would include inherited properties, which we don't want to serialize. This also naturally excludes getters (which are on the prototype).

### 6. Why the Prefix System?

```javascript
this.prefix = 'sls_';
t.ls.set(this.prefix + key, serialized);
```

**Reasons**:
- **Namespace isolation**: Prevents collisions with other storage users
- **Easy identification**: All SuperLocalStorage keys are identifiable
- **Bulk operations**: Could implement `clearAll()` by prefix matching

### 7. Why Hydrate Function Over Static Method?

The hydrate function approach (introduced as the primary method) is preferred over static `hydrate()` methods because:

- **Separation of concerns**: Serialization logic stays outside class definition
- **Flexibility**: Different hydration strategies for different contexts
- **No class modification**: Works with third-party classes you don't control
- **Explicit at call site**: Clear what hydration strategy is being used

The static `hydrate()` method is maintained for backward compatibility.

---

## Performance Considerations

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `register()` | O(1) | Map insertion |
| `set()` | O(n) | n = total properties in object graph |
| `get()` | O(n) | n = total properties in object graph |
| Class lookup | O(k) | k = number of registered classes |

### Memory Considerations

- **WeakMap for `seen`**: Allows GC of intermediate objects
- **Placeholder pattern**: Temporarily doubles memory for circular structures
- **String storage**: Final serialized form is a string (browser limitation)

### Optimization Opportunities

1. **Class lookup cache**: Could use `instanceof` checks once and cache results
2. **Streaming serialization**: For very large objects
3. **Compression**: For string-heavy data

---

## Summary

SuperLocalStorage provides a transparent serialization layer that:

1. **Wraps** registered class instances with type metadata
2. **Delegates** native type handling to devalue
3. **Tracks** circular references via WeakMap
4. **Morphs** placeholders for reference integrity
5. **Restores** class prototypes for method and getter access
6. **Supports** flexible hydration via functions or static methods
7. **Excludes** getters automatically (they're computed, not stored)

The design prioritizes correctness over performance, with special attention to edge cases like circular references, inheritance, complex constructor requirements, and the distinction between stored properties and computed getters.