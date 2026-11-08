"use client";

import React, { useState } from "react";
import Image from "next/image";
import ControlRoomHeader from "@/components/controlroom/Header";
import { DEMO_MENU_ITEMS, DEMO_CATEGORIES } from "@/lib/demo-data";
import { MenuItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import {
  Plus,
  Search,
  X,
  Edit2,
} from "lucide-react";

export default function ControlRoomMenuPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<MenuItem[]>(DEMO_MENU_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Toggle item availability
  const toggleAvailability = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    );
  };

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== "all" && item.categoryId !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Menu Catalog &amp; Pricing Management"
        subtitle="Manage 18+ dishes, coffee roasts, real-time stock 86-ing, and INR prices"
      />

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes or items..."
              className="w-full rounded-xl border border-zinc-200 py-2 pl-9 pr-3 text-xs focus:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === "all"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All Categories
            </button>
            {DEMO_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === c.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm hover:bg-amber-400 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Menu Item</span>
        </button>
      </div>

      {/* Menu Items Table / Cards */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Item &amp; Photo</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Price (INR)</th>
                <th className="py-3.5 px-4">Diet &amp; Profile</th>
                <th className="py-3.5 px-4">Stock Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/60 transition">
                  {/* Photo & Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-zinc-900 block text-xs">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 line-clamp-1 max-w-xs">
                          {item.description}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 font-medium text-zinc-700 capitalize">
                    {item.categoryId.replace("-", " ")}
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4 font-bold text-zinc-900">
                    {formatINR(item.price)}
                  </td>

                  {/* Diet & Profile */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          item.classification === "veg"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.classification === "vegan"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.classification}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                        {item.servingTemperature}
                      </span>
                    </div>
                  </td>

                  {/* Stock Toggle Button */}
                  <td className="py-3 px-4">
                    <button
                      onClick={() => toggleAvailability(item.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        item.isAvailable
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.isAvailable ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      <span>{item.isAvailable ? "In Stock" : "86'd (Sold Out)"}</span>
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() =>
                        showToast(`Editing for "${item.name}" is coming soon.`, "info")
                      }
                      className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition"
                      aria-label="Edit item"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Item Modal Preview */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Add New Dish or Beverage (Preview)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block text-zinc-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cinnamon French Toast"
                  className="w-full rounded-xl border p-2.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Category
                  </label>
                  <select className="w-full rounded-xl border p-2.5 text-xs bg-white">
                    {DEMO_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    placeholder="250"
                    className="w-full rounded-xl border p-2.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Fresh brioche soaked in spiced egg batter..."
                  className="w-full rounded-xl border p-2.5 text-xs"
                />
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 text-[11px]">
                <strong>Phase 1 UI Notice:</strong> In Phase 3, this form writes directly to the Supabase database. In Phase 1, sample items are persisted in the centralized typed demo layer.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  showToast("Menu item creation will be saved to Supabase in next update.", "info");
                  setIsAddModalOpen(false);
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
              >
                Save Menu Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

