"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, StaffRole } from "@/lib/auth-context";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";

interface StaffRouteGuardProps {
  children: React.ReactNode;
}

const SECTION_PERMISSIONS: Record<string, StaffRole[]> = {
  "/controlroom": ["owner", "manager", "cashier", "kitchen"],
  "/controlroom/kitchen": ["owner", "manager", "kitchen"],
  "/controlroom/cashier": ["owner", "manager", "cashier"],
  "/controlroom/tables": ["owner", "manager"],
  "/controlroom/menu": ["owner", "manager"],
  "/controlroom/orders": ["owner", "manager", "cashier", "kitchen"],
  "/controlroom/customers": ["owner", "manager", "cashier"],
  "/controlroom/loyalty": ["owner", "manager", "cashier"],
  "/controlroom/settings": ["owner"],
};

export default function StaffRouteGuard({ children }: StaffRouteGuardProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/controlroom/login";

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push(`/controlroom/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLoading, isLoginPage, pathname, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-xs text-zinc-400">Verifying staff credentials...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Check section permission
  const requiredRoles = SECTION_PERMISSIONS[pathname];
  if (requiredRoles && !hasPermission(requiredRoles)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-8 ring-red-500/5">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold text-zinc-900">
            Access Restricted
          </h2>
          <p className="text-xs text-zinc-600 mt-1 max-w-sm">
            Your current role (<strong>{user.role.toUpperCase()}</strong>) does not have authorization to view this section.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/controlroom"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/controlroom/login"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
          >
            Switch Staff Profile
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

