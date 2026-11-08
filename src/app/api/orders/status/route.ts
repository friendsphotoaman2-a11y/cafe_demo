import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/lib/server-auth";
import { OrderStatus } from "@/lib/types";

// Strict forward-only state machine transitions
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["served"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};

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
    const { orderId, nextStatus, expectedPreviousStatus } = body;

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

    const supabase = createAdminClient();

    // 3. Fetch canonical current order state from Supabase
    const { data: currentOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("id, status, table_id, order_number, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !currentOrder) {
      return NextResponse.json(
        { error: "Order not found in database." },
        { status: 404 }
      );
    }

    const currentStatus = currentOrder.status as OrderStatus;

    // 4. Idempotent check: if already in requested status, return success cleanly
    if (currentStatus === nextStatus) {
      return NextResponse.json({
        success: true,
        orderId,
        status: nextStatus,
        previousStatus: currentStatus,
        orderNumber: currentOrder.order_number,
        idempotent: true,
      });
    }

    // 5. Concurrency / expected previous status validation
    if (expectedPreviousStatus && expectedPreviousStatus !== currentStatus) {
      return NextResponse.json(
        {
          error: `Concurrency conflict: Order was expected to be "${expectedPreviousStatus}", but is currently "${currentStatus}".`,
          currentStatus,
          orderId,
        },
        { status: 409 }
      );
    }

    // 6. Strict forward-only state machine validation
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Illegal status transition: Cannot change order from "${currentStatus}" to "${nextStatus}". Allowed: ${allowedNext.join(", ") || "none"}`,
          currentStatus,
          requestedStatus: nextStatus,
        },
        { status: 422 }
      );
    }

    // 7. Atomic update with state guard to prevent race conditions
    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        status: nextStatus,
      })
      .eq("id", orderId)
      .eq("status", currentStatus) // atomic CAS condition
      .select("id, status, table_id, order_number, payment_status")
      .maybeSingle();

    if (updateErr || !updatedOrder) {
      return NextResponse.json(
        {
          error: "Failed to update order status. The order state may have changed concurrently.",
        },
        { status: 409 }
      );
    }

    // 8. Update table status if applicable
    let tableStatusUpdated: string | null = null;
    if (updatedOrder.table_id) {
      let targetTableStatus = "occupied";
      if (nextStatus === "preparing") {
        targetTableStatus = "preparing";
      } else if (nextStatus === "served" || nextStatus === "ready" || nextStatus === "accepted") {
        targetTableStatus = "occupied";
      }

      await supabase
        .from("restaurant_tables")
        .update({ status: targetTableStatus })
        .eq("id", updatedOrder.table_id);

      tableStatusUpdated = targetTableStatus;
    }

    return NextResponse.json({
      success: true,
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      previousStatus: currentStatus,
      status: updatedOrder.status,
      nextStatus: updatedOrder.status,
      tableStatusUpdated,
      updatedBy: staff.fullName,
      staffRole: staff.role,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
