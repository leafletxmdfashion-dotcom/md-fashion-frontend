import type * as React from "react";

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6 grid gap-1.5 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}
