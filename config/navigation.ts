import {
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileClock,
  Grid3x3,
  LayoutDashboard,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Ruler,
  Scissors,
  ScrollText,
  Settings,
  Shield,
  Shirt,
  Tags,
  UserRound,
  Users,
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
        title: "Fabric Master",
        href: "/fabric",
        icon: Layers,
        exact: true,
        permission: "fabric.view",
      },
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
        title: "Stitching / Jogadi",
        href: "/stitching",
        icon: Shirt,
        description: "Issue cut pieces to Jogadi teams and receive Good, Rework and Reject.",
      },
      {
        title: "Rework & Reject",
        href: "/rework",
        icon: RotateCcw,
        description: "Track rework from pending to completed, and log rejects with reasons.",
      },
      {
        title: "Packing",
        href: "/packing",
        icon: Package,
        description: "Pack Good pieces by Lot, article, colour and size.",
      },
      {
        title: "Godown",
        href: "/godown",
        icon: Warehouse,
        description: "Receive packed goods into the godown and confirm quantities.",
      },
      {
        title: "Finished Goods",
        href: "/finished-goods",
        icon: PackageCheck,
        description: "Finished goods balances and dispatch by challan.",
      },
    ],
  },
  {
    title: "Setup / Masters",
    items: [
      {
        title: "Items / Designs",
        href: "/items",
        icon: Tags,
        permission: "production.view",
      },
      {
        title: "Size Templates",
        href: "/size-templates",
        icon: Ruler,
        permission: "production.view",
      },
    ],
  },
  {
    title: "Workers",
    items: [
      {
        title: "Karigar Master",
        href: "/karigar",
        icon: UserRound,
        exact: true,
        permission: "karigar.view",
      },
      {
        title: "Jogadi Teams",
        href: "/jogadi",
        icon: UsersRound,
        description: "Stitching teams, members and earning split.",
      },
      {
        title: "Payments",
        href: "/karigar/payments",
        icon: Wallet,
        description: "Earnings, advances, deductions and outstanding balance per person.",
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
        permission: "reports.view",
        description: "Filterable reports for every stage, with Excel, CSV and PDF export.",
      },
      {
        title: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        description: "Review requested corrections with old and proposed values.",
      },
      {
        title: "Users",
        href: "/users",
        icon: Users,
        permission: "users.view",
      },
      {
        title: "Roles",
        href: "/roles",
        icon: Shield,
        permission: "users.view",
        description: "Roles and who holds them.",
      },
      {
        title: "Permission Matrix",
        href: "/permissions",
        icon: Grid3x3,
        permission: "settings.manage",
        description: "Grant view, create, edit, finalize and approve rights per role.",
      },
      {
        title: "Audit Log",
        href: "/audit-log",
        icon: FileClock,
        permission: "settings.manage",
        description: "Who changed what, when, and why, with old and new values.",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings.manage",
        description: "Numbering, thresholds and system defaults.",
      },
    ],
  },
];
