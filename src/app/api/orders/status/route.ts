import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderStatus } from "@/lib/types";

export async function PATCH(req: NextRequest) {
  try {
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

    try {
      const supabase = createAdminClient();

      const { data: order, error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId)
        .select("table_id")
        .maybeSingle();

      if (!error && order && order.table_id) {
        let tableStatus = "occupied";
        if (nextStatus === "preparing") tableStatus = "preparing";
        if (nextStatus === "ready" || nextStatus === "served") tableStatus = "occupied";

        await supabase
          .from("restaurant_tables")
          .update({ status: tableStatus })
          .eq("id", order.table_id);
      }
    } catch {
      // Ignored if local demo mode
    }

    return NextResponse.json({ success: true, orderId, nextStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

