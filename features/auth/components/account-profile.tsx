"use client";

import { Section } from "@/components/page-header";

import { useCurrentUser } from "../hooks/use-current-user";
import { ProfileForm } from "./profile-form";

export function AccountProfile() {
  const { data: user } = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <Section title="Profile" description="How you appear to the rest of your team.">
        <ProfileForm user={user} />
      </Section>
      <Section title="Role" description="Assigned by an administrator. It decides what you can see and change.">
        <div className="grid max-w-sm gap-1">
          <p className="text-[13px] font-medium">{user.role.name}</p>
          <p className="text-xs text-muted-foreground">
            {user.permissions.length} permission{user.permissions.length === 1 ? "" : "s"} granted
          </p>
        </div>
      </Section>
    </>
  );
}
