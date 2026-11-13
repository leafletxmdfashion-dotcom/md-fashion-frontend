import { Boxes, LayoutDashboard, Settings, Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { NavGroup } from "@/types/navigation";

import { filterNavigation, hasPermission } from "./permissions";

const groups: NavGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        title: "Inventory",
        icon: Boxes,
        items: [
          { title: "Stock", href: "/inventory", permission: "fabric.view" },
          {
            title: "Adjust",
            href: "/inventory/adjust",
            permission: "fabric.adjust",
          },
        ],
      },
      { title: "Activity", href: "/activity", icon: Users },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "roles.manage",
      },
    ],
  },
];

describe("filterNavigation", () => {
  it("removes unauthorized items and nested children", () => {
    const result = filterNavigation(groups, ["dashboard.view", "fabric.view"]);
    const inventory = result[1]!.items.find((item) => item.title === "Inventory");
    expect(inventory?.items?.map((item) => item.title)).toEqual(["Stock"]);
  });

  it("drops a parent whose children are all unauthorized", () => {
    const result = filterNavigation(groups, ["dashboard.view"]);
    expect(result[1]!.items.map((item) => item.title)).toEqual(["Activity"]);
  });

  it("drops groups left empty", () => {
    const result = filterNavigation(groups, ["dashboard.view"]);
    expect(result.map((group) => group.title)).toEqual([undefined, "Management"]);
  });

  it("keeps items without a permission requirement", () => {
    expect(filterNavigation(groups, [])[0]!.items.map((item) => item.title)).toEqual(["Activity"]);
  });
});

describe("filterNavigation: own ledger", () => {
  const groups: NavGroup[] = [
    {
      items: [
        {
          title: "My Ledger",
          href: "/my-ledger",
          icon: Users,
          linkedPersonOnly: true,
        },
      ],
    },
  ];

  it("shows My Ledger only to logins linked to a staff or karigar record", () => {
    expect(filterNavigation(groups, ["users.manage"])).toEqual([]);
    expect(filterNavigation(groups, [], { linkedPerson: true })[0]?.items.map((item) => item.title)).toEqual([
      "My Ledger",
    ]);
  });
});

describe("hasPermission", () => {
  it("is false for a signed-out user", () => {
    expect(hasPermission(null, "users.view")).toBe(false);
    expect(hasPermission({ permissions: ["users.view"] }, "users.view")).toBe(true);
  });
});
