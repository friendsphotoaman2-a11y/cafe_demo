import assert from "assert";

const BASE = "http://localhost:3006";

async function fetchHttp(url: string) {
  const res = await fetch(url);
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

async function runRootTest() {
  console.log("=================================================================");
  console.log("🌱 TESTING ORIGINAL ROOT-MODE APPLICATION AT http://localhost:3006");
  console.log("=================================================================\n");

  console.log("1. Testing GET / (Landing Page)");
  const home = await fetchHttp(`${BASE}/`);
  assert.strictEqual(home.status, 200);
  assert(home.text.includes("Brew &amp; Bean") || home.text.includes("Brew & Bean"));
  // In root mode, script src should be /_next/static/..., NOT /cafe-static/
  assert(!home.text.includes("/cafe-static/"), "Root mode should NOT use /cafe-static asset prefix");
  assert(home.text.includes("/_next/static/"), "Root mode should use standard /_next/static/ assets");
  console.log("   ✅ GET / responded HTTP 200 with standard /_next/static/ assets\n");

  console.log("2. Testing GET /menu");
  const menu = await fetchHttp(`${BASE}/menu`);
  assert.strictEqual(menu.status, 200);
  console.log("   ✅ GET /menu responded HTTP 200\n");

  console.log("3. Testing GET /controlroom");
  const cr = await fetchHttp(`${BASE}/controlroom`);
  assert.strictEqual(cr.status, 200);
  console.log("   ✅ GET /controlroom responded HTTP 200\n");

  console.log("4. Testing GET /t/04");
  const table = await fetchHttp(`${BASE}/t/04`);
  assert.strictEqual(table.status, 200);
  console.log("   ✅ GET /t/04 responded HTTP 200\n");

  console.log("5. Testing GET /api/supabase/status");
  const api = await fetchHttp(`${BASE}/api/supabase/status`);
  assert.strictEqual(api.status, 200);
  assert.strictEqual(api.json?.connected, true);
  console.log("   ✅ GET /api/supabase/status responded HTTP 200 (connected: true)\n");

  console.log("=================================================================");
  console.log("🎉 ORIGINAL ROOT-MODE APPLICATION REMAINS 100% OPERATIONAL!");
  console.log("=================================================================");
}

runRootTest().catch((e) => {
  console.error("Root test failed:", e);
  process.exit(1);
});

