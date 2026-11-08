import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize Staff Role
    const authCheck = await requireStaffRole(req, [
      "owner",
      "manager",
      "cashier",
      "kitchen",
    ]);

    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const supabase = createAdminClient();

    // 2. Fetch authoritative tables
    const { data: dbTables, error: tablesErr } = await supabase
      .from("restaurant_tables")
      .select("id, code, name, capacity, section, status, is_active")
      .order("code", { ascending: true });

    if (tablesErr) {
      return NextResponse.json({ error: tablesErr.message }, { status: 500 });
    }

    // 3. Fetch active dining sessions
    const { data: activeSessions } = await supabase
      .from("dining_sessions")
      .select("id, table_id, customer_id, guest_name, guest_phone, status, opened_at")
      .eq("status", "active");

    const activeTableIds = new Set((activeSessions || []).map((s) => s.table_id));

    // 4. Fetch recent orders
    const { data: dbOrders } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        table_id,
        dining_session_id,
        status,
        payment_status,
        total_amount,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    const orders = dbOrders || [];

    // 5. Fetch bills
    const { data: dbBills } = await supabase
      .from("bills")
      .select("id, bill_number, dining_session_id, total_payable, status, paid_at")
      .limit(200);

    const bills = dbBills || [];

    // Calculate authoritative KPIs
    const totalTablesCount = dbTables?.length || 12;

    // A table is occupied if it has an active dining session OR an unpaid order
    const unpaidTableIds = new Set(
      orders
        .filter((o) => o.payment_status === "unpaid" && o.status !== "cancelled")
        .map((o) => o.table_id)
    );

    const occupiedTableIds = new Set([
      ...Array.from(activeTableIds),
      ...Array.from(unpaidTableIds),
    ]);

    const activeTablesCount = occupiedTableIds.size;

    const newOrdersCount = orders.filter(
      (o) => o.status === "new" && o.payment_status !== "paid_counter"
    ).length;

    const pendingKitchenCount = orders.filter(
      (o) =>
        ["new", "accepted", "preparing"].includes(o.status) &&
        o.payment_status !== "paid_counter"
    ).length;

    // Distinct tables with unpaid orders
    const outstandingBillsCount = unpaidTableIds.size;

    // Paid revenue: sum of paid bills or paid orders
    const paidBills = bills.filter((b) => b.status === "paid");
    const paidSalesTotal = paidBills.length > 0
      ? paidBills.reduce((acc, b) => acc + (Number(b.total_payable) || 0), 0)
      : orders
          .filter((o) => o.payment_status === "paid_counter")
          .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

    const paidOrdersCount = orders.filter(
      (o) => o.payment_status === "paid_counter"
    ).length;

    // Merge table statuses
    const tables = (dbTables || []).map((t) => {
      const isOccupied = occupiedTableIds.has(t.id);
      const session = (activeSessions || []).find((s) => s.table_id === t.id);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        status: isOccupied ? (t.status === "available" ? "occupied" : t.status) : "available",
        isActive: t.is_active,
        currentCustomerName: session?.guest_name,
        currentCustomerPhone: session?.guest_phone,
      };
    });

    return NextResponse.json({
      success: true,
      kpis: {
        activeTablesCount,
        totalTablesCount,
        newOrdersCount,
        pendingKitchenCount,
        outstandingBillsCount,
        paidSalesTotal,
        paidOrdersCount,
      },
      tables,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
