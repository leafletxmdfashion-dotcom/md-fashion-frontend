import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE = {
  default: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
} as const;

const frame = "relative grid gap-1 rounded-lg border bg-card p-4 text-left sm:p-5";

/** KPI tile: label, large value, optional context line. A `href` or `onClick` makes it a drill-down. */
export function StatCard({
  label,
  value,
  context,
  icon: Icon,
  tone = "default",
  href,
  onClick,
}: {
  label: string;
  value: string;
  context?: string;
  icon?: LucideIcon;
  tone?: keyof typeof TONE;
  href?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-muted-foreground">
        {label}
        {Icon ? <Icon className="size-4 shrink-0 opacity-70" aria-hidden /> : null}
      </span>
      <span
        className={cn("text-lg leading-tight font-bold tracking-tight break-all tabular-nums sm:text-2xl", TONE[tone])}
      >
        {value}
      </span>
      {context ? <span className="truncate text-xs text-muted-foreground">{context}</span> : null}
    </>
  );
  const interactive = cn(
    frame,
    "transition-colors outline-none hover:border-input hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/40",
  );
  if (href)
    return (
      <Link href={href} className={interactive}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={interactive}>
        {body}
      </button>
    );
  return <div className={frame}>{body}</div>;
}

export function StatCardSkeleton({ context = true }: { context?: boolean }) {
  return (
    <div className={frame} aria-hidden>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-1 h-6 w-28 sm:h-7 sm:w-32" />
      {context ? <Skeleton className="h-3 w-28 opacity-70" /> : null}
    </div>
  );
}
