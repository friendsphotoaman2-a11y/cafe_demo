"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import TableQrModal from "@/components/controlroom/TableQrModal";
import PrintAllQrSheet from "@/components/controlroom/PrintAllQrSheet";
import { useCafeStore } from "@/lib/store";
import { CafeTable, TableSection, TableStatus } from "@/lib/types";
import {
  getBaseOrderingUrl,
  getTableOrderingUrl,
  setStoredQrBaseUrl,
  resetStoredQrBaseUrl,
  DEFAULT_LAN_BASE_URL,
} from "@/lib/qr-generator";
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
  Globe,
  Save,
  RotateCcw,
  Wifi,
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

  // Configurable QR Base URL
  const [qrBaseUrl, setQrBaseUrl] = useState<string>(DEFAULT_LAN_BASE_URL);
  const [inputBaseUrl, setInputBaseUrl] = useState<string>(DEFAULT_LAN_BASE_URL);
  const [urlSavedFeedback, setUrlSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    const active = getBaseOrderingUrl();
    setQrBaseUrl(active);
    setInputBaseUrl(active);
  }, []);

  const handleSaveBaseUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputBaseUrl.trim()) return;
    setStoredQrBaseUrl(inputBaseUrl);
    setQrBaseUrl(inputBaseUrl.trim().replace(/\/+$/, ""));
    setUrlSavedFeedback(true);
    setTimeout(() => setUrlSavedFeedback(false), 2500);
  };

  const handleResetLan = () => {
    setInputBaseUrl(DEFAULT_LAN_BASE_URL);
    setStoredQrBaseUrl(DEFAULT_LAN_BASE_URL);
    setQrBaseUrl(DEFAULT_LAN_BASE_URL);
    setUrlSavedFeedback(true);
    setTimeout(() => setUrlSavedFeedback(false), 2500);
  };

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

      {/* Owner-Editable Public QR Base URL Panel */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-serif text-sm font-bold text-zinc-900">
                Public QR Ordering Base URL
              </h3>
              <p className="text-[11px] text-zinc-500">
                Encoded into all table QR codes. Use your laptop Wi-Fi IP for phone testing or your HTTPS public domain in production.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
              Active: {qrBaseUrl}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveBaseUrl} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputBaseUrl}
                onChange={(e) => setInputBaseUrl(e.target.value)}
                placeholder="e.g. http://10.84.23.121:3000 or https://yourdomain.com"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-900 focus:border-zinc-800 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition active:scale-95"
            >
              <Save className="h-3.5 w-3.5 text-amber-300" />
              <span>Apply Base URL</span>
            </button>

            <button
              type="button"
              onClick={handleResetLan}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition active:scale-95"
              title="Reset to 10.84.23.121:3000"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-500" />
              <span>Wi-Fi (10.84.23.121)</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 pt-1">
            <span className="font-semibold text-zinc-400">Quick Presets:</span>
            <button
              type="button"
              onClick={() => {
                setInputBaseUrl("http://10.84.23.121:3000");
                setStoredQrBaseUrl("http://10.84.23.121:3000");
                setQrBaseUrl("http://10.84.23.121:3000");
                setUrlSavedFeedback(true);
                setTimeout(() => setUrlSavedFeedback(false), 2500);
              }}
              className="rounded-lg bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200 font-mono text-[10px] text-zinc-700"
            >
              Wi-Fi: 10.84.23.121:3000
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  setInputBaseUrl(window.location.origin);
                  setStoredQrBaseUrl(window.location.origin);
                  setQrBaseUrl(window.location.origin);
                  setUrlSavedFeedback(true);
                  setTimeout(() => setUrlSavedFeedback(false), 2500);
                }
              }}
              className="rounded-lg bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200 font-mono text-[10px] text-zinc-700"
            >
              Current Browser Host
            </button>
            <button
              type="button"
              onClick={() => {
                setInputBaseUrl("https://brewandbean.in");
                setStoredQrBaseUrl("https://brewandbean.in");
                setQrBaseUrl("https://brewandbean.in");
                setUrlSavedFeedback(true);
                setTimeout(() => setUrlSavedFeedback(false), 2500);
              }}
              className="rounded-lg bg-zinc-100 px-2 py-0.5 hover:bg-zinc-200 font-mono text-[10px] text-zinc-700"
            >
              https://brewandbean.in
            </button>
          </div>

          {urlSavedFeedback && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl animate-fade-in">
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Base URL updated! All table QRs regenerated with {qrBaseUrl}</span>
            </div>
          )}
        </form>
      </div>

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

                  {/* QR Scan URL Display on Table Card */}
                  <div className="pt-2 border-t border-zinc-100">
                    <div className="rounded-xl bg-amber-50/60 p-2 border border-amber-200/60 text-[10px] space-y-0.5">
                      <span className="text-amber-800 font-bold uppercase tracking-wider block text-[9px]">
                        Scannable QR URL
                      </span>
                      <p className="font-mono text-zinc-900 font-bold truncate select-all">
                        {getTableOrderingUrl(table.code, table.qrNonce, qrBaseUrl)}
                      </p>
                    </div>
                  </div>
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
                  href={getTableOrderingUrl(table.code, table.qrNonce, qrBaseUrl)}
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
        customBaseUrl={qrBaseUrl}
      />

      {/* Print All Sheet Modal */}
      <PrintAllQrSheet
        tables={tables.filter((t) => t.isActive)}
        isOpen={isPrintAllOpen}
        onClose={() => setIsPrintAllOpen(false)}
        customBaseUrl={qrBaseUrl}
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
