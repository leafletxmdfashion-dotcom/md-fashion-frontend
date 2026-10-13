import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export function FormAlert({
  variant = "error",
  children,
  className,
}: {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = { error: CircleAlert, success: CircleCheck, info: Info }[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-[13px] leading-5",
        variant === "error" && "border-destructive/25 bg-destructive/5 text-destructive",
        variant === "success" && "border-success/25 bg-success/5 text-foreground",
        variant === "info" && "border-border bg-muted/60 text-foreground",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          variant === "success" && "text-success",
          variant === "info" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <div>{children}</div>
    </div>
  );
}
