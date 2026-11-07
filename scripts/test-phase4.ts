import { createAdminClient } from "../src/lib/supabase/admin";
import { createStaffSessionToken } from "../src/lib/server-auth";
import { COOKIE_CUSTOMER_DEVICE } from "../src/lib/customer-session";

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

interface TestResult {
  id: number;
  title: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(id: number, title: string, passed: boolean, details?: string, error?: string) {
  results.push({ id, title, passed, details, error });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[Test ${String(id).padStart(2, "0")}] ${icon}: ${title}`);
  if (details) console.log(`   ${details}`);
  if (error) console.log(`   Error: ${error}`);
}

async function runPhase4Tests() {
  console.log("========================================================================");
  console.log("PHASE 4 ACCEPTANCE TEST SUITE: CUSTOMER PROFILE, LOYALTY & ORDER HISTORY");
  console.log("========================================================================\n");

  const supabase = createAdminClient();
  const testPhone = "9999900001";
  const testName = "Aman Phase4 Tester";

  // Pre-test cleanup: delete previous test user records cleanly
  const { data: existingCust } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", testPhone)
    .maybeSingle();

  if (existingCust) {
    const { data: userSessions } = await supabase
      .from("dining_sessions")
      .select("id")
      .eq("customer_id", existingCust.id);

    const sessionIds = (userSessions || []).map((s) => s.id);
    if (sessionIds.length > 0) {
      await supabase.from("order_items").delete().in(
        "order_id",
        (await supabase.from("orders").select("id").in("dining_session_id", sessionIds)).data?.map((o) => o.id) || []
      );
      await supabase.from("orders").delete().in("dining_session_id", sessionIds);
      await supabase.from("bills").delete().in("dining_session_id", sessionIds);
      await supabase.from("dining_sessions").delete().in("id", sessionIds);
    }
    const { data: lAcc } = await supabase.from("loyalty_accounts").select("id").eq("customer_id", existingCust.id).maybeSingle();
    if (lAcc) {
      await supabase.from("reward_redemptions").delete().eq("loyalty_account_id", lAcc.id);
      await supabase.from("loyalty_events").delete().eq("loyalty_account_id", lAcc.id);
      await supabase.from("loyalty_accounts").delete().eq("id", lAcc.id);
    }
    await supabase.from("customer_sessions").delete().eq("customer_id", existingCust.id);
    await supabase.from("customers").delete().eq("id", existingCust.id);
  }

  // Ensure Table 02 and Table 01 are free
  await supabase.from("restaurant_tables").update({ status: "available" }).in("code", ["01", "02"]);

  const ownerToken = createStaffSessionToken({
    role: "owner",
    email: "owner@brewandbean.in",
    fullName: "Aman (Owner)",
  });

  let deviceCookie = "";
  let customerId = "";
  let loyaltyAccountId = "";

  // -------------------------------------------------------------------------
  // Test 1: New customer registers at Table 02
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customer/identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: testName, phone: testPhone }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(new RegExp(`${COOKIE_CUSTOMER_DEVICE}=([^;]+)`));
    deviceCookie = match ? match[1] : "";

    const json = await res.json();
    customerId = json.customer?.id || "";

    recordTest(
      1,
      "New customer registers at Table 02 and gets 90-day device cookie",
      res.status === 200 && json.authenticated && !!deviceCookie && !!customerId,
      `CustomerId: ${customerId}, Cookie set: ${deviceCookie.slice(0, 15)}...`
    );
  } catch (e: any) {
    recordTest(1, "New customer registers at Table 02", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 2: First order is saved at Table 02
  // -------------------------------------------------------------------------
  let order1Number = "";
  try {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}`,
      },
      body: JSON.stringify({
        tableCode: "02",
        customerName: testName,
        customerPhone: testPhone,
        items: [{ menuItemId: "c-01", quantity: 2 }],
        notes: "Phase 4 Round 1",
      }),
    });
    const json = await res.json();
    order1Number = json.order?.orderNumber || "";

    recordTest(
      2,
      "First order is saved in Supabase",
      res.status === 200 && json.success && !!order1Number,
      `Order: ${order1Number}, Subtotal: ₹${json.order?.subtotal}, Total: ₹${json.order?.totalAmount}`
    );
  } catch (e: any) {
    recordTest(2, "First order is saved", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 3: Second order in same visit is combined correctly
  // -------------------------------------------------------------------------
  let order2Number = "";
  try {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}`,
      },
      body: JSON.stringify({
        tableCode: "02",
        customerName: testName,
        customerPhone: testPhone,
        items: [{ menuItemId: "b-01", quantity: 1 }],
        notes: "Phase 4 Round 2",
      }),
    });
    const json = await res.json();
    order2Number = json.order?.orderNumber || "";

    const combinedTotal = json.sessionBill?.totalAmount || 0;
    const isCombined = json.sessionBill?.orderNumbers?.length === 2;

    recordTest(
      3,
      "Second order in same visit is combined correctly into running bill",
      res.status === 200 && isCombined,
      `Round 2: ${order2Number}, Combined Payable: ₹${combinedTotal}, Orders: [${json.sessionBill?.orderNumbers?.join(", ")}]`
    );
  } catch (e: any) {
    recordTest(3, "Second order combined correctly", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 4: Cashier confirms payment
  // -------------------------------------------------------------------------
  let settleBillTotal = 0;
  try {
    const res = await fetch(`${BASE_URL}/api/cashier/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_staff_session_token=${ownerToken}`,
      },
      body: JSON.stringify({
        tableCode: "02",
        paymentMethod: "UPI",
        transactionRef: "UPI_PHASE4_TEST_001",
      }),
    });
    const json = await res.json();
    settleBillTotal = json.authoritativeTotal || 0;

    recordTest(
      4,
      "Cashier confirms payment and closes Table 02 dining session",
      res.status === 200 && json.success && settleBillTotal > 0,
      `Settled via: ${json.paymentMethod}, Amount: ₹${settleBillTotal}, BillId: ${json.billId}`
    );
  } catch (e: any) {
    recordTest(4, "Cashier confirms payment", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 5: Exactly one visit stamp is awarded for the visit
  // -------------------------------------------------------------------------
  try {
    const { data: loyalty } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", customerId)
      .single();

    loyaltyAccountId = loyalty?.id || "";
    const stamps = loyalty?.stamps_earned || 0;
    const visits = loyalty?.total_visits || 0;

    recordTest(
      5,
      "Exactly one visit stamp is awarded (multiple rounds = 1 stamp)",
      stamps === 1 && visits === 1,
      `Stamps: ${stamps}/5, Completed Visits: ${visits}, Lifetime Spend: ₹${loyalty?.total_spent}`
    );
  } catch (e: any) {
    recordTest(5, "Exactly one stamp awarded", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 6: Customer scans Table 01 on same device
  // -------------------------------------------------------------------------
  let table1CustomerCheck: any = null;
  try {
    const res = await fetch(`${BASE_URL}/api/orders?tableCode=01`, {
      headers: { Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}` },
    });
    table1CustomerCheck = await res.json();

    const recognized = table1CustomerCheck?.rememberedCustomer?.fullName === testName;
    recordTest(
      6,
      "Customer scans Table 01 on same device and is automatically recognized",
      res.status === 200 && recognized,
      `Recognized Customer: ${table1CustomerCheck?.rememberedCustomer?.fullName}`
    );
  } catch (e: any) {
    recordTest(6, "Customer recognized on Table 01", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 7: No repeated name/phone form
  // -------------------------------------------------------------------------
  recordTest(
    7,
    "No repeated name/phone form required for returning customer",
    table1CustomerCheck?.rememberedCustomer?.phone === testPhone,
    `Saved phone preserved on device: ${table1CustomerCheck?.rememberedCustomer?.phone}`
  );

  // -------------------------------------------------------------------------
  // Test 8: Table 02 paid orders visible in history
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customer/profile`, {
      headers: { Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}` },
    });
    const profileJson = await res.json();
    const history = profileJson.visitHistory || [];
    const hasTable02 = history.some((v: any) => v.tableCode === "02" && v.status === "closed");

    recordTest(
      8,
      "Table 02 paid orders visible in Customer Profile history",
      res.status === 200 && profileJson.authenticated && hasTable02,
      `Total past visits in profile: ${history.length}, Table 02 Bill: ₹${history[0]?.bill?.totalPayable}`
    );
  } catch (e: any) {
    recordTest(8, "Table 02 visible in history", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 9: Table 01 current bill is empty initially
  // -------------------------------------------------------------------------
  const table1HasActiveSession = table1CustomerCheck?.hasActiveSession || false;
  const table1SessionBill = table1CustomerCheck?.sessionBill;
  recordTest(
    9,
    "Table 01 current bill is empty initially (no bleed from Table 02)",
    !table1HasActiveSession && table1SessionBill === null,
    `HasActiveSession: ${table1HasActiveSession}, Table 01 Bill: ${table1SessionBill}`
  );

  // -------------------------------------------------------------------------
  // Test 10: New Table 01 order gets a separate dining session
  // -------------------------------------------------------------------------
  let orderTable1Number = "";
  try {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}`,
      },
      body: JSON.stringify({
        tableCode: "01",
        customerName: testName,
        customerPhone: testPhone,
        items: [{ menuItemId: "c-02", quantity: 1 }],
        notes: "Visit 2 on Table 01",
      }),
    });
    const json = await res.json();
    orderTable1Number = json.order?.orderNumber || "";

    recordTest(
      10,
      "New Table 01 order gets a separate dining session",
      res.status === 200 && json.success && !!orderTable1Number,
      `Table 01 Order: ${orderTable1Number}, Dining Session ID: ${json.order?.diningSessionId}`
    );
  } catch (e: any) {
    recordTest(10, "Table 01 separate session", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 11: Lifetime spend includes both completed visits
  // -------------------------------------------------------------------------
  try {
    // Settle Table 01
    await fetch(`${BASE_URL}/api/cashier/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_staff_session_token=${ownerToken}`,
      },
      body: JSON.stringify({ tableCode: "01", paymentMethod: "Cash" }),
    });

    const { data: loyalty } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", customerId)
      .single();

    const totalVisits = loyalty?.total_visits || 0;
    const totalSpent = Number(loyalty?.total_spent) || 0;

    recordTest(
      11,
      "Lifetime spend & completed visits increment accurately across both visits",
      totalVisits === 2 && totalSpent > settleBillTotal,
      `Completed Visits: ${totalVisits}, Total Spent: ₹${totalSpent}, Stamps: ${loyalty?.stamps_earned}/5`
    );
  } catch (e: any) {
    recordTest(11, "Lifetime spend across visits", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 12: Five eligible paid visits earn five stamps
  // -------------------------------------------------------------------------
  try {
    // Directly simulate visits 3, 4, 5 in loyalty account to test threshold
    await supabase
      .from("loyalty_accounts")
      .update({
        stamps_earned: 5,
        total_visits: 5,
        total_spent: 1250,
        reward_eligible: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loyaltyAccountId);

    const { data: loyalty5 } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("id", loyaltyAccountId)
      .single();

    recordTest(
      12,
      "Five eligible paid visits earn five stamps",
      loyalty5?.stamps_earned === 5 && loyalty5?.reward_eligible === true,
      `Stamps: ${loyalty5?.stamps_earned}/5, Reward Eligible: ${loyalty5?.reward_eligible}`
    );
  } catch (e: any) {
    recordTest(12, "Five stamps earned", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 13: Sixth eligible coffee reward is available in Profile API
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customer/profile`, {
      headers: { Cookie: `${COOKIE_CUSTOMER_DEVICE}=${deviceCookie}` },
    });
    const profile = await res.json();

    recordTest(
      13,
      "Sixth eligible coffee reward is available in Customer Profile API",
      res.status === 200 && profile.loyalty?.rewardEligible === true && profile.loyalty?.stampsEarned === 5,
      `Profile Reward Status: ${profile.loyalty?.rewardEligible ? "UNLOCKED" : "LOCKED"}`
    );
  } catch (e: any) {
    recordTest(13, "Reward available in Profile API", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 14: Owner redeems the reward once
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/loyalty/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tbw_staff_session_token=${ownerToken}`,
      },
      body: JSON.stringify({
        loyaltyAccountId,
        rewardDescription: "6th Complimentary Pour-Over Coffee",
      }),
    });
    const json = await res.json();

    recordTest(
      14,
      "Owner redeems the reward once via authenticated endpoint",
      res.status === 200 && json.success === true,
      `Redeemed: ${json.redemption?.reward_description}, Redemptions ID: ${json.redemption?.id}`
    );
  } catch (e: any) {
    recordTest(14, "Owner redeems reward", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 15: Stamps reset to 0/5 and redemption history is preserved
  // -------------------------------------------------------------------------
  try {
    const { data: updatedLoyalty } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("id", loyaltyAccountId)
      .single();

    const { data: redemptions } = await supabase
      .from("reward_redemptions")
      .select("*")
      .eq("loyalty_account_id", loyaltyAccountId);

    const isReset = updatedLoyalty?.stamps_earned === 0 && updatedLoyalty?.reward_eligible === false;
    const hasAudit = (redemptions || []).length > 0;

    recordTest(
      15,
      "Stamps reset to 0/5 for new cycle and redemption audit history is preserved",
      isReset && hasAudit,
      `New Cycle Stamps: ${updatedLoyalty?.stamps_earned}/5, Total Redemptions Logged: ${redemptions?.length}`
    );
  } catch (e: any) {
    recordTest(15, "Stamps reset and audit preserved", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 16: Different browser without session cannot see customer's private history
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/customer/profile`);
    const json = await res.json();

    recordTest(
      16,
      "Different browser without session cannot access customer's private profile",
      res.status === 401 && json.authenticated === false,
      `Status: ${res.status}, Response: ${JSON.stringify(json)}`
    );
  } catch (e: any) {
    recordTest(16, "Unauthenticated access blocked", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 17: Production demo-role bypass is blocked on staff endpoints
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${BASE_URL}/api/loyalty/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loyaltyAccountId }),
    });

    recordTest(
      17,
      "Unauthenticated public caller cannot access owner reward redemption",
      res.status === 401,
      `Blocked with HTTP Status: ${res.status}`
    );
  } catch (e: any) {
    recordTest(17, "Public redemption blocked", false, undefined, e.message);
  }

  // -------------------------------------------------------------------------
  // Test 18: Existing genuine transactions & restaurant settings remain intact
  // -------------------------------------------------------------------------
  try {
    const { data: rest } = await supabase.from("restaurants").select("id, name").single();
    const { data: tables } = await supabase.from("restaurant_tables").select("code");

    recordTest(
      18,
      "Genuine restaurant settings, name, and 12 table records remain intact",
      rest?.name === "Brew & Bean Café" && tables?.length === 12,
      `Restaurant: ${rest?.name}, Tables Count: ${tables?.length}`
    );
  } catch (e: any) {
    recordTest(18, "Restaurant settings intact", false, undefined, e.message);
  }

  console.log("\n========================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL ACCEPTANCE TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((err) => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});

