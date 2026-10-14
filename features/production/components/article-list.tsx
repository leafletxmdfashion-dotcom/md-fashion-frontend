"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Tags } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { FabricCombobox } from "@/features/fabric/components/fabric-combobox";
import { useFabricOptions } from "@/features/fabric/hooks/use-fabric";
import { applyServerError } from "@/lib/form-errors";

import { useArticles, useSaveArticle } from "../hooks/use-production";
import { kgText } from "../lib/format";
import type { Article } from "../types/production.types";
import { ProductionPage } from "./production-pages";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  code: z
    .string()
    .trim()
    .regex(/^([A-Za-z0-9][A-Za-z0-9-]{0,23})?$/, "Use up to 24 letters, numbers or dashes."),
  defaultFabricId: z.string(),
  active: z.boolean(),
});

type Values = z.infer<typeof schema>;

function markerSummary(article: Article): string | null {
  const marker = article.defaultMarker;

  if (!marker) return null;

  const pala = marker.weightSource === "MEASURED" ? kgText(marker.measuredPalaKg) : "calculated";
  const ratio = marker.sizes.map((size) => `${size.label} ${size.piecesPerPala}`).join(" · ");

  return `Pala ${pala} · ${ratio}`;
}

/** Mount with a `key` so each open starts fresh. */
function ArticleFormDialog({ article, onOpenChange }: { article?: Article; onOpenChange: (open: boolean) => void }) {
  const save = useSaveArticle();
  const fabrics = useFabricOptions();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: article?.name ?? "",
      code: article?.code ?? "",
      defaultFabricId: article?.defaultFabric?.id ?? "",
      active: article?.active ?? true,
    },
  });

  const { errors, isSubmitting } = form.formState;
  const defaults = article ? markerSummary(article) : null;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: article?.id,
        name: values.name,
        code: values.code.trim().toUpperCase() || null,
        defaultFabricId: values.defaultFabricId || null,
        defaultMarker: article?.defaultMarker ?? null,
        active: values.active,
      });

      toast.success(`${saved.name} (${saved.code}) saved.`);
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{article ? "Edit item" : "New item / design"}</DialogTitle>
          <DialogDescription>
            Items can also be typed straight into New cutting. Names that differ only by case, spaces or punctuation
            count as the same item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
          <Field id="article-name" label="Name" error={errors.name?.message}>
            <Input {...fieldProps("article-name", errors.name?.message)} autoFocus {...form.register("name")} />
          </Field>
          <Field id="article-code" label="Code" error={errors.code?.message} description={article ? undefined : "Leave empty to number it automatically"}>
            <Input
              {...fieldProps("article-code", errors.code?.message)}
              placeholder="ART-0001"
              className="uppercase"
              {...form.register("code")}
            />
          </Field>
          <Field id="article-fabric" label="Default fabric" error={errors.defaultFabricId?.message}>
            <Controller
              control={form.control}
              name="defaultFabricId"
              render={({ field }) => (
                <FabricCombobox
                  id="article-fabric"
                  fabrics={(fabrics.data ?? []).filter((fabric) => fabric.unit === "KG")}
                  value={field.value}
                  onChange={field.onChange}
                  clearable
                />
              )}
            />
          </Field>
          {defaults ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
              Cutting defaults: {defaults}. Change them from a cutting form with “Save as the item’s default”.
            </p>
          ) : null}
          {article ? (
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox id="article-active" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                  <Label htmlFor="article-active" className="text-[13px] font-normal">
                    Active (offered in New cutting)
                  </Label>
                </div>
              )}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const COLUMNS: DataColumn<Article>[] = [
  {
    id: "article",
    header: "Item / design",
    sortable: true,
    hideable: false,
    filter: { type: "text", placeholder: "Name or code contains…" },
    skeleton: { sub: true, width: "w-28" },
    csv: (article) => `${article.name} (${article.code})`,
    cell: (article) => (
      <>
        <p className="font-medium">{article.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{article.code}</p>
      </>
    ),
  },
  {
    id: "fabric",
    header: "Default fabric",
    className: "hidden md:table-cell",
    sortable: true,
    filter: { type: "text", placeholder: "Fabric contains…" },
    skeleton: { width: "w-24" },
    csv: (article) => article.defaultFabric?.name,
    cell: (article) => <span className="text-muted-foreground">{article.defaultFabric?.name ?? "—"}</span>,
  },
  {
    id: "defaults",
    header: "Cutting defaults",
    className: "hidden lg:table-cell",
    skeleton: { width: "w-32" },
    csv: (article) => markerSummary(article),
    cell: (article) => <span className="text-[13px] text-muted-foreground">{markerSummary(article) ?? "—"}</span>,
  },
  {
    id: "lots",
    header: "Lots",
    align: "right",
    sortable: true,
    filter: { type: "number" },
    skeleton: { width: "w-8" },
    csv: (article) => article.lots,
    cell: (article) => <span className="tabular-nums">{article.lots}</span>,
  },
  {
    id: "status",
    header: "Status",
    sortable: true,
    filter: {
      type: "enum",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    skeleton: { width: "w-14" },
    csv: (article) => (article.active ? "Active" : "Inactive"),
    cell: (article) => (
      <StatusChip tone={article.active ? "success" : "neutral"}>{article.active ? "Active" : "Inactive"}</StatusChip>
    ),
  },
];

export function ArticleList() {
  const { data: user } = useCurrentUser();
  const table = useDataTableState(COLUMNS);
  const list = useArticles({ ...table.params, page: table.page, pageSize: table.pageSize });
  const [dialog, setDialog] = useState<{ article?: Article; key: number } | null>(null);
  const canManage = hasPermission(user, "production.manage");

  const newButton = canManage ? (
    <Button onClick={() => setDialog({ key: Date.now() })}>
      <Plus aria-hidden />
      New item
    </Button>
  ) : null;

  return (
    <ProductionPage title="Items / Designs" description="Reusable items with their default fabric, measurements and size ratio.">
      <DataTable
        id="articles"
        columns={COLUMNS}
        rows={list.data?.articles}
        rowId={(article) => article.id}
        total={list.data?.total}
        state={table}
        isFetching={list.isFetching}
        isPlaceholderData={list.isPlaceholderData}
        error={list.error}
        onRetry={() => void list.refetch()}
        searchLabel="Search items"
        searchPlaceholder="Search name or code…"
        isEmpty={list.data !== undefined && list.data.total === 0 && !table.isFiltered}
        empty={{
          icon: Tags,
          title: "No items yet",
          description: "Items are created here or typed straight into New cutting.",
          action: newButton,
        }}
        toolbarEnd={newButton}
        onRowClick={canManage ? (article) => setDialog({ article, key: Date.now() }) : undefined}
        rowActions={
          canManage
            ? (article) => (
                <DropdownMenuItem onClick={() => setDialog({ article, key: Date.now() })}>Edit item</DropdownMenuItem>
              )
            : undefined
        }
      />
      {dialog ? (
        <ArticleFormDialog key={dialog.key} article={dialog.article} onOpenChange={(open) => (open ? null : setDialog(null))} />
      ) : null}
    </ProductionPage>
  );
}
