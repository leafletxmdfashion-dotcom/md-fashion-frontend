import { Loader2 } from "lucide-react";

export function AuthLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
