import { Shirt } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
        className,
      )}
      aria-hidden
    >
      <Shirt className="size-4" />
    </span>
  );
}
