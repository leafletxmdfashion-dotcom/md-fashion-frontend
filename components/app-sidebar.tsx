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
    () =>
      filterNavigation(navigation, user.permissions, {
        linkedPerson: user.karigarId !== null,
      }),
    [user.permissions, user.karigarId],
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 p-0">
        {/* Same height as the top bar so their bottom borders form one line. */}
        {/* Same height as the top bar so their bottom borders form one line. The lockup and the
            monogram cross-fade in place while the sidebar folds, instead of swapping. */}
        <div className="flex h-14 items-center overflow-hidden border-b border-sidebar-border px-3 md:h-16">
          <Link
            href="/dashboard"
            aria-label="MD Fashion Center, go to dashboard"
            className="relative flex h-11 min-w-0 flex-1 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <BrandLogo className="w-[235px] shrink-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0" />
            <BrandMonogram className="absolute -left-0.5 w-9 opacity-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-100" />
          </Link>
        </div>
        <div className="px-2 pt-3 pb-1">
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
