"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CafeOrder,
  CafeTable,
  CafeCustomer,
  OrderStatus,
  PaymentMethod,
  OrderCustomizationChoice,
  VegClassification,
  TableSessionBill,
  TableSection,
} from "./types";
import {
  DEMO_TABLES,
  DEMO_SETTINGS,
} from "./demo-data";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY_ORDERS = "tbw_cafe_orders_v4";
const STORAGE_KEY_TABLES = "tbw_cafe_tables_v4";
const STORAGE_KEY_CUSTOMERS = "tbw_cafe_customers_v4";
const STORAGE_KEY_SESSION = "tbw_cafe_customer_session_v4";

if (typeof window !== "undefined") {
  // Purge any legacy demo storage keys to ensure a clean operational slate
  [
    "tbw_cafe_orders_v1", "tbw_cafe_orders_v2", "tbw_cafe_orders_v3",
    "tbw_cafe_tables_v1", "tbw_cafe_tables_v2", "tbw_cafe_tables_v3",
    "tbw_cafe_customers_v1", "tbw_cafe_customers_v2", "tbw_cafe_customers_v3"
  ].forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
}

export interface CustomerSession {
  name: string;
  phone: string;
}

function getStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to parse ${key} from localStorage`, err);
    return fallback;
  }
}

function setStoredJson<T>(key: string, value: T, silent = false): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (!silent) {
      window.dispatchEvent(new Event("tbw-cafe-store-updated"));
    }
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage`, err);
  }
}

