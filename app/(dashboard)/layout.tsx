"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ConnectionBanner } from "@/components/connection-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

// The sidebar primitive writes this cookie on every toggle.
function sidebarWasOpen(): boolean {
  return !document.cookie.split("; ").includes("sidebar_state=false");
}

function Shell({ children }: { children: React.ReactNode }) {
  const { data: user } = useCurrentUser();
  // Only reached in the browser: the session is fetched client-side, so `document` exists.
  if (!user) return null;
  return (
    <SidebarProvider defaultOpen={sidebarWasOpen()}>
      <AppSidebar user={user} />
      <SidebarInset>
        <ConnectionBanner />
        {children}
      </SidebarInset>
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
