import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Package,
  PackageOpen,
  Settings,
  Shirt,
  ShoppingCart,
  UserCog,
  Users,
} from "lucide-react";

import type { NavGroup } from "@/types/navigation";

export const navigation: NavGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
        exact: true,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        title: "Products",
        href: "/products",
        icon: Package,
        permission: "products.view",
      },
      {
        title: "Garments",
        href: "/garments",
        icon: Shirt,
        permission: "garments.view",
      },
      {
        title: "Orders",
        href: "/orders",
        icon: ShoppingCart,
        permission: "orders.view",
      },
      {
        title: "Inventory",
        icon: Boxes,
        permission: "inventory.view",
        items: [
          {
            title: "Stock",
            href: "/inventory",
            permission: "inventory.view",
          },
          {
            title: "Stock Movements",
            href: "/inventory/movements",
            permission: "inventory.view",
          },
        ],
      },
      {
        title: "Leftovers",
        href: "/leftovers",
        icon: PackageOpen,
        permission: "leftovers.view",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        permission: "customers.view",
      },
      {
        title: "Reports",
        href: "/reports",
        icon: ChartNoAxesCombined,
        permission: "reports.view",
      },
      {
        title: "Activity",
        href: "/activity",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Members",
        href: "/users",
        icon: UserCog,
        permission: "users.view",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings.manage",
      },
    ],
  },
];
