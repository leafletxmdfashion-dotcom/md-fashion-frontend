import { BrandLogo } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <BrandLogo className="mx-auto mb-6 w-40" />
        {children}
      </div>
    </main>
  );
}
