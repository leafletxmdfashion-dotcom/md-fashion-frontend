"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

function Shell({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}
