import { cn } from "@/lib/utils";

/**
 * MED Fashion monogram, inlined from public/med-fashion-monogram.svg (viewBox cropped
 * to the artwork). Letters follow `currentColor`, so they flip with the theme; the
 * bolt stays brand red.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="24 220 1179 792" className={cn("h-auto w-9 shrink-0 text-foreground", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M 110 479 H 313 L 419 614 L 583 479 H 701 L 509 718 H 600 L 514 878 H 385 L 505 662 L 353 779 L 273 660 L 170 878 H 24 L 185 563 Z"
      />
      <path
        fill="currentColor"
        d="M 815 479 H 1024 C 1135 479 1203 551 1203 674 C 1203 796 1118 878 999 878 H 604 L 833 616 H 930 L 805 767 H 997 C 1064 767 1103 734 1103 674 C 1103 613 1073 593 996 593 H 741 Z"
      />
      <path className="fill-brand" d="M 990 220 L 704 621 H 817 L 443 1012 L 628 713 H 527 Z" />
    </svg>
  );
}

/** Full logo with wordmark. CSS picks the variant, so there is no theme flash on load. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img src="/med-fashion-logo-light.svg" alt="MD Fashion, quality wears since 2015" className="w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img src="/med-fashion-logo.svg" alt="MD Fashion, quality wears since 2015" className="hidden w-full dark:block" />
    </span>
  );
}
