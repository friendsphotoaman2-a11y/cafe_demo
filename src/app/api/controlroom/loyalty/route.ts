import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  try {
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

    const supabase = createAdminClient();

    // Fetch loyalty accounts joined with customer details and redemptions
    const { data: accounts, error } = await supabase
      .from("loyalty_accounts")
      .select(`
        id,
        stamps_earned,
        total_visits,
        total_spent,
        reward_eligible,
        created_at,
        updated_at,
        customers (
          id,
          full_name,
          phone
        ),
        reward_redemptions (
          id,
          reward_description,
          redeemed_at
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (accounts || []).map((acc) => {
      const cust = Array.isArray(acc.customers)
        ? acc.customers[0]
        : acc.customers;

      return {
        id: acc.id,
        customerId: cust?.id || null,
        customerName: cust?.full_name || "Unknown Guest",
        customerPhone: cust?.phone || "",
        stamps: acc.stamps_earned || 0,
        totalVisits: acc.total_visits || 0,
        totalSpent: Number(acc.total_spent) || 0,
        rewardEligible: acc.reward_eligible || false,
        redemptions: acc.reward_redemptions || [],
        lastUpdated: acc.updated_at || acc.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      loyaltyAccounts: formatted,
      count: formatted.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

