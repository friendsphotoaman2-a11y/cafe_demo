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
import {
  DEMO_CATEGORIES,
  DEMO_MENU_ITEMS,
  DEMO_TABLES,
  DEMO_SETTINGS,
} from "@/lib/demo-data";
import {
  MenuItem,
  CartItem,
  OrderCustomizationChoice,
} from "@/lib/types";
import {
  Coffee,
  ShoppingBag,
  User,
  Search,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
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

  const tableData = DEMO_TABLES.find((t) => t.code === formattedCode) || {
    id: `custom-${formattedCode}`,
    code: formattedCode,
    name: `Table ${formattedCode}`,
    capacity: 4,
    section: "Indoor Main" as const,
    status: "available" as const,
  };

  // State
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedVegFilter, setSelectedVegFilter] = useState<string>("all");

  // Selected item for modal
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState<string>("");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);

  // Customer Onboarding state
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);

  // Review modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);

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
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.flavour.toLowerCase().includes(q)
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
    const customSuffix = selectedCustomizations.map((c) => c.optionName).sort().join("-");
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

  // Proceeding to checkout review
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

  const handleOrderSuccess = (orderNo: string) => {
    setPlacedOrderNumber(orderNo);
    setCartItems([]);
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

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
                {tableData.section} &bull; Scan &amp; Order
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

      {/* Hero Table Banner */}
      <section className="bg-gradient-to-r from-cafe-950 via-cafe-900 to-cafe-950 text-white py-6 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Table Ordering Experience</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">
              Ordering for Table {formattedCode}
            </h1>
            <p className="text-xs text-zinc-300 mt-0.5">
              Select your favorites below &bull; Items are delivered directly to Table {formattedCode}.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-zinc-300 backdrop-blur-xs">
            <AlertCircle className="h-4 w-4 text-amber-300 shrink-0" />
            <span>Fictional Demo Session &bull; Pay at Counter</span>
          </div>
        </div>
      </section>

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

      {/* Menu Grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              isTableMode={true}
              onSelect={(i) => setSelectedItem(i)}
              onQuickAdd={(i) => {
                // Quick add with default options
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
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onProceedToReview={handleProceedToReview}
        kitchenNotes={kitchenNotes}
        onKitchenNotesChange={setKitchenNotes}
      />

      <TableOrderReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        tableCode={formattedCode}
        customerName={customerName || "Table Guest"}
        customerPhone={customerPhone || "+91 98000 00000"}
        cartItems={cartItems}
        kitchenNotes={kitchenNotes}
        onOrderSuccess={handleOrderSuccess}
        onEditCustomer={() => {
          setIsReviewModalOpen(false);
          setIsOnboardingModalOpen(true);
        }}
      />
    </div>
  );
}

