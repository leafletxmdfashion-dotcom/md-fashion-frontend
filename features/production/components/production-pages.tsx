"use client";

import { useParams } from "next/navigation";

import { Page } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import type { Permission } from "@/features/auth/types/auth.types";

import { useBatch } from "../hooks/use-production";
import { cutNumber } from "../lib/format";
import { batchValues, newProductionValues } from "../lib/form-model";
import { BatchView } from "./batch-view";
import { CuttingForm } from "./cutting-form";

/** Page frame for production views, gated by a permission (production.view unless stated). */
export function ProductionPage({
  title,
  description,
  actions,
  permission = "production.view",
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  permission?: Permission;
  children: React.ReactNode;
}) {
  return (
    <RequirePermission permission={permission} title={title}>
      <Page title={title} description={description} actions={actions}>
        {children}
      </Page>
    </RequirePermission>
  );
}

export function FormSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** New cutting: lot number, item, fabric, marker and Thaan on one page. */
export function NewCutting() {
  return (
    <ProductionPage
      title="New cutting"
      description="Fill in the sections from top to bottom. Save a draft at any point; nothing leaves the store until fabric is issued."
      permission="production.manage"
    >
      <CuttingForm mode={{ kind: "new" }} defaultValues={newProductionValues()} />
    </ProductionPage>
  );
}

/** One cutting batch: the editable form while open, the posted record once finalized. */
export function BatchPage() {
  const { id } = useParams<{ id: string }>();
  const batch = useBatch(id);
  const { data: user } = useCurrentUser();
  const data = batch.data;

  const editable =
    data !== undefined &&
    (data.status === "DRAFT" || data.status === "ISSUED") &&
    (data.lot.status === "DRAFT" || data.lot.status === "ACTIVE") &&
    hasPermission(user, "production.manage");

  return (
    <ProductionPage
      title={data ? cutNumber(data.number) : "Cutting"}
      description={data ? `Lot ${data.lot.lotNumber} · ${data.lot.article.name} · ${data.lot.fabric.name}` : undefined}
    >
      {batch.error ? (
        <ErrorState title="Could not load this cutting" error={batch.error} onRetry={() => void batch.refetch()} />
      ) : !data ? (
        <FormSkeleton />
      ) : editable ? (
        // Remounts after every save, so the form always starts from what the server stored.
        <CuttingForm key={data.updatedAt} mode={{ kind: "edit", batch: data }} defaultValues={batchValues(data)} />
      ) : (
        <BatchView batch={data} />
      )}
    </ProductionPage>
  );
}
