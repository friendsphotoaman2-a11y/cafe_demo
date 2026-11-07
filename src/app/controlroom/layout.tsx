import React from "react";
import ControlRoomSidebar from "@/components/controlroom/Sidebar";
import DemoNoticeBanner from "@/components/controlroom/DemoNoticeBanner";
import { AuthProvider } from "@/lib/auth-context";
import StaffRouteGuard from "@/components/controlroom/StaffRouteGuard";

export const metadata = {
  title: "Brew & Bean — Café Control Room HQ",
  description: "Private restaurant administration & operations dashboard",
};

export default function ControlRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col lg:flex-row bg-zinc-100 text-zinc-900 font-sans">
        <ControlRoomSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DemoNoticeBanner />
          <StaffRouteGuard>
            <main className="flex-1">{children}</main>
          </StaffRouteGuard>
        </div>
      </div>
    </AuthProvider>
  );
}
