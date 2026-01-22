# SuperLocalStorage Test Documentation

> **Total: 118 tests passing** | 3 test suites | ~50ms execution time

## Overview

SuperLocalStorage is an enhanced localStorage wrapper for Titan Planet that supports complex JavaScript types including `Map`, `Set`, `Date`, circular references, and custom class instances with automatic serialization/deserialization.

---

## Test Suite 1: Normal Cases (36 tests)

Standard functionality tests covering typical usage scenarios.

### Basic JavaScript Types (9 tests)

| Test | Description |
|------|-------------|
| `should store and retrieve simple objects` | Verifies plain objects with nested properties survive serialization round-trip |
| `should store and retrieve arrays` | Confirms arrays maintain order and values after storage |
| `should store and retrieve Map` | Tests native `Map` support with key-value pair preservation |
| `should store and retrieve Set` | Tests native `Set` support with unique value preservation |
| `should store and retrieve Date` | Verifies `Date` objects are restored as actual Date instances, not strings |
| `should store and retrieve undefined` | Confirms explicit `undefined` values are preserved (not converted to `null`) |
| `should store and retrieve null` | Validates `null` values are stored and retrieved correctly |
| `should store and retrieve special numbers (NaN, Infinity)` | Tests IEEE 754 special values that JSON normally loses |
| `should store and retrieve circular references` | Verifies objects referencing themselves don't cause infinite loops |

### Registered Classes (5 tests)

| Test | Description |
|------|-------------|
| `should store and retrieve class instances` | Basic class registration and instance recovery with correct prototype |
| `should preserve class methods` | Confirms instance methods are functional after deserialization |
| `should use static hydrate() when defined` | Tests custom reconstruction via static `hydrate()` method |
| `should handle multiple instances of the same class` | Verifies array of same-class instances are all properly restored |
| `should allow registration with custom typeName` | Tests aliasing classes to avoid name collisions or minification issues |

### Dependency Injection - Single Dependency (4 tests)

| Test | Description |
|------|-------------|
| `should store and retrieve class with single dependency` | Class containing another registered class instance as property |
| `should preserve dependency methods` | Nested class instance methods remain functional |
| `should handle null dependency gracefully` | Optional dependencies set to `null` don't cause errors |
| `should preserve dependency as proper class instance` | Verifies `instanceof` check passes for nested dependencies |

### Dependency Injection - Nested Dependencies (3 tests)

| Test | Description |
|------|-------------|
| `should store and retrieve class with nested dependencies` | Three-level deep class composition (A → B → C) |
| `should preserve nested dependency methods` | Methods at all nesting levels work correctly |
| `should preserve nested dependencies as proper class instances` | `instanceof` checks pass at all nesting levels |

### Dependency Injection - Multiple Dependencies (IoC Pattern) (3 tests)

| Test | Description |
|------|-------------|
| `should store and retrieve service with multiple dependencies` | Service class with multiple injected dependencies (IoC pattern) |
| `should handle service with state in dependencies` | Dependencies maintain their internal state after restoration |
| `should work with services using static hydrate` | Complex dependency graphs with custom hydration logic |

### Dependency Injection - Circular Dependencies (2 tests)

| Test | Description |
|------|-------------|
| `should handle parent-child circular references` | Parent references Child which references Parent back |
| `should preserve bidirectional references` | Both directions of circular reference work correctly |

### Dependency Injection - Array of Dependencies (2 tests)

| Test | Description |
|------|-------------|
| `should handle array of class instances as dependency` | Class property containing array of other class instances |
| `should handle Map with class instances as values` | Class instances stored as Map values are properly restored |

### Complex Cases (3 tests)

| Test | Description |
|------|-------------|
| `should handle nested objects with Map` | Deep nesting combining plain objects and Maps |
| `should handle arrays with mixed types` | Arrays containing primitives, objects, and class instances |
| `should return null for non-existent keys` | Graceful handling of missing keys |

### README Validation (2 tests)

| Test | Description |
|------|-------------|
| `Basic Usage: Map with user_settings` | Validates the basic example from README works |
| `Class Hydration: Player with methods` | Validates the class hydration example from README works |

### Internals (Under the Hood) (2 tests)

| Test | Description |
|------|-------------|
| `should use devalue for serialization` | Confirms devalue library is being used for stringify/parse |
| `should add __super_type__ metadata for registered classes` | Verifies internal wrapper structure with type markers |

### Error Handling (1 test)

| Test | Description |
|------|-------------|
| `should throw error when registering non-class values` | Attempting to register primitives or plain objects throws |

---

## Test Suite 2: Edge Cases (37 tests)

