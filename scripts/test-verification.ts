import { createClient } from "@supabase/supabase-js";
import {
  createStaffSessionToken,
  verifyStaffSessionToken,
  requireStaffRole,
} from "../src/lib/server-auth";
import type { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

async function runLiveVerification() {
  console.log("=== STARTING LIVE SUPABASE & SECURITY VERIFICATION ===\n");

  const results: Record<string, { pass: boolean; details: string }> = {};

  // ---------------------------------------------------------------------------
  // TEST 1: Server Authentication & Role Guarding
  // ---------------------------------------------------------------------------
  try {
    const ownerToken = createStaffSessionToken({
      role: "owner",
      email: "owner@brewandbean.in",
      fullName: "Aman (Café Owner)",
    });
    const verifiedOwner = verifyStaffSessionToken(ownerToken);
    const tamperedToken = ownerToken.replace(
      /^ey[a-zA-Z0-9_-]+/,
      "eyJyb2xlIjoiaGFja2VyIn0"
    );
    const isTamperedBlocked = verifyStaffSessionToken(tamperedToken) === null;

    const cashierToken = createStaffSessionToken({
      role: "cashier",
      email: "cashier@brewandbean.in",
      fullName: "Rahul (Head Cashier)",
    });
    const mockCashierReq = {
      cookies: {
        get: (n: string) =>
          n === "tbw_staff_session_token" ? { value: cashierToken } : undefined,
      },
      headers: { get: () => null },
    } as unknown as NextRequest;

    // Cashier blocked from kitchen
    const cashierToKitchen = await requireStaffRole(mockCashierReq, [
      "owner",
      "manager",
      "kitchen",
    ]);
    const isCashierBlockedFromKitchen =
      !cashierToKitchen.authorized && cashierToKitchen.status === 403;

    // Anon blocked from any staff route
    const mockAnonReq = {
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as unknown as NextRequest;
    const anonToStaff = await requireStaffRole(mockAnonReq, [
      "owner",
      "manager",
      "cashier",
      "kitchen",
    ]);
    const isAnonBlocked = !anonToStaff.authorized && anonToStaff.status === 401;

    results.server_auth_guards = {
      pass:
        verifiedOwner?.role === "owner" &&
        isTamperedBlocked &&
        isCashierBlockedFromKitchen &&
        isAnonBlocked,
      details:
        "Signed HMAC-SHA256 tokens validated. Tampering rejected. Cashier forbidden from kitchen updates (403). Anon rejected (401).",
    };
  } catch (err: unknown) {
    results.server_auth_guards = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Anonymous Row Level Security (RLS) Isolation
  // ---------------------------------------------------------------------------
  try {
    const { data: anonOrders } = await anon.from("orders").select("*");
    const { data: anonCustomers } = await anon.from("customers").select("*");
    const { data: anonStaff } = await anon.from("restaurant_staff").select("*");
    const { data: anonBills } = await anon.from("bills").select("*");

    const ordersEmpty = !anonOrders || anonOrders.length === 0;
    const customersEmpty = !anonCustomers || anonCustomers.length === 0;
    const staffEmpty = !anonStaff || anonStaff.length === 0;
    const billsEmpty = !anonBills || anonBills.length === 0;

    // Direct insert blocked by RLS
    const { error: insertErr } = await anon.from("orders").insert({
      restaurant_id: "207f6df3-e09f-4a28-873a-3fae014c64f1",
      order_number: "#ATTACK",
      status: "new",
      subtotal: 0,
      tax_amount: 0,
      total_amount: 0,
    });

    results.rls_anonymous_isolation = {
      pass:
        ordersEmpty &&
        customersEmpty &&
        staffEmpty &&
        billsEmpty &&
        insertErr !== null,
      details: `Direct read of private tables blocked. Direct insert blocked by RLS policy: "${insertErr?.message}"`,
    };
  } catch (err: unknown) {
    results.rls_anonymous_isolation = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Live Customer Ordering Flow in Supabase
  // ---------------------------------------------------------------------------
  let testOrderId: string | null = null;
  let testDiningSessionId: string | null = null;
  let testTableId: string | null = null;
  let testSubtotal = 0;
  let testTax = 0;
  let testTotal = 0;

  try {
    // 1. Get Table 01
    const { data: table01 } = await admin
      .from("restaurant_tables")
      .select("id, restaurant_id, code")
      .eq("code", "01")
      .single();

    testTableId = table01!.id;
    const restaurantId = table01!.restaurant_id;

    // 2. Upsert a test customer
    const testPhone = "9876500001";
    const testName = "Live Test Customer";
    const { data: cust } = await admin
      .from("customers")
      .upsert({ phone: testPhone, full_name: testName }, { onConflict: "phone" })
      .select("id")
      .single();

    // 3. Create active dining session
    const sessionCode = `ses_test_${Date.now()}`;
    const { data: session } = await admin
      .from("dining_sessions")
      .insert({
        restaurant_id: restaurantId,
        table_id: table01!.id,
        customer_id: cust!.id,
        session_code: sessionCode,
        guest_name: testName,
        guest_phone: testPhone,
        status: "active",
      })
      .select("id")
      .single();

    testDiningSessionId = session!.id;

    // 4. Calculate prices authoritatively for 1 Flat White (₹240) + 1 Panini (₹380)
    const item1Price = 240.0;
    const item2Price = 380.0;
    testSubtotal = item1Price + item2Price; // 620
    testTax = (testSubtotal * 5) / 100; // 31
    testTotal = testSubtotal + testTax; // 651

    const orderNumber = `#TBW-TEST-${Date.now().toString().slice(-4)}`;
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        restaurant_id: restaurantId,
        dining_session_id: session!.id,
        table_id: table01!.id,
        order_number: orderNumber,
        status: "new",
        payment_status: "unpaid",
        notes: "Test order for live verification",
        subtotal: testSubtotal,
        tax_amount: testTax,
        total_amount: testTotal,
      })
      .select("id, order_number, total_amount, status")
      .single();

    if (orderErr) throw orderErr;
    testOrderId = order.id;

    // 5. Insert order items
    await admin.from("order_items").insert([
      {
        order_id: order.id,
        item_name_snapshot: "Indiranagar Signature Flat White",
        unit_price_snapshot: item1Price,
        quantity: 1,
        total_price: item1Price,
        classification: "veg",
      },
      {
        order_id: order.id,
        item_name_snapshot: "Wild Truffle Mushroom Panini",
        unit_price_snapshot: item2Price,
        quantity: 1,
        total_price: item2Price,
        classification: "veg",
      },
    ]);

    // 6. Update table status to order_pending
    await admin
      .from("restaurant_tables")
      .update({ status: "order_pending" })
      .eq("id", table01!.id);

    // Verify written table state
    const { data: updatedTable } = await admin
      .from("restaurant_tables")
      .select("status")
      .eq("id", table01!.id)
      .single();

    results.live_customer_ordering = {
      pass:
        order !== null &&
        order.total_amount === testTotal &&
        updatedTable?.status === "order_pending",
      details: `Order created in Supabase (ID: ${order.id}, Total: ₹${testTotal}). Table 01 transitioned to order_pending.`,
    };
  } catch (err: unknown) {
    results.live_customer_ordering = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Kitchen Status Progression & Persistence in Supabase
  // ---------------------------------------------------------------------------
  try {
    if (!testOrderId) throw new Error("Missing test order ID");

    // Advance status: new -> accepted -> preparing -> ready -> served
    const statuses = ["accepted", "preparing", "ready", "served"] as const;
    let lastStatus = "";

    for (const st of statuses) {
      const { data: updatedOrder, error } = await admin
        .from("orders")
        .update({ status: st })
        .eq("id", testOrderId)
        .select("status")
        .single();

      if (error) throw error;
      lastStatus = updatedOrder.status;
    }

    // Verify order in Supabase
    const { data: fetchedOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", testOrderId)
      .single();

    results.kitchen_status_progression = {
      pass: fetchedOrder?.status === "served",
      details: `Kitchen status stepped through accepted -> preparing -> ready -> served and persisted in Supabase (Final: ${fetchedOrder?.status}).`,
    };
  } catch (err: unknown) {
    results.kitchen_status_progression = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate Order & Duplicate Payment Prevention
  // ---------------------------------------------------------------------------
  try {
    if (!testDiningSessionId) throw new Error("Missing dining session");

    // Attempt to insert duplicate bill for same dining session
    // (bills.dining_session_id has UNIQUE constraint)
    const billNumber1 = `BILL-1-${Date.now()}`;
    const billNumber2 = `BILL-2-${Date.now()}`;

    const { error: bill1Err } = await admin.from("bills").insert({
      restaurant_id: "207f6df3-e09f-4a28-873a-3fae014c64f1",
      dining_session_id: testDiningSessionId,
      bill_number: billNumber1,
      subtotal: testSubtotal,
      tax_amount: testTax,
      total_payable: testTotal,
      status: "unpaid",
    });

    const { error: dupBillErr } = await admin.from("bills").insert({
      restaurant_id: "207f6df3-e09f-4a28-873a-3fae014c64f1",
      dining_session_id: testDiningSessionId,
      bill_number: billNumber2,
      subtotal: testSubtotal,
      tax_amount: testTax,
      total_payable: testTotal,
      status: "unpaid",
    });

    const duplicateBillBlocked =
      dupBillErr !== null &&
      (dupBillErr.code === "23505" || dupBillErr.message.includes("unique"));

    results.duplicate_prevention = {
      pass: !bill1Err && duplicateBillBlocked,
      details: `Duplicate bill insertion for the same dining session strictly blocked by UNIQUE constraint (Code: ${dupBillErr?.code}).`,
    };
  } catch (err: unknown) {
    results.duplicate_prevention = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Cashier Payment Settle, Bill Totals Match & Audit Trail
  // ---------------------------------------------------------------------------
  try {
    if (!testDiningSessionId || !testTableId || !testOrderId)
      throw new Error("Missing test context");

    // Fetch the authoritative bill
    const { data: bill } = await admin
      .from("bills")
      .select("id, total_payable, subtotal, tax_amount")
      .eq("dining_session_id", testDiningSessionId)
      .single();

    // Check customer order total vs cashier bill total
    const { data: order } = await admin
      .from("orders")
      .select("total_amount, subtotal, tax_amount")
      .eq("id", testOrderId)
      .single();

    const totalsMatch =
      Number(bill!.total_payable) === Number(order!.total_amount) &&
      Number(bill!.subtotal) === Number(order!.subtotal);

    // Record Payment
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        bill_id: bill!.id,
        amount: bill!.total_payable,
        payment_method: "UPI",
        transaction_reference: "UPI-TEST-123456",
        cashier_name: "Rahul (Head Cashier)",
        status: "confirmed",
      })
      .select("id")
      .single();

    if (payErr) throw payErr;

    // Record Immutable Audit Event
    const { error: auditErr } = await admin
      .from("payment_audit_events")
      .insert({
        payment_id: payment.id,
        event_type: "counter_settlement",
        performed_by: "Rahul (Head Cashier)",
        details: {
          tableCode: "01",
          billId: bill!.id,
          amount: bill!.total_payable,
          method: "UPI",
        },
      });

    // Mark bill paid, orders completed, close session, free table
    await admin
      .from("bills")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", bill!.id);

    await admin
      .from("orders")
      .update({ payment_status: "paid_counter", status: "completed" })
      .eq("dining_session_id", testDiningSessionId);

    await admin
      .from("dining_sessions")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", testDiningSessionId);

    await admin
      .from("restaurant_tables")
      .update({ status: "available" })
      .eq("id", testTableId);

    // Verify Table 01 is free again
    const { data: tableAfterSettle } = await admin
      .from("restaurant_tables")
      .select("status")
      .eq("id", testTableId)
      .single();

    results.cashier_settlement_and_audit = {
      pass:
        totalsMatch &&
        !auditErr &&
        tableAfterSettle?.status === "available",
      details: `Totals match exactly (Customer ₹${order!.total_amount} == Cashier ₹${bill!.total_payable}). Payment & audit logged. Table 01 freed to available.`,
    };
  } catch (err: unknown) {
    results.cashier_settlement_and_audit = {
      pass: false,
      details: String(err),
    };
  }

  // ---------------------------------------------------------------------------
  // CLEANUP TEST TRANSACTION
  // ---------------------------------------------------------------------------
  try {
    if (testDiningSessionId) {
      await admin
        .from("dining_sessions")
        .delete()
        .eq("id", testDiningSessionId);
    }
    // Delete test customer
    await admin.from("customers").delete().eq("phone", "9876500001");
  } catch (err) {
    console.error("Cleanup notice:", err);
  }

  // Print Summary
  console.log("=== FINAL VERIFICATION RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
}

runLiveVerification().catch(console.error);

