import assert from "assert";
import http from "http";

const PORT = 3005;
const BASE = `http://localhost:${PORT}`;
const SUB = `${BASE}/demo/cafe`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHttp(url: string, options: RequestInit = {}): Promise<{ status: number; text: string; json?: any; headers: Headers }> {
  const res = await fetch(url, options);
  const text = await res.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json, headers: res.headers };
}

async function runE2eSuite() {
  console.log("=================================================================");
  console.log("🚀 STARTING FULL E2E SUITE FOR /demo/cafe");
  console.log("=================================================================\n");

  // 1. Check Root landing page under /demo/cafe
  console.log("1. Testing HTML Page: GET /demo/cafe");
  const homeRes = await fetchHttp(`${SUB}`);
  assert.strictEqual(homeRes.status, 200, `Expected 200, got ${homeRes.status}`);
  assert(homeRes.text.includes("Brew &amp; Bean") || homeRes.text.includes("Brew & Bean"), "Brand name missing in home page");
  assert(homeRes.text.includes("/cafe-static/_next/static/"), "Asset prefix /cafe-static missing from script/style tags");
  console.log("   ✅ GET /demo/cafe responded HTTP 200 with /cafe-static assets\n");

  // Extract a JS chunk URL from HTML
  const jsChunkMatch = homeRes.text.match(/\/cafe-static\/_next\/static\/chunks\/[^"']+\.js/);
  if (jsChunkMatch) {
    const chunkPath = jsChunkMatch[0];
    console.log(`2. Testing Static JS Asset Delivery: ${chunkPath}`);
    const chunkRes = await fetchHttp(`${BASE}${chunkPath}`);
    assert.strictEqual(chunkRes.status, 200, `Expected 200 for JS chunk, got ${chunkRes.status}`);
    console.log(`   ✅ Static asset fetched successfully (HTTP 200, length: ${chunkRes.text.length} bytes)\n`);
  } else {
    console.log("   ⚠️ Note: Inlined JS chunks");
  }

  // 2. Menu page under /demo/cafe/menu
  console.log("3. Testing Menu Page: GET /demo/cafe/menu");
  const menuRes = await fetchHttp(`${SUB}/menu`);
  assert.strictEqual(menuRes.status, 200, `Expected 200, got ${menuRes.status}`);
  assert(menuRes.text.includes("Artisan Coffee") || menuRes.text.includes("Menu"), "Menu contents missing");
  console.log("   ✅ GET /demo/cafe/menu responded HTTP 200\n");

  // 3. Control room under /demo/cafe/controlroom
  console.log("4. Testing Control Room: GET /demo/cafe/controlroom");
  const controlRes = await fetchHttp(`${SUB}/controlroom`);
  assert.strictEqual(controlRes.status, 200, `Expected 200, got ${controlRes.status}`);
  assert(controlRes.text.includes("Control Room") || controlRes.text.includes("Dashboard"), "Control room missing");
  console.log("   ✅ GET /demo/cafe/controlroom responded HTTP 200\n");

  // 4. Supabase DB status API
  console.log("5. Testing Supabase Status API: GET /demo/cafe/api/supabase/status");
  const dbRes = await fetchHttp(`${SUB}/api/supabase/status`);
  assert.strictEqual(dbRes.status, 200, `Expected 200, got ${dbRes.status}`);
  assert.strictEqual(dbRes.json?.connected, true, "DB should be connected");
  console.log(`   ✅ Supabase connected: ${dbRes.json?.connected}, Migrated: ${dbRes.json?.migrated}\n`);

  // 5. Customer identity and device session creation
  console.log("6. Testing Customer Session & PIN: POST /demo/cafe/api/customer/identity");
  const testPhone = "9876543210";
  const testName = "E2E Test User";
  const authRes = await fetchHttp(`${SUB}/api/customer/identity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: testName, phone: testPhone }),
  });
  assert.strictEqual(authRes.status, 200, `Expected 200, got ${authRes.status}`);
  assert.strictEqual(authRes.json?.authenticated, true, "Customer authentication should succeed");
  const cookieHeader = authRes.headers.get("set-cookie") || "";
  console.log(`   ✅ Customer identified: ${authRes.json?.customer?.fullName}`);
  console.log(`   ✅ Set-Cookie header present: ${cookieHeader.includes("tbw_customer_device_token")}`);
  console.log(`   ✅ Cookie path scoped to /demo/cafe: ${cookieHeader.includes("Path=/demo/cafe")}\n`);

  // Extract raw device token cookie
  let deviceCookie = "";
  if (cookieHeader) {
    const match = cookieHeader.match(/tbw_customer_device_token=([^;]+)/);
    if (match) deviceCookie = match[0];
  }

  // 6. Customer profile retrieval
  console.log("7. Testing Customer Profile: GET /demo/cafe/api/customer/profile");
  const profRes = await fetchHttp(`${SUB}/api/customer/profile`, {
    headers: deviceCookie ? { Cookie: deviceCookie } : {},
  });
  assert.strictEqual(profRes.status, 200, `Expected 200, got ${profRes.status}`);
  assert.strictEqual(profRes.json?.authenticated, true);
  console.log(`   ✅ Profile fetched: ${profRes.json?.customer?.fullName}, Stamps: ${profRes.json?.loyalty?.stampsEarned}\n`);

  // 7. Table QR page: /demo/cafe/t/04
  console.log("8. Testing Customer Table Ordering Page: GET /demo/cafe/t/04");
  const tableRes = await fetchHttp(`${SUB}/t/04`);
  assert.strictEqual(tableRes.status, 200, `Expected 200, got ${tableRes.status}`);
  assert(tableRes.text.includes("04"), "Table 04 page missing table code");
  console.log("   ✅ GET /demo/cafe/t/04 responded HTTP 200\n");

  // 8. Order submission: POST /demo/cafe/api/orders
  console.log("9. Testing Order Creation: POST /demo/cafe/api/orders");
  const orderRes = await fetchHttp(`${SUB}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(deviceCookie ? { Cookie: deviceCookie } : {}),
    },
    body: JSON.stringify({
      tableCode: "04",
      customerName: "E2E Test User",
      customerPhone: "9876543210",
      items: [
        {
          menuItemId: "c-01",
          quantity: 2,
        },
      ],
      paymentMethod: "counter",
      diningType: "dine_in",
    }),
  });
  assert.strictEqual(orderRes.status, 200, `Expected 200, got ${orderRes.status}`);
  assert.strictEqual(orderRes.json?.success, true, "Order submission should succeed");
  const createdOrder = orderRes.json?.order;
  assert(createdOrder && createdOrder.id, "Created order should have an ID");
  console.log(`   ✅ Order placed: Order #${createdOrder.orderNumber} (ID: ${createdOrder.id}), Total: ₹${createdOrder.totalAmount}\n`);

  // 10. Staff Authentication PIN login: POST /demo/cafe/api/auth/staff-login
  console.log("10. Testing Staff Login PIN Authentication: POST /demo/cafe/api/auth/staff-login");
  const staffRes = await fetchHttp(`${SUB}/api/auth/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "owner", pin: "1234" }),
  });
  assert.strictEqual(staffRes.status, 200, `Expected 200, got ${staffRes.status}`);
  assert.strictEqual(staffRes.json?.success, true);
  const staffCookieHeader = staffRes.headers.get("set-cookie") || "";
  let staffCookie = "";
  if (staffCookieHeader) {
    const match = staffCookieHeader.match(/tbw_staff_session_token=([^;]+)/);
    if (match) staffCookie = match[0];
  }
  const staffToken = staffRes.json?.token;
  console.log(`   ✅ Staff logged in: ${staffRes.json?.user?.fullName} (${staffRes.json?.user?.role})`);
  console.log(`   ✅ Staff cookie path scoped to /demo/cafe: ${staffCookieHeader.includes("Path=/demo/cafe")}\n`);

  // 11. Kitchen Status Progression: PATCH /demo/cafe/api/orders/status
  console.log("11. Testing Kitchen Status Machine Transitions");
  const staffHeaders = {
    "Content-Type": "application/json",
    ...(staffCookie ? { Cookie: staffCookie } : {}),
    ...(staffToken ? { Authorization: `Bearer ${staffToken}` } : {}),
  };

  // Status: new -> accepted
  const acceptRes = await fetchHttp(`${SUB}/api/orders/status`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({
      orderId: createdOrder.id,
      nextStatus: "accepted",
      expectedPreviousStatus: "new",
    }),
  });
  assert.strictEqual(acceptRes.status, 200, `Expected 200, got ${acceptRes.status}`);
  console.log("   ✅ Status transition: new ➔ accepted (HTTP 200)");

  // Status: accepted -> preparing
  const prepRes = await fetchHttp(`${SUB}/api/orders/status`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({
      orderId: createdOrder.id,
      nextStatus: "preparing",
      expectedPreviousStatus: "accepted",
    }),
  });
  assert.strictEqual(prepRes.status, 200, `Expected 200, got ${prepRes.status}`);
  console.log("   ✅ Status transition: accepted ➔ preparing (HTTP 200)");

  // Status: preparing -> ready
  const readyRes = await fetchHttp(`${SUB}/api/orders/status`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({
      orderId: createdOrder.id,
      nextStatus: "ready",
      expectedPreviousStatus: "preparing",
    }),
  });
  assert.strictEqual(readyRes.status, 200, `Expected 200, got ${readyRes.status}`);
  console.log("   ✅ Status transition: preparing ➔ ready (HTTP 200)");

  // Status: ready -> served
  const servedRes = await fetchHttp(`${SUB}/api/orders/status`, {
    method: "PATCH",
    headers: staffHeaders,
    body: JSON.stringify({
      orderId: createdOrder.id,
      nextStatus: "served",
      expectedPreviousStatus: "ready",
    }),
  });
  assert.strictEqual(servedRes.status, 200, `Expected 200, got ${servedRes.status}`);
  console.log("   ✅ Status transition: ready ➔ served (HTTP 200)\n");

  // 12. Billing and Settle Payment: POST /demo/cafe/api/cashier/settle
  console.log("12. Testing Counter Cashier Settlement: POST /demo/cafe/api/cashier/settle");
  const settleRes = await fetchHttp(`${SUB}/api/cashier/settle`, {
    method: "POST",
    headers: staffHeaders,
    body: JSON.stringify({
      tableCode: "04",
      paymentMethod: "Cash",
      transactionRef: "CASH-E2E-TEST",
      cashierName: "Head Cashier Rahul",
    }),
  });
  assert.strictEqual(settleRes.status, 200, `Expected 200, got ${settleRes.status}`);
  assert.strictEqual(settleRes.json?.success, true, "Settlement should succeed");
  console.log(`   ✅ Table 04 settled: paid ₹${settleRes.json?.settledAmount}, loyalty stamps awarded: ${settleRes.json?.stampsAwarded}\n`);

  // 13. Owner Dashboard KPIs: GET /demo/cafe/api/controlroom/dashboard
  console.log("13. Testing Owner Dashboard KPIs: GET /demo/cafe/api/controlroom/dashboard");
  const dashRes = await fetchHttp(`${SUB}/api/controlroom/dashboard`, {
    headers: staffHeaders,
  });
  assert.strictEqual(dashRes.status, 200, `Expected 200, got ${dashRes.status}`);
  assert.strictEqual(dashRes.json?.success, true);
  console.log(`   ✅ Dashboard stats: Total Revenue: ₹${dashRes.json?.kpis?.totalRevenue}, Total Orders: ${dashRes.json?.kpis?.totalOrders}\n`);

  // 14. Delete test order cleanly to keep database clean
  console.log("14. Cleaning up E2E Test Order: DELETE /demo/cafe/api/orders");
  const delRes = await fetchHttp(`${SUB}/api/orders?orderId=${encodeURIComponent(createdOrder.id)}`, {
    method: "DELETE",
    headers: staffHeaders,
  });
  assert.strictEqual(delRes.status, 200, `Expected 200, got ${delRes.status}`);
  console.log("   ✅ Test order purged successfully from database\n");

  console.log("=================================================================");
  console.log("🎉 ALL E2E BROWSER & API WORKFLOW TESTS PASSED PERFECTLY!");
  console.log("=================================================================");
}

runE2eSuite().catch((err) => {
  console.error("❌ E2E Suite Failed:", err);
  process.exit(1);
});
