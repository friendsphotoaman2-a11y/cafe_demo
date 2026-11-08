import React from "react";

export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-zinc-200/80 ${className}`}
      {...props}
    />
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/60 p-8 text-center space-y-3 ${className}`}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 mb-1">
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <h3 className="font-serif text-base font-bold text-zinc-900">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
