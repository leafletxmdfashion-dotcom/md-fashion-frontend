import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

import { AuthHeading } from "./auth-heading";

export function InvalidLink({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <>
      <AuthHeading title={title} description={description} />
      {action ? (
        <Link href={action.href} className={buttonVariants({ className: "w-full" })}>
          {action.label}
        </Link>
      ) : null}
      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">
          Back to log in
        </Link>
      </p>
    </>
  );
}
