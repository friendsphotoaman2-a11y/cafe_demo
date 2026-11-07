import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";
import { PaymentMethod } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    // 1. Mandatory Server-Side Staff Authorization Check
    const authCheck = await requireStaffRole(req, [
      "owner",
      "manager",
      "cashier",
    ]);

    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { staff } = authCheck;

    // 2. Body Validation
    const body = await req.json();
    const { tableCode, paymentMethod, transactionRef } = body;

    const formattedCode = (tableCode || "").toString().padStart(2, "0");
    if (!formattedCode) {
      return NextResponse.json(
        { error: "Valid table code is required." },
        { status: 400 }
      );
    }

    const validMethods: PaymentMethod[] = ["Cash", "UPI", "Card", "Other"];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Valid payment method is required (Cash, UPI, Card, Other)." },
        { status: 400 }
      );
    }

    let authoritativeSubtotal = 0;
    let authoritativeTax = 0;
    let authoritativeTotal = 0;
    let supabasePersisted = false;
    let billId: string | null = null;
    let paymentId: string | null = null;

    try {
      const supabase = createAdminClient();

      // Find table in DB
      const { data: dbTable } = await supabase
        .from("restaurant_tables")
        .select("id, restaurant_id")
        .eq("code", formattedCode)
        .maybeSingle();

      if (dbTable) {
        // Find active dining session
        const { data: diningSession } = await supabase
          .from("dining_sessions")
          .select("id, customer_id, guest_name, guest_phone")
          .eq("table_id", dbTable.id)
          .eq("status", "active")
          .maybeSingle();

        if (diningSession) {
          // Authoritative Server-side Summation of Unpaid Orders
          const { data: activeOrders } = await supabase
            .from("orders")
            .select("id, subtotal, tax_amount, total_amount, payment_status")
            .eq("dining_session_id", diningSession.id);

          if (activeOrders && activeOrders.length > 0) {
            for (const ord of activeOrders) {
              authoritativeSubtotal += Number(ord.subtotal) || 0;
              authoritativeTax += Number(ord.tax_amount) || 0;
              authoritativeTotal += Number(ord.total_amount) || 0;
            }
          }

          // Create or update authoritative Bill
          const billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`;
          const { data: dbBill } = await supabase
            .from("bills")
            .upsert(
              {
                restaurant_id: dbTable.restaurant_id,
                dining_session_id: diningSession.id,
                bill_number: billNumber,
                subtotal: authoritativeSubtotal,
                tax_percent: 5.0,
                tax_amount: authoritativeTax,
                discount_amount: 0,
                total_payable: authoritativeTotal,
                status: "paid",
                paid_at: new Date().toISOString(),
              },
              { onConflict: "dining_session_id" }
            )
            .select("id")
            .single();

          if (dbBill) {
            billId = dbBill.id;

            // Record Payment
            const { data: dbPayment } = await supabase
              .from("payments")
              .insert({
                bill_id: dbBill.id,
                amount: authoritativeTotal,
                payment_method: paymentMethod,
                transaction_reference: transactionRef ? transactionRef.trim() : null,
                cashier_name: staff.fullName,
                status: "confirmed",
              })
              .select("id")
              .single();

            if (dbPayment) {
              paymentId = dbPayment.id;

              // Record Immutable Audit Event
              await supabase.from("payment_audit_events").insert({
                payment_id: dbPayment.id,
                event_type: "counter_settlement",
                performed_by: `${staff.fullName} (${staff.role})`,
                details: {
                  tableCode: formattedCode,
                  billNumber,
                  amount: authoritativeTotal,
                  paymentMethod,
                  transactionRef: transactionRef || null,
                  guestName: diningSession.guest_name,
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }

          // Mark orders paid and completed
          await supabase
            .from("orders")
            .update({
              payment_status: "paid_counter",
              status: "completed",
            })
            .eq("dining_session_id", diningSession.id);

          // Close dining session
          await supabase
            .from("dining_sessions")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", diningSession.id);

          // Free table
          await supabase
            .from("restaurant_tables")
            .update({ status: "available" })
            .eq("id", dbTable.id);

          // Update loyalty program if registered customer
          if (diningSession.customer_id) {
            const { data: loyalty } = await supabase
              .from("loyalty_accounts")
              .select("id, stamps_earned, total_visits, total_spent")
              .eq("customer_id", diningSession.customer_id)
              .maybeSingle();

            if (loyalty) {
              const newStamps = Math.min(5, (loyalty.stamps_earned || 0) + 1);
              await supabase
                .from("loyalty_accounts")
                .update({
                  stamps_earned: newStamps,
                  total_visits: (loyalty.total_visits || 0) + 1,
                  total_spent:
                    (Number(loyalty.total_spent) || 0) + authoritativeTotal,
                  reward_eligible: newStamps >= 5,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", loyalty.id);

              await supabase.from("loyalty_events").insert({
                loyalty_account_id: loyalty.id,
                event_type: "stamp_earned",
                stamps_delta: 1,
                reason: `Visit settlement at Table ${formattedCode}`,
              });
            }
          }

          supabasePersisted = true;
        }
      }
    } catch {
      supabasePersisted = false;
    }

    return NextResponse.json({
      success: true,
      tableCode: formattedCode,
      paymentMethod,
      authoritativeTotal,
      billId,
      paymentId,
      cashierName: staff.fullName,
      cashierRole: staff.role,
      paidAt: new Date().toLocaleTimeString(),
      supabasePersisted,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
