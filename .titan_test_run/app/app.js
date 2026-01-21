import t from "../titan/titan.js";
import "titanpl-superls";

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

await t.start(3000, "Titan Extension Test Running!");
