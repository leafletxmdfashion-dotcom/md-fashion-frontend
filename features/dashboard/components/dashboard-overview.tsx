"use client";

import { format, startOfMonth } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  PackagePlus,
  PackageX,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Page } from "@/components/page-header";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { navigation } from "@/config/navigation";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { filterNavigation, hasPermission } from "@/features/auth/lib/permissions";
import { InwardFormDialog } from "@/features/fabric/components/inward-form-dialog";
import { useFabricList, useInwards } from "@/features/fabric/hooks/use-fabric";
import { formatDate, formatMoney, formatQty } from "@/features/fabric/lib/format";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-link hover:underline">
          {linkLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden className="divide-y">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="grid gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20 opacity-70" />
          </div>
          <div className="grid justify-items-end gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-12 opacity-70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FabricSnapshot({ canPost }: { canPost: boolean }) {
  // Each panel asks the server for exactly what it shows: six rows, plus totals.
  const fabrics = useFabricList({ stock: "low", pageSize: 6 });
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const month = useInwards({ dateFrom: monthStart, status: "posted", pageSize: 1 });
  const recent = useInwards({ pageSize: 6 });

  const summary = fabrics.data?.summary;
  const reorder = fabrics.data?.fabrics ?? [];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {fabrics.isPending || month.isPending ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Fabric stock value"
              icon={Wallet}
              value={summary ? formatMoney(summary.stockValue) : "—"}
              context={summary ? `${summary.fabrics} fabric${summary.fabrics === 1 ? "" : "s"}` : undefined}
              href="/fabric"
            />
            <StatCard
              label="Need reorder"
              icon={PackageX}
              value={summary ? String(summary.reorder) : "—"}
              tone={summary && summary.reorder > 0 ? "warning" : "default"}
              context={summary && summary.reorder > 0 ? "At or below reorder level" : "Everything above reorder level"}
              href="/fabric?stock=low"
            />
            <StatCard
              label="Purchased this month"
              icon={Receipt}
              value={month.data ? formatMoney(month.data.totalAmount) : "—"}
              context={`Since ${formatDate(monthStart)}`}
              href={`/fabric/purchases?dateFrom=${monthStart}&status=posted`}
            />
            <StatCard
              label="Purchases this month"
              icon={PackagePlus}
              value={month.data ? String(month.data.total) : "—"}
              context="Posted inward entries"
              href={`/fabric/purchases?dateFrom=${monthStart}&status=posted`}
            />
          </>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel title="Needs reorder" href="/fabric?stock=low" linkLabel="All fabrics">
          {fabrics.isPending ? (
            <ListSkeleton />
          ) : fabrics.isError ? (
            <ErrorState title="Could not load fabrics" error={fabrics.error} onRetry={() => void fabrics.refetch()} />
          ) : summary && summary.fabrics === 0 ? (
            <EmptyState
              icon={Layers}
              title="No fabrics yet"
              description="Add fabrics in Fabric Master to track stock."
            />
          ) : reorder.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Stock is healthy" description="No fabric is at its reorder level." />
          ) : (
            <ul className="divide-y">
              {reorder.map((fabric) => {
                const out = fabric.balance <= 0;
                return (
                  <li key={fabric.id}>
                    <Link
                      href={`/fabric/ledger?fabric=${fabric.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{fabric.name}</span>
                        <span className="text-xs text-muted-foreground">{fabric.code}</span>
                      </span>
                      <span className="text-right">
                        <span
                          className={cn(
                            "block text-sm font-semibold tabular-nums",
                            out ? "text-destructive" : "text-warning",
                          )}
                        >
                          {formatQty(fabric.balance, fabric.unit)}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {out ? "Out of stock" : `Reorder at ${formatQty(fabric.lowStockThreshold ?? 0, fabric.unit)}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent purchases" href="/fabric/purchases" linkLabel="All purchases">
          {recent.isPending ? (
            <ListSkeleton />
          ) : recent.isError ? (
            <ErrorState title="Could not load purchases" error={recent.error} onRetry={() => void recent.refetch()} />
          ) : recent.data.inwards.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title="No purchases yet"
              description={canPost ? "Record a purchase to bring fabric into stock." : "Posted purchases appear here."}
            />
          ) : (
            <ul className="divide-y">
              {recent.data.inwards.map((inward) => (
                <li key={inward.id}>
                  <Link
                    href={`/fabric/purchases?q=FI-${String(inward.number).padStart(4, "0")}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50 sm:px-5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{inward.fabric.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(inward.inwardDate)}
                        {inward.supplier ? ` · ${inward.supplier}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className={cn(
                          "block text-sm font-semibold tabular-nums",
                          inward.reversal && "text-muted-foreground line-through",
                        )}
                      >
                        {formatMoney(inward.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {inward.reversal ? "Reversed" : formatQty(inward.quantity, inward.fabric.unit)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

export function DashboardOverview() {
  const { data: user } = useCurrentUser();
  const [purchasing, setPurchasing] = useState(0);
  const sections = useMemo(
    () =>
      filterNavigation(navigation, user?.permissions ?? [])
        .map((group) => ({ ...group, items: group.items.filter((item) => item.href && item.href !== "/dashboard") }))
        .filter((group) => group.items.length > 0),
    [user?.permissions],
  );

  if (!user) return null;
  const canSeeFabric = hasPermission(user, "fabric.view");
  const canPost = hasPermission(user, "fabric.inward");

  return (
    <Page
      title="Dashboard"
      description={`${greeting(new Date().getHours())}, ${user.name.split(" ")[0]}. Here is where things stand today.`}
      actions={
        canPost ? (
          <Button onClick={() => setPurchasing((count) => count + 1)}>
            <Plus aria-hidden />
            Record purchase
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6">
        {canSeeFabric ? <FabricSnapshot canPost={canPost} /> : null}

        <section className="grid gap-3">
          <h2 className="text-[15px] font-semibold">Modules</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <div key={section.title} className="rounded-lg border bg-card p-2">
                <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{section.title}</p>
                <ul className="grid">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.title}>
                        <Link
                          href={item.href!}
                          className="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40"
                        >
                          <Icon className="size-4 text-muted-foreground group-hover:text-link" aria-hidden />
                          <span className="font-medium">{item.title}</span>
                          {item.description ? (
                            <span className="rounded-[5px] bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                              Soon
                            </span>
                          ) : null}
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
        </section>
      </div>

      {purchasing > 0 ? (
        <InwardFormDialog
          key={purchasing}
          open
          onOpenChange={(open) => {
            if (!open) setPurchasing(0);
          }}
        />
      ) : null}
    </Page>
  );
}
