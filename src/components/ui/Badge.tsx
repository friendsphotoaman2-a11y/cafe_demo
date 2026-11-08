import React from "react";
import { OrderStatus } from "@/lib/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "amber"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline";
  size?: "sm" | "md";
}

export function Badge({
  className = "",
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center font-bold tracking-tight uppercase select-none rounded-full";

  const variants = {
    default: "bg-cafe-950 text-white",
    secondary: "bg-cafe-100 text-cafe-900 border border-cafe-200",
    amber: "bg-amber-100 text-amber-950 border border-amber-300",
    success: "bg-emerald-100 text-emerald-950 border border-emerald-300",
    warning: "bg-orange-100 text-orange-950 border border-orange-300",
    danger: "bg-red-100 text-red-950 border border-red-300",
    info: "bg-blue-100 text-blue-950 border border-blue-300",
    outline: "bg-white text-zinc-700 border border-zinc-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-[11px]",
  };

  return (
    <span
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export interface StatusChipProps {
  status: OrderStatus | "paid_counter" | "unpaid" | string;
  className?: string;
  showStepNumber?: boolean;
}

export function StatusChip({
  status,
  className = "",
  showStepNumber = false,
}: StatusChipProps) {
  switch (status) {
    case "new":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300/80 shadow-2xs ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>{showStepNumber ? "1. New Ticket" : "New"}</span>
        </span>
      );
    case "accepted":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-300/80 shadow-2xs ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span>{showStepNumber ? "2. Accepted" : "Accepted"}</span>
        </span>
      );
    case "preparing":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-900 border border-orange-300/80 shadow-2xs ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
          <span>{showStepNumber ? "3. Brewing" : "Preparing"}</span>
        </span>
      );
    case "ready":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 border border-emerald-300/80 shadow-2xs ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{showStepNumber ? "4. Ready" : "Ready"}</span>
        </span>
      );
    case "served":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs ${className}`}
        >
          <span>✓</span>
          <span>{showStepNumber ? "5. Served" : "Served"}</span>
        </span>
      );
    case "completed":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-700 border border-zinc-200 ${className}`}
        >
          <span>Completed</span>
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-800 border border-red-200 ${className}`}
        >
          <span>Cancelled</span>
        </span>
      );
    case "paid_counter":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 ${className}`}
        >
          <span>● Paid</span>
        </span>
      );
    case "unpaid":
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 ${className}`}
        >
          <span>○ Unpaid</span>
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-800 border border-zinc-200 ${className}`}
        >
          {status}
        </span>
      );
  }
}