Stress tests and boundary conditions for robustness validation.

### Class Inheritance (3 tests)

| Test | Description |
|------|-------------|
| `should handle simple class inheritance` | Child class extending parent maintains both class's methods |
| `should handle multi-level inheritance` | Three-level inheritance chain (A → B → C) works correctly |
| `should handle inheritance with dependency injection` | Inherited class with injected dependencies |

### Shared References (3 tests)

| Test | Description |
|------|-------------|
| `should handle same instance referenced multiple times` | Single instance used in multiple properties stays deduplicated |
| `should handle shared instance in nested structures` | Shared references across nesting levels maintain identity |
| `should handle shared instance in array` | Array with repeated same-instance elements preserves identity |

### Unregistered Classes as Dependencies (2 tests)

| Test | Description |
|------|-------------|
| `should convert unregistered class to plain object` | Unregistered classes become POJOs (methods lost, data preserved) |
| `should handle array of unregistered classes` | Array of unregistered instances converted to plain objects |

### Special Data Types (5 tests)

| Test | Description |
|------|-------------|
| `should handle BigInt` | Large integers beyond `Number.MAX_SAFE_INTEGER` are preserved |
| `should handle RegExp` | Regular expressions with flags survive round-trip |
| `should handle Typed Arrays` | `Uint8Array`, `Float32Array`, `Int32Array` support |
| `should handle sparse arrays (holes become undefined)` | Sparse array holes are converted to `undefined` (known limitation) |
| `should handle Object.create(null)` | Objects without prototype are handled correctly |

### Deeply Nested Structures (2 tests)

| Test | Description |
|------|-------------|
| `should handle 10 levels of nesting` | Deep class instance chains don't cause stack overflow |
| `should handle mixed nested types` | Combination of Map, Set, arrays, and classes deeply nested |

### Constructor Edge Cases (2 tests)

| Test | Description |
|------|-------------|
| `should handle class with required constructor args using hydrate` | Classes that throw without args use `static hydrate()` |
| `should handle class with default constructor when no hydrate` | Classes with default parameter values work without hydrate |

### Getters and Setters (1 test)

| Test | Description |
|------|-------------|
| `should NOT serialize computed getters (expected behavior)` | Getters remain functional via prototype, not serialized as values |

### Class Name Collisions (1 test)

| Test | Description |
|------|-------------|
| `should handle classes with same name using custom typeName` | Two classes named "User" from different modules coexist via aliases |

### Circular References with Classes (2 tests)

| Test | Description |
|------|-------------|
| `should handle self-referencing class` | Doubly-linked list with circular `next`/`prev` pointers |
| `should handle mutual circular references between different classes` | Author ↔ Book bidirectional relationship |

### Explicit Undefined Values (2 tests)

| Test | Description |
|------|-------------|
| `should preserve explicit undefined in objects` | Properties explicitly set to `undefined` remain `undefined` |
| `should handle undefined in arrays` | Array elements with `undefined` values are preserved |

### Empty Structures (2 tests)

| Test | Description |
|------|-------------|
| `should handle empty class instance` | Class with no own properties serializes/deserializes correctly |
| `should handle empty nested structures` | Empty `{}`, `[]`, `Map`, and `Set` all work |

### Special Property Names (2 tests)

| Test | Description |
|------|-------------|
| `should handle properties named like internal markers` | Properties named `__super_type__`, `__data__` don't break serialization |
| `should handle numeric string keys` | Object keys like `"0"`, `"1"`, `"999"` are preserved |

### Stress Tests (2 tests)

| Test | Description |
|------|-------------|
| `should handle large number of registered classes` | 50 different classes registered simultaneously |
| `should handle large array of class instances` | 1000 class instances in single array |

### Error Scenarios (5 tests)

| Test | Description |
|------|-------------|
| `should return null for non-existent key` | Missing keys return `null`, not throw |
| `should throw when registering non-function` | `register({})`, `register("string")` throw errors |
| `should throw for non-serializable values (functions)` | Objects containing functions throw on `set()` |
| `should silently ignore WeakMap (becomes empty object)` | WeakMap properties become `{}` (known limitation) |
| `should silently ignore WeakSet (becomes empty object)` | WeakSet properties become `{}` (known limitation) |

### Multiple SuperLocalStorage Instances (1 test)

| Test | Description |
|------|-------------|
| `should have isolated registries` | Two SuperLocalStorage instances don't share class registrations |

### Set with Class Instances (1 test)

| Test | Description |
|------|-------------|
| `should handle Set containing class instances` | Set elements that are class instances are properly restored |

