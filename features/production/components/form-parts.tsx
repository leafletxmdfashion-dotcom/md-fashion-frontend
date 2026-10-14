import Link from "next/link";
import type * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A titled block inside a wizard step. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/**
 * A calculated value: read-only, visually distinct from inputs, announced to screen
 * readers when it changes.
 */
export function Computed({
  children,
  className,
  tone = "default",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger";
  label?: string;
}) {
  return (
    <output
      aria-label={label}
      aria-live="polite"
      className={cn(
        "flex h-9 items-center rounded-md bg-muted px-3 text-sm font-medium tabular-nums",
        tone === "warning" && "text-warning",
        tone === "danger" && "text-destructive",
        className,
      )}
    >
      {children}
    </output>
  );
}

/** Small label/value pair for summaries. */
export function Figure({
  label,
  value,
  hint,
  tone = "default",
  size = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  size?: "default" | "large";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-semibold tabular-nums",
          size === "large" ? "text-xl sm:text-2xl" : "text-[15px]",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </dd>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Error text under an input that is not wrapped in <Field>. */
export function CellError({ id, message }: { id: string; message?: string | undefined }) {
  return message ? (
    <p id={id} className="mt-1 text-xs font-normal whitespace-normal text-destructive">
      {message}
    </p>
  ) : null;
}

/** A real link that looks like a button (navigation keeps link semantics). */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
