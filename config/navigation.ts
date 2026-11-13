import {
  BookUser,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Scissors,
  ScrollText,
  Settings,
  Shield,
  Shirt,
  UserRound,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";

import type { NavGroup } from "@/types/navigation";

// ponytail: modules not built yet have no API permissions, so their placeholder items
// are visible to every signed-in user. Add a `permission` once the catalog has one.
export const navigation: NavGroup[] = [
  {
    title: "Overview",
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
    title: "Fabric",
    items: [
      {
        title: "Purchase / Inward",
        href: "/fabric/purchases",
        icon: PackagePlus,
        permission: "fabric.view",
      },
      {
        title: "Stock & Ledger",
        href: "/fabric/ledger",
        icon: ScrollText,
        permission: "fabric.view",
      },
    ],
  },
  {
    title: "Production",
    items: [
      {
        title: "Cutting",
        href: "/cutting",
        icon: Scissors,
        permission: "production.view",
      },
      {
        title: "Stitching",
        href: "/stitching",
        icon: Shirt,
        permission: "stitching.view",
      },
      {
        title: "Rework & Reject",
        href: "/rework",
        icon: RotateCcw,
        permission: "stitching.view",
      },
      {
        title: "Packing",
        href: "/packing",
        icon: Package,
        permission: "packing.view",
      },
      {
        title: "Godown",
        href: "/godown",
        icon: Warehouse,
        permission: "godown.view",
      },
      {
        title: "Finished Goods",
        href: "/finished-goods",
        icon: PackageCheck,
        permission: "godown.view",
      },
    ],
  },
  {
    title: "Workers",
    items: [
      {
        title: "Staff & Karigar",
        href: "/karigar",
        icon: UserRound,
        exact: true,
        permission: "karigar.view",
      },
      {
        title: "Jogadi Teams",
        href: "/jogadi",
        icon: UsersRound,
        permission: "karigar.view",
      },
      {
        title: "Payments",
        href: "/karigar/payments",
        icon: Wallet,
        permission: "payments.view",
      },
      {
        title: "My Ledger",
        href: "/my-ledger",
        icon: BookUser,
        linkedPersonOnly: true,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        title: "Costing",
        href: "/costing",
        icon: Calculator,
        description: "Source-driven Lot costs and cost per Good piece.",
      },
      {
        title: "Reports",
        href: "/reports",
        icon: ChartNoAxesCombined,
        description: "Filterable reports for every stage, with Excel, CSV and PDF export.",
      },
      {
        title: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        description: "Review requested corrections with old and proposed values.",
      },
      {
        title: "Roles & Permissions",
        href: "/roles",
        icon: Shield,
        permission: "users.view",
      },
      {
        title: "Audit Log",
        href: "/audit-log",
        icon: FileClock,
        permission: "roles.manage",
        description: "Who changed what, when, and why, with old and new values.",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "roles.manage",
        description: "Numbering, thresholds and system defaults.",
      },
    ],
  },
];
