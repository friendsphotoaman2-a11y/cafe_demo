"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CafeOrder,
  CafeTable,
  CafeCustomer,
  OrderStatus,
  PaymentStatus,
  OrderCustomizationChoice,
  VegClassification,
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

// Helper to safely access localStorage on client
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
    // Dispatch custom event to notify other components in same tab
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

  // Place a new order from a table QR session
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
    const taxAmount = subtotal * 0.05;
    const totalAmount = subtotal + taxAmount;
    const generatedOrderNumber = `#TBW-${Math.floor(1040 + currentOrders.length + 1)}`;
    const newOrderId = `ord-${Date.now()}`;

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
      status: "pending",
      paymentStatus: "unpaid",
      notes: params.notes,
      createdAt: "Just now",
      estimatedPrepMinutes: 12,
    };

    // Update orders list
    const updatedOrders = [newOrder, ...currentOrders];
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);

    // Update table state
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

    // Update or register customer record
    const existingCustIndex = currentCustomers.findIndex(
      (c) =>
        c.phone.replace(/\D/g, "") === params.customerPhone.replace(/\D/g, "")
    );
    let updatedCustomers = [...currentCustomers];
    if (existingCustIndex > -1) {
      const existing = updatedCustomers[existingCustIndex];
      updatedCustomers[existingCustIndex] = {
        ...existing,
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
        favoriteItem: params.items[0]?.name || "Signature Coffee",
      });
    }
    setStoredJson(STORAGE_KEY_CUSTOMERS, updatedCustomers);

    // Save session in localStorage so customer doesn't have to re-enter
    setStoredJson(STORAGE_KEY_SESSION, {
      name: params.customerName,
      phone: params.customerPhone,
    });

    loadAll();
    return newOrder;
  };

  // Update order status (used by Kitchen Kanban & Waiter)
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

  // Settle bill at counter (used by Cashier POS)
  const settleOrderPayment = (
    orderId: string,
    paymentMethod: "Cash" | "UPI" | "Card"
  ) => {
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

    let paidCustomerPhone: string | null = null;
    let paidAmount = 0;
    let tableCodeToFree: string | null = null;

    const updatedOrders = currentOrders.map((o) => {
      if (o.id === orderId) {
        paidCustomerPhone = o.customerPhone;
        paidAmount = o.totalAmount;
        tableCodeToFree = o.tableCode;
        return {
          ...o,
          paymentStatus: "paid_counter" as PaymentStatus,
          paymentMethod,
          status: "served" as OrderStatus,
        };
      }
      return o;
    });
    setStoredJson(STORAGE_KEY_ORDERS, updatedOrders);

    // Update customer loyalty stamp and spend
    if (paidCustomerPhone) {
      const cleanTargetPhone = paidCustomerPhone.replace(/\D/g, "");
      const updatedCustomers = currentCustomers.map((c) => {
        if (c.phone.replace(/\D/g, "") === cleanTargetPhone) {
          const newStamps = c.stampsEarned >= 5 ? 5 : c.stampsEarned + 1;
          return {
            ...c,
            visitsCount: c.visitsCount + 1,
            totalSpent: c.totalSpent + paidAmount,
            stampsEarned: newStamps,
            rewardEligible: newStamps >= 5,
          };
        }
        return c;
      });
      setStoredJson(STORAGE_KEY_CUSTOMERS, updatedCustomers);
    }

    // Free or update table
    if (tableCodeToFree) {
      const updatedTables = currentTables.map((t) => {
        if (t.code === tableCodeToFree) {
          return {
            ...t,
            status: "billed" as const,
            lastActiveTime: "Just settled at counter",
          };
        }
        return t;
      });
      setStoredJson(STORAGE_KEY_TABLES, updatedTables);
    }

    loadAll();
  };

  // Reset demo fixtures back to initial values
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
    placeOrder,
    updateOrderStatus,
    settleOrderPayment,
    resetDemoData,
  };
}

