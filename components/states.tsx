import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-primary-soft text-link">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="font-heading text-[15px] font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** "Temporarily unavailable": says what failed, why if known, and offers a retry. */
export function ErrorState({
  title,
  error,
  onRetry,
  className,
}: {
  title: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const reason =
    error instanceof ApiError && error.code === "NETWORK_ERROR"
      ? "The server could not be reached. Check your connection."
      : error instanceof ApiError && error.code === "AUTH_FORBIDDEN"
        ? "Your role does not allow this. Ask an administrator for access."
        : "Something went wrong on our side. Your data is safe.";
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-4 py-14 text-center", className)}>
      <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <p className="font-heading text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{reason}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Shape of one table column, shared by the real cells and their loading placeholders. */
export interface ColumnShape {
  className?: string;
  /** Second, shorter bar for cells that show a sub-line (code, email…). */
  sub?: boolean;
  /** Bar width, e.g. "w-24". */
  width?: string;
  align?: "right";
  /** Leading avatar circle, as in people lists. */
  avatar?: boolean;
}

/** Placeholder rows laid out exactly like the table's real rows. */
export function SkeletonRows({ columns, rows = 8 }: { columns: ColumnShape[]; rows?: number }) {
  return Array.from({ length: rows }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      {columns.map((column, index) => (
        <TableCell key={index} className={cn("py-2.5", column.className)}>
          <div className="flex items-center gap-2.5">
            {column.avatar ? <Skeleton className="size-8 shrink-0 rounded-full" /> : null}
            <div className={cn("grid flex-1 gap-1.5", column.align === "right" && "justify-items-end")}>
              <Skeleton className={cn("h-3.5", column.width ?? "w-20")} />
              {column.sub ? <Skeleton className="h-3 w-14 opacity-70" /> : null}
            </div>
          </div>
        </TableCell>
      ))}
    </TableRow>
  ));
}
