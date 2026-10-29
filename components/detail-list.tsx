import { cn } from "@/lib/utils";

/** Headline figures at the top of a detail sheet, side by side. */
export function DetailStats({ items }: { items: { label: string; value: React.ReactNode; tone?: "muted" }[] }) {
  return (
    <dl
      className="grid divide-x rounded-lg border bg-muted/30"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <div key={item.label} className="grid content-start gap-1 px-3 py-3 sm:px-4">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "text-sm font-semibold wrap-break-word tabular-nums sm:text-base",
              item.tone === "muted" && "text-muted-foreground line-through",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled group of label/value rows in a detail sheet. */
export function DetailSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("grid gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DetailList({ children }: { children: React.ReactNode }) {
  return <dl className="grid divide-y rounded-lg border text-[13px]">{children}</dl>;
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
