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

    const search = req.nextUrl.searchParams.get("search")?.toLowerCase().trim() || "";

    const supabase = createAdminClient();

    // Fetch real customers from Supabase
    let query = supabase
      .from("customers")
      .select(`
        id,
        full_name,
        phone,
        created_at,
        loyalty_accounts (
          id,
          stamps_earned,
          total_visits,
          total_spent,
          reward_eligible
        )
      `)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format for CRM
    const formatted = (customers || []).map((c) => {
      const loyalty = Array.isArray(c.loyalty_accounts)
        ? c.loyalty_accounts[0]
        : c.loyalty_accounts;

      return {
        id: c.id,
        fullName: c.full_name,
        phone: c.phone,
        memberSince: c.created_at,
        stamps: loyalty?.stamps_earned || 0,
        totalVisits: loyalty?.total_visits || 0,
        totalSpent: Number(loyalty?.total_spent) || 0,
        rewardEligible: loyalty?.reward_eligible || false,
      };
    });

    return NextResponse.json({
      success: true,
      customers: formatted,
      count: formatted.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

