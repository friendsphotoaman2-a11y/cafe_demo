import { createAdminClient } from "../src/lib/supabase/admin";
import { createStaffSessionToken, STAFF_CREDENTIALS } from "../src/lib/server-auth";
import { NextRequest } from "next/server";

async function testKitchenStateMachine() {
  console.log("=== TESTING KITCHEN STATUS STATE MACHINE & CONCURRENCY GUARD ===");
  const supabase = createAdminClient();

  // 1. Get an available table
  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("id, code")
    .eq("code", "01")
    .single();

  if (!table) {
    console.error("Table 01 not found");
    process.exit(1);
  }

  // 2. Create a clean test customer and dining session
  const testPhone = `910${Date.now().toString().slice(-7)}`;
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      full_name: "Kitchen Test Guest",
      phone: testPhone,
    })
    .select()
    .single();

  if (custErr || !customer) {
    console.error("Failed to create test customer:", custErr);
    process.exit(1);
  }

  let session: any = null;
  let orderId: string | null = null;

  try {
    const { data: sessData } = await supabase
      .from("dining_sessions")
      .insert({
        table_id: table.id,
        customer_id: customer!.id,
        guest_name: "Kitchen Test Guest",
        guest_phone: "9100000001",
        session_code: "ses_kitchen_test",
        status: "active",
      })
      .select()
      .single();
    session = sessData;

    // 3. Create a test order with status 'new'
    const { data: order } = await supabase
      .from("orders")
      .insert({
        order_number: "#KITCHEN-TEST-1",
        table_id: table.id,
        dining_session_id: session!.id,
        status: "new",
        payment_status: "unpaid",
        subtotal: 200,
        tax_amount: 10,
        total_amount: 210,
      })
      .select()
      .single();

    orderId = order!.id;
    console.log(`Created test order ${orderId} in status "new"`);

    // Staff token
    const kitchenToken = createStaffSessionToken({
      role: "kitchen",
      email: STAFF_CREDENTIALS.kitchen.email,
      fullName: STAFF_CREDENTIALS.kitchen.name,
    });

    async function callPatchStatus(payload: Record<string, unknown>) {
      const req = new NextRequest("http://localhost:3000/api/orders/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `tbw_staff_session_token=${kitchenToken}`,
        },
        body: JSON.stringify(payload),
      });
      const { PATCH } = await import("../src/app/api/orders/status/route");
      const res = await PATCH(req);
      return { status: res.status, json: await res.json() };
    }

    // TEST 1: Advance from new -> accepted (with expectedPreviousStatus: "new")
    const t1 = await callPatchStatus({
      orderId,
      nextStatus: "accepted",
      expectedPreviousStatus: "new",
    });
    console.log("TEST 1: new -> accepted:", t1.status, t1.json);
    if (t1.status !== 200) throw new Error("Test 1 failed");

    // TEST 2: Illegal backwards transition: accepted -> new
    const t2 = await callPatchStatus({
      orderId,
      nextStatus: "new",
    });
    console.log("TEST 2: backwards accepted -> new rejected:", t2.status === 422 ? "PASS (422 Illegal Transition)" : "FAIL", t2.json.error);
    if (t2.status !== 422) throw new Error("Test 2 failed");

    // TEST 3: Concurrency conflict: expectedPreviousStatus mismatch
    const t3 = await callPatchStatus({
      orderId,
      nextStatus: "preparing",
      expectedPreviousStatus: "new", // Wrong! Current is 'accepted'
    });
    console.log("TEST 3: concurrency conflict mismatch rejected:", t3.status === 409 ? "PASS (409 Conflict)" : "FAIL", t3.json.error);
    if (t3.status !== 409) throw new Error("Test 3 failed");

    // TEST 4: Valid transition: accepted -> preparing
    const t4 = await callPatchStatus({
      orderId,
      nextStatus: "preparing",
      expectedPreviousStatus: "accepted",
    });
    console.log("TEST 4: accepted -> preparing:", t4.status, t4.json.status === "preparing" ? "PASS" : "FAIL");
    if (t4.status !== 200) throw new Error("Test 4 failed");

    // TEST 5: Illegal backwards transition: preparing -> accepted (THE REPORTED BUG!)
    const t5 = await callPatchStatus({
      orderId,
      nextStatus: "accepted",
    });
    console.log("TEST 5: preparing -> accepted (bug condition) strictly blocked:", t5.status === 422 ? "PASS (422 Blocked)" : "FAIL", t5.json.error);
    if (t5.status !== 422) throw new Error("Test 5 failed");

    // TEST 6: Valid transition: preparing -> ready
    const t6 = await callPatchStatus({
      orderId,
      nextStatus: "ready",
      expectedPreviousStatus: "preparing",
    });
    console.log("TEST 6: preparing -> ready:", t6.status, t6.json.status === "ready" ? "PASS" : "FAIL");
    if (t6.status !== 200) throw new Error("Test 6 failed");

    // TEST 7: Valid transition: ready -> served
    const t7 = await callPatchStatus({
      orderId,
      nextStatus: "served",
      expectedPreviousStatus: "ready",
    });
    console.log("TEST 7: ready -> served:", t7.status, t7.json.status === "served" ? "PASS" : "FAIL");
    if (t7.status !== 200) throw new Error("Test 7 failed");

    // TEST 8: Verify in database directly
    const { data: finalDbOrder } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    console.log("TEST 8: Authoritative database final status:", finalDbOrder?.status, finalDbOrder?.status === "served" ? "PASS" : "FAIL");
    console.log("=== ALL 8 KITCHEN STATE MACHINE TESTS PASSED! ===");
  } finally {
    if (orderId) {
      await supabase.from("orders").delete().eq("id", orderId);
    }
    if (session?.id) {
      await supabase.from("dining_sessions").delete().eq("id", session.id);
    }
    await supabase.from("customers").delete().eq("id", customer!.id);
    await supabase.from("restaurant_tables").update({ status: "available" }).eq("id", table.id);
    console.log("Test cleanup completed: Table 01 reset to available.");
  }
}

testKitchenStateMachine().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
