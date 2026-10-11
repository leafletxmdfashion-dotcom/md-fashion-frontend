"use client";

import Link from "next/link";
import { useMemo } from "react";

import { BrandMark } from "@/components/brand-mark";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navigation } from "@/config/navigation";
import { filterNavigation } from "@/features/auth/lib/permissions";
import type { CurrentUser } from "@/features/auth/types/auth.types";

export function AppSidebar({ user }: { user: CurrentUser }) {
  // Visibility only; every route's data is still authorized by the API.
  const groups = useMemo(
    () => filterNavigation(navigation, user.permissions),
    [user.permissions],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              {/* Menu buttons size every svg as an icon; the logo opts out. */}
              <BrandMark className="h-auto! w-10! group-data-[collapsible=icon]:w-9!" />
              <span className="grid leading-tight">
                <span className="truncate text-[15px] font-semibold tracking-tight">
                  MD Fashion
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Garment Manager
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
