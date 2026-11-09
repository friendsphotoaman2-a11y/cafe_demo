"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiUrl, withBasePath } from "@/lib/base-path";

export type StaffRole = "owner" | "manager" | "cashier" | "kitchen";

export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  isAuthenticated: boolean;
  authMethod: "supabase_auth" | "staff_pin" | "demo";
}

interface AuthContextType {
  user: StaffUser | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithStaffRole: (role: StaffRole, pin?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (requiredRoles: StaffRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  loginWithGoogle: async () => {},
  loginWithStaffRole: async () => ({ success: false }),
  logout: async () => {},
  hasPermission: () => false,
});

const SESSION_STORAGE_KEY = "tbw_staff_auth_session_v3";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        // 1. Check Supabase Auth User
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && session.user) {
          const email = session.user.email || "";
          let role: StaffRole = "owner";
          if (email.includes("kitchen")) role = "kitchen";
          else if (email.includes("cashier")) role = "cashier";
          else if (email.includes("manager")) role = "manager";

          setUser({
            id: session.user.id,
            email,
            fullName: session.user.user_metadata?.full_name || email.split("@")[0],
            role,
            isAuthenticated: true,
            authMethod: "supabase_auth",
          });
          setIsLoading(false);
          return;
        }

        // 2. Check local staff session
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(SESSION_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
          }
        }
      } catch {
        // fallback
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, [supabase.auth]);

  const loginWithGoogle = async () => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "http://localhost:3000";

    const callbackUrl = `${origin}${withBasePath(
      "/auth/callback?next=" + encodeURIComponent(withBasePath("/controlroom"))
    )}`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });
  };

  const loginWithStaffRole = async (
    role: StaffRole,
    pin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(apiUrl("/api/auth/staff-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || "Authentication failed." };
      }

      setUser(data.user);
      if (typeof window !== "undefined") {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.user));
      }
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during authentication",
      };
    }
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/auth/staff-logout"), { method: "POST" });
    } catch {
      // Ignored
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    router.push("/controlroom/login");
  };

  const hasPermission = (requiredRoles: StaffRole[]): boolean => {
    if (!user || !user.isAuthenticated) return false;
    if (user.role === "owner") return true; // Owner has all permissions
    return requiredRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogle,
        loginWithStaffRole,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

