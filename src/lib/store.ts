"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CafeOrder,
  CafeTable,
  CafeCustomer,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  OrderCustomizationChoice,
  VegClassification,
  TableSessionBill,
  TableSection,
} from "./types";
import {
  DEMO_ORDERS,
  DEMO_TABLES,
  DEMO_CUSTOMERS,
  DEMO_SETTINGS,
} from "./demo-data";

const STORAGE_KEY_ORDERS = "tbw_cafe_orders_v2";
const STORAGE_KEY_TABLES = "tbw_cafe_tables_v2";
const STORAGE_KEY_CUSTOMERS = "tbw_cafe_customers_v2";
const STORAGE_KEY_SESSION = "tbw_cafe_customer_session_v2";

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

function setStoredJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("tbw-cafe-store-updated"));
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

  const loadAll = useCallback(() => {
    const loadedOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      DEMO_ORDERS
    );
    const loadedTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const loadedCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      DEMO_CUSTOMERS
    );
    const loadedSession = getStoredJson<CustomerSession | null>(
      STORAGE_KEY_SESSION,
      null
    );

    setOrders(loadedOrders);
    setTables(loadedTables);
    setCustomers(loadedCustomers);
    setSession(loadedSession);
    setIsLoaded(true);
  }, []);

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

  // --- ORDER PLACEMENT ---
  const placeOrder = (params: {
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
  }): CafeOrder => {
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      DEMO_ORDERS
    );
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const currentCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      DEMO_CUSTOMERS
    );

    const subtotal = params.items.reduce((acc, i) => acc + i.totalPrice, 0);
    const taxRate = DEMO_SETTINGS.gstRatePercent / 100;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;
    const generatedOrderNumber = `#TBW-${Math.floor(1040 + currentOrders.length + 1)}`;
    const newOrderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    const newOrder: CafeOrder = {
      id: newOrderId,
      orderNumber: generatedOrderNumber,
      tableCode: params.tableCode,
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

    // Prepend new order
    setStoredJson(STORAGE_KEY_ORDERS, [newOrder, ...currentOrders]);

    // Update table status
    const updatedTables = currentTables.map((t) => {
      if (t.code === params.tableCode) {
        return {
          ...t,
          status: "order_pending" as const,
          currentCustomerName: params.customerName,
          currentCustomerPhone: params.customerPhone,
          currentOrderId: newOrderId,
          lastActiveTime: "Just now",
        };
      }
      return t;
    });
    setStoredJson(STORAGE_KEY_TABLES, updatedTables);

    // Update customer entry
    const cleanPhone = params.customerPhone.replace(/\D/g, "");
    const existingIndex = currentCustomers.findIndex(
      (c) => c.phone.replace(/\D/g, "") === cleanPhone
    );
    let updatedCustomers = [...currentCustomers];
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

    // Store remembered session
    setStoredJson(STORAGE_KEY_SESSION, {
      name: params.customerName,
      phone: params.customerPhone,
    });

    loadAll();
    return newOrder;
  };

  // --- KITCHEN STATUS PROGRESSION ---
  const updateOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      DEMO_ORDERS
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
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);

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
      setStoredJson(STORAGE_KEY_TABLES, updatedTables);
    }

    loadAll();
  };

  // --- CONSOLIDATED BILL CALCULATION ---
  const getTableSessionBill = useCallback(
    (tableCode: string): TableSessionBill | null => {
      const currentOrders = getStoredJson<CafeOrder[]>(
        STORAGE_KEY_ORDERS,
        DEMO_ORDERS
      );
      const currentTables = getStoredJson<CafeTable[]>(
        STORAGE_KEY_TABLES,
        DEMO_TABLES
      );

      const table = currentTables.find((t) => t.code === tableCode);
      const formattedCode = tableCode.padStart(2, "0");

      // Filter all orders belonging to this table
      const tableOrders = currentOrders.filter((o) => o.tableCode === formattedCode);

      if (tableOrders.length === 0) {
        return null;
      }

      // Find unpaid orders first; if all paid, grab the most recent dining session
      const unpaidOrders = tableOrders.filter((o) => o.paymentStatus === "unpaid");
      const targetOrders = unpaidOrders.length > 0 ? unpaidOrders : [tableOrders[0]];

      // Consolidated items map to prevent duplicate lines
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
  const settleTableBill = (params: {
    tableCode: string;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    cashierName: string;
    amountPaid?: number;
  }): { success: boolean; error?: string } => {
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      DEMO_ORDERS
    );
    const currentTables = getStoredJson<CafeTable[]>(
      STORAGE_KEY_TABLES,
      DEMO_TABLES
    );
    const currentCustomers = getStoredJson<CafeCustomer[]>(
      STORAGE_KEY_CUSTOMERS,
      DEMO_CUSTOMERS
    );

    const formattedCode = params.tableCode.padStart(2, "0");
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

    // Mark orders as paid
    const updatedOrders = currentOrders.map((o) => {
      if (o.tableCode === formattedCode && o.paymentStatus === "unpaid") {
        return {
          ...o,
          paymentStatus: "paid_counter" as const,
          paymentMethod: params.paymentMethod,
          paymentAudit: auditRecord,
          status: o.status === "served" ? ("completed" as const) : o.status,
        };
      }
      return o;
    });
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);

    // Free table or set status to available
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

    // Update customer loyalty stats
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

  // Controlled Demo Payment Correction (Void / Refund)
  const voidPaymentCorrection = (
    orderId: string,
    reason: string
  ): { success: boolean } => {
    const currentOrders = getStoredJson<CafeOrder[]>(
      STORAGE_KEY_ORDERS,
      DEMO_ORDERS
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

  // Reset Demo Data
  const resetDemoData = () => {
    setStoredJson(STORAGE_KEY_ORDERS, DEMO_ORDERS);
    setStoredJson(STORAGE_KEY_TABLES, DEMO_TABLES);
    setStoredJson(STORAGE_KEY_CUSTOMERS, DEMO_CUSTOMERS);
    loadAll();
  };

  return {
    orders,
    tables,
    customers,
    session,
    isLoaded,
    addTable,
    updateTable,
    toggleTableActive,
    regenerateTableQr,
    placeOrder,
    updateOrderStatus,
    getTableSessionBill,
    settleTableBill,
    voidPaymentCorrection,
    resetDemoData,
  };
}
