import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";
import { OrderStatus } from "@/lib/types";

export async function PATCH(req: NextRequest) {
  try {
    // 1. Mandatory Server-Side Staff Authorization Check
    const authCheck = await requireStaffRole(req, [
      "owner",
      "manager",
      "kitchen",
    ]);

    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { staff } = authCheck;

    // 2. Body validation
    const body = await req.json();
    const { orderId, nextStatus } = body;

    const validStatuses: OrderStatus[] = [
      "new",
      "accepted",
      "preparing",
      "ready",
      "served",
      "completed",
      "cancelled",
    ];

    if (!orderId || !validStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { error: "Valid orderId and nextStatus are required." },
        { status: 400 }
      );
    }

    // Cancellation restricted to Manager & Owner
    if (nextStatus === "cancelled" && !["owner", "manager"].includes(staff.role)) {
      return NextResponse.json(
        { error: "Only Store Managers or Café Owners can cancel orders." },
        { status: 403 }
      );
    }

    let supabaseUpdated = false;
    let tableStatusUpdated: string | null = null;

    try {
      const supabase = createAdminClient();

      const { data: order, error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId)
        .select("id, table_id, status")
        .maybeSingle();

      if (!error && order && order.table_id) {
        supabaseUpdated = true;
        let tableStatus = "occupied";
        if (nextStatus === "preparing") tableStatus = "preparing";
        if (nextStatus === "ready" || nextStatus === "served")
          tableStatus = "occupied";

        await supabase
          .from("restaurant_tables")
          .update({ status: tableStatus })
          .eq("id", order.table_id);

        tableStatusUpdated = tableStatus;
      }
    } catch {
      supabaseUpdated = false;
    }

    return NextResponse.json({
      success: true,
      orderId,
      nextStatus,
      updatedBy: staff.fullName,
      staffRole: staff.role,
      supabaseUpdated,
      tableStatusUpdated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
