import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MENU_ITEMS, DEMO_SETTINGS } from "@/lib/demo-data";
import { OrderCustomizationChoice, VegClassification } from "@/lib/types";
import { generateDiningSessionToken } from "@/lib/customer-session";

interface IncomingOrderItem {
  menuItemId: string;
  quantity: number;
  customizations?: OrderCustomizationChoice[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableCode, customerName, customerPhone, items, notes, diningSessionToken } = body;

    // 1. Mandatory Input Validation
    if (!tableCode) {
      return NextResponse.json({ error: "Table code is required." }, { status: 400 });
    }
    const formattedCode = tableCode.toString().padStart(2, "0");

    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json({ error: "Valid customer name (minimum 2 characters) is required." }, { status: 400 });
    }

    const cleanPhone = (customerPhone || "").toString().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: "A valid 10-digit Indian mobile number is required." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one menu item." }, { status: 400 });
    }

    // 2. Authoritative Server-side Price Calculation (Client prices discarded)
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
        return NextResponse.json(
          { error: `Item with id '${item.menuItemId}' does not exist in active menu catalog.` },
          { status: 400 }
        );
      }

      if (!catalogItem.isAvailable) {
        return NextResponse.json(
          { error: `'${catalogItem.name}' is currently unavailable.` },
          { status: 400 }
        );
      }

      const optionsDelta = (item.customizations || []).reduce(
        (sum, c) => sum + (Number(c.priceDelta) || 0),
        0
      );

      const serverUnitPrice = catalogItem.price + optionsDelta;
      const quantity = Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1)));
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

    // 3. Customer Session Isolation & Dining Session Management
    const cookieTokenName = `tbw_dining_token_${formattedCode}`;
    const providedSessionToken =
      diningSessionToken ||
      req.cookies.get(cookieTokenName)?.value ||
      req.headers.get("x-dining-session-token");

    let activeSessionCode = providedSessionToken;
    let isNewSession = false;
    let supabasePersisted = false;
    let newOrderId = `ord-${Date.now()}`;
    let diningSessionId: string | null = null;
    let persistenceDetails = "local_memory_fallback";

    try {
      const supabase = createAdminClient();

      // Check if table is valid and active in DB
      const { data: dbTable, error: tableErr } = await supabase
        .from("restaurant_tables")
        .select("id, is_active, restaurant_id")
        .eq("code", formattedCode)
        .maybeSingle();

      if (!tableErr && dbTable) {
        if (!dbTable.is_active) {
          return NextResponse.json(
            { error: `Table ${formattedCode} is currently inactive and cannot accept orders.` },
            { status: 403 }
          );
        }

        // Check for active dining session on this table
        const { data: existingSession } = await supabase
          .from("dining_sessions")
          .select("id, session_code, guest_name, guest_phone")
          .eq("table_id", dbTable.id)
          .eq("status", "active")
          .maybeSingle();

        if (existingSession) {
          // If active dining session exists, verify caller has matching session credential or matching identity
          const tokenMatches = providedSessionToken && existingSession.session_code === providedSessionToken;
          const identityMatches = existingSession.guest_phone === cleanPhone;

          if (!tokenMatches && !identityMatches) {
            return NextResponse.json(
              {
                error: `Table ${formattedCode} is occupied by an active dining session. Please request the current guest or staff to close previous bill.`,
                code: "TABLE_OCCUPIED",
              },
              { status: 409 }
            );
          }

          diningSessionId = existingSession.id;
          activeSessionCode = existingSession.session_code;
        } else {
          // No active session: initialize new isolated dining session with cryptographically secure token
          activeSessionCode = generateDiningSessionToken();
          isNewSession = true;

          // Register or retrieve customer
          const { data: customerRecord } = await supabase
            .from("customers")
            .upsert(
              { phone: cleanPhone, full_name: customerName.trim() },
              { onConflict: "phone" }
            )
            .select("id")
            .single();

          const { data: newSession, error: sessionErr } = await supabase
            .from("dining_sessions")
            .insert({
              restaurant_id: dbTable.restaurant_id,
              table_id: dbTable.id,
              customer_id: customerRecord?.id || null,
              session_code: activeSessionCode,
              guest_name: customerName.trim(),
              guest_phone: cleanPhone,
              status: "active",
            })
            .select("id")
            .single();

          if (!sessionErr && newSession) {
            diningSessionId = newSession.id;
          }
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
          supabasePersisted = true;
          persistenceDetails = "supabase_cloud_verified";

          // Insert order items snapshot
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
      supabasePersisted = false;
      persistenceDetails = "database_migrations_pending";
    }

    if (!activeSessionCode) {
      activeSessionCode = generateDiningSessionToken();
    }

    const response = NextResponse.json({
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
        notes: notes ? notes.trim() : undefined,
        createdAt: "Just now",
        supabasePersisted,
        persistenceDetails,
        diningSessionId,
      },
      diningSessionToken: activeSessionCode,
      isNewSession,
    });

    // Set secure cookie for dining session on this table
    response.cookies.set(cookieTokenName, activeSessionCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4, // 4 hours for active dining session
      path: `/t/${formattedCode}`,
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
