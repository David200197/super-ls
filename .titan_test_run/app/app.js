import t from "../titan/titan.js";

// 1. Expose 't' globally because extensions expect it (like in the real runtime)
globalThis.t = t;

// 2. Dynamic import ensures 't' is set BEFORE the extension loads
await import("titanpl-superls");

// Extension test harness for: titanpl-superls
const ext = t["titanpl-superls"];

t.log("---------------------------------------------------");
t.log("Testing Extension: titanpl-superls");
t.log("---------------------------------------------------");

if (!ext) {
    console.log("ERROR: Extension 'titanpl-superls' not found in global 't'.");
} else {
    t.log("✓ Extension loaded successfully!");
    t.log("✓ Available methods:", Object.keys(ext).join(", "));
    
    // Try 'hello' if it exists
    if (typeof ext.hello === 'function') {
        console.log("\nTesting ext.hello('Titan')...");
        try {
           const res = ext.hello("Titan");
           t.log("✓ Result:", res);
        } catch(e) {
           t.log("✗ Error:", e.message);
        }
    }

    // Try 'calc' if it exists
    if (typeof ext.calc === 'function') {
        console.log("\nTesting ext.calc(10, 20)...");
        try {
            const res = ext.calc(10, 20);
            t.log("✓ Result:", res);
        } catch(e) {
            t.log("✗ Error:", e.message);
        }
    }
}

t.log("---------------------------------------------------");
t.log("✓ Test complete!");
t.log("\n📍 Routes:");
t.log("  GET  http://localhost:3000/      → Test harness info");
t.log("  GET  http://localhost:3000/test  → Extension test results (JSON)");
t.log("---------------------------------------------------\n");

// Create routes
t.get("/test").action("test");
t.get("/").reply("🚀 Extension Test Harness for titanpl-superls\n\nVisit /test to see extension test results");

await t.start(4000, "Titan Extension Test Running!", 10, 16);
