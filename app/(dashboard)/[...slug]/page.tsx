import { Construction } from "lucide-react";
import { notFound } from "next/navigation";

import { PageBody, PageHeader } from "@/components/page-header";
import { navigation } from "@/config/navigation";
import { RequirePermission } from "@/features/auth/components/require-permission";

// Placeholder for every sidebar module that has no page yet. A real page at the
// same path (e.g. app/(dashboard)/cutting/page.tsx) takes precedence over this.
export const instant = false;

// Items with a description have no page yet; built modules drop theirs.
const items = navigation
  .flatMap((group) => group.items)
  .filter((item) => item.href && item.description);

// Known at build time, so cacheComponents can prerender these pages and their metadata.
export function generateStaticParams() {
  return items.map((item) => ({ slug: item.href!.split("/").slice(1) }));
}

function findItem(slug: string[]) {
  const href = `/${slug.join("/")}`;
  return items.find((item) => item.href === href);
}

export default async function PlaceholderPage({
  params,
}: PageProps<"/[...slug]">) {
  const item = findItem((await params).slug);
  if (!item) notFound();

  const Icon = item.icon;
  const body = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-20 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-link">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="text-sm font-medium">{item.title}</h2>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        {item.description}
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Construction className="size-3.5" aria-hidden />
        This module is being built.
      </p>
    </div>
  );

  return (
    <>
      {/* React hoists this; generateMetadata would block the cacheComponents fallback shell. */}
      <title>{`${item.title} · MD Fashion`}</title>
      <PageHeader title={item.title} />
      <PageBody>
        {item.permission ? (
          <RequirePermission permission={item.permission}>
            {body}
          </RequirePermission>
        ) : (
          body
        )}
      </PageBody>
    </>
  );
}
