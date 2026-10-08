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
  const shortcuts = useMemo(
    () =>
      filterNavigation(navigation, user?.permissions ?? [])
        .flatMap((group) => group.items)
        .filter((item) => item.href && item.href !== "/dashboard"),
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

      <div>
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">Jump to</h3>
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="bg-background">
                <Link
                  href={item.href!}
                  className="group flex items-center gap-3 px-3 py-3 text-[13px] outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
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
    </div>
  );
}
