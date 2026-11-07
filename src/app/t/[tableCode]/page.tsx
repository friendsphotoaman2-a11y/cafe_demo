"use client";

import React, { useState, useMemo, use } from "react";
import Image from "next/image";
import Link from "next/link";
import CategoryFilter from "@/components/public/CategoryFilter";
import MenuItemCard from "@/components/public/MenuItemCard";
import ItemDetailModal from "@/components/public/ItemDetailModal";
import TableCustomerOnboardingModal from "@/components/ordering/TableCustomerOnboardingModal";
import TableCartDrawer from "@/components/ordering/TableCartDrawer";
import TableOrderReviewModal from "@/components/ordering/TableOrderReviewModal";
import { useCafeStore } from "@/lib/store";
import { DEMO_CATEGORIES, DEMO_MENU_ITEMS, DEMO_SETTINGS } from "@/lib/demo-data";
import { formatINR } from "@/lib/utils";
import {
  MenuItem,
  CartItem,
  OrderCustomizationChoice,
  OrderStatus,
} from "@/lib/types";
import {
  Coffee,
  ShoppingBag,
  User,
  Search,
  Sparkles,
  AlertCircle,
  Clock,
  CheckCircle2,
  Receipt,
  ChevronRight,
  Flame,
  ChefHat,
  ArrowRight,
} from "lucide-react";

interface PageProps {
  params: Promise<{
    tableCode: string;
  }>;
}

