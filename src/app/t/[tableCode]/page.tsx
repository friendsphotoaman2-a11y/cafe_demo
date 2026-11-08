"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import CategoryFilter from "@/components/public/CategoryFilter";
import MenuItemCard from "@/components/public/MenuItemCard";
import ItemDetailModal from "@/components/public/ItemDetailModal";
import TableCustomerOnboardingModal from "@/components/ordering/TableCustomerOnboardingModal";
import TableCartDrawer from "@/components/ordering/TableCartDrawer";
import TableOrderReviewModal from "@/components/ordering/TableOrderReviewModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
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
  CheckCircle2,
  Receipt,
  X,
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
  const { showToast } = useToast();

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
  const [isRememberedCustomer, setIsRememberedCustomer] = useState<boolean>(false);
  const [customerLoyalty, setCustomerLoyalty] = useState<{ stamps: number; totalVisits: number } | null>(null);
  const [isSwitchConfirmOpen, setIsSwitchConfirmOpen] = useState(false);

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
          // 1. Remembered customer device identification
          if (data.rememberedCustomer) {
            setIsRememberedCustomer(true);
            setCustomerName(data.session?.guestName || data.rememberedCustomer.fullName);
            setCustomerPhone(data.session?.guestPhone || data.rememberedCustomer.phone);
            setCustomerLoyalty({
              stamps: data.rememberedCustomer.stamps || 0,
              totalVisits: data.rememberedCustomer.totalVisits || 0,
            });
          }
          // 2. Active dining session on this specific table
          if (data.session) {
            if (data.session.guestName) setCustomerName(data.session.guestName);
            if (data.session.guestPhone) setCustomerPhone(data.session.guestPhone);
            setIsSessionClosed(data.isClosed || data.session.status === "closed");
          } else {
            setIsSessionClosed(false);
          }
          if (data.orders && Array.isArray(data.orders)) {
            setRemoteOrders(data.orders);
          } else {
            setRemoteOrders([]);
          }
          if (data.sessionBill) {
            setRemoteSessionBill(data.sessionBill);
          } else {
            setRemoteSessionBill(null);
          }
        }
      }
    } catch {
      // Offline fallback
    }
  }, [formattedCode]);

  React.useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 4000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const effectiveOrders = remoteOrders !== null ? remoteOrders : tableOrders;
  const effectiveBill = remoteOrders !== null ? remoteSessionBill : sessionBill;

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
    const custKey = selectedCustomizations
      .map((c) => c.optionName)
      .sort()
      .join("|");
    const cartItemId = `${item.id}__${custKey}`;

    const unitPrice =
      item.price +
      selectedCustomizations.reduce((sum, c) => sum + c.priceDelta, 0);
    const totalPrice = unitPrice * quantity;

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.cartItemId === cartItemId);
      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          totalPrice: updated[existingIdx].unitPrice * newQty,
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

    showToast(`Added ${quantity}× ${item.name} to order`);
  };

  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              quantity: newQty,
              totalPrice: item.unitPrice * newQty,
            }
          : item
      )
    );
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

  const handleCustomerSaved = async (name: string, phone: string) => {
    setCustomerName(name);
    setCustomerPhone(phone);
    try {
      await fetch("/api/customer/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, phone }),
      });
      setIsRememberedCustomer(true);
      showToast(`Welcome to Table ${formattedCode}, ${name}!`);
    } catch (e) {
      console.warn("Device registration:", e);
    }
    if (cartItems.length > 0) {
      setIsReviewModalOpen(true);
    }
  };

  const confirmSwitchCustomer = async () => {
    try {
      await fetch("/api/customer/identity", { method: "DELETE" });
    } catch {}
    setCustomerName("");
    setCustomerPhone("");
    setIsRememberedCustomer(false);
    setCustomerLoyalty(null);
    setIsSwitchConfirmOpen(false);
    setIsOnboardingModalOpen(true);
    showToast("Profile switched. Enter details for new guest.", "info");
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
        return { step: 3, label: "Barista Brewing", color: "text-orange-600" };
      case "ready":
        return { step: 4, label: "Ready to Serve", color: "text-emerald-600" };
      case "served":
      case "completed":
        return { step: 5, label: "Delivered to Table", color: "text-zinc-900" };
      default:
        return { step: 1, label: "Received", color: "text-amber-600" };
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-zinc-900 pb-24">
      {/* 1. Mobile Header (Compact, 52px, Sticky with Safe Area support) */}
      <header className="sticky top-0 z-40 border-b border-cafe-200/90 bg-[#FAF7F2]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6">
          {/* Logo & Table Pill */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-cafe-950 text-amber-300 shadow-xs hover:bg-cafe-900 transition"
              aria-label="Back to home"
            >
              <Coffee className="h-4.5 w-4.5" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-serif text-sm font-bold text-cafe-950">
                  {DEMO_SETTINGS.brandName}
                </span>
                <span className="rounded-lg bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-cafe-950 shadow-2xs">
                  T-{formattedCode}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {currentTable.section}
              </p>
            </div>
          </div>

          {/* Right Header: Profile & Cart Action */}
          <div className="flex items-center gap-2">
            {/* Customer Pill */}
            {customerName ? (
              <button
                onClick={() => setIsSwitchConfirmOpen(true)}
                title="Switch Guest Session"
                className="min-h-[44px] flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-800 border border-zinc-200/90 shadow-2xs hover:border-amber-400 transition"
              >
                <User className="h-3.5 w-3.5 text-cafe-700" />
                <span className="max-w-[80px] sm:max-w-[120px] truncate font-bold">
                  {customerName.split(" ")[0]}
                </span>
                {isRememberedCustomer && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsOnboardingModalOpen(true)}
                className="min-h-[44px] flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-950 border border-amber-300/80"
              >
                <User className="h-3.5 w-3.5 text-amber-800" />
                <span>Guest</span>
              </button>
            )}

            {/* Cart Button with Animated Counter Badge */}
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-cafe-950 text-white shadow-xs hover:bg-cafe-900 active:scale-95 transition"
              aria-label="View Order Cart"
            >
              <ShoppingBag className="h-5 w-5 text-amber-300" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-xs animate-scale-up">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Compact Welcome Greeting Bar for Remembered Customer */}
      {isRememberedCustomer && customerName && !effectiveBill?.isPaid && (
        <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 border-b border-amber-200/80 px-4 py-1.5 text-xs text-amber-950 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              Welcome back, <strong className="font-bold">{customerName.split(" ")[0]}</strong>! Table {formattedCode} is active.
            </span>
            {customerLoyalty && customerLoyalty.stamps > 0 && (
              <span className="rounded-full bg-amber-200/80 px-2 py-0.2 text-[10px] font-black text-amber-900 ml-1 shrink-0">
                ★ {customerLoyalty.stamps}/5 Stamps
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <Link
              href="/profile"
              className="text-[10px] font-bold text-cafe-950 hover:underline"
            >
              Profile
            </Link>
            <span className="text-zinc-300">&bull;</span>
            <button
              onClick={() => setIsSwitchConfirmOpen(true)}
              className="text-[10px] font-medium text-amber-800 hover:text-amber-950 hover:underline"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* 3. Session Settled Notice */}
      {(effectiveBill?.isPaid || isSessionClosed) && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-center text-xs font-bold shadow-xs flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
          <span>
            Table {formattedCode} bill has been settled at counter. Thank you!
          </span>
        </div>
      )}

      {/* 4. Compact Ordering Hero & View Tabs */}
      <section className="bg-cafe-950 text-white px-4 py-3.5 shadow-xs">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <span>Contactless Dining</span>
              <span>&bull;</span>
              <span>Multiple Ordering Rounds</span>
            </div>
            <h1 className="font-serif text-lg sm:text-2xl font-bold mt-0.5">
              Table {formattedCode} Ordering
            </h1>
          </div>

          {/* Navigation Tabs: Menu / My Orders / Running Bill */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl backdrop-blur-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveViewTab("menu")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "menu"
                  ? "bg-amber-400 text-cafe-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              Menu
            </button>
            <button
              onClick={() => setActiveViewTab("orders")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "orders"
                  ? "bg-amber-400 text-cafe-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <span>My Orders</span>
              {effectiveOrders.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                    activeViewTab === "orders"
                      ? "bg-cafe-950 text-white"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {effectiveOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveViewTab("bill")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeViewTab === "bill"
                  ? "bg-amber-400 text-cafe-950 shadow-xs"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Bill</span>
              {effectiveBill && effectiveBill.totalAmount > 0 && (
                <span className="text-[10px] opacity-80">
                  {formatINR(effectiveBill.totalAmount)}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 5. VIEW TAB 1: MENU VIEW */}
      {activeViewTab === "menu" && (
        <>
          {/* Sticky Search & Category Navigation */}
          <section className="sticky top-14 z-30 border-b border-cafe-200/90 bg-[#FAF7F2]/95 backdrop-blur-md py-2.5 shadow-2xs">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 space-y-2">
              <div className="flex items-center gap-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search coffee, bowls, pastries..."
                    className="w-full rounded-xl border border-zinc-200 bg-white py-1.5 pl-8 pr-8 text-xs focus:border-cafe-600 focus:outline-none focus:ring-1 focus:ring-cafe-600 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Veg/Dietary Toggle */}
                <div className="flex items-center gap-1 overflow-x-auto shrink-0">
                  {[
                    { id: "all", label: "All" },
                    { id: "veg", label: "Veg" },
                    { id: "non-veg", label: "Non-Veg" },
                  ].map((pill) => (
                    <button
                      key={pill.id}
                      onClick={() => setSelectedVegFilter(pill.id)}
                      className={`min-h-[34px] rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        selectedVegFilter === pill.id
                          ? "bg-cafe-950 text-white shadow-2xs"
                          : "bg-white text-zinc-700 border border-zinc-200"
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizontal Scrollable Categories */}
              <CategoryFilter
                categories={DEMO_CATEGORIES}
                activeCategoryId={activeCategory}
                onSelectCategory={(id) => setActiveCategory(id)}
              />
            </div>
          </section>

          {/* Menu Items Grid: 2 columns on mobile/tablet, 3-4 on desktop */}
          <main className="mx-auto max-w-7xl px-3 sm:px-6 pt-4 sm:pt-6">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 p-8 text-center text-xs text-zinc-500">
                No menu items match your search. Try another query or category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
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
            )}
          </main>
        </>
      )}

      {/* 6. VIEW TAB 2: MY ORDERS (LIVE KITCHEN TRACKER) */}
      {activeViewTab === "orders" && (
        <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-zinc-900">
                Table {formattedCode} Orders
              </h2>
              <p className="text-xs text-zinc-500">
                Live status updates directly from our barista &amp; kitchen
              </p>
            </div>
            <button
              onClick={() => setActiveViewTab("menu")}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950"
            >
              <span>+ Add Items</span>
            </button>
          </div>

          {effectiveOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-10 text-center space-y-2">
              <ShoppingBag className="h-10 w-10 text-zinc-300 mx-auto" />
              <h3 className="font-serif text-base font-bold text-zinc-800">
                No orders placed yet
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Explore our menu, select items, and submit your table ticket.
              </p>
              <button
                onClick={() => setActiveViewTab("menu")}
                className="rounded-xl bg-cafe-950 px-4 py-2 text-xs font-bold text-white shadow-xs mt-2"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {effectiveOrders.map((ord) => {
                const stepInfo = getOrderStatusStep(ord.status);

                return (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-zinc-900">
                            {ord.orderNumber}
                          </span>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Table {ord.tableCode}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {ord.createdAt} &bull; {ord.customerName}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-sm text-zinc-900 block">
                          {formatINR(ord.totalAmount)}
                        </span>
                        <span className={`text-[11px] font-bold ${stepInfo.color}`}>
                          {stepInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Sequential Progress Bar */}
                    <div className="space-y-1">
                      <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                        <span className={stepInfo.step >= 1 ? "text-amber-600" : "text-zinc-300"}>
                          1. Received
                        </span>
                        <span className={stepInfo.step >= 2 ? "text-blue-600" : "text-zinc-300"}>
                          2. Accepted
                        </span>
                        <span className={stepInfo.step >= 3 ? "text-orange-600" : "text-zinc-300"}>
                          3. Brewing
                        </span>
                        <span className={stepInfo.step >= 4 ? "text-emerald-600" : "text-zinc-300"}>
                          4. Ready/Served
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-500 transition-all duration-500"
                          style={{
                            width: `${(Math.min(stepInfo.step, 4) / 4) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="divide-y divide-zinc-100 text-xs">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex justify-between">
                          <div>
                            <span className="font-bold text-zinc-800">
                              {it.quantity} &times; {it.name}
                            </span>
                            {it.customizations?.map((c, ci) => (
                              <span
                                key={ci}
                                className="block text-[10px] text-zinc-500 ml-2"
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
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* 7. VIEW TAB 3: RUNNING TABLE BILL */}
      {activeViewTab === "bill" && (
        <main className="mx-auto max-w-lg px-4 sm:px-6 pt-5">
          {effectiveBill && effectiveBill.consolidatedItems.length > 0 ? (
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5">
              <div className="text-center border-b border-zinc-100 pb-3.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Dining Invoice
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-cafe-950 mt-0.5">
                  Table {formattedCode} Running Bill
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Rounds: {effectiveBill.orderNumbers.join(", ")}
                </p>
                <div className="mt-2">
                  {effectiveBill.isPaid ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-900 border border-emerald-300">
                      PAID AT COUNTER ({effectiveBill.paymentMethod || "Settled"})
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-black text-amber-900 border border-amber-300">
                      PAYMENT DUE AT COUNTER
                    </span>
                  )}
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Ordered Items ({effectiveBill.consolidatedItems.length})
                </span>
                <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 text-xs">
                  {effectiveBill.consolidatedItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between p-3"
                    >
                      <div>
                        <span className="font-bold text-zinc-900">
                          {item.quantity} &times; {item.name}
                        </span>
                        {item.customizations?.map((c, i) => (
                          <div key={i} className="text-[10px] text-zinc-500 ml-2">
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

              {/* Tax & Grand Total */}
              <div className="rounded-2xl bg-zinc-50 p-4 space-y-1.5 text-xs text-zinc-600 border border-zinc-200/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatINR(effectiveBill.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({effectiveBill.taxPercent}%)</span>
                  <span>{formatINR(effectiveBill.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Total Payable</span>
                  <span className="text-cafe-950 font-black">
                    {formatINR(effectiveBill.totalAmount)}
                  </span>
                </div>
              </div>

              {/* How to Settle */}
              {!effectiveBill.isPaid ? (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>How to settle bill:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Visit the counter and mention <strong>Table {formattedCode}</strong>. We accept UPI QR, Cards, and Cash.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                  <p className="font-bold">Bill settled! Thank you for dining with us.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-10 text-center space-y-2">
              <Receipt className="h-10 w-10 text-zinc-300 mx-auto" />
              <h3 className="font-serif text-base font-bold text-zinc-800">
                No active bill for Table {formattedCode}
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Add items to your table order to start a dining session.
              </p>
            </div>
          )}
        </main>
      )}

      {/* Floating Bottom Cart Bar (if items in cart and drawer closed) */}
      {cartItems.length > 0 && !isCartDrawerOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto">
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full flex items-center justify-between rounded-2xl bg-cafe-950 text-white p-3.5 shadow-xl hover:bg-cafe-900 transition active:scale-98 border border-cafe-800"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-400 text-cafe-950 text-xs font-black">
                {totalCartCount}
              </span>
              <span className="text-xs font-bold">View Cart &bull; Round {effectiveOrders.length + 1}</span>
            </div>
            <div className="flex items-center gap-1.5 font-black text-amber-300 text-sm">
              <span>{formatINR(cartItems.reduce((acc, i) => acc + i.totalPrice, 0))}</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* Switch Customer Confirmation Dialog (replaces browser confirm) */}
      <ConfirmDialog
        isOpen={isSwitchConfirmOpen}
        title="Switch Guest Profile?"
        message={`This will revoke the remembered device session for ${customerName || "this table"}. You can sign in with another name or continue as a new visitor.`}
        confirmLabel="Switch Guest"
        cancelLabel="Keep Session"
        variant="warning"
        onConfirm={confirmSwitchCustomer}
        onCancel={() => setIsSwitchConfirmOpen(false)}
      />

      {/* Modals & Bottom Drawers */}
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
