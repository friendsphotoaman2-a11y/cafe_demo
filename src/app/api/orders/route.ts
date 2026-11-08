import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MENU_ITEMS, DEMO_SETTINGS } from "@/lib/demo-data";
import { OrderCustomizationChoice, VegClassification } from "@/lib/types";
import {
  generateDiningSessionToken,
  COOKIE_CUSTOMER_DEVICE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  verifyCustomerDeviceSession,
  createAndStoreCustomerDeviceSession,
  RememberedCustomer,
} from "@/lib/customer-session";
import { requireStaffRole } from "@/lib/server-auth";

interface IncomingOrderItem {
  menuItemId: string;
  quantity: number;
  customizations?: OrderCustomizationChoice[];
}

// In-memory idempotency cache to prevent double-charges and duplicate orders on repeated clicks
interface IdempotentRecord {
  responsePayload: Record<string, unknown>;
  timestamp: number;
}
const idempotencyStore = new Map<string, IdempotentRecord>();

// Clean idempotency cache older than 5 minutes
function pruneIdempotencyCache() {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.timestamp > 5 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}

// =========================================================================
// GET: Fetch Table Session & Orders (for Customer) OR All Orders (for Staff)
// =========================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableCode = searchParams.get("tableCode");
    const supabase = createAdminClient();

    // 1. Check if caller is authenticated staff (Cashier / Kitchen / Owner / Manager)
    const staffCheck = await requireStaffRole(req, [
      "owner",
      "manager",
      "cashier",
      "kitchen",
    ]);

    if (staffCheck.authorized) {
      // Staff view: return all recent orders across tables
      const { data: dbOrders, error: staffOrdersErr } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          table_id,
          dining_session_id,
          status,
          payment_status,
          notes,
          subtotal,
          tax_amount,
          total_amount,
          created_at,
          restaurant_tables ( code, name ),
          dining_sessions ( guest_name, guest_phone, status ),
          order_items (
            id,
            item_name_snapshot,
            unit_price_snapshot,
            quantity,
            total_price,
            customizations_snapshot,
            classification
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (staffOrdersErr) {
        return NextResponse.json({ error: staffOrdersErr.message }, { status: 500 });
      }

      const formattedOrders = (dbOrders || []).map((ord) => {
        const tableRecord = Array.isArray(ord.restaurant_tables)
          ? ord.restaurant_tables[0]
          : ord.restaurant_tables;
        const sessionRecord = Array.isArray(ord.dining_sessions)
          ? ord.dining_sessions[0]
          : ord.dining_sessions;

        return {
          id: ord.id,
          orderNumber: ord.order_number,
          tableCode: tableRecord?.code || "01",
          customerName: sessionRecord?.guest_name || "Guest",
          customerPhone: sessionRecord?.guest_phone || "",
          diningSessionId: ord.dining_session_id,
          subtotal: Number(ord.subtotal) || 0,
          taxAmount: Number(ord.tax_amount) || 0,
          totalAmount: Number(ord.total_amount) || 0,
          status: ord.status,
          paymentStatus: ord.payment_status,
          notes: ord.notes || undefined,
          createdAt: new Date(ord.created_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          timestamp: new Date(ord.created_at).getTime(),
          items: (ord.order_items || []).map((it) => ({
            name: it.item_name_snapshot,
            quantity: it.quantity,
            unitPrice: Number(it.unit_price_snapshot) || 0,
            totalPrice: Number(it.total_price) || 0,
            customizations: it.customizations_snapshot || [],
            classification: it.classification || "veg",
          })),
        };
      });

      return NextResponse.json({
        success: true,
        isStaff: true,
        orders: formattedOrders,
      });
    }

    // 2. Customer view: requires tableCode
    if (!tableCode) {
      return NextResponse.json(
        { error: "tableCode query parameter is required." },
        { status: 400 }
      );
    }
    const formattedCode = tableCode.padStart(2, "0");

    // Check for persistent remembered customer device cookie across ALL tables
    const rawDeviceToken =
      req.cookies.get(COOKIE_CUSTOMER_DEVICE)?.value ||
      req.headers.get("x-customer-device-token");

    let rememberedCustomer: RememberedCustomer | null = null;
    if (rawDeviceToken) {
      const devCheck = await verifyCustomerDeviceSession(supabase, rawDeviceToken);
      if (devCheck.valid && devCheck.customer) {
        rememberedCustomer = devCheck.customer;
      }
    }

    const cookieTokenName = `tbw_dining_token_${formattedCode}`;
    const providedSessionToken =
      searchParams.get("token") ||
      req.cookies.get(cookieTokenName)?.value ||
      req.headers.get("x-dining-session-token");

    // Look up table in DB
    const { data: dbTable, error: tableErr } = await supabase
      .from("restaurant_tables")
      .select("id, code, name, is_active, status")
      .eq("code", formattedCode)
      .maybeSingle();

    if (tableErr || !dbTable) {
      return NextResponse.json({ error: "Table not found." }, { status: 404 });
    }

    // Check if table currently has an active dining session
    const { data: tableActiveSession } = await supabase
      .from("dining_sessions")
      .select("id, session_code, customer_id, guest_name, guest_phone, status, opened_at")
      .eq("table_id", dbTable.id)
      .eq("status", "active")
      .maybeSingle();

    let matchedSession = null;

    if (providedSessionToken) {
      // Direct lookup by provided dining session token
      const { data: tokenSession } = await supabase
        .from("dining_sessions")
        .select("id, session_code, customer_id, guest_name, guest_phone, status, opened_at, closed_at")
        .eq("table_id", dbTable.id)
        .eq("session_code", providedSessionToken)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      matchedSession = tokenSession;
    } else if (tableActiveSession && rememberedCustomer) {
      // If no table-scoped token passed, but this device belongs to the active session guest on this table
      if (
        tableActiveSession.customer_id === rememberedCustomer.id ||
        tableActiveSession.guest_phone === rememberedCustomer.phone
      ) {
        matchedSession = tableActiveSession;
      }
    }

    // If no active dining session on this table (e.g. customer moved to a new table like Table 07)
    if (!matchedSession) {
      const isOccupiedByOther = !!tableActiveSession && (!rememberedCustomer || tableActiveSession.customer_id !== rememberedCustomer.id);

      return NextResponse.json({
        success: true,
        hasActiveSession: false,
        isOccupied: isOccupiedByOther,
        requiresToken: isOccupiedByOther,
        rememberedCustomer: rememberedCustomer || undefined,
        table: {
          code: dbTable.code,
          name: dbTable.name,
          status: dbTable.status,
        },
        orders: [],
        sessionBill: null,
      });
    }

    // Fetch all orders for this matched dining session
    const { data: sessionOrders } = await supabase
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
          item_name_snapshot,
          unit_price_snapshot,
          quantity,
          total_price,
          customizations_snapshot,
          classification
        )
      `)
      .eq("dining_session_id", matchedSession.id)
      .order("created_at", { ascending: true });

    // Check for bills & payments if settled
    let billAudit: Record<string, unknown> | null = null;
    let paymentMethod: string | null = null;
    const { data: dbBill } = await supabase
      .from("bills")
      .select("id, bill_number, total_payable, status, paid_at, payments ( payment_method, cashier_name, status )")
      .eq("dining_session_id", matchedSession.id)
      .maybeSingle();

    if (dbBill && dbBill.status === "paid") {
      const paymentRec = Array.isArray(dbBill.payments) ? dbBill.payments[0] : dbBill.payments;
      paymentMethod = paymentRec?.payment_method || "Counter Settle";
      billAudit = {
        cashierName: paymentRec?.cashier_name || "Head Cashier",
        paidAt: dbBill.paid_at ? new Date(dbBill.paid_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Recently",
      };
    }

    // Authoritative session bill calculation
    let sessionSubtotal = 0;
    const itemMap = new Map<string, {
      key: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      customizations: OrderCustomizationChoice[];
    }>();

    const formattedCustomerOrders = (sessionOrders || []).map((ord) => {
      const sub = Number(ord.subtotal) || 0;
      sessionSubtotal += sub;

      const items = (ord.order_items || []).map((it) => {
        const customizations = (it.customizations_snapshot || []) as OrderCustomizationChoice[];
        const custKey = customizations.map((c) => c.optionName).sort().join("|");
        const mapKey = `${it.item_name_snapshot}__${custKey}`;

        if (itemMap.has(mapKey)) {
          const ex = itemMap.get(mapKey)!;
          ex.quantity += it.quantity;
          ex.totalPrice += Number(it.total_price) || 0;
        } else {
          itemMap.set(mapKey, {
            key: mapKey,
            name: it.item_name_snapshot,
            quantity: it.quantity,
            unitPrice: Number(it.unit_price_snapshot) || 0,
            totalPrice: Number(it.total_price) || 0,
            customizations,
          });
        }

        return {
          name: it.item_name_snapshot,
          quantity: it.quantity,
          unitPrice: Number(it.unit_price_snapshot) || 0,
          totalPrice: Number(it.total_price) || 0,
          customizations,
          classification: it.classification || "veg",
        };
      });

      return {
        id: ord.id,
        orderNumber: ord.order_number,
        tableCode: formattedCode,
        customerName: matchedSession.guest_name,
        customerPhone: matchedSession.guest_phone,
        subtotal: sub,
        taxAmount: Number(ord.tax_amount) || 0,
        totalAmount: Number(ord.total_amount) || 0,
        status: ord.status,
        paymentStatus: ord.payment_status,
        notes: ord.notes || undefined,
        createdAt: new Date(ord.created_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: new Date(ord.created_at).getTime(),
        items,
      };
    });

    const taxPercent = DEMO_SETTINGS.gstRatePercent;
    const taxAmount = Math.round(sessionSubtotal * taxPercent) / 100;
    const totalAmount = sessionSubtotal + taxAmount;
    const isPaid = matchedSession.status === "closed" || (dbBill && dbBill.status === "paid");

    const sessionBill = {
      tableCode: formattedCode,
      tableName: dbTable.name,
      customerName: matchedSession.guest_name,
      customerPhone: matchedSession.guest_phone,
      orderNumbers: formattedCustomerOrders.map((o) => o.orderNumber),
      orderIds: formattedCustomerOrders.map((o) => o.id),
      consolidatedItems: Array.from(itemMap.values()),
      subtotal: sessionSubtotal,
      taxPercent,
      taxAmount,
      totalAmount,
      isAllServed: formattedCustomerOrders.every((o) => o.status === "served" || o.status === "completed"),
      isPaid: !!isPaid,
      paymentMethod: paymentMethod || undefined,
      paymentAudit: billAudit || undefined,
    };

    return NextResponse.json({
      success: true,
      rememberedCustomer: rememberedCustomer || undefined,
      session: {
        id: matchedSession.id,
        sessionCode: matchedSession.session_code,
        guestName: matchedSession.guest_name,
        guestPhone: matchedSession.guest_phone,
        status: matchedSession.status,
      },
      orders: formattedCustomerOrders,
      sessionBill,
      isPaid: !!isPaid,
      isClosed: matchedSession.status === "closed",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// =========================================================================
// POST: Submit a New Order (Round 1 or Additional Rounds in Active Session)
// =========================================================================
export async function POST(req: NextRequest) {
  try {
    pruneIdempotencyCache();

    const body = await req.json();
    const {
      tableCode,
      customerName,
      customerPhone,
      items,
      notes,
      diningSessionToken,
      idempotencyKey,
    } = body;

    // Check idempotency cache to prevent double-charges and duplicate orders on repeated clicks
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      return NextResponse.json(cached.responsePayload);
    }

    // 1. Mandatory Input Validation
    if (!tableCode) {
      return NextResponse.json({ error: "Table code is required." }, { status: 400 });
    }
    const formattedCode = tableCode.toString().padStart(2, "0");

    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json(
        { error: "Valid customer name (minimum 2 characters) is required." },
        { status: 400 }
      );
    }

    const cleanPhone = (customerPhone || "").toString().replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      return NextResponse.json(
        { error: "A valid 10-digit Indian mobile number is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Order must contain at least one menu item." },
        { status: 400 }
      );
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

    // Decimal-safe calculations (rounded to 2 decimal places)
    const taxPercent = DEMO_SETTINGS.gstRatePercent; // 5%
    const taxAmount = Math.round(calculatedSubtotal * taxPercent) / 100;
    const totalAmount = Math.round((calculatedSubtotal + taxAmount) * 100) / 100;
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
    let newDeviceTokenToSet: string | null = null;

    // Track session running totals
    let previousSessionSubtotal = 0;
    let combinedSessionSubtotal = calculatedSubtotal;
    let combinedSessionTax = taxAmount;
    let combinedSessionTotal = totalAmount;
    const sessionOrderNumbers: string[] = [orderNumber];

    try {
      const supabase = createAdminClient();

      // Check if table is valid and active in DB
      const { data: dbTable, error: tableErr } = await supabase
        .from("restaurant_tables")
        .select("id, is_active, restaurant_id, name")
        .eq("code", formattedCode)
        .maybeSingle();

      if (!tableErr && dbTable) {
        if (!dbTable.is_active) {
          return NextResponse.json(
            { error: `Table ${formattedCode} is currently inactive and cannot accept orders.` },
            { status: 403 }
          );
        }

        // Verify or issue persistent customer device token
        const rawDeviceToken =
          req.cookies.get(COOKIE_CUSTOMER_DEVICE)?.value ||
          req.headers.get("x-customer-device-token");

        let customerId: string | null = null;
        let hasValidDeviceSession = false;
        if (rawDeviceToken) {
          const devCheck = await verifyCustomerDeviceSession(supabase, rawDeviceToken);
          if (devCheck.valid && devCheck.customer) {
            customerId = devCheck.customer.id;
            hasValidDeviceSession = true;
          }
        }

        // Upsert customer profile
        const { data: customerRecord } = await supabase
          .from("customers")
          .upsert(
            { phone: cleanPhone, full_name: customerName.trim() },
            { onConflict: "phone" }
          )
          .select("id")
          .single();

        if (customerRecord) {
          if (customerId !== customerRecord.id) {
            hasValidDeviceSession = false;
          }
          customerId = customerRecord.id;
        }

        // Issue 90-day device token if none exists or previous was invalid
        if (!hasValidDeviceSession && customerId) {
          newDeviceTokenToSet = await createAndStoreCustomerDeviceSession(
            supabase,
            customerId
          );
        }

        // Check for active dining session on this table
        const { data: existingSession } = await supabase
          .from("dining_sessions")
          .select("id, session_code, customer_id, guest_name, guest_phone, status")
          .eq("table_id", dbTable.id)
          .eq("status", "active")
          .maybeSingle();

        if (existingSession) {
          // If active dining session exists, verify caller has matching cryptographic session token or matches customer profile
          const tokenMatches =
            providedSessionToken && existingSession.session_code === providedSessionToken;
          const customerMatches =
            customerId && existingSession.customer_id === customerId;

          if (!tokenMatches && !customerMatches) {
            return NextResponse.json(
              {
                error: `Table ${formattedCode} is occupied by an active dining session. Please request staff to close previous bill.`,
                code: "TABLE_OCCUPIED",
              },
              { status: 409 }
            );
          }

          diningSessionId = existingSession.id;
          activeSessionCode = existingSession.session_code;
        } else {
          // No active session: check if client is attempting to place order with an already closed session token
          if (providedSessionToken) {
            const { data: closedSession } = await supabase
              .from("dining_sessions")
              .select("id, status")
              .eq("table_id", dbTable.id)
              .eq("session_code", providedSessionToken)
              .eq("status", "closed")
              .maybeSingle();

            if (closedSession) {
              return NextResponse.json(
                {
                  error: "This dining session has already been settled and closed. Please scan table QR to start a fresh dining session.",
                  code: "SESSION_CLOSED",
                },
                { status: 403 }
              );
            }
          }

          // No active session and not closed: initialize a new isolated dining session with cryptographically secure token
          activeSessionCode = generateDiningSessionToken();
          isNewSession = true;

          const { data: newSession, error: sessionErr } = await supabase
            .from("dining_sessions")
            .insert({
              restaurant_id: dbTable.restaurant_id,
              table_id: dbTable.id,
              customer_id: customerId,
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

          // Query all orders in this session to compute the authoritative cumulative running bill
          if (diningSessionId) {
            const { data: allSessionOrders } = await supabase
              .from("orders")
              .select("id, order_number, subtotal, tax_amount, total_amount, payment_status")
              .eq("dining_session_id", diningSessionId);

            if (allSessionOrders && allSessionOrders.length > 0) {
              const previousOrders = allSessionOrders.filter((o) => o.id !== dbOrder.id);
              previousSessionSubtotal = previousOrders.reduce(
                (sum, o) => sum + (Number(o.subtotal) || 0),
                0
              );
              combinedSessionSubtotal = allSessionOrders.reduce(
                (sum, o) => sum + (Number(o.subtotal) || 0),
                0
              );
              combinedSessionTax = Math.round(combinedSessionSubtotal * taxPercent) / 100;
              combinedSessionTotal = Math.round((combinedSessionSubtotal + combinedSessionTax) * 100) / 100;
              sessionOrderNumbers.length = 0;
              allSessionOrders.forEach((o) => sessionOrderNumbers.push(o.order_number));
            }
          }
        }
      }
    } catch {
      supabasePersisted = false;
      persistenceDetails = "database_migrations_pending";
    }

    if (!activeSessionCode) {
      activeSessionCode = generateDiningSessionToken();
    }

    // Consolidated Running Bill structure returned directly from authoritative server calculation
    const sessionBillPayload = {
      tableCode: formattedCode,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      orderNumbers: sessionOrderNumbers,
      previousSubtotal: previousSessionSubtotal,
      newSubtotal: calculatedSubtotal,
      subtotal: combinedSessionSubtotal,
      taxPercent,
      taxAmount: combinedSessionTax,
      totalAmount: combinedSessionTotal,
      isPaid: false,
    };

    const responsePayload = {
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
      sessionBill: sessionBillPayload,
      diningSessionToken: activeSessionCode,
      isNewSession,
    };

    // Cache in idempotency store if key was provided
    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        responsePayload,
        timestamp: Date.now(),
      });
    }

    const response = NextResponse.json(responsePayload);

    // 1. Set secure cookie for dining session on this table
    response.cookies.set(cookieTokenName, activeSessionCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4, // 4 hours for active dining session
      path: `/t/${formattedCode}`,
    });

    // 2. Set persistent 90-day customer device session cookie with path="/" across ALL tables
    if (newDeviceTokenToSet) {
      response.cookies.set(COOKIE_CUSTOMER_DEVICE, newDeviceTokenToSet, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
        path: "/",
      });
    }

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// =========================================================================
// DELETE: Void / Delete an Order (for Mistake Orders) from DB & Supabase
// =========================================================================
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 }
      );
    }

    // 1. Authorize: Staff Role required (Owner, Manager, Cashier, Kitchen)
    const staffCheck = await requireStaffRole(req, [
      "owner",
      "manager",
      "cashier",
      "kitchen",
    ]);

    if (!staffCheck.authorized) {
      return NextResponse.json(
        { error: "Unauthorized. Staff authorization required to delete an order." },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // 2. Locate the order in Supabase by UUID or order_number
    let { data: orderRecord } = await supabase
      .from("orders")
      .select("id, order_number, table_id, dining_session_id, total_amount, restaurant_tables ( code )")
      .eq("id", orderId)
      .maybeSingle();

    if (!orderRecord) {
      // Try searching by order_number (e.g. "TBW-1234" or "#TBW-1234")
      const cleanNumber = orderId.replace(/^#/, "");
      const res = await supabase
        .from("orders")
        .select("id, order_number, table_id, dining_session_id, total_amount, restaurant_tables ( code )")
        .eq("order_number", cleanNumber)
        .maybeSingle();
      orderRecord = res.data;
    }

    if (!orderRecord) {
      // Order might already be deleted or not in remote DB
      return NextResponse.json({
        success: true,
        message: "Order record removed.",
        deletedOrderId: orderId,
      });
    }

    const tableId = orderRecord.table_id;
    const diningSessionId = orderRecord.dining_session_id;

    // 3. Delete order items first (explicitly to ensure no foreign key issues)
    await supabase.from("order_items").delete().eq("order_id", orderRecord.id);

    // 4. Delete the order record itself
    const { error: deleteErr } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderRecord.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 5. Check if any remaining active (unpaid) orders exist on this table
    if (tableId) {
      const { data: remainingOrders } = await supabase
        .from("orders")
        .select("id, status, payment_status")
        .eq("table_id", tableId)
        .neq("payment_status", "paid_counter");

      if (!remainingOrders || remainingOrders.length === 0) {
        // No remaining active orders on this table!
        // Reset table status to 'available'
        await supabase
          .from("restaurant_tables")
          .update({ status: "available" })
          .eq("id", tableId);

        // Complete/close the dining session if exists
        if (diningSessionId) {
          await supabase
            .from("dining_sessions")
            .update({ status: "completed" })
            .eq("id", diningSessionId);
        }
      } else {
        // If remaining orders exist, check if any is 'preparing'
        const hasPreparing = remainingOrders.some((o) => o.status === "preparing");
        const nextTableStatus = hasPreparing ? "preparing" : "occupied";
        await supabase
          .from("restaurant_tables")
          .update({ status: nextTableStatus })
          .eq("id", tableId);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order #${orderRecord.order_number} was permanently deleted from the database.`,
      deletedOrderId: orderRecord.id,
      orderNumber: orderRecord.order_number,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