export default function TableOrderingPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const rawCode = unwrappedParams.tableCode || "01";
  const formattedCode = rawCode.padStart(2, "0");

  const {
    tables,
    orders,
    session,
    placeOrder,
    getTableSessionBill,
  } = useCafeStore();

  const currentTable = tables.find((t) => t.code === formattedCode) || {
    id: `custom-${formattedCode}`,
    code: formattedCode,
    name: `Table ${formattedCode}`,
    capacity: 4,
    section: "Indoor Main" as const,
    status: "available" as const,
    isActive: true,
  };

  // State
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVegFilter, setSelectedVegFilter] = useState<string>("all");
  const [activeViewTab, setActiveViewTab] = useState<"menu" | "orders" | "bill">("menu");

  // Selected item for modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState<string>("");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  // Customer Onboarding state
  const [customerName, setCustomerName] = useState<string>(session?.name || "");
  const [customerPhone, setCustomerPhone] = useState<string>(session?.phone || "");
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Consolidated table session bill
  const sessionBill = getTableSessionBill(formattedCode);

  // Active orders placed by this table
  const tableOrders = orders.filter((o) => o.tableCode === formattedCode);

  // Remote session state (Authoritative from Supabase)
  const [remoteSessionBill, setRemoteSessionBill] = useState<typeof sessionBill | null>(null);
  const [remoteOrders, setRemoteOrders] = useState<typeof orders | null>(null);
  const [isSessionClosed, setIsSessionClosed] = useState(false);

  const fetchSession = React.useCallback(async () => {
    try {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem(`tbw_dining_token_${formattedCode}`)
          : null;

      const url = `/api/orders?tableCode=${formattedCode}${
        storedToken ? `&token=${encodeURIComponent(storedToken)}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.session) {
            if (data.session.guestName && !customerName) setCustomerName(data.session.guestName);
            if (data.session.guestPhone && !customerPhone) setCustomerPhone(data.session.guestPhone);
            setIsSessionClosed(data.isClosed || data.session.status === "closed");
          }
          if (data.orders && Array.isArray(data.orders)) {
            setRemoteOrders(data.orders);
          }
          if (data.sessionBill) {
            setRemoteSessionBill(data.sessionBill);
          }
        }
      }
    } catch {
      // Offline fallback
    }
  }, [formattedCode, customerName, customerPhone]);

  React.useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 4000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const effectiveOrders = remoteOrders && remoteOrders.length > 0 ? remoteOrders : tableOrders;
  const effectiveBill = remoteSessionBill || sessionBill;

  // Filtered menu
  const filteredItems = useMemo(() => {
    return DEMO_MENU_ITEMS.filter((item) => {
      if (activeCategory !== "all" && item.categoryId !== activeCategory) {
        return false;
      }
      if (selectedVegFilter !== "all" && item.classification !== selectedVegFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (item.name || "").toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          (item.flavour || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, selectedVegFilter, searchQuery]);

  // Cart Handlers
  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    selectedCustomizations: OrderCustomizationChoice[]
  ) => {
    if (effectiveBill?.isPaid || isSessionClosed) {
      alert("This table session is already paid and closed. Please scan the table QR code to start a new dining session.");
      return;
    }
    const customSuffix = selectedCustomizations
      .map((c) => c.optionName)
      .sort()
      .join("-");
    const cartItemId = `${item.id}_${customSuffix || "default"}`;

    const optionDeltas = selectedCustomizations.reduce(
      (acc, opt) => acc + opt.priceDelta,
      0
    );
    const unitPrice = item.price + optionDeltas;
    const totalPrice = unitPrice * quantity;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex((ci) => ci.cartItemId === cartItemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          totalPrice: unitPrice * newQty,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            cartItemId,
            menuItem: item,
            quantity,
            selectedCustomizations,
            unitPrice,
            totalPrice,
          },
        ];
      }
    });
  };

  const handleUpdateQuantity = (cartItemId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: item.unitPrice * newQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handleProceedToReview = () => {
    setIsCartDrawerOpen(false);
    if (!customerName || !customerPhone) {
      setIsOnboardingModalOpen(true);
    } else {
      setIsReviewModalOpen(true);
    }
  };

  const handleCustomerSaved = (name: string, phone: string) => {
    setCustomerName(name);
    setCustomerPhone(phone);
    if (cartItems.length > 0) {
      setIsReviewModalOpen(true);
    }
  };

  const handleConfirmOrder = async (notes?: string) => {
    const idempotencyKey = `ord_req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result = await placeOrder({
      tableCode: formattedCode,
      customerName: customerName || "Guest",
      customerPhone: customerPhone || "9999999999",
      items: cartItems.map((ci) => ({
        menuItemId: ci.menuItem.id,
        name: ci.menuItem.name,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        totalPrice: ci.totalPrice,
        customizations: ci.selectedCustomizations,
        classification: ci.menuItem.classification,
      })),
      notes: notes || kitchenNotes || undefined,
      idempotencyKey,
    });

    fetchSession();
    return result;
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const getOrderStatusStep = (status: OrderStatus) => {
    switch (status) {
      case "new":
        return { step: 1, label: "Order Received", color: "text-amber-600" };
      case "accepted":
        return { step: 2, label: "Kitchen Accepted", color: "text-blue-600" };
      case "preparing":
        return { step: 3, label: "Chef Preparing", color: "text-orange-600" };
      case "ready":
        return { step: 4, label: "Ready to Serve", color: "text-emerald-600" };
      case "served":
      case "completed":
        return { step: 5, label: "Served at Table", color: "text-zinc-800" };
      default:
        return { step: 1, label: "Received", color: "text-amber-600" };
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 pb-28">
      {/* Table Header Bar */}
      <header className="sticky top-0 z-40 border-b border-cafe-200 bg-[#FAF7F2]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-cafe-900 text-amber-300 shadow-sm"
              aria-label="Back to home"
            >
              <Coffee className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif text-base font-bold text-cafe-950">
                  {DEMO_SETTINGS.brandName}
                </span>
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-cafe-950">
                  Table {formattedCode}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">
                {currentTable.section} &bull; Contactless Ordering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Customer Pill */}
            {customerName ? (
              <button
                onClick={() => setIsOnboardingModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 border border-zinc-200 shadow-xs"
              >
                <User className="h-3.5 w-3.5 text-cafe-700" />
                <span className="max-w-[90px] truncate">{customerName}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsOnboardingModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-950 border border-amber-300"
              >
                <User className="h-3.5 w-3.5 text-amber-800" />
                <span className="hidden sm:inline">Set Your Name</span>
                <span className="sm:hidden">Guest</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-cafe-900 text-white shadow-sm hover:bg-cafe-800 transition"
              aria-label="View Cart"
            >
              <ShoppingBag className="h-5 w-5 text-amber-300" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-extrabold text-white">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Session Paid / Closed Notice */}
      {(effectiveBill?.isPaid || isSessionClosed) && (
        <div className="bg-emerald-700 text-white px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span>
            Table {formattedCode} dining session has been settled &amp; closed. Thank you for visiting!
          </span>
        </div>
      )}

      {/* Hero Table Banner */}
      <section className="bg-gradient-to-r from-cafe-950 via-cafe-900 to-cafe-950 text-white py-5 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Table Ordering Session</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">
              Ordering for Table {formattedCode}
            </h1>
            <p className="text-xs text-zinc-300 mt-0.5">
              Select dishes, customize options, and place multiple rounds. Settled at counter.
            </p>
          </div>

          {/* Navigation view switcher: Menu vs Active Orders vs Bill */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl backdrop-blur-xs">
            <button
              onClick={() => setActiveViewTab("menu")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "menu"
                  ? "bg-amber-400 text-zinc-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => setActiveViewTab("orders")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "orders"
                  ? "bg-amber-400 text-zinc-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <span>My Orders</span>
              {effectiveOrders.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                  {effectiveOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveViewTab("bill")}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "bill"
                  ? "bg-amber-400 text-zinc-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Bill</span>
            </button>
          </div>
        </div>
      </section>

      {/* VIEW TAB 1: MENU VIEW */}
      {activeViewTab === "menu" && (
        <>
          {/* Filter and Search Bar */}
          <section className="sticky top-16 z-30 border-b border-cafe-200 bg-[#FAF7F2]/95 backdrop-blur-md py-3 shadow-xs">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search menu items or flavours..."
                    className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "all", label: "All" },
                    { id: "veg", label: "Pure Veg" },
                    { id: "vegan", label: "Vegan" },
                    { id: "non-veg", label: "Non-Veg" },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setSelectedVegFilter(pill.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selectedVegFilter === pill.id
                          ? "bg-cafe-900 text-white"
                          : "bg-white text-zinc-700 border border-zinc-200 hover:bg-cafe-100"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              <CategoryFilter
                categories={DEMO_CATEGORIES}
                activeCategoryId={activeCategory}
                onSelectCategory={(id) => setActiveCategory(id)}
              />
            </div>
          </section>

          {/* Menu Items Grid */}
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  isTableMode={true}
                  onSelect={(i) => setSelectedItem(i)}
                  onQuickAdd={(i) => {
                    const defaultChoices: OrderCustomizationChoice[] = [];
                    i.customizationGroups?.forEach((g) => {
                      if (g.options.length > 0) {
                        defaultChoices.push({
                          groupTitle: g.title,
                          optionName: g.options[0].name,
                          priceDelta: g.options[0].priceDelta,
                        });
                      }
                    });
                    handleAddToCart(i, 1, defaultChoices);
                  }}
                />
              ))}
            </div>
          </main>
        </>
      )}

      {/* VIEW TAB 2: MY ORDERS (LIVE KITCHEN STATUS TRACKER) */}
      {activeViewTab === "orders" && (
        <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="font-serif text-xl font-bold text-zinc-900">
                Orders for Table {formattedCode}
              </h2>
              <p className="text-xs text-zinc-500">
                Live preparation updates dispatched directly from our barista &amp; kitchen
              </p>
            </div>
            <button
              onClick={() => setActiveViewTab("menu")}
              className="inline-flex items-center gap-1 text-xs font-bold text-cafe-800 hover:underline"
            >
              <span>+ Add More Items</span>
            </button>
          </div>

          {effectiveOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-12 text-center">
              <ShoppingBag className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
              <h3 className="font-serif text-lg font-bold text-zinc-800">
                No orders placed yet
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Browse our digital menu and tap &ldquo;Add to Table Order&rdquo; to send your first ticket.
              </p>
              <button
                onClick={() => setActiveViewTab("menu")}
                className="mt-4 rounded-xl bg-cafe-900 px-5 py-2.5 text-xs font-bold text-white"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {effectiveOrders.map((ord) => {
                const stepInfo = getOrderStatusStep(ord.status);

                return (
                  <div
                    key={ord.id}
                    className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900">
                            {ord.orderNumber}
                          </span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Table {ord.tableCode}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Placed: {ord.createdAt} &bull; Guest: {ord.customerName}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-extrabold text-sm text-zinc-900">
                          {formatINR(ord.totalAmount)}
                        </span>
                        <span className={`block text-[11px] font-bold ${stepInfo.color}`}>
                          {stepInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Progress Step Bar */}
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-bold">
                        <span className={stepInfo.step >= 1 ? "text-amber-600" : "text-zinc-400"}>
                          1. Received
                        </span>
                        <span className={stepInfo.step >= 2 ? "text-blue-600" : "text-zinc-400"}>
                          2. Accepted
                        </span>
                        <span className={stepInfo.step >= 3 ? "text-orange-600" : "text-zinc-400"}>
                          3. In Kitchen
                        </span>
                        <span className={stepInfo.step >= 4 ? "text-emerald-600" : "text-zinc-400"}>
                          4. Ready / Served
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-500 transition-all duration-500"
                          style={{
                            width: `${(Math.min(stepInfo.step, 4) / 4) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-zinc-100 text-xs">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex justify-between">
                          <div>
                            <span className="font-bold text-zinc-800">
                              {it.quantity} &times; {it.name}
                            </span>
                            {it.customizations.map((c, ci) => (
                              <span
                                key={ci}
                                className="block text-[10px] text-zinc-500 ml-3"
                              >
                                &bull; {c.optionName}
                              </span>
                            ))}
                          </div>
                          <span className="font-semibold text-zinc-700">
                            {formatINR(it.totalPrice)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {ord.notes && (
                      <div className="rounded-xl bg-amber-50/70 p-2.5 text-[11px] text-amber-900 border border-amber-200/60">
                        <strong>Kitchen Note: </strong>
                        {ord.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* VIEW TAB 3: CONSOLIDATED SESSION BILL */}
      {activeViewTab === "bill" && (
        <main className="mx-auto max-w-lg px-4 sm:px-6 pt-6">
          {effectiveBill && effectiveBill.consolidatedItems.length > 0 ? (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg space-y-6">
              <div className="text-center border-b border-zinc-100 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Dining Session Invoice
                </span>
                <h3 className="font-serif text-2xl font-bold text-cafe-950 mt-1">
                  Table {formattedCode} Total Bill
                </h3>
                <p className="text-xs text-zinc-500">
                  Orders: {effectiveBill.orderNumbers.join(", ")}
                </p>
                <div className="mt-2 inline-block">
                  {effectiveBill.isPaid ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900 border border-emerald-300">
                      PAID AT COUNTER ({effectiveBill.paymentMethod || "Settled"})
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 border border-amber-300">
                      PAYMENT DUE AT COUNTER
                    </span>
                  )}
                </div>
              </div>

              {/* Guest Details */}
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Customer:</span>
                  <span className="font-bold">{effectiveBill.customerName}</span>
                </div>
                {effectiveBill.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Phone:</span>
                    <span>{effectiveBill.customerPhone}</span>
                  </div>
                )}
                {effectiveBill.paymentAudit && (
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>Receipt Confirmed by:</span>
                    <span>
                      {effectiveBill.paymentAudit.cashierName} @{" "}
                      {effectiveBill.paymentAudit.paidAt}
                    </span>
                  </div>
                )}
              </div>

              {/* Itemized list combining all orders */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Consolidated Items
                </h4>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                  {effectiveBill.consolidatedItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div>
                        <span className="font-bold text-zinc-900">
                          {item.quantity} &times; {item.name}
                        </span>
                        {item.customizations.map((c, i) => (
                          <div key={i} className="text-[10px] text-zinc-500 ml-3">
                            &bull; {c.optionName}
                          </div>
                        ))}
                      </div>
                      <span className="font-bold text-zinc-800">
                        {formatINR(item.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculations */}
              <div className="rounded-2xl bg-zinc-50 p-4 space-y-2 text-xs text-zinc-600 border border-zinc-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatINR(effectiveBill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Configured GST ({effectiveBill.taxPercent}%)</span>
                  <span>{formatINR(effectiveBill.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Total Payable</span>
                  <span className="text-cafe-900">
                    {formatINR(effectiveBill.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              {!effectiveBill.isPaid ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span>How to Pay:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Please visit the café counter and quote <strong>Table {formattedCode}</strong>.
                    Our cashier will accept UPI QR, Cash, or Card, and mark your bill Paid.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center text-xs text-emerald-900 space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                  <p className="font-bold">Thank you for dining with us!</p>
                  <p className="text-[11px] text-emerald-700">
                    Your visit has been recorded toward your 5-stamp loyalty reward.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-12 text-center">
              <Receipt className="h-10 w-10 text-zinc-300 mx-auto mb-2" />
              <h3 className="font-serif text-lg font-bold text-zinc-800">
                No active bill for Table {formattedCode}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Order some dishes from our digital menu to start a table session.
              </p>
              <button
                onClick={() => setActiveViewTab("menu")}
                className="mt-4 rounded-xl bg-cafe-900 px-5 py-2.5 text-xs font-bold text-white"
              >
                Browse Menu
              </button>
            </div>
          )}
        </main>
      )}

      {/* Modals & Drawers */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        isTableMode={true}
        onClose={() => setSelectedItem(null)}
        onAddToCart={handleAddToCart}
      />

      <TableCustomerOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        tableCode={formattedCode}
        initialName={customerName}
        initialPhone={customerPhone}
        onSaveCustomer={handleCustomerSaved}
      />

      <TableCartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        onOpen={() => setIsCartDrawerOpen(true)}
        tableCode={formattedCode}
        cartItems={cartItems}
        previousOrders={effectiveOrders}
        currentSessionBill={effectiveBill}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToReview={handleProceedToReview}
        kitchenNotes={kitchenNotes}
        onKitchenNotesChange={setKitchenNotes}
        onViewOrders={() => setActiveViewTab("orders")}
      />

      <TableOrderReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        tableCode={formattedCode}
        customerName={customerName || "Table Guest"}
        customerPhone={customerPhone || "+91 98000 00000"}
        cartItems={cartItems}
        previousOrders={effectiveOrders}
        currentSessionBill={effectiveBill}
        kitchenNotes={kitchenNotes}
        onConfirmOrder={handleConfirmOrder}
        onOrderSuccess={() => {
          setCartItems([]);
          setKitchenNotes("");
          fetchSession();
        }}
        onEditCustomer={() => {
          setIsReviewModalOpen(false);
          setIsOnboardingModalOpen(true);
        }}
        onViewOrders={() => {
          setIsReviewModalOpen(false);
          setActiveViewTab("orders");
        }}
        onViewBill={() => {
          setIsReviewModalOpen(false);
          setActiveViewTab("bill");
        }}
      />
    </div>
  );
}
