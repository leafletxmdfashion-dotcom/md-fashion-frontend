"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { navigation } from "@/config/navigation";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { filterNavigation } from "@/features/auth/lib/permissions";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardOverview() {
  const { data: user } = useCurrentUser();
  const sections = useMemo(
    () =>
      filterNavigation(navigation, user?.permissions ?? [])
        .map((group) => ({ ...group, items: group.items.filter((item) => item.href && item.href !== "/dashboard") }))
        .filter((group) => group.items.length > 0),
    [user?.permissions],
  );

  if (!user) return null;

  return (
    <div className="grid gap-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {greeting(new Date().getHours())}, {user.name.split(" ")[0]}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Signed in as {user.role.name}.</p>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">{section.title}</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <Link
                    href={item.href!}
                    className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-3 text-[13px] outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    <span className="font-medium">{item.title}</span>
                    <ArrowUpRight
                      className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