### Map with Complex Keys (1 test)

| Test | Description |
|------|-------------|
| `should handle Map with class instances as keys` | Class instances used as Map keys survive serialization |

---

## Test Suite 3: Additional API Methods (45 tests)

Tests for additional API methods: `has()`, `remove()`, `clean()`, `resolve()`, and `register()` with hydrate function.

### has() method (11 tests)

| Test | Description |
|------|-------------|
| `should return true for existing key with object value` | Objects are detected as existing |
| `should return true for existing key with number value` | Numbers are detected as existing |
| `should return true for existing key with zero value` | Zero (falsy) is detected as existing |
| `should return true for existing key with false value` | False (falsy) is detected as existing |
| `should return true for existing key with empty string value` | Empty string (falsy) is detected as existing |
| `should return true for existing key with empty array` | Empty arrays are detected as existing |
| `should return true for existing key with empty object` | Empty objects are detected as existing |
| `should return false for non-existent key` | Missing keys return false |
| `should return false after key is removed` | Removed keys return false |
| `should return true for class instances` | Registered class instances are detected |
| `should return true for Map and Set` | Map and Set are detected as existing |

### remove() method (5 tests)

| Test | Description |
|------|-------------|
| `should remove existing key` | Key is removed and returns null on get |
| `should not throw when removing non-existent key` | Safe to remove missing keys |
| `should only remove specified key` | Other keys remain unaffected |
| `should remove class instances` | Registered class instances can be removed |
| `should remove Map and Set` | Map and Set values can be removed |

### clean() method (4 tests)

| Test | Description |
|------|-------------|
| `should remove all keys` | All stored keys are cleared |
| `should not throw when storage is empty` | Safe to clean empty storage |
| `should remove class instances` | All class instances are cleared |
| `should remove mixed types` | All types (primitives, objects, classes) are cleared |

### resolve() method (12 tests)

| Test | Description |
|------|-------------|
| `should return existing value if key exists` | Returns stored value without calling resolver |
| `should call resolver and store result if key does not exist` | Creates and stores new value |
| `should not call resolver if key exists` | Resolver is not invoked for existing keys |
| `should call resolver only once for new key` | Resolver called exactly once per new key |
| `should work with Map as resolved value` | Map can be lazily initialized |
| `should work with Set as resolved value` | Set can be lazily initialized |
| `should work with class instances` | Class instances can be lazily initialized |
| `should return existing class instance without calling resolver` | Existing instances returned directly |
| `should handle resolver returning primitive values` | Primitives (strings, numbers) work |
| `should handle resolver returning array` | Arrays can be lazily initialized |
| `should work with complex nested structures` | Complex objects with Maps/Sets work |
| `should preserve falsy values (0, false, empty string) as existing` | Falsy values are not overwritten |

### register() with hydrate function as second argument (13 tests)

| Test | Description |
|------|-------------|
| `should use hydrate function for class with required constructor args` | Classes with required args work via hydrate function |
| `should use hydrate function for immutable objects` | Frozen objects remain frozen after deserialization |
| `should use hydrate function for destructuring constructors` | Classes with `constructor({ name, score })` pattern work |
| `should support hydrate function with custom type name` | Hydrate function + custom name combination works |
| `should handle hydrate function with validation logic` | Validation in hydrate function is executed |
| `should handle hydrate function with complex nested data` | Nested class instances use their respective hydrate functions |
| `should handle hydrate function with private-like fields` | Underscore-prefixed "private" fields are restored |
| `should handle nested classes both using hydrate functions` | Parent and child classes both use hydrate functions |
| `should prioritize hydrate function over static hydrate method` | Function argument takes precedence over static method |
| `should fall back to static hydrate if no function provided` | Backward compatible with static hydrate pattern |
| `should work with only custom type name (backward compatible)` | String-only second argument still works |
| `should handle array of instances with hydrate functions` | Arrays of hydrated instances work correctly |
| `should handle Map with class instances using hydrate functions` | Map values using hydrate functions work correctly |

---

## Known Limitations

| Limitation | Behavior |
|------------|----------|
| **Sparse arrays** | Holes become `undefined` values |
| **WeakMap / WeakSet** | Silently converted to empty objects `{}` |
| **Functions** | Throw error (not serializable) |
| **Symbol properties** | Not serialized (standard JSON behavior) |
| **Unregistered classes** | Converted to plain objects, methods lost |
| **Getters/Setters** | Not serialized as values | Work via Hydrate Function |

---

## Test Execution Summary

```
Test Suites: 3 passed, 3 total
Tests:       118 passed, 118 total
Duration:    ~50ms
```