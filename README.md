# 🪐 super-ls

> A supercharged storage adapter for Titan Planet that enables storing complex objects, circular references, and Class instances with automatic rehydration.

`super-ls` extends the capabilities of the native `t.ls` API by using `devalue` for serialization. While standard `t.ls` is limited to simple JSON data, `super-ls` allows you to save and retrieve rich data structures effortlessly.

---

## ✨ Features

*   **Rich Data Types**: Store `Map`, `Set`, `Date`, `undefined`, and circular references.
*   **Class Hydration**: Register your custom classes and retrieve fully functional instances instead of plain JSON objects.
*   **Drop-in Library**: Works via standard ES module `import` without polluting the global `t` namespace.
*   **Titan Native Integration**: Built on top of `@titanpl/core`'s `t.ls` for persistence.

---

## 📦 Installation

Add `super-ls` to your Titan Planet project:

```bash
npm install super-ls
```

---

## 🚀 Usage

### Basic Usage (Complex Objects)

Store objects that standard JSON cannot handle (like Maps or Sets).

```javascript
import superLs from "super-ls";

export const run = (req) => {
    const myMap = new Map();
    myMap.set("user_id", 12345);
    myMap.set("roles", ["admin", "editor"]);

    // Save the Map directly
    superLs.set("user_settings", myMap);

    // Retrieve it later
    const recoveredSettings = superLs.get("user_settings");
    
    // recoveredSettings is a Map instance again
    console.log(recoveredSettings instanceof Map); // true

    return { settings: recoveredSettings };
}
```

### Advanced Usage (Class Hydration)

The true power of `super-ls` lies in its ability to restore class instances with their methods intact.

#### 1. Define your Class

```javascript
class Player {
    constructor(name, score) {
        this.name = name;
        this.score = score;
    }

    greet() {
        return `Hello, I am ${this.name}!`;
    }
}
```

#### 2. Register the Class

You must register the class before saving or loading instances of it.

```javascript
import superLs from "super-ls";

superLs.register(Player);
```

#### 3. Save and Restore

```javascript
// Create an instance
const p1 = new Player("Alice", 100);

// Save it (internally stores class name and data)
superLs.set("player_1", p1);

// ... later in a different request ...

// Retrieve it
const restoredPlayer = superLs.get("player_1");

// It's a real Player instance!
console.log(restoredPlayer.name);       // "Alice"
console.log(restoredPlayer.greet());     // "Hello, I am Alice!"
console.log(restoredPlayer instanceof Player); // true
```

---

## 📚 API Reference

### `superLs.set(key, value)`
Stores any JavaScript value in Titan storage.
*   **key** (`string`): The key to store the value under.
*   **value** (`any`): The data to store (Objects, Maps, Sets, Class Instances, etc.).

### `superLs.get(key)`
Retrieves and deserializes a value.
*   **key** (`string`): The key to retrieve.
*   **Returns**: The original value, with Class instances rehydrated if previously registered.

### `superLs.register(ClassRef, typeName?)`
Registers a class constructor for automatic rehydration.
*   **ClassRef** (`Function`): The class constructor (e.g., `Player`).
*   **typeName** (`string`, optional): A custom name to use for serialization. Defaults to `ClassRef.name`.

---

## 🔧 Under the Hood

`super-ls` works by:
1.  Intercepting values passed to `set`.
2.  Checking if they are instances of registered classes.
3.  Wrapping them with type metadata.
4.  Serializing the result using `devalue` (which handles circular references and `undefined`).
5.  Storing the string in the native `t.ls` storage.

When retrieving (`get`), it parses the string back, detects the type metadata, and reconstructs the class instance using `Object.assign` or a static `hydrate` method if defined.

---

## 🧪 Development

If you wish to contribute or run tests locally on this extension:

```bash
# 1. Install dependencies
npm install

# 2. Run the Titan SDK test runner
titan run ext
```

---

## 📄 License

ISC