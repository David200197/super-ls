# SuperLocalStorage - Technical Deep Dive

> A comprehensive guide to understanding the internal architecture and implementation details of SuperLocalStorage.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Serialization Pipeline](#serialization-pipeline)
4. [Deserialization Pipeline](#deserialization-pipeline)
5. [Circular Reference Handling](#circular-reference-handling)
6. [Class Registration System](#class-registration-system)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Design Decisions](#design-decisions)

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
│  │    Constructor>)│    │                 │    │             │  │
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
    __data__: {                     // All own properties
        name: 'Alice',
        score: 100
    }
}
```

### 3. The Registry

A `Map` that associates type names with their constructors:

```javascript
this.registry = new Map();
// After registration:
// 'Player' → class Player { ... }
// 'Weapon' → class Weapon { ... }
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
       │           └─── recursively process all properties
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
    for (const [name, Constructor] of this.registry.entries()) {
        if (value instanceof Constructor) {
            // Create wrapper FIRST (for circular ref tracking)
            const wrapper = {
                [TYPE_MARKER]: name,
                [DATA_MARKER]: {}
            };
            
            // Register in seen map BEFORE recursing (prevents infinite loops)
            seen.set(value, wrapper);
            
            // Now safely recurse into properties
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
    │           ├─── Create instance via hydrate() or new Constructor()
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
    const Constructor = this.registry.get(value[TYPE_MARKER]);
    
    if (!Constructor) {
        // Class not registered - treat as plain object
        return this._rehydrateObject(value, seen);
    }
    
    // CRITICAL: Create placeholder BEFORE recursing
    // This placeholder will be used for circular references
    const placeholder = {};
    seen.set(value, placeholder);
    
    // Recursively rehydrate all nested data
    const hydratedData = {};
    for (const key of Object.keys(value[DATA_MARKER])) {
        hydratedData[key] = this._rehydrate(value[DATA_MARKER][key], seen);
    }
    
    // Create the actual instance
    const instance = this._createInstance(Constructor, hydratedData);
    
    // MAGIC: Transform placeholder into the actual instance
    // Any circular references pointing to placeholder now point to instance
    Object.assign(placeholder, instance);
    Object.setPrototypeOf(placeholder, Object.getPrototypeOf(instance));
    
    return placeholder;
}
```

#### `_createInstance(Constructor, data)`

Handles both simple and complex constructors:

```javascript
_createInstance(Constructor, data) {
    // If class has static hydrate(), use it (for complex constructors)
    if (typeof Constructor.hydrate === 'function') {
        return Constructor.hydrate(data);
    }
    
    // Otherwise, create empty instance and assign properties
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
superLs.register(Player);
// Internally:
// 1. Validate: typeof Player === 'function' ✓
// 2. Get name: Player.name → 'Player'
// 3. Store: registry.set('Player', Player)

superLs.register(Player, 'GamePlayer');
// Same but uses custom name:
// registry.set('GamePlayer', Player)
```

### Why Custom Names?

1. **Minification** - In production, `Player.name` might become `t` or `n`
2. **Name Collisions** - Two modules might export `class User`
3. **Versioning** - `UserV1`, `UserV2` for migration scenarios

### The `hydrate()` Pattern

For classes with complex constructors:

```javascript
class ImmutableUser {
    constructor(name, email) {
        if (!name || !email) throw new Error('Required!');
        this.name = name;
        this.email = email;
        Object.freeze(this);
    }
    
    // Without hydrate(), deserialization would fail because
    // new ImmutableUser() throws an error
    
    static hydrate(data) {
        return new ImmutableUser(data.name, data.email);
    }
}
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
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _rehydrateClass():                                                     │
│  1. placeholder = {}                                                    │
│  2. seen.set(original, placeholder)                                     │
│  3. hydratedData = { name: 'Alice', weapon: <recurse...> }              │
│  4. instance = new Player(); Object.assign(instance, hydratedData)      │
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
└─────────────────────────────────────────────────────────────────────────┘
```

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

**Reason**: `Object.keys()` returns only own enumerable properties. `for...in` would include inherited properties, which we don't want to serialize.

### 6. Why the Prefix System?

```javascript
this.prefix = 'sls_';
t.ls.set(this.prefix + key, serialized);
```

**Reasons**:
- **Namespace isolation**: Prevents collisions with other storage users
- **Easy identification**: All SuperLocalStorage keys are identifiable
- **Bulk operations**: Could implement `clearAll()` by prefix matching

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
5. **Restores** class prototypes for method access

The design prioritizes correctness over performance, with special attention to edge cases like circular references, inheritance, and complex constructor requirements.