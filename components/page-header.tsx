"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { navigation } from "@/config/navigation";

/** Section for the breadcrumb, from the sidebar config (longest matching href wins). */
function useTrail(title: string): { group?: string; href?: string } {
  const pathname = usePathname();
  if (pathname.startsWith("/account")) {
    return title === "Account" ? {} : { group: "Account", href: "/account" };
  }
  const match = navigation
    .flatMap((group) => group.items.map((item) => ({ group: group.title, href: item.href })))
    .filter((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href!.length - a.href!.length)[0];
  return match?.group && match.group !== title ? { group: match.group } : {};
}

function Topbar({ title }: { title: string }) {
  const trail = useTrail(title);
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-topbar/85 px-4 backdrop-blur-md sm:px-6 md:h-16 xl:px-7">
      <SidebarTrigger className="-ml-1.5 text-muted-foreground" title="Toggle sidebar (Ctrl+B)" />
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {trail.group ? (
            <>
              <li className="hidden truncate sm:block">
                {trail.href ? (
                  <Link href={trail.href} className="hover:text-foreground">
                    {trail.group}
                  </Link>
                ) : (
                  trail.group
                )}
              </li>
              <li aria-hidden className="hidden sm:block">
                <ChevronRight className="size-3.5" />
              </li>
            </>
          ) : null}
          <li aria-current="page" className="truncate font-medium text-foreground">
            {title}
          </li>
        </ol>
      </nav>
    </header>
  );
}

/**
 * Standard page frame: sticky top bar with breadcrumb, then a full-width body with
 * equal padding on every side, opening with the page title, description and actions.
 */
export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar title={title} />
      <div className="grid w-full flex-1 content-start gap-6 p-4 sm:p-6 xl:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
            {description ? <p className="mt-1 text-[13px] text-muted-foreground sm:text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b py-8 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[260px_1fr] md:gap-10">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
