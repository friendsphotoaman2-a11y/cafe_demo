import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MENU_ITEMS, DEMO_SETTINGS } from "@/lib/demo-data";
import { OrderCustomizationChoice, VegClassification } from "@/lib/types";

interface IncomingOrderItem {
  menuItemId: string;
  quantity: number;
  customizations: OrderCustomizationChoice[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableCode, customerName, customerPhone, items, notes } = body;

    // 1. Validation
    if (!tableCode) {
      return NextResponse.json({ error: "Table code is required." }, { status: 400 });
    }
    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json({ error: "Valid customer name is required." }, { status: 400 });
    }
    const cleanPhone = (customerPhone || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: "Valid 10-digit mobile number is required." }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one item." }, { status: 400 });
    }

    // 2. Authoritative Server-side Price Calculation (prevents tampering)
    let calculatedSubtotal = 0;
    const validatedItems: {
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      customizations: OrderCustomizationChoice[];
      classification: VegClassification;
    }[] = [];

    for (const item of items as IncomingOrderItem[]) {
      const catalogItem = DEMO_MENU_ITEMS.find((m) => m.id === item.menuItemId);
      if (!catalogItem) {
        return NextResponse.json({ error: `Item with id ${item.menuItemId} not found.` }, { status: 400 });
      }

      const optionsDelta = (item.customizations || []).reduce(
        (sum, c) => sum + (c.priceDelta || 0),
        0
      );
      const serverUnitPrice = catalogItem.price + optionsDelta;
      const quantity = Math.max(1, Math.min(50, item.quantity || 1));
      const serverTotalPrice = serverUnitPrice * quantity;

      calculatedSubtotal += serverTotalPrice;

      validatedItems.push({
        menuItemId: catalogItem.id,
        name: catalogItem.name,
        quantity,
        unitPrice: serverUnitPrice,
        totalPrice: serverTotalPrice,
        customizations: item.customizations || [],
        classification: catalogItem.classification,
      });
    }

    const taxPercent = DEMO_SETTINGS.gstRatePercent;
    const taxAmount = (calculatedSubtotal * taxPercent) / 100;
    const totalAmount = calculatedSubtotal + taxAmount;
    const orderNumber = `#TBW-${Math.floor(1040 + Math.random() * 8950)}`;
    const formattedCode = tableCode.padStart(2, "0");

    // 3. Attempt Supabase Insertion
    let supabaseSaved = false;
    let newOrderId = `ord-${Date.now()}`;

    try {
      const supabase = createAdminClient();

      // Check table in DB
      const { data: dbTable } = await supabase
        .from("restaurant_tables")
        .select("id, is_active, restaurant_id")
        .eq("code", formattedCode)
        .maybeSingle();

      if (dbTable && dbTable.is_active) {
        // Upsert customer
        const { data: customerRecord } = await supabase
          .from("customers")
          .upsert(
            { phone: cleanPhone, full_name: customerName.trim() },
            { onConflict: "phone" }
          )
          .select("id")
          .single();

        // Get or create active dining session for this table
        let diningSessionId: string | null = null;
        const { data: existingSession } = await supabase
          .from("dining_sessions")
          .select("id")
          .eq("table_id", dbTable.id)
          .eq("status", "active")
          .maybeSingle();

        if (existingSession) {
          diningSessionId = existingSession.id;
        } else {
          const { data: newSession } = await supabase
            .from("dining_sessions")
            .insert({
              restaurant_id: dbTable.restaurant_id,
              table_id: dbTable.id,
              customer_id: customerRecord?.id || null,
              session_code: `SES-${Date.now()}`,
              guest_name: customerName.trim(),
              guest_phone: cleanPhone,
              status: "active",
            })
            .select("id")
            .single();
          diningSessionId = newSession?.id || null;
        }

        // Insert Order
        const { data: dbOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            restaurant_id: dbTable.restaurant_id,
            dining_session_id: diningSessionId,
            table_id: dbTable.id,
            order_number: orderNumber,
            status: "new",
            payment_status: "unpaid",
            notes: notes ? notes.trim() : null,
            subtotal: calculatedSubtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
          })
          .select("id")
          .single();

        if (!orderError && dbOrder) {
          newOrderId = dbOrder.id;
          supabaseSaved = true;

          // Insert order items
          const orderItemsPayload = validatedItems.map((vi) => ({
            order_id: dbOrder.id,
            menu_item_id: null,
            item_name_snapshot: vi.name,
            unit_price_snapshot: vi.unitPrice,
            quantity: vi.quantity,
            total_price: vi.totalPrice,
            customizations_snapshot: vi.customizations,
            classification: vi.classification,
          }));

          await supabase.from("order_items").insert(orderItemsPayload);

          // Update table status in DB
          await supabase
            .from("restaurant_tables")
            .update({ status: "order_pending" })
            .eq("id", dbTable.id);
        }
      }
    } catch {
      // Supabase connection or table not yet migrated, fallback gracefully
      supabaseSaved = false;
    }

    return NextResponse.json({
      success: true,
      order: {
        id: newOrderId,
        orderNumber,
        tableCode: formattedCode,
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        items: validatedItems,
        subtotal: calculatedSubtotal,
        taxAmount,
        totalAmount,
        status: "new",
        paymentStatus: "unpaid",
        notes: notes || undefined,
        createdAt: "Just now",
        supabaseSaved,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

