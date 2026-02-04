import t from "../titan/titan.js";

// 1. Expose 't' globally because extensions expect it (like in the real runtime)
globalThis.t = t;

// 2. Dynamic import ensures 't' is set BEFORE the extension loads
await import("titanpl-superls");

// Extension test harness for: titanpl-superls
const ext = t["titanpl-superls"];

console.log("---------------------------------------------------");
console.log("Testing Extension: titanpl-superls");
console.log("---------------------------------------------------");

if (!ext) {
    console.log("ERROR: Extension 'titanpl-superls' not found in global 't'.");
} else {
    console.log("✓ Extension loaded successfully!");
    console.log("✓ Available methods:", Object.keys(ext).join(", "));
    
    // Try 'hello' if it exists
    if (typeof ext.hello === 'function') {
        console.log("\nTesting ext.hello('Titan')...");
        try {
           const res = ext.hello("Titan");
           console.log("✓ Result:", res);
        } catch(e) {
           console.log("✗ Error:", e.message);
        }
    }

    // Try 'calc' if it exists
    if (typeof ext.calc === 'function') {
        console.log("\nTesting ext.calc(10, 20)...");
        try {
            const res = ext.calc(10, 20);
            console.log("✓ Result:", res);
        } catch(e) {
            console.log("✗ Error:", e.message);
        }
    }
}

console.log("---------------------------------------------------");
console.log("✓ Test complete!");
console.log("\n📍 Routes:");
console.log("  GET  http://localhost:3000/      → Test harness info");
console.log("  GET  http://localhost:3000/test  → Extension test results (JSON)");
console.log("---------------------------------------------------\n");

// Create routes
t.get("/test").action("test");
t.get("/").reply("🚀 Extension Test Harness for titanpl-superls\n\nVisit /test to see extension test results");

await t.start(4000, "Titan Extension Test Running!");
