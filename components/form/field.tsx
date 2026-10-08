import type * as React from "react";

import { Label } from "@/components/ui/label";

/** Accessible wiring for an input inside <Field>: aria-invalid + aria-describedby. */
export function fieldProps(id: string, error?: string, description?: string) {
  const describedBy = [error ? `${id}-error` : null, description ? `${id}-description` : null]
    .filter(Boolean)
    .join(" ");
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined };
}

export function Field({
  id,
  label,
  error,
  description,
  action,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-4 items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {description ? (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
