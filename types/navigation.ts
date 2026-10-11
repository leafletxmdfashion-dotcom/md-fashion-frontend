import type { LucideIcon } from "lucide-react";

import type { Permission } from "@/features/auth/types/auth.types";

export interface NavSubItem {
  title: string;
  href: string;
  permission?: Permission;
}

export interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
  permission?: Permission;
  exact?: boolean;
  /** Marks a module with no page yet: app/(dashboard)/[...slug] serves it. Remove once built. */
  description?: string;
  items?: NavSubItem[];
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}
