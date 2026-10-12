"use client";

import Link from "next/link";
import { useMemo } from "react";

import { BrandLogo, BrandMonogram } from "@/components/brand-mark";
import { CommandMenu } from "@/components/command-menu";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navigation } from "@/config/navigation";
import { filterNavigation } from "@/features/auth/lib/permissions";
import type { CurrentUser } from "@/features/auth/types/auth.types";

/** Edge-to-edge sidebar. Its toggle lives in the page top bar (and Ctrl/⌘ + B). */
export function AppSidebar({ user }: { user: CurrentUser }) {
  // Visibility only; every route's data is still authorized by the API.
  const groups = useMemo(
    () => filterNavigation(navigation, user.permissions),
    [user.permissions],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 p-0">
        {/* Same height as the top bar so their bottom borders form one line. */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-3 md:h-16 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Link
            href="/dashboard"
            aria-label="MD Fashion Center, go to dashboard"
            className="flex min-w-0 flex-1 items-center rounded-md outline-none group-data-[collapsible=icon]:flex-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            {/* Full lockup when expanded, filling the header; the bare monogram when collapsed. */}
            <BrandLogo className="w-[235px] group-data-[collapsible=icon]:hidden" />
            <BrandMonogram className="hidden w-9 group-data-[collapsible=icon]:block" />
          </Link>
        </div>
        <div className="px-3 pt-3 pb-1 group-data-[collapsible=icon]:px-2">
          <CommandMenu groups={groups} />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={groups} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
