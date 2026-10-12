import { Construction } from "lucide-react";
import { notFound } from "next/navigation";

import { Page } from "@/components/page-header";
import { navigation } from "@/config/navigation";
import { RequirePermission } from "@/features/auth/components/require-permission";

// Placeholder for every sidebar module that has no page yet. A real page at the
// same path (e.g. app/(dashboard)/cutting/page.tsx) takes precedence over this.
export const instant = false;

// Items with a description have no page yet; built modules drop theirs.
const items = navigation.flatMap((group) => group.items).filter((item) => item.href && item.description);

// Known at build time, so cacheComponents can prerender these pages and their metadata.
export function generateStaticParams() {
  return items.map((item) => ({ slug: item.href!.split("/").slice(1) }));
}

function findItem(slug: string[]) {
  const href = `/${slug.join("/")}`;
  return items.find((item) => item.href === href);
}

export default async function PlaceholderPage({ params }: PageProps<"/[...slug]">) {
  const item = findItem((await params).slug);
  if (!item) notFound();

  const Icon = item.icon;
  const body = (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card px-6 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-primary-soft text-link">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{item.title}</h2>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        This module is planned for an upcoming milestone. Its data will appear here once it is built.
      </p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Construction className="size-3.5" aria-hidden />
        This module is being built.
      </p>
    </div>
  );

  return (
    <>
      {/* React hoists this; generateMetadata would block the cacheComponents fallback shell. */}
      <title>{`${item.title} · MD Fashion Center`}</title>
      <Page title={item.title} description={item.description}>
        {item.permission ? <RequirePermission permission={item.permission}>{body}</RequirePermission> : body}
      </Page>
    </>
  );
}
