"use client";

import React, { useState } from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import TableQrModal from "@/components/controlroom/TableQrModal";
import PrintAllQrSheet from "@/components/controlroom/PrintAllQrSheet";
import { useCafeStore } from "@/lib/store";
import { CafeTable, TableSection, TableStatus } from "@/lib/types";
import {
  Grid,
  QrCode,
  Users,
  ExternalLink,
  Plus,
  Printer,
  Edit2,
  Power,
  X,
  Check,
  AlertCircle,
} from "lucide-react";

export default function ControlRoomTablesPage() {
  const {
    tables,
    addTable,
    updateTable,
    toggleTableActive,
    regenerateTableQr,
  } = useCafeStore();

  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modals state
  const [selectedTableForQr, setSelectedTableForQr] = useState<CafeTable | null>(
    null
  );
  const [isPrintAllOpen, setIsPrintAllOpen] = useState(false);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<CafeTable | null>(null);

  // Form states
  const [newTableCode, setNewTableCode] = useState("");
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableSection, setNewTableSection] =
    useState<TableSection>("Indoor Main");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editCapacity, setEditCapacity] = useState(4);
  const [editSection, setEditSection] = useState<TableSection>("Indoor Main");

  const handleOpenEdit = (t: CafeTable) => {
    setEditingTable(t);
    setEditName(t.name);
    setEditCapacity(t.capacity);
    setEditSection(t.section);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    updateTable(editingTable.id, {
      name: editName,
      capacity: editCapacity,
      section: editSection,
    });
    setEditingTable(null);
  };

  const handleCreateNewTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableCode.trim()) {
      setFormError("Table code is required.");
      return;
    }
    const res = addTable({
      code: newTableCode,
      name: newTableName,
      capacity: newTableCapacity,
      section: newTableSection,
    });
    if (!res.success) {
      setFormError(res.error || "Failed to create table.");
      return;
    }
    setIsAddTableOpen(false);
    setNewTableCode("");
    setNewTableName("");
    setFormError(null);
  };

  const filteredTables = tables.filter((t) => {
    if (filterSection !== "all" && t.section !== filterSection) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: TableStatus, isActive: boolean) => {
    if (!isActive) {
      return (
        <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600">
          Disabled
        </span>
      );
    }
    switch (status) {
      case "available":
        return (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
            Available
          </span>
        );
      case "occupied":
        return (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
            Occupied
          </span>
        );
      case "order_pending":
        return (
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
            Order Pending
          </span>
        );
      case "preparing":
        return (
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700 border border-orange-200">
            In Kitchen
          </span>
        );
      case "billed":
        return (
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
            Ready to Bill
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <ControlRoomHeader
        title="Table &amp; QR Management"
        subtitle="Generate unique scannable QRs, manage floor capacities, and export printable tent cards"
      />

      {/* Action and Filter Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 mr-1">Section:</span>
          {[
            "all",
            "Indoor Main",
            "Courtyard Patio",
            "Mezzanine Loft",
            "Window Bar",
          ].map((sec) => (
            <button
              key={sec}
              onClick={() => setFilterSection(sec)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterSection === sec
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {sec === "all" ? "All Sections" : sec}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPrintAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 transition"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-600" />
            <span>Print All QRs (A4 Sheet)</span>
          </button>

          <button
            onClick={() => {
              setIsAddTableOpen(true);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => {
          const isSelected = selectedTableForQr?.code === table.code;

          return (
            <div
              key={table.id}
              className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:border-zinc-400 ${
                !table.isActive ? "opacity-60 bg-zinc-50 border-dashed" : "border-zinc-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-serif text-xl font-bold text-zinc-900">
                    {table.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(table.status, table.isActive)}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Section</span>
                    <span className="font-semibold text-zinc-800">
                      {table.section}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Capacity</span>
                    <span className="font-semibold text-zinc-800 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {table.capacity} Persons
                    </span>
                  </div>

                  {table.currentCustomerName && (
                    <div className="pt-2 border-t border-zinc-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Seated Guest</span>
                        <span className="font-bold text-zinc-900">
                          {table.currentCustomerName}
                        </span>
                      </div>
                      {table.currentCustomerPhone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-400">Phone</span>
                          <span className="text-zinc-600">
                            {table.currentCustomerPhone}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-zinc-100 space-y-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedTableForQr(table)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
                  >
                    <QrCode className="h-3.5 w-3.5 text-amber-300" />
                    <span>View / Print QR</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(table)}
                    className="p-2 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition"
                    title="Edit Table Details"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => toggleTableActive(table.id)}
                    className={`p-2 rounded-xl transition ${
                      table.isActive
                        ? "text-zinc-500 hover:text-red-600 hover:bg-red-50"
                        : "text-red-500 hover:text-emerald-600 hover:bg-emerald-50"
                    }`}
                    title={table.isActive ? "Disable Table" : "Enable Table"}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Link
                  href={`/t/${table.code}`}
                  target="_blank"
                  className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  <span>Open Customer View</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* QR Details Modal */}
      <TableQrModal
        table={selectedTableForQr}
        isOpen={!!selectedTableForQr}
        onClose={() => setSelectedTableForQr(null)}
        onRegenerateQr={(code) => {
          regenerateTableQr(code);
        }}
      />

      {/* Print All Sheet Modal */}
      <PrintAllQrSheet
        tables={tables.filter((t) => t.isActive)}
        isOpen={isPrintAllOpen}
        onClose={() => setIsPrintAllOpen(false)}
      />

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Add New Table
              </h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="text-zinc-400 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateNewTable} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block text-zinc-700 mb-1">
                  Table Number Code (e.g. 13) *
                </label>
                <input
                  type="text"
                  required
                  value={newTableCode}
                  onChange={(e) => setNewTableCode(e.target.value)}
                  placeholder="e.g. 13"
                  className="w-full rounded-xl border p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold block text-zinc-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. Table 13"
                  className="w-full rounded-xl border p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newTableCapacity}
                    onChange={(e) =>
                      setNewTableCapacity(Number(e.target.value))
                    }
                    className="w-full rounded-xl border p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Section
                  </label>
                  <select
                    value={newTableSection}
                    onChange={(e) =>
                      setNewTableSection(e.target.value as TableSection)
                    }
                    className="w-full rounded-xl border p-2.5 text-xs bg-white focus:border-zinc-800 focus:outline-none"
                  >
                    <option value="Indoor Main">Indoor Main</option>
                    <option value="Courtyard Patio">Courtyard Patio</option>
                    <option value="Mezzanine Loft">Mezzanine Loft</option>
                    <option value="Window Bar">Window Bar</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-serif text-lg font-bold text-zinc-900">
                Edit {editingTable.name} (Code: {editingTable.code})
              </h3>
              <button
                onClick={() => setEditingTable(null)}
                className="text-zinc-400 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block text-zinc-700 mb-1">
                  Table Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border p-2.5 text-xs focus:border-zinc-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold block text-zinc-700 mb-1">
                    Seating Section
                  </label>
                  <select
                    value={editSection}
                    onChange={(e) =>
                      setEditSection(e.target.value as TableSection)
                    }
                    className="w-full rounded-xl border p-2.5 text-xs bg-white focus:border-zinc-800 focus:outline-none"
                  >
                    <option value="Indoor Main">Indoor Main</option>
                    <option value="Courtyard Patio">Courtyard Patio</option>
                    <option value="Mezzanine Loft">Mezzanine Loft</option>
                    <option value="Window Bar">Window Bar</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
