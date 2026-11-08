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

    // Run primary queries in parallel: customer, loyalty, and dining sessions
    const [customerRes, loyaltyRes, sessionsRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, phone, created_at")
        .eq("id", customer.id)
        .maybeSingle(),
      supabase
        .from("loyalty_accounts")
        .select("*")
        .eq("customer_id", customer.id)
        .maybeSingle(),
      supabase
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
        .order("opened_at", { ascending: false })
        .limit(30),
    ]);

    const dbCustomer = customerRes.data;
    const loyalty = loyaltyRes.data;
    const diningSessions = sessionsRes.data || [];

    const sessionIds = diningSessions.map((ds) => ds.id);

    // Run secondary queries in parallel: redemptions, all bills, and all orders
    const [redemptionsRes, billsRes, ordersRes] = await Promise.all([
      loyalty?.id
        ? supabase
            .from("reward_redemptions")
            .select("*")
            .eq("loyalty_account_id", loyalty.id)
            .order("redeemed_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      sessionIds.length > 0
        ? supabase
            .from("bills")
            .select("*")
            .in("dining_session_id", sessionIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length > 0
        ? supabase
            .from("orders")
            .select(`
              id,
              order_number,
              dining_session_id,
              status,
              payment_status,
              notes,
              subtotal,
              tax_amount,
              total_amount,
              created_at,
              order_items (
                id,
                item_name_snapshot,
                quantity,
                unit_price_snapshot,
                total_price,
                customizations_snapshot,
                classification
              )
            `)
            .in("dining_session_id", sessionIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const redemptions = redemptionsRes.data || [];
    const allBills = billsRes.data || [];
    const allOrders = ordersRes.data || [];

    // Index bills and orders by dining_session_id for instant O(1) in-memory lookup
    interface BillRecord {
      id: string;
      dining_session_id: string;
      bill_number: string;
      subtotal: number;
      tax_amount: number;
      total_payable: number;
      status: string;
      paid_at: string | null;
    }

    interface OrderRecord {
      id: string;
      order_number: string;
      dining_session_id: string;
      status: string;
      payment_status: string;
      subtotal: number;
      tax_amount: number;
      total_amount: number;
      created_at: string;
      order_items?: {
        id: string;
        item_name_snapshot?: string;
        item_name?: string;
        quantity: number;
        unit_price_snapshot?: number;
        unit_price?: number;
        total_price: number;
        customizations_snapshot?: unknown;
        classification?: string;
      }[];
    }

    const billsBySession = new Map<string, BillRecord>();
    for (const b of allBills as BillRecord[]) {
      if (b.dining_session_id) {
        billsBySession.set(b.dining_session_id, b);
      }
    }

    const ordersBySession = new Map<string, OrderRecord[]>();
    for (const ord of allOrders as OrderRecord[]) {
      if (ord.dining_session_id) {
        const list = ordersBySession.get(ord.dining_session_id) || [];
        list.push(ord);
        ordersBySession.set(ord.dining_session_id, list);
      }
    }

    // Assemble visit history with zero sequential database round-trips
    const visitHistory: unknown[] = [];
    let activeSessionData: unknown = null;

    for (const ds of diningSessions) {
      const tableRecord = Array.isArray(ds.restaurant_tables)
        ? ds.restaurant_tables[0]
        : ds.restaurant_tables;
      const tableCode = tableRecord?.code || "??";
      const tableName = tableRecord?.name || `Table ${tableCode}`;

      const bill = billsBySession.get(ds.id);
      const sessionOrders = ordersBySession.get(ds.id) || [];

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
        orders: sessionOrders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          status: o.status,
          paymentStatus: o.payment_status,
          subtotal: Number(o.subtotal) || 0,
          taxAmount: Number(o.tax_amount) || 0,
          totalAmount: Number(o.total_amount) || 0,
          createdAt: o.created_at,
          items: (o.order_items || []).map((oi) => ({
            id: oi.id,
            name: oi.item_name_snapshot || oi.item_name || "Café Item",
            quantity: oi.quantity,
            unitPrice: Number(oi.unit_price_snapshot ?? oi.unit_price) || 0,
            totalPrice: Number(oi.total_price) || 0,
            customizations: oi.customizations_snapshot || [],
            classification: oi.classification || "veg",
          })),
        })),
      };

      if (ds.status === "active" && !activeSessionData) {
        activeSessionData = visitRecord;
      }

      visitHistory.push(visitRecord);
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
