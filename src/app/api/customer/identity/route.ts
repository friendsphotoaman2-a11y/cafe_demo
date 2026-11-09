import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COOKIE_CUSTOMER_DEVICE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  verifyCustomerDeviceSession,
  createAndStoreCustomerDeviceSession,
  revokeCustomerDeviceSession,
} from "@/lib/customer-session";
import { getCookiePath } from "@/lib/base-path";

// =========================================================================
// GET: Retrieve authenticated customer profile from device session cookie
// =========================================================================
export async function GET(req: NextRequest) {
  try {
    const rawToken =
      req.cookies.get(COOKIE_CUSTOMER_DEVICE)?.value ||
      req.headers.get("x-customer-device-token");

    if (!rawToken) {
      return NextResponse.json({ authenticated: false });
    }

    const supabase = createAdminClient();
    const sessionCheck = await verifyCustomerDeviceSession(supabase, rawToken);

    if (!sessionCheck.valid || !sessionCheck.customer) {
      // Invalid or expired token: clear cookie
      const res = NextResponse.json({ authenticated: false });
      res.cookies.delete({ name: COOKIE_CUSTOMER_DEVICE, path: getCookiePath() });
      return res;
    }

    return NextResponse.json({
      authenticated: true,
      customer: sessionCheck.customer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// =========================================================================
// POST: Register or login customer and issue persistent 90-day device cookie
// =========================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phone } = body;

    if (!fullName || fullName.trim().length < 2) {
      return NextResponse.json(
        { error: "Valid customer name (minimum 2 characters) is required." },
        { status: 400 }
      );
    }

    const cleanPhone = (phone || "").toString().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "A valid 10-digit Indian mobile number is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Upsert or retrieve customer profile
    const { data: customerRecord, error: custErr } = await supabase
      .from("customers")
      .upsert(
        { phone: cleanPhone, full_name: fullName.trim() },
        { onConflict: "phone" }
      )
      .select("id, full_name, phone")
      .single();

    if (custErr || !customerRecord) {
      return NextResponse.json(
        { error: "Failed to register customer profile." },
        { status: 500 }
      );
    }

    // Initialize loyalty account if not present
    try {
      const { data: dbTable } = await supabase
        .from("restaurant_tables")
        .select("restaurant_id")
        .limit(1)
        .single();

      if (dbTable) {
        await supabase.from("loyalty_accounts").upsert(
          {
            customer_id: customerRecord.id,
            restaurant_id: dbTable.restaurant_id,
            stamps_earned: 0,
            total_visits: 0,
            total_spent: 0,
          },
          { onConflict: "customer_id" }
        );
      }
    } catch {
      // Non-critical
    }

    // Issue cryptographic 90-day device token stored as SHA-256 hash in DB
    const rawToken = await createAndStoreCustomerDeviceSession(
      supabase,
      customerRecord.id
    );

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      customer: {
        id: customerRecord.id,
        fullName: customerRecord.full_name,
        phone: customerRecord.phone,
        stamps: 0,
        totalVisits: 0,
      },
    });

    // Set persistent HttpOnly cookie
    response.cookies.set(COOKIE_CUSTOMER_DEVICE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
      path: getCookiePath(),
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// =========================================================================
// DELETE: Revoke device session (Logout / Switch Customer)
// =========================================================================
export async function DELETE(req: NextRequest) {
  try {
    const rawToken =
      req.cookies.get(COOKIE_CUSTOMER_DEVICE)?.value ||
      req.headers.get("x-customer-device-token");

    if (rawToken) {
      const supabase = createAdminClient();
      await revokeCustomerDeviceSession(supabase, rawToken);
    }

    const response = NextResponse.json({ success: true, authenticated: false });
    response.cookies.set(COOKIE_CUSTOMER_DEVICE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: getCookiePath(),
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

