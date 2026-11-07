"use client";

import React, { useState } from "react";
import Link from "next/link";
import ControlRoomHeader from "@/components/controlroom/Header";
import { DEMO_TABLES } from "@/lib/demo-data";
import { CafeTable, TableStatus } from "@/lib/types";
import {
  Grid,
  QrCode,
  Users,
  ExternalLink,
  Plus,
  Clock,
  Printer,
  Sparkles,
} from "lucide-react";

export default function ControlRoomTablesPage() {
  const [filterSection, setFilterSection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredTables = DEMO_TABLES.filter((t) => {
    if (filterSection !== "all" && t.section !== filterSection) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const getStatusBadge = (status: TableStatus) => {
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
        title="Table Matrix &amp; QR Management"
        subtitle="Live floor map of indoor, courtyard, and window tables"
      />

      {/* Action and Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 mr-1">Section:</span>
          {["all", "Indoor Main", "Courtyard Patio", "Mezzanine Loft", "Window Bar"].map((sec) => (
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert("Phase 2 will generate printable PDF sheet of table QR codes.")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50 transition"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-500" />
            <span>Print All QRs (Phase 2)</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <div
            key={table.id}
            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-400 transition"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif text-xl font-bold text-zinc-900">
                  {table.name}
                </span>
                {getStatusBadge(table.status)}
              </div>

              <div className="space-y-1.5 text-xs text-zinc-600 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Section</span>
                  <span className="font-semibold text-zinc-800">{table.section}</span>
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
                        <span className="text-zinc-600">{table.currentCustomerPhone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
              <Link
                href={`/t/${table.code}`}
                target="_blank"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition"
              >
                <QrCode className="h-3.5 w-3.5 text-amber-300" />
                <span>Simulate QR View</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

