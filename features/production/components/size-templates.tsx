"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { ApiError } from "@/lib/api-client";
import { applyServerError } from "@/lib/form-errors";

import { useDeleteSizeTemplate, useSaveSizeTemplate, useSizeTemplates } from "../hooks/use-production";
import type { SizeTemplate } from "../types/production.types";
import { ProductionPage } from "./production-pages";

const splitSizes = (text: string) =>
  text
    .split(/[,\n]/)
    .map((size) => size.trim())
    .filter(Boolean);

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50),
  sizes: z
    .string()
    .refine((text) => splitSizes(text).length > 0, "Add at least one size.")
    .refine((text) => splitSizes(text).length <= 20, "Use at most 20 sizes.")
    .refine((text) => {
      const sizes = splitSizes(text).map((size) => size.toLowerCase());

      return new Set(sizes).size === sizes.length;
    }, "A size is listed twice."),
});

type Values = z.infer<typeof schema>;

function TemplateDialog({ template, onOpenChange }: { template?: SizeTemplate; onOpenChange: (open: boolean) => void }) {
  const save = useSaveSizeTemplate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: template?.name ?? "", sizes: template?.sizes.join(", ") ?? "" },
  });

  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: template?.id, name: values.name, sizes: splitSizes(values.sizes) });
      toast.success(`Size template ${values.name.trim()} saved.`);
      onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? "Edit size template" : "New size template"}</DialogTitle>
          <DialogDescription>Sizes in the order they are cut. A cutting form can apply a template in one step.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
          <Field id="template-name" label="Name" error={errors.name?.message}>
            <Input {...fieldProps("template-name", errors.name?.message)} placeholder="Adult S–XXL" autoFocus {...form.register("name")} />
          </Field>
          <Field id="template-sizes" label="Sizes" error={errors.sizes?.message} description="Separate with commas">
            <Input {...fieldProps("template-sizes", errors.sizes?.message)} placeholder="S, M, L, XL, XXL" {...form.register("sizes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SizeTemplates() {
  const { data: user } = useCurrentUser();
  const templates = useSizeTemplates();
  const remove = useDeleteSizeTemplate();
  const [dialog, setDialog] = useState<{ template?: SizeTemplate; key: number } | null>(null);
  const canManage = hasPermission(user, "production.manage");

  const onDelete = (template: SizeTemplate) =>
    remove.mutate(template.id, {
      onSuccess: () => toast.success(`Size template ${template.name} deleted.`),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete the template."),
    });

  const newButton = canManage ? (
    <Button onClick={() => setDialog({ key: Date.now() })}>
      <Plus aria-hidden />
      New template
    </Button>
  ) : null;

  return (
    <ProductionPage title="Size Templates" description="Size sets reused across marker ratios." actions={newButton}>
      {templates.error ? (
        <ErrorState title="Could not load size templates" error={templates.error} onRetry={() => void templates.refetch()} />
      ) : !templates.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : templates.data.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState
            icon={Ruler}
            title="No size templates yet"
            description="Save the size sets you cut most, then apply them to a marker ratio in one step."
            action={newButton}
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.data.map((template) => (
            <li key={template.id} className="flex items-start justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="min-w-0">
                <p className="font-medium">{template.name}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {template.sizes.map((size) => (
                    <span key={size} className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium">
                      {size}
                    </span>
                  ))}
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${template.name}`} onClick={() => setDialog({ template, key: Date.now() })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${template.name}`}
                    disabled={remove.isPending}
                    onClick={() => onDelete(template)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {dialog ? (
        <TemplateDialog key={dialog.key} template={dialog.template} onOpenChange={(open) => (open ? null : setDialog(null))} />
      ) : null}
    </ProductionPage>
  );
}
