"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
}

/**
 * One-of-few choice (unit, direction, split method): a radio group styled like the tab bar —
 * muted tray, bordered pills, the chosen one filled. Arrow keys move between options.
 * `size="inline"` fits inside an InputGroup addon (unit switchers).
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "default",
  fill = false,
  invalid,
  className,
  ...props
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  size?: "default" | "inline";
  /** Stretch options to equal widths across the full row. */
  fill?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-invalid={invalid ? true : undefined}
      className={cn(
        fill ? "grid auto-cols-fr grid-flow-col" : "inline-flex w-fit",
        size === "inline"
          ? // Part of the field: a thin divider, no tray, so the unit reads as the input's suffix.
            "h-6 items-center gap-0.5 border-l border-input pl-1.5"
          : "gap-0.5 rounded-lg border bg-muted p-1 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    >
      {options.map(({ value: option, label, icon: Icon, disabled }) => (
        <Radio.Root
          key={option}
          value={option}
          disabled={disabled}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap text-muted-foreground transition-colors duration-200 outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-40",
            size === "inline"
              ? "h-6 min-w-8 px-2 text-xs data-checked:bg-muted data-checked:font-semibold data-checked:text-foreground pointer-coarse:h-8 pointer-coarse:min-w-10"
              : "h-8 px-3.5 text-[13px] pointer-coarse:h-10 data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-sm dark:data-checked:bg-foreground dark:data-checked:text-background",
          )}
        >
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
          {label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
