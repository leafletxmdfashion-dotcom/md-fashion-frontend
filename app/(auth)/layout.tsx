import { BrandMark } from "@/components/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 flex justify-center">
          <BrandMark className="size-9 rounded-lg [&>svg]:size-5" />
        </div>
        {children}
      </div>
    </main>
  );
}
