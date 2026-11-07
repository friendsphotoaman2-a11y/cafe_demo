import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COOKIE_CUSTOMER_DEVICE,
  verifyCustomerDeviceSession,
} from "@/lib/customer-session";

// Mask phone for privacy (e.g. 9876543210 -> ******3210)
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return phone || "";
  const last4 = phone.slice(-4);
  return `${"*".repeat(Math.max(0, phone.length - 4))}${last4}`;
}

export async function GET(req: NextRequest) {
  try {
    const rawToken =
      req.cookies.get(COOKIE_CUSTOMER_DEVICE)?.value ||
      req.headers.get("x-customer-device-token");

    if (!rawToken) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const supabase = createAdminClient();
    const sessionCheck = await verifyCustomerDeviceSession(supabase, rawToken);

    if (!sessionCheck.valid || !sessionCheck.customer) {
      const res = NextResponse.json({ authenticated: false }, { status: 401 });
      res.cookies.delete({ name: COOKIE_CUSTOMER_DEVICE, path: "/" });
      return res;
    }

    const customer = sessionCheck.customer;

    // Fetch full customer details including created_at
    const { data: dbCustomer } = await supabase
      .from("customers")
      .select("id, full_name, phone, created_at")
      .eq("id", customer.id)
      .maybeSingle();

    // 1. Fetch Loyalty Account
    const { data: loyalty } = await supabase
      .from("loyalty_accounts")
      .select("*")
      .eq("customer_id", customer.id)
      .maybeSingle();

    // 2. Fetch Redemptions
    let redemptions: unknown[] = [];
    if (loyalty?.id) {
      const { data: dbRedemptions } = await supabase
        .from("reward_redemptions")
        .select("*")
        .eq("loyalty_account_id", loyalty.id)
        .order("redeemed_at", { ascending: false });
      redemptions = dbRedemptions || [];
    }

    // 3. Fetch All Dining Sessions for this Customer (Cross-table history)
    const { data: diningSessions } = await supabase
      .from("dining_sessions")
      .select(`
        id,
        session_code,
        table_id,
        status,
        opened_at,
        closed_at,
        restaurant_tables (
          code,
          name
        )
      `)
      .eq("customer_id", customer.id)
      .order("opened_at", { ascending: false });

    // 4. For each dining session, fetch its bills and orders
    const visitHistory: unknown[] = [];
    let activeSessionData: unknown = null;

    if (diningSessions && diningSessions.length > 0) {
      for (const ds of diningSessions) {
        // Table info
        const tableRecord = Array.isArray(ds.restaurant_tables)
          ? ds.restaurant_tables[0]
          : ds.restaurant_tables;
        const tableCode = tableRecord?.code || "??";
        const tableName = tableRecord?.name || `Table ${tableCode}`;

        // Fetch Bill for this session
        const { data: bill } = await supabase
          .from("bills")
          .select("*")
          .eq("dining_session_id", ds.id)
          .maybeSingle();

        // Fetch Orders for this session
        const { data: orders } = await supabase
          .from("orders")
          .select(`
            id,
            order_number,
            status,
            payment_status,
            notes,
            subtotal,
            tax_amount,
            total_amount,
            created_at,
            order_items (
              id,
              item_name,
              quantity,
              unit_price,
              total_price,
              customization_choices
            )
          `)
          .eq("dining_session_id", ds.id)
          .order("created_at", { ascending: true });

        const visitRecord = {
          sessionId: ds.id,
          sessionCode: ds.session_code,
          tableCode,
          tableName,
          status: ds.status,
          openedAt: ds.opened_at,
          closedAt: ds.closed_at,
          bill: bill
            ? {
                id: bill.id,
                billNumber: bill.bill_number,
                subtotal: Number(bill.subtotal) || 0,
                taxAmount: Number(bill.tax_amount) || 0,
                totalPayable: Number(bill.total_payable) || 0,
                status: bill.status,
                paidAt: bill.paid_at,
              }
            : null,
          orders: (orders || []).map((o) => ({
            id: o.id,
            orderNumber: o.order_number,
            status: o.status,
            paymentStatus: o.payment_status,
            subtotal: Number(o.subtotal) || 0,
            taxAmount: Number(o.tax_amount) || 0,
            totalAmount: Number(o.total_amount) || 0,
            createdAt: o.created_at,
            items: (o.order_items || []).map((oi: {
              id: string;
              item_name: string;
              quantity: number;
              unit_price: number;
              total_price: number;
              customization_choices: unknown;
            }) => ({
              id: oi.id,
              name: oi.item_name,
              quantity: oi.quantity,
              unitPrice: Number(oi.unit_price) || 0,
              totalPrice: Number(oi.total_price) || 0,
              customizations: oi.customization_choices || [],
            })),
          })),
        };

        if (ds.status === "active" && !activeSessionData) {
          activeSessionData = visitRecord;
        }

        visitHistory.push(visitRecord);
      }
    }

    // Return complete profile
    return NextResponse.json({
      authenticated: true,
      profile: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        maskedPhone: maskPhone(customer.phone),
        createdAt: dbCustomer?.created_at || new Date().toISOString(),
      },
      loyalty: {
        accountId: loyalty?.id || null,
        stampsEarned: loyalty?.stamps_earned || 0,
        totalVisits: loyalty?.total_visits || 0,
        totalSpent: Number(loyalty?.total_spent) || 0,
        rewardEligible: loyalty?.reward_eligible || false,
        redemptions,
      },
      activeSession: activeSessionData,
      visitHistory,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
