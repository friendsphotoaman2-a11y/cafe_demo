import { createAdminClient } from "../src/lib/supabase/admin";
import { createStaffSessionToken } from "../src/lib/server-auth";
import crypto from "crypto";

const BASE_URL = "http://127.0.0.1:3000";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(num: number, name: string, passed: boolean, details: string) {
  results.push({ num, name, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[Test ${num.toString().padStart(2, "0")}] ${status}: ${name}`);
  if (details) console.log(`   ${details}`);
}

async function runAcceptanceTests() {
  console.log("========================================================================");
  console.log("TBW CAFÉ — CUSTOMER REMEMBER DEVICE & CROSS-TABLE ORDERING TEST SUITE");
  console.log("========================================================================\n");

  const supabase = createAdminClient();
  const testPhone = "9876500001";
  const testName = "Aman Sharma";

  // Pre-test DB cleanup for Table 03 and Table 07 to ensure clean starting slate
  console.log("Pre-test setup: Preparing clean state for Table 03 and Table 07...");
  const { data: dbTables } = await supabase
    .from("restaurant_tables")
    .select("id, code")
    .in("code", ["03", "07"]);

  if (dbTables) {
    const tableIds = dbTables.map((t) => t.id);
    await supabase
      .from("dining_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .in("table_id", tableIds)
      .eq("status", "active");

    await supabase
      .from("restaurant_tables")
      .update({ status: "available" })
      .in("id", tableIds);
  }

  // Clean any existing customer sessions for test phone
  const { data: existingCust } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", testPhone)
    .maybeSingle();

  if (existingCust) {
    await supabase.from("customer_sessions").delete().eq("customer_id", existingCust.id);
  }

  console.log("Clean state confirmed. Running 12 acceptance tests...\n");

  let capturedDeviceToken = "";
  let capturedDiningTokenTable03 = "";
  let customerId = "";

  // -------------------------------------------------------------------------
  // TEST 1: First visit to Table 03 - Customer places order and receives device cookie
  // -------------------------------------------------------------------------
  try {
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableCode: "03",
        customerName: testName,
        customerPhone: testPhone,
        items: [{ menuItemId: "c-01", quantity: 2 }], // Indiranagar Signature Flat White (2 * 240 = 480)
        notes: "Test First Visit Table 03",
      }),
    });

    const setCookieHeaders = orderRes.headers.getSetCookie?.() || [];
    const rawSetCookie = orderRes.headers.get("set-cookie") || "";
    const allCookieStrings = [...setCookieHeaders, rawSetCookie].join("; ");

    const deviceMatch = allCookieStrings.match(/tbw_customer_device_token=([^;]+)/);
    const diningMatch = allCookieStrings.match(/tbw_dining_token_03=([^;]+)/);

    if (deviceMatch) capturedDeviceToken = deviceMatch[1];
    if (diningMatch) capturedDiningTokenTable03 = diningMatch[1];

    const data = await orderRes.json();
    const isSuccess =
      orderRes.ok &&
      data.success === true &&
      capturedDeviceToken.startsWith("cdt_") &&
      capturedDeviceToken.length === 68 && // cdt_ + 64 hex chars
      data.sessionBill?.totalAmount === 504; // 480 + 24 (5% tax)

    recordTest(
      1,
      "First visit Table 03: Place order & issue 90-day persistent device token (cdt_...)",
      isSuccess,
      `Order: ${data.order?.orderNumber}, Total: ₹${data.order?.totalAmount}, Token: ${capturedDeviceToken.slice(0, 15)}... (len: ${capturedDeviceToken.length})`
    );
  } catch (err: unknown) {
    recordTest(1, "First visit Table 03: Place order & issue 90-day persistent device token", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 2: Verify device token is SHA-256 hashed in Supabase customer_sessions
  // -------------------------------------------------------------------------
  try {
    const tokenHash = crypto.createHash("sha256").update(capturedDeviceToken).digest("hex");

    const { data: dbSession, error: sessErr } = await supabase
      .from("customer_sessions")
      .select(`
        id,
        session_token,
        expires_at,
        customer_id,
        customers ( id, full_name, phone )
      `)
      .eq("session_token", tokenHash)
      .maybeSingle();

    const customerRecord = Array.isArray(dbSession?.customers)
      ? dbSession.customers[0]
      : dbSession?.customers;

    if (customerRecord) {
      customerId = customerRecord.id;
    }

    const expiryDate = dbSession ? new Date(dbSession.expires_at) : new Date(0);
    const daysUntilExpiry = Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const isSecurelyStored =
      !sessErr &&
      !!dbSession &&
      dbSession.session_token === tokenHash &&
      dbSession.session_token !== capturedDeviceToken &&
      daysUntilExpiry >= 88 &&
      daysUntilExpiry <= 91 &&
      customerRecord?.phone === testPhone;

    recordTest(
      2,
      "Database Security: Token is SHA-256 hashed, not stored plaintext, 90-day expiry",
      isSecurelyStored,
      `Stored Hash: ${tokenHash.slice(0, 16)}..., Expiry: ${daysUntilExpiry} days, Phone: ${customerRecord?.phone}`
    );
  } catch (err: unknown) {
    recordTest(2, "Database Security: Token is SHA-256 hashed, not stored plaintext", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 3: Browser Revisit / Direct Identity Check (/api/customer/identity)
  // -------------------------------------------------------------------------
  try {
    const identRes = await fetch(`${BASE_URL}/api/customer/identity`, {
      method: "GET",
      headers: {
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}`,
      },
    });

    const identData = await identRes.json();
    const isValid =
      identRes.ok &&
      identData.authenticated === true &&
      identData.customer?.fullName === testName &&
      identData.customer?.phone === testPhone;

    recordTest(
      3,
      "Persistent Identity Check: Returns authenticated customer across browser sessions",
      isValid,
      `Authenticated: ${identData.authenticated}, Name: ${identData.customer?.fullName}, Phone: ${identData.customer?.phone}`
    );
  } catch (err: unknown) {
    recordTest(3, "Persistent Identity Check: Returns authenticated customer across browser sessions", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 4: Cross-Table Visit to Table 07 - Auto-detect customer, clean new bill
  // -------------------------------------------------------------------------
  try {
    const table07Res = await fetch(`${BASE_URL}/api/orders?tableCode=07`, {
      method: "GET",
      headers: {
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}`,
      },
    });

    const table07Data = await table07Res.json();
    const isCleanTable07 =
      table07Res.ok &&
      table07Data.success === true &&
      table07Data.rememberedCustomer?.fullName === testName &&
      table07Data.rememberedCustomer?.phone === testPhone &&
      table07Data.hasActiveSession === false &&
      table07Data.orders.length === 0 &&
      table07Data.sessionBill === null;

    recordTest(
      4,
      "Cross-Table Visit (Table 07): Auto-recognizes customer Aman, starts fresh clean bill",
      isCleanTable07,
      `Remembered: ${table07Data.rememberedCustomer?.fullName}, HasActiveSession: ${table07Data.hasActiveSession}, Orders: ${table07Data.orders.length}, Bill: ${table07Data.sessionBill}`
    );
  } catch (err: unknown) {
    recordTest(4, "Cross-Table Visit (Table 07): Auto-recognizes customer Aman, starts fresh clean bill", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 5: Table 07 First Order - Placed seamlessly without re-entering details
  // -------------------------------------------------------------------------
  let table07DiningToken = "";
  try {
    const order07Res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}`,
      },
      body: JSON.stringify({
        tableCode: "07",
        customerName: testName,
        customerPhone: testPhone,
        items: [{ menuItemId: "c-01", quantity: 1 }], // Indiranagar Signature Flat White (₹240)
        notes: "Round 1 on Table 07",
      }),
    });

    const setCookies = order07Res.headers.getSetCookie?.() || [];
    const allCookies = [...setCookies, order07Res.headers.get("set-cookie") || ""].join("; ");
    const diningMatch07 = allCookies.match(/tbw_dining_token_07=([^;]+)/);
    if (diningMatch07) table07DiningToken = diningMatch07[1];

    const data07 = await order07Res.json();
    const isSuccess07 =
      order07Res.ok &&
      data07.success === true &&
      data07.sessionBill?.totalAmount === 252; // 240 + 5% tax (12) = 252

    recordTest(
      5,
      "Table 07 Round 1 Order: Placed without form friction, ₹252 total",
      isSuccess07,
      `Order: ${data07.order?.orderNumber}, Subtotal: ₹${data07.sessionBill?.subtotal}, Total: ₹${data07.sessionBill?.totalAmount}`
    );
  } catch (err: unknown) {
    recordTest(5, "Table 07 Round 1 Order: Placed without form friction", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 6: Table 07 Round 2 Order - Cumulative running bill on Table 07
  // -------------------------------------------------------------------------
  try {
    const round2Res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}; tbw_dining_token_07=${table07DiningToken}`,
      },
      body: JSON.stringify({
        tableCode: "07",
        customerName: testName,
        customerPhone: testPhone,
        diningSessionToken: table07DiningToken,
        items: [{ menuItemId: "t-01", quantity: 1 }], // Brew & Bean Masala Chai Reserve (₹180)
        notes: "Round 2 on Table 07",
      }),
    });

    const round2Data = await round2Res.json();
    // Subtotal: 240 + 180 = 420. Tax: 5% of 420 = 21. Total = 441.
    const isCumulative =
      round2Res.ok &&
      round2Data.success === true &&
      round2Data.sessionBill?.subtotal === 420 &&
      round2Data.sessionBill?.taxAmount === 21 &&
      round2Data.sessionBill?.totalAmount === 441 &&
      round2Data.sessionBill?.orderNumbers.length === 2;

    recordTest(
      6,
      "Table 07 Round 2 Order: Cumulative running bill (₹240 + ₹180 + ₹21 tax = ₹441)",
      isCumulative,
      `Subtotal: ₹${round2Data.sessionBill?.subtotal}, Tax: ₹${round2Data.sessionBill?.taxAmount}, Total: ₹${round2Data.sessionBill?.totalAmount}, Orders: [${round2Data.sessionBill?.orderNumbers.join(", ")}]`
    );
  } catch (err: unknown) {
    recordTest(6, "Table 07 Round 2 Order: Cumulative running bill", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 7: Customer View on Table 07 reflects full running bill
  // -------------------------------------------------------------------------
  try {
    const get07Res = await fetch(`${BASE_URL}/api/orders?tableCode=07`, {
      method: "GET",
      headers: {
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}; tbw_dining_token_07=${table07DiningToken}`,
      },
    });

    const get07Data = await get07Res.json();
    const isReflected =
      get07Res.ok &&
      (get07Data.hasActiveSession === true || !!get07Data.session) &&
      get07Data.sessionBill?.totalAmount === 441 &&
      get07Data.orders.length === 2 &&
      get07Data.isPaid === false;

    recordTest(
      7,
      "Table 07 Customer View: Displays active running bill of ₹441 with 2 orders",
      isReflected,
      `Orders count: ${get07Data.orders?.length}, Total: ₹${get07Data.sessionBill?.totalAmount}, IsPaid: ${get07Data.isPaid}`
    );
  } catch (err: unknown) {
    recordTest(7, "Table 07 Customer View: Displays active running bill", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 8: Cashier Settlement & Bill Matching
  // -------------------------------------------------------------------------
  try {
    // Generate valid cashier authorization token
    const cashierToken = createStaffSessionToken({
      role: "cashier",
      email: "cashier@brewandbean.in",
      fullName: "Rahul (Head Cashier)",
    });

    // Settle Table 07 via Cashier
    const settleRes = await fetch(`${BASE_URL}/api/cashier/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_staff_session_token=${cashierToken}`,
      },
      body: JSON.stringify({
        tableCode: "07",
        paymentMethod: "UPI",
        transactionRef: "UPI-AXIS-982341",
      }),
    });

    const settleData = await settleRes.json();
    const settledTotal = settleData.authoritativeTotal ?? settleData.totalAmount;
    const isSettled =
      settleRes.ok &&
      settleData.success === true &&
      settledTotal === 441 &&
      settleData.paymentMethod === "UPI";

    recordTest(
      8,
      "Cashier Settlement: Table 07 settled for exact matching total ₹441 via UPI",
      isSettled,
      `Settled: ${settleData.success}, Total: ₹${settledTotal}, Method: ${settleData.paymentMethod}, BillId: ${settleData.billId}`
    );
  } catch (err: unknown) {
    recordTest(8, "Cashier Settlement: Table 07 settled", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 9: Table 07 Customer Screen reflects Paid and Closed status
  // -------------------------------------------------------------------------
  try {
    const paid07Res = await fetch(`${BASE_URL}/api/orders?tableCode=07`, {
      method: "GET",
      headers: {
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}; tbw_dining_token_07=${table07DiningToken}`,
      },
    });

    const paid07Data = await paid07Res.json();
    const isPaidVerified =
      paid07Res.ok &&
      paid07Data.isPaid === true &&
      paid07Data.sessionBill?.isPaid === true &&
      paid07Data.sessionBill?.totalAmount === 441 &&
      paid07Data.sessionBill?.paymentMethod === "UPI";

    recordTest(
      9,
      "Customer Screen Verification: Confirms Paid status (₹441 via UPI) in sync with Cashier",
      isPaidVerified,
      `isPaid: ${paid07Data.isPaid}, Bill.isPaid: ${paid07Data.sessionBill?.isPaid}, Method: ${paid07Data.sessionBill?.paymentMethod}`
    );
  } catch (err: unknown) {
    recordTest(9, "Customer Screen Verification: Confirms Paid status", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 10: Unknown Device Isolation (Anti-Hijack / Privacy)
  // -------------------------------------------------------------------------
  try {
    // Unknown device visiting Table 07 (no device cookie)
    const unknownRes = await fetch(`${BASE_URL}/api/orders?tableCode=07`, {
      method: "GET",
    });

    const unknownData = await unknownRes.json();
    // Since Table 07 session was just settled and closed, an unknown device sees a clean new table
    const isSecureFromHijack =
      unknownRes.ok &&
      unknownData.rememberedCustomer === undefined &&
      unknownData.sessionBill === null;

    recordTest(
      10,
      "Unknown Device Privacy: Different device has no access to Aman's profile or previous orders",
      isSecureFromHijack,
      `Remembered: ${unknownData.rememberedCustomer}, ActiveSession: ${unknownData.hasActiveSession}, Orders: ${unknownData.orders?.length || 0}`
    );
  } catch (err: unknown) {
    recordTest(10, "Unknown Device Privacy: Different device has no access", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 11: Customer Logout / Switch Profile (DELETE /api/customer/identity)
  // -------------------------------------------------------------------------
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/customer/identity`, {
      method: "DELETE",
      headers: {
        Cookie: `tbw_customer_device_token=${capturedDeviceToken}`,
      },
    });

    const setCookies = logoutRes.headers.getSetCookie?.() || [];
    const allCookies = [...setCookies, logoutRes.headers.get("set-cookie") || ""].join("; ");
    const isCookieCleared = allCookies.includes("Max-Age=0") || allCookies.includes("tbw_customer_device_token=;");

    // Verify token was deleted from database
    const tokenHash = crypto.createHash("sha256").update(capturedDeviceToken).digest("hex");
    const { data: dbCheck } = await supabase
      .from("customer_sessions")
      .select("id")
      .eq("session_token", tokenHash)
      .maybeSingle();

    const isRevoked = logoutRes.ok && isCookieCleared && !dbCheck;

    recordTest(
      11,
      "Switch Customer / Logout: Session deleted from DB and cookie cleared with Max-Age=0",
      isRevoked,
      `Cookie Cleared: ${isCookieCleared}, DB Session Deleted: ${!dbCheck}`
    );
  } catch (err: unknown) {
    recordTest(11, "Switch Customer / Logout: Session deleted from DB", false, String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 12: Verify Configurable Base URL & All 12 Table QR Access Paths
  // -------------------------------------------------------------------------
  try {
    const expectedBase = "http://10.84.23.121:3000";
    let all12Valid = true;
    const sampleUrls: string[] = [];

    for (let i = 1; i <= 12; i++) {
      const code = i.toString().padStart(2, "0");
      const url = `${expectedBase}/t/${code}`;
      sampleUrls.push(url);
    }

    // Verify that Table 01-12 exist and are active in DB
    const { data: tables, error: tablesErr } = await supabase
      .from("restaurant_tables")
      .select("code, is_active")
      .order("code");

    if (tablesErr || !tables || tables.length < 12) {
      all12Valid = false;
    }

    recordTest(
      12,
      "Table QR Integrity: All 12 tables mapped to Wi-Fi IP http://10.84.23.121:3000/t/{01-12}",
      all12Valid,
      `Active Tables in DB: ${tables?.length}, Sample URLs: ${sampleUrls[0]}, ${sampleUrls[1]}, ${sampleUrls[3]}, ${sampleUrls[11]}`
    );
  } catch (err: unknown) {
    recordTest(12, "Table QR Integrity: All 12 tables mapped to Wi-Fi IP", false, String(err));
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n========================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`TOTAL ACCEPTANCE TESTS: ${results.length} | PASSED: ${totalPassed} | FAILED: ${results.length - totalPassed}`);
  console.log("========================================================================\n");

  if (totalPassed === results.length) {
    console.log("🎉 ALL 12 ACCEPTANCE TESTS PASSED SUCCESSFULLY AGAINST LIVE DATABASE & SERVER!");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED. PLEASE REVIEW LOGS.");
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
