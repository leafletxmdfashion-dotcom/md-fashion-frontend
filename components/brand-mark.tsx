import { cn } from "@/lib/utils";

// MD Fashion Center brand assets from the official brand kit (exact vector paths).

const MONOGRAM =
  "M154.3520,61.2600 C153.4650,74.7540 147.7090,86.3230 137.7060,94.7321 C127.3820,103.3940 112.5480,108.3671 96.9870,108.3671 C94.3540,108.3671 91.6650,108.2170 89.0040,107.9330 C71.8200,106.2631 56.2870,98.3840 46.3690,86.3230 C41.0760,80.0950 36.7350,73.0280 32.5350,66.1860 L32.4880,66.1110 C32.0920,65.4590 20.9100,46.4260 15.6910,37.5360 L15.6910,90.6270 L7.0000,90.6270 L7.0000,8.6890 L14.8420,8.6890 L15.3040,9.6040 C16.4370,11.8220 20.2490,19.3330 22.0800,22.9950 C27.2230,33.2340 39.9620,56.2970 43.8690,63.2700 L77.2460,8.6890 L89.7960,8.6890 L89.7960,90.6270 L76.3020,90.6270 L76.3020,26.9110 L48.9360,71.6500 C56.6180,83.4270 65.1670,92.1270 81.9080,96.3550 C98.2610,100.4780 120.5500,97.7230 133.5070,82.2570 C142.4340,71.6021 144.7170,55.6930 139.1780,42.6700 L139.1310,42.5660 C138.3100,40.6320 135.8190,34.7620 129.9490,29.1479 C118.4550,18.1440 103.7630,17.2760 97.9780,17.4180 L95.7510,17.4930 L95.7510,17.4270 L95.8640,8.6890 L97.2700,8.6890 C101.8660,8.2450 125.6460,7.0000 142.5750,26.2030 C148.4540,32.8560 151.3320,40.6700 151.4550,41.0090 C153.8140,47.2280 154.8140,54.2300 154.3520,61.2600";

/** The MD monogram in Artisan Sand. Size it with a width class; the height follows. */
export function BrandMonogram({ className }: { className?: string }) {
  return (
    <svg viewBox="7 7 148 102" className={cn("h-auto w-8 shrink-0 fill-brand", className)} aria-hidden>
      <path d={MONOGRAM} />
    </svg>
  );
}

/** Full lockup. Navy wordmark on light surfaces, all-sand on dark; CSS picks, so no theme flash. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img src="/md-fashion-center-logo.svg" alt="MD Fashion Center" className="w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimize */}
      <img src="/md-fashion-center-logo-sand.svg" alt="MD Fashion Center" className="hidden w-full dark:block" />
    </span>
  );
}