export function useCafeStore() {
  const [orders, setOrders] = useState<CafeOrder[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [customers, setCustomers] = useState<CafeCustomer[]>([]);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const loadAll = useCallback(() => {
    const loadedOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      []
    );
    const loadedTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const loadedCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      []
    );
    const loadedSession = getStoredJson<CustomerSession | null>(
      STORAGE_KEY_SESSION,
      null
    );

    // Clean any zombie table states that have no active unpaid orders
    const unpaidCodesInLoaded = new Set(
      loadedOrders
        .filter(
          (o) =>
            o.paymentStatus !== "paid_counter" &&
            o.status !== "cancelled" &&
            o.status !== "completed"
        )
        .map((o) => o.tableCode)
    );
    const cleanedLoadedTables = loadedTables.map((t) => {
      if (!unpaidCodesInLoaded.has(t.code) && t.status !== "available") {
        return {
          ...t,
          status: "available" as const,
          currentCustomerName: undefined,
          currentCustomerPhone: undefined,
          currentOrderId: undefined,
        };
      }
      return t;
    });

    setOrders(loadedOrders);
    setTables(cleanedLoadedTables);
    setCustomers(loadedCustomers);
    setSession(loadedSession);
    setIsLoaded(true);

    // If staff session active, cross-sync latest orders directly from server/Supabase
    if (typeof window !== "undefined") {
      fetch("/api/orders")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.success && Array.isArray(data.orders)) {
            setOrders(data.orders);
            setStoredJson(STORAGE_KEY_ORDERS, data.orders, true);

            const serverUnpaidCodes = new Set(
              data.orders
                .filter(
                  (o: CafeOrder) =>
                    o.paymentStatus !== "paid_counter" &&
                    o.status !== "cancelled" &&
                    o.status !== "completed"
                )
                .map((o: CafeOrder) => o.tableCode)
            );

            const serverReconciledTables = cleanedLoadedTables.map((t) => {
              if (!serverUnpaidCodes.has(t.code) && t.status !== "available") {
                return {
                  ...t,
                  status: "available" as const,
                  currentCustomerName: undefined,
                  currentCustomerPhone: undefined,
                  currentOrderId: undefined,
                };
              }
              return t;
            });
            setTables(serverReconciledTables);
            setStoredJson(STORAGE_KEY_TABLES, serverReconciledTables, true);
          }
        })
        .catch(() => {});
    }
  }, []);

  // 1. Local Same-Origin Sync
  useEffect(() => {
    loadAll();

    const handleSync = () => {
      loadAll();
    };

    window.addEventListener("storage", handleSync);
    window.addEventListener("tbw-cafe-store-updated", handleSync);

    return () => {
      window.removeEventListener("storage", handleSync);
      window.removeEventListener("tbw-cafe-store-updated", handleSync);
    };
  }, [loadAll]);

  // 2. Cross-Device Supabase Realtime Subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel("tbw-cafe-cross-device-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            console.log("[Supabase Realtime] Order event received:", payload);
            loadAll();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "restaurant_tables" },
          (payload) => {
            console.log("[Supabase Realtime] Table event received:", payload);
            loadAll();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsRealtimeConnected(true);
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            setIsRealtimeConnected(false);
          }
        });
    } catch (err) {
      console.warn("Supabase Realtime subscription not active in current environment.", err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, loadAll]);

  // --- TABLE CRUD OPERATIONS ---
  const addTable = (tableData: {
    code: string;
    name: string;
    capacity: number;
    section: TableSection;
  }): { success: boolean; error?: string } => {
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const formattedCode = tableData.code.trim().padStart(2, "0");

    if (currentTables.some((t) => t.code === formattedCode)) {
      return { success: false, error: `Table code "${formattedCode}" already exists.` };
    }

    const newTable: CafeTable = {
      id: `t-${formattedCode}-${Date.now().toString(36)}`,
      code: formattedCode,
      name: tableData.name.trim() || `Table ${formattedCode}`,
      capacity: tableData.capacity || 2,
      section: tableData.section || "Indoor Main",
      status: "available",
      isActive: true,
    };

    setStoredJson(STORAGE_KEY_TABLES, [...currentTables, newTable]);
    loadAll();
    return { success: true };
  };

  const updateTable = (
    id: string,
    updates: {
      name?: string;
      capacity?: number;
      section?: TableSection;
    }
  ) => {
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const updated = currentTables.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    setStoredJson(STORAGE_KEY_TABLES, updated);
    loadAll();
  };

  const toggleTableActive = (id: string) => {
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const updated = currentTables.map((t) =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    setStoredJson(STORAGE_KEY_TABLES, updated);
    loadAll();
  };

  const regenerateTableQr = (code: string): string => {
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const newNonce = `sec_${Math.random().toString(36).substring(2, 8)}`;
    const updated = currentTables.map((t) =>
      t.code === code ? { ...t, qrNonce: newNonce } : t
    );
    setStoredJson(STORAGE_KEY_TABLES, updated);
    loadAll();
    return newNonce;
  };

  // --- ORDER PLACEMENT (Sends to Server & Stores in State) ---
  const placeOrder = async (params: {
    tableCode: string;
    customerName: string;
    customerPhone: string;
    items: {
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      customizations: OrderCustomizationChoice[];
      classification: VegClassification;
    }[];
    notes?: string;
    idempotencyKey?: string;
  }): Promise<CafeOrder & { order: CafeOrder; sessionBill: TableSessionBill | null; diningSessionToken?: string }> => {
    const formattedCode = params.tableCode.padStart(2, "0");
    const storedDiningToken = typeof window !== "undefined"
      ? localStorage.getItem(`tbw_dining_token_${formattedCode}`)
      : null;

    let serverOrder: CafeOrder | null = null;
    let serverSessionBill: TableSessionBill | null = null;
    let activeToken: string | undefined = storedDiningToken || undefined;

    // 1. Call server API route for authoritative processing
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(storedDiningToken ? { "x-dining-session-token": storedDiningToken } : {}),
      },
      body: JSON.stringify({
        ...params,
        tableCode: formattedCode,
        diningSessionToken: storedDiningToken,
        idempotencyKey: params.idempotencyKey,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Failed to place order for Table ${formattedCode}.`);
    }

    if (data.success && data.order) {
      serverOrder = {
        id: data.order.id,
        orderNumber: data.order.orderNumber,
        tableCode: data.order.tableCode,
        customerName: data.order.customerName,
        customerPhone: data.order.customerPhone,
        items: data.order.items,
        subtotal: data.order.subtotal,
        taxAmount: data.order.taxAmount,
        totalAmount: data.order.totalAmount,
        status: data.order.status || "new",
        paymentStatus: data.order.paymentStatus || "unpaid",
        notes: data.order.notes,
        createdAt: data.order.createdAt || "Just now",
        timestamp: Date.now(),
        estimatedPrepMinutes: 12,
      };

      if (data.sessionBill) {
        serverSessionBill = data.sessionBill;
      }

      if (data.diningSessionToken) {
        activeToken = data.diningSessionToken;
        if (typeof window !== "undefined") {
          localStorage.setItem(`tbw_dining_token_${formattedCode}`, data.diningSessionToken);
        }
      }
    }

    // 2. Synchronize store state
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      []
    );
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const currentCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      []
    );

    const subtotal = params.items.reduce((acc, i) => acc + i.totalPrice, 0);
    const taxRate = DEMO_SETTINGS.gstRatePercent / 100;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalAmount = subtotal + taxAmount;
    const generatedOrderNumber = `#TBW-${Math.floor(1040 + currentOrders.length + 1)}`;
    const newOrderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    const newOrder: CafeOrder = serverOrder || {
      id: newOrderId,
      orderNumber: generatedOrderNumber,
      tableCode: formattedCode,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      items: params.items,
      subtotal,
      taxAmount,
      totalAmount,
      status: "new",
      paymentStatus: "unpaid",
      notes: params.notes,
      createdAt: "Just now",
      timestamp: Date.now(),
      estimatedPrepMinutes: 12,
    };

    setStoredJson(STORAGE_KEY_ORDERS, [newOrder, ...currentOrders.filter((o) => o.id !== newOrder.id)]);

    const updatedTables = currentTables.map((t) => {
      if (t.code === formattedCode) {
        return {
          ...t,
          status: "order_pending" as const,
          currentCustomerName: params.customerName,
          currentCustomerPhone: params.customerPhone,
          currentOrderId: newOrder.id,
          lastActiveTime: "Just now",
        };
      }
      return t;
    });
    setStoredJson(STORAGE_KEY_TABLES, updatedTables);

    const cleanPhone = params.customerPhone.replace(/\D/g, "");
    const existingIndex = currentCustomers.findIndex(
      (c) => c.phone.replace(/\D/g, "") === cleanPhone
    );
    const updatedCustomers = [...currentCustomers];
    if (existingIndex > -1) {
      updatedCustomers[existingIndex] = {
        ...updatedCustomers[existingIndex],
        lastVisit: `Today (Table ${params.tableCode})`,
      };
    } else {
      updatedCustomers.push({
        id: `cust-${Date.now()}`,
        name: params.customerName,
        phone: params.customerPhone,
        visitsCount: 1,
        totalSpent: 0,
        stampsEarned: 1,
        rewardEligible: false,
        lastVisit: `Today (Table ${params.tableCode})`,
        favoriteItem: params.items[0]?.name || "Specialty Coffee",
      });
    }
    setStoredJson(STORAGE_KEY_CUSTOMERS, updatedCustomers);

    setStoredJson(STORAGE_KEY_SESSION, {
      name: params.customerName,
      phone: params.customerPhone,
    });

    loadAll();

    return Object.assign(newOrder, {
      order: newOrder,
      sessionBill: serverSessionBill,
      diningSessionToken: activeToken,
    });
  };

  // --- KITCHEN STATUS PROGRESSION ---
  const updateOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    expectedPreviousStatus?: OrderStatus
  ) => {
    // 1. Authoritative Server Mutation with State Machine Guard
    try {
      const res = await fetch("/api/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, nextStatus, expectedPreviousStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn("Status update rejected by server:", data.error);
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.warn("Server API status broadcast:", err);
    }

    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      []
    );
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );

    let targetTableCode: string | null = null;
    const updatedOrders = currentOrders.map((o) => {
      if (o.id === orderId) {
        targetTableCode = o.tableCode;
        return { ...o, status: nextStatus };
      }
      return o;
    });
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders, true);

    if (targetTableCode) {
      const updatedTables = currentTables.map((t) => {
        if (t.code === targetTableCode) {
          if (nextStatus === "preparing") {
            return { ...t, status: "preparing" as const };
          }
          if (nextStatus === "ready" || nextStatus === "served") {
            return { ...t, status: "occupied" as const };
          }
        }
        return t;
      });
      setStoredJson(STORAGE_KEY_TABLES, updatedTables, true);
    }

    loadAll();
    return { success: true };
  };

  // --- CONSOLIDATED BILL CALCULATION ---
  const getTableSessionBill = useCallback(
    (tableCode: string): TableSessionBill | null => {
      const currentOrders = getStoredJson<CafeOrder[]>(
        STORAGE_KEY_ORDERS,
        []
      );
      const currentTables = getStoredJson<CafeTable[]>(
        STORAGE_KEY_TABLES,
        DEMO_TABLES
      );

      const table = currentTables.find((t) => t.code === tableCode);
      const formattedCode = tableCode.padStart(2, "0");

      const tableOrders = currentOrders.filter((o) => o.tableCode === formattedCode);

      if (tableOrders.length === 0) {
        return null;
      }

      const unpaidOrders = tableOrders.filter((o) => o.paymentStatus === "unpaid");
      const targetOrders = unpaidOrders.length > 0 ? unpaidOrders : tableOrders;

      const itemMap = new Map<
        string,
        {
          key: string;
          name: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          customizations: OrderCustomizationChoice[];
        }
      >();

      let subtotal = 0;
      targetOrders.forEach((ord) => {
        ord.items.forEach((item) => {
          const custKey = item.customizations
            .map((c) => c.optionName)
            .sort()
            .join("|");
          const mapKey = `${item.menuItemId}__${custKey}`;

          if (itemMap.has(mapKey)) {
            const existing = itemMap.get(mapKey)!;
            existing.quantity += item.quantity;
            existing.totalPrice += item.totalPrice;
          } else {
            itemMap.set(mapKey, {
              key: mapKey,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              customizations: item.customizations,
            });
          }
          subtotal += item.totalPrice;
        });
      });

      const taxPercent = DEMO_SETTINGS.gstRatePercent;
      const taxAmount = (subtotal * taxPercent) / 100;
      const totalAmount = subtotal + taxAmount;

      const isAllServed = targetOrders.every(
        (o) => o.status === "served" || o.status === "completed"
      );
      const isPaid = targetOrders.every((o) => o.paymentStatus === "paid_counter");

      const primaryOrder = targetOrders[0];

      return {
        tableCode: formattedCode,
        tableName: table ? table.name : `Table ${formattedCode}`,
        customerName: primaryOrder.customerName || table?.currentCustomerName || "Guest",
        customerPhone: primaryOrder.customerPhone || table?.currentCustomerPhone || "",
        orderNumbers: targetOrders.map((o) => o.orderNumber),
        orderIds: targetOrders.map((o) => o.id),
        consolidatedItems: Array.from(itemMap.values()),
        subtotal,
        taxPercent,
        taxAmount,
        totalAmount,
        isAllServed,
        isPaid,
        paymentMethod: primaryOrder.paymentMethod,
        paymentAudit: primaryOrder.paymentAudit,
      };
    },
    []
  );

  // --- CASHIER COUNTER PAYMENT CONFIRMATION ---
  const settleTableBill = async (params: {
    tableCode: string;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    cashierName: string;
    amountPaid?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    const formattedCode = params.tableCode.padStart(2, "0");

    // Authoritative Server Settlement Call
    try {
      const res = await fetch("/api/cashier/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode: formattedCode,
          paymentMethod: params.paymentMethod,
          transactionRef: params.transactionRef,
          cashierName: params.cashierName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Server rejected bill settlement." };
      }
    } catch (err: unknown) {
      console.warn("Server settle call:", err);
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(`tbw_dining_token_${formattedCode}`);
    }

    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      []
    );
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const currentCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      []
    );

    const unpaidTableOrders = currentOrders.filter(
      (o) => o.tableCode === formattedCode && o.paymentStatus === "unpaid"
    );

    if (unpaidTableOrders.length === 0) {
      return { success: false, error: "No unpaid orders found for this table." };
    }

    const totalBillAmount = unpaidTableOrders.reduce(
      (acc, o) => acc + o.totalAmount,
      0
    );

    const auditRecord = {
      amount: params.amountPaid || totalBillAmount,
      method: params.paymentMethod,
      transactionRef: params.transactionRef || undefined,
      cashierName: params.cashierName || "Head Cashier",
      paidAt: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updatedOrders = currentOrders.map((o) => {
      if (o.tableCode === formattedCode && o.paymentStatus === "unpaid") {
        return {
          ...o,
          paymentStatus: "paid_counter" as const,
          paymentMethod: params.paymentMethod,
          paymentAudit: auditRecord,
          status: "completed" as const,
        };
      }
      return o;
    });
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);

    const updatedTables = currentTables.map((t) => {
      if (t.code === formattedCode) {
        return {
          ...t,
          status: "available" as const,
          currentCustomerName: undefined,
          currentCustomerPhone: undefined,
          currentOrderId: undefined,
          lastActiveTime: "Bill settled at counter",
        };
      }
      return t;
    });
    setStoredJson(STORAGE_KEY_TABLES, updatedTables);

    const customerPhone = unpaidTableOrders[0].customerPhone.replace(/\D/g, "");
    if (customerPhone) {
      const updatedCustomers = currentCustomers.map((c) => {
        if (c.phone.replace(/\D/g, "") === customerPhone) {
          const nextStamps = c.stampsEarned >= 5 ? 5 : c.stampsEarned + 1;
          return {
            ...c,
            visitsCount: c.visitsCount + 1,
            totalSpent: c.totalSpent + totalBillAmount,
            stampsEarned: nextStamps,
            rewardEligible: nextStamps >= 5,
            lastVisit: "Today (Settled)",
          };
        }
        return c;
      });
      setStoredJson(STORAGE_KEY_CUSTOMERS, updatedCustomers);
    }

    loadAll();
    return { success: true };
  };

  const voidPaymentCorrection = (
    orderId: string,
    reason: string
  ): { success: boolean } => {
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      []
    );
    const updatedOrders = currentOrders.map((o) => {
      if (o.id === orderId) {
        return {
          ...o,
          paymentStatus: "unpaid" as const,
          paymentMethod: undefined,
          paymentAudit: o.paymentAudit
            ? { ...o.paymentAudit, correctionReason: reason }
            : undefined,
        };
      }
      return o;
    });
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);
    loadAll();
    return { success: true };
  };

  const deleteOrder = async (
    orderId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Authoritative server delete from Supabase
      const res = await fetch(`/api/orders?orderId=${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Failed to delete order." };
      }

      // 2. Remove order from local client store
      const currentOrders = getStoredJson<CafeOrder[]>(STORAGE_KEY_ORDERS, []);
      const target = currentOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
      const updatedOrders = currentOrders.filter(
        (o) => o.id !== orderId && o.orderNumber !== orderId
      );
      setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);
      setOrders(updatedOrders);

      // 3. If target table has no other active unpaid orders, reset table to available
      if (target) {
        const remainingForTable = updatedOrders.filter(
          (o) => o.tableCode === target.tableCode && o.paymentStatus === "unpaid"
        );
        if (remainingForTable.length === 0) {
          const currentTables = getStoredJson<CafeTable[]>(STORAGE_KEY_TABLES, DEMO_TABLES);
          const updatedTables = currentTables.map((t) =>
            t.code === target.tableCode
              ? {
                  ...t,
                  status: "available" as const,
                  currentCustomerName: undefined,
                  currentCustomerPhone: undefined,
                }
              : t
          );
          setStoredJson(STORAGE_KEY_TABLES, updatedTables);
          setTables(updatedTables);
        }
      }

      loadAll();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, error: msg };
    }
  };

  const resetDemoData = () => {
    setStoredJson(STORAGE_KEY_ORDERS, []);
    setStoredJson(STORAGE_KEY_TABLES, DEMO_TABLES);
    setStoredJson(STORAGE_KEY_CUSTOMERS, []);
    loadAll();
  };

  return {
    orders,
    tables,
    customers,
    session,
    isLoaded,
    isRealtimeConnected,
    addTable,
    updateTable,
    toggleTableActive,
    regenerateTableQr,
    placeOrder,
    updateOrderStatus,
    getTableSessionBill,
    settleTableBill,
    voidPaymentCorrection,
    deleteOrder,
    resetDemoData,
  };
}
