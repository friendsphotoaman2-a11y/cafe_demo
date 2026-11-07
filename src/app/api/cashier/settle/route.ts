import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentMethod } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableCode, paymentMethod, transactionRef, cashierName, amount } = body;

    const formattedCode = (tableCode || "").padStart(2, "0");
    if (!formattedCode) {
      return NextResponse.json({ error: "Table code is required." }, { status: 400 });
    }

    const validMethods: PaymentMethod[] = ["Cash", "UPI", "Card", "Other"];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json({ error: "Valid payment method is required." }, { status: 400 });
    }

    try {
      const supabase = createAdminClient();

      const { data: dbTable } = await supabase
        .from("restaurant_tables")
        .select("id, restaurant_id")
        .eq("code", formattedCode)
        .maybeSingle();

      if (dbTable) {
        // Find active dining session
        const { data: diningSession } = await supabase
          .from("dining_sessions")
          .select("id, customer_id")
          .eq("table_id", dbTable.id)
          .eq("status", "active")
          .maybeSingle();

        if (diningSession) {
          // Close dining session
          await supabase
            .from("dining_sessions")
            .update({ status: "closed", closed_at: new Date().toISOString() })
            .eq("id", diningSession.id);

          // Mark orders paid
          await supabase
            .from("orders")
            .update({
              payment_status: "paid_counter",
              status: "completed",
            })
            .eq("dining_session_id", diningSession.id);

          // Free table
          await supabase
            .from("restaurant_tables")
            .update({ status: "available" })
            .eq("id", dbTable.id);

          // Update customer loyalty if customer_id exists
          if (diningSession.customer_id) {
            const { data: loyalty } = await supabase
              .from("loyalty_accounts")
              .select("id, stamps_earned, total_visits, total_spent")
              .eq("customer_id", diningSession.customer_id)
              .maybeSingle();

            if (loyalty) {
              const newStamps = Math.min(5, loyalty.stamps_earned + 1);
              await supabase
                .from("loyalty_accounts")
                .update({
                  stamps_earned: newStamps,
                  total_visits: loyalty.total_visits + 1,
                  total_spent: loyalty.total_spent + (amount || 0),
                  reward_eligible: newStamps >= 5,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", loyalty.id);
            }
          }
        }
      }
    } catch {
      // Ignored if local demo mode
    }

    return NextResponse.json({
      success: true,
      tableCode: formattedCode,
      paymentMethod,
      cashierName: cashierName || "Cashier",
      paidAt: new Date().toLocaleTimeString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

