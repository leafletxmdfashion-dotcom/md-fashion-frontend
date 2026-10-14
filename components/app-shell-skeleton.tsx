import { Skeleton } from "@/components/ui/skeleton";

/** Workspace placeholder while the session loads: same sidebar, top bar and page frame. */
export function AppShellSkeleton() {
  return (
    <div role="status" className="flex min-h-svh w-full">
      <span className="sr-only">Loading workspace…</span>
      <div className="hidden w-[16.5rem] shrink-0 md:block" aria-hidden>
        <div className="flex h-svh flex-col border-r border-sidebar-border bg-sidebar">
          <div className="flex h-16 items-center border-b border-sidebar-border px-3">
            <Skeleton className="h-[54px] w-[212px]" />
          </div>
          <div className="px-3 pt-3 pb-1">
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="grid gap-5 px-4 py-2">
            {[1, 3, 5].map((count, group) => (
              <div key={group} className="grid gap-3.5">
                <Skeleton className="h-3 w-16 opacity-70" />
                {Array.from({ length: count }, (_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="size-[18px] rounded-md" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border p-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32 opacity-70" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col" aria-hidden>
        <div className="flex h-14 items-center gap-3 border-b bg-topbar px-4 sm:px-6 md:h-16 xl:px-7">
          <Skeleton className="size-6" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="grid w-full content-start gap-6 p-4 sm:p-6 xl:p-7">
          <div className="grid gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80 max-w-full opacity-70" />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[104px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
