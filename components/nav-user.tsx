"use client";

import { ChevronRight, LogOut, Monitor, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/hooks/use-logout";
import type { CurrentUser } from "@/features/auth/types/auth.types";
import { initials } from "@/lib/initials";

export function NavUser({ user }: { user: CurrentUser }) {
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="gap-2.5 px-2 data-popup-open:bg-sidebar-accent" />}
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary-soft text-xs font-semibold text-link">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight">
              <span className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 rounded-[5px] bg-primary-soft px-1.5 py-px text-[10px] font-semibold tracking-wide text-link uppercase">
                  {user.role.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </div>
            <ChevronRight className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={12} className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-[13px] font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/account" />}>
              <UserRound />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/account/security" />}>
              <ShieldCheck />
              Security
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(value) => setTheme(String(value))}>
                <DropdownMenuRadioItem value="light">
                  <Sun />
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon />
                  Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor />
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
