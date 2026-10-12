import { cn } from "@/lib/utils";

const TONES = {
  neutral: "border-border text-muted-foreground",
  success: "border-success/35 bg-success-soft text-success",
  warning: "border-warning/35 bg-warning-soft text-warning",
  danger: "border-destructive/35 bg-destructive-soft text-destructive",
  info: "border-info/35 bg-info-soft text-info",
} as const;

export type StatusTone = keyof typeof TONES;

/** Compact uppercase status label. Always text, never colour alone. */
export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[4px] border px-1.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
