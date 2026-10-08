"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Role } from "../types/user.types";

export function RoleSelect({
  id,
  roles,
  value,
  onChange,
  invalid,
}: {
  id: string;
  roles: Role[];
  value: string;
  onChange: (roleKey: string) => void;
  invalid?: boolean;
}) {
  // Only roles the API says this admin may grant are offered (the API re-checks on submit).
  const assignable = roles.filter((role) => role.assignable);
  const items = assignable.map((role) => ({ value: role.key, label: role.name }));

  return (
    <Select items={items} value={value || null} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {assignable.map((role) => (
          <SelectItem key={role.key} value={role.key}>
            {role.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
