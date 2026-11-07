import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Must be authorized staff (Owner or Manager only)
    const authCheck = await requireStaffRole(req, ["owner", "manager"]);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { staff } = authCheck;
    const body = await req.json();
    const { customerId, loyaltyAccountId, rewardDescription } = body;

    if (!customerId && !loyaltyAccountId) {
      return NextResponse.json(
        { error: "customerId or loyaltyAccountId is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 2. Fetch the Loyalty Account
    let query = supabase.from("loyalty_accounts").select("*");
    if (loyaltyAccountId) {
      query = query.eq("id", loyaltyAccountId);
    } else {
      query = query.eq("customer_id", customerId);
    }

    const { data: loyalty, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !loyalty) {
      return NextResponse.json(
        { error: "Loyalty account not found." },
        { status: 404 }
      );
    }

    // 3. Verify reward eligibility (Must have at least 5 stamps or reward_eligible=true)
    if ((loyalty.stamps_earned || 0) < 5 && !loyalty.reward_eligible) {
      return NextResponse.json(
        {
          error: `Customer is not eligible for a reward yet (${loyalty.stamps_earned || 0}/5 stamps).`,
        },
        { status: 400 }
      );
    }

    const description =
      rewardDescription || "6th Complimentary Artisan Coffee";

    // 4. Record Reward Redemption
    const { data: redemption, error: redErr } = await supabase
      .from("reward_redemptions")
      .insert({
        loyalty_account_id: loyalty.id,
        reward_description: description,
        redeemed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (redErr) {
      return NextResponse.json(
        { error: `Failed to record redemption: ${redErr.message}` },
        { status: 500 }
      );
    }

    // 5. Log Loyalty Event
    await supabase.from("loyalty_events").insert({
      loyalty_account_id: loyalty.id,
      event_type: "reward_redeemed",
      stamps_delta: -5,
      reason: `Authorized by ${staff.fullName} (${staff.role}): ${description}`,
      created_at: new Date().toISOString(),
    });

    // 6. Reset Stamps for next cycle (stamps reset to 0, reward_eligible = false)
    const { data: updatedLoyalty, error: updateErr } = await supabase
      .from("loyalty_accounts")
      .update({
        stamps_earned: 0,
        reward_eligible: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loyalty.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to reset stamps: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Reward successfully redeemed by ${staff.fullName}.`,
      redemption,
      loyalty: {
        id: updatedLoyalty.id,
        stampsEarned: updatedLoyalty.stamps_earned,
        totalVisits: updatedLoyalty.total_visits,
        totalSpent: updatedLoyalty.total_spent,
        rewardEligible: updatedLoyalty.reward_eligible,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

