import type { NavGroup, NavItem } from "@/types/navigation";

import type { CurrentUser, Permission } from "../types/auth.types";

// UX-only visibility checks. The API is the security boundary.
export function hasPermission(user: Pick<CurrentUser, "permissions"> | null | undefined, permission: Permission) {
  return Boolean(user?.permissions.includes(permission));
}

/**
 * Removes items the user cannot see, filters nested items, and drops parents
 * whose children are all hidden and groups left empty.
 */
export function filterNavigation(groups: NavGroup[], permissions: readonly Permission[]): NavGroup[] {
  const granted = new Set(permissions);
  const allowed = (permission?: Permission) => !permission || granted.has(permission);

  return groups
    .map((group) => ({
      ...group,
      items: group.items.flatMap((item): NavItem[] => {
        if (!allowed(item.permission)) return [];
        if (!item.items) return [item];
        const children = item.items.filter((child) => allowed(child.permission));
        return children.length > 0 ? [{ ...item, items: children }] : [];
      }),
    }))
    .filter((group) => group.items.length > 0);
}
