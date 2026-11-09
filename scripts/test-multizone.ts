import assert from "assert";

console.log("=================================================================");
console.log("🧪 TESTING MULTI-ZONE & BASE-PATH CONFIGURATION");
console.log("=================================================================\n");

// 1. Test base-path logic with empty BASE_PATH (Root deployment)
delete process.env.CAFE_DEMO_BASE_PATH;
delete process.env.NEXT_PUBLIC_BASE_PATH;
delete process.env.CAFE_DEMO_ASSET_PREFIX;
delete process.env.NEXT_PUBLIC_ASSET_PREFIX;

// Re-evaluate module dynamically
async function runTests() {
  // Test Case A: ROOT Deployment (Original Vercel project)
  console.log("▶ Case A: Default Root Deployment (CAFE_DEMO_BASE_PATH absent)");
  const bpA = await import(`../src/lib/base-path?update=${Date.now()}`);
  
  assert.strictEqual(bpA.BASE_PATH, "", "BASE_PATH must be empty string in root mode");
  assert.strictEqual(bpA.ASSET_PREFIX, "", "ASSET_PREFIX must be empty string in root mode");
  assert.strictEqual(bpA.withBasePath("/menu"), "/menu", "Internal link /menu should be unchanged");
  assert.strictEqual(bpA.withBasePath("/controlroom"), "/controlroom", "Internal link /controlroom should be unchanged");
  assert.strictEqual(bpA.apiUrl("/api/orders"), "/api/orders", "apiUrl(/api/orders) should be /api/orders");
  assert.strictEqual(bpA.apiUrl("/api/orders?tableCode=01"), "/api/orders?tableCode=01", "apiUrl with params should be unchanged");
  assert.strictEqual(bpA.withBasePathUrl("https://cafe-demo-lovat-sigma.vercel.app"), "https://cafe-demo-lovat-sigma.vercel.app", "Origin should be unchanged");
  assert.strictEqual(bpA.getCookiePath(), "/", "Cookie path must be '/' in root deployment");
  console.log("  ✅ Root mode URL resolution: PASSED");
  console.log("  ✅ Root mode API URL resolution: PASSED");
  console.log("  ✅ Root mode Cookie path: PASSED ('/')\n");

  // Test Case B: Multi-Zone Subpath Deployment (Second Vercel project)
  console.log("▶ Case B: Multi-Zone Subpath Deployment (CAFE_DEMO_BASE_PATH=/demo/cafe)");
  process.env.CAFE_DEMO_BASE_PATH = "/demo/cafe";
  process.env.CAFE_DEMO_ASSET_PREFIX = "/cafe-static";

  // Re-import with cache busting
  const bpB = await import(`../src/lib/base-path?update=${Date.now() + 1}`);

  assert.strictEqual(bpB.BASE_PATH, "/demo/cafe", "BASE_PATH must be '/demo/cafe'");
  assert.strictEqual(bpB.ASSET_PREFIX, "/cafe-static", "ASSET_PREFIX must be '/cafe-static'");
  assert.strictEqual(bpB.withBasePath("/menu"), "/demo/cafe/menu", "withBasePath('/menu') must prefix /demo/cafe");
  assert.strictEqual(bpB.withBasePath("/controlroom"), "/demo/cafe/controlroom", "withBasePath('/controlroom') must prefix /demo/cafe");
  assert.strictEqual(bpB.withBasePath("/demo/cafe/menu"), "/demo/cafe/menu", "Should not double-prefix if already present");
  assert.strictEqual(bpB.withBasePath("https://example.com/other"), "https://example.com/other", "External URLs must not be prefixed");
  assert.strictEqual(bpB.apiUrl("/api/orders"), "/demo/cafe/api/orders", "apiUrl(/api/orders) must be '/demo/cafe/api/orders'");
  assert.strictEqual(bpB.apiUrl("/api/orders?tableCode=04"), "/demo/cafe/api/orders?tableCode=04", "Query string must be preserved");
  assert.strictEqual(
    bpB.withBasePathUrl("https://www.thebusinesswork.com"),
    "https://www.thebusinesswork.com/demo/cafe",
    "Origin must append /demo/cafe"
  );
  assert.strictEqual(
    bpB.withBasePathUrl("https://www.thebusinesswork.com/demo/cafe"),
    "https://www.thebusinesswork.com/demo/cafe",
    "Origin already having /demo/cafe must not duplicate it"
  );
  assert.strictEqual(bpB.getCookiePath(), "/demo/cafe", "Cookie path must be scoped to '/demo/cafe'");
  console.log("  ✅ Multi-zone BASE_PATH: PASSED ('/demo/cafe')");
  assert.strictEqual(bpB.ASSET_PREFIX, "/cafe-static");
  console.log("  ✅ Multi-zone ASSET_PREFIX: PASSED ('/cafe-static')");
  console.log("  ✅ Multi-zone API URL routing: PASSED ('/demo/cafe/api/orders')");
  console.log("  ✅ Multi-zone Cookie scoping: PASSED ('/demo/cafe')\n");

  // Test Case C: QR Generator URLs in Multi-Zone mode
  console.log("▶ Case C: QR Code URL Generation");
  const qrGen = await import(`../src/lib/qr-generator?update=${Date.now() + 2}`);
  
  const qrUrlTable1 = qrGen.getTableOrderingUrl("01", undefined, "https://www.thebusinesswork.com");
  assert.strictEqual(
    qrUrlTable1,
    "https://www.thebusinesswork.com/demo/cafe/t/01",
    `Expected https://www.thebusinesswork.com/demo/cafe/t/01, got ${qrUrlTable1}`
  );

  const qrUrlTable4WithNonce = qrGen.getTableOrderingUrl("04", "nonce123", "https://www.thebusinesswork.com");
  assert.strictEqual(
    qrUrlTable4WithNonce,
    "https://www.thebusinesswork.com/demo/cafe/t/04?ref=nonce123",
    `Expected https://www.thebusinesswork.com/demo/cafe/t/04?ref=nonce123, got ${qrUrlTable4WithNonce}`
  );

  const qrUrlWithBaseAlready = qrGen.getTableOrderingUrl("07", undefined, "https://www.thebusinesswork.com/demo/cafe");
  assert.strictEqual(
    qrUrlWithBaseAlready,
    "https://www.thebusinesswork.com/demo/cafe/t/07",
    `Should not duplicate basePath: got ${qrUrlWithBaseAlready}`
  );
  console.log("  ✅ QR destination format: PASSED (https://www.thebusinesswork.com/demo/cafe/t/01)");
  console.log("  ✅ QR nonce preservation: PASSED (?ref=nonce123)");
  console.log("  ✅ QR deduplication protection: PASSED\n");

  // Test Case D: OAuth Callback Redirect URL
  console.log("▶ Case D: OAuth Callback Redirect URL");
  const oauthRedirect = `https://www.thebusinesswork.com${bpB.withBasePath(
    "/auth/callback?next=" + encodeURIComponent(bpB.withBasePath("/controlroom"))
  )}`;
  assert.strictEqual(
    oauthRedirect,
    "https://www.thebusinesswork.com/demo/cafe/auth/callback?next=%2Fdemo%2Fcafe%2Fcontrolroom",
    "OAuth callback must redirect to subzone path"
  );
  console.log("  ✅ Google OAuth callback URL: PASSED\n");

  console.log("=================================================================");
  console.log("🎉 ALL MULTI-ZONE INTEGRATION TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});

