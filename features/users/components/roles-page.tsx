"use client";

import { Copy, Loader2, Lock, Plus, Shield, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Page } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/states";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import type { Permission } from "@/features/auth/types/auth.types";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { useCreateRole, useDeleteRole, useRoleCatalog, useUpdateRole } from "../hooks/use-users";
import type { PermissionGroup, Role } from "../types/user.types";

const SYSTEM_ROLES = ["OWNER", "ADMIN"];

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item) => b.includes(item));

/** Why a role is read-only for the current user, or null when they may edit it. */
function lockReason(role: Role, canManage: boolean): string | null {
  if (role.key === "OWNER") return "The Owner always has every permission and cannot be changed.";

  if (!canManage) return "You can see roles. Changing them needs the Manage roles permission.";

  if (!role.editable) return "You can only change roles below your own.";

  return null;
}

/** "Fabric, Cutting, Stitching": the modules a role can do anything in. */
function modulesOf(role: Pick<Role, "permissions">, catalog: PermissionGroup[]): string {
  const modules = catalog.flatMap((group) =>
    group.module !== "General" && group.permissions.some((permission) => role.permissions.includes(permission.key))
      ? [group.module]
      : [],
  );

  return modules.length > 0 ? modules.join(", ") : "Dashboard only";
}

function NewRoleDialog({
  roles,
  copyFrom: initialCopy,
  onOpenChange,
  onCreated,
}: {
  roles: Role[];
  copyFrom: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const { data: user } = useCurrentUser();
  const create = useCreateRole();
  const source = roles.find((role) => role.key === initialCopy);
  const [name, setName] = useState(source ? `${source.name} copy` : "");
  const [copyFrom, setCopyFrom] = useState(initialCopy);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  const sources = [
    { value: "", label: "No permissions (start empty)" },
    ...roles.filter((role) => role.key !== "OWNER").map((role) => ({ value: role.key, label: role.name })),
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNameError(undefined);

    if (name.trim().length < 2) {
      setNameError("Use at least 2 characters.");

      return;
    }

    // Only rights the creator holds can be copied; the API refuses anything else.
    const permissions = (roles.find((role) => role.key === copyFrom)?.permissions ?? []).filter((permission) =>
      hasPermission(user, permission),
    );

    try {
      const role = await create.mutateAsync({ name: name.trim(), permissions });

      toast.success(`Role ${role.name} created. Tick what it can do, then save.`);
      onCreated(role.key);
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      setNameError(apiError?.details?.name?.[0]);
      setError(apiError?.details?.name ? null : (apiError?.message ?? "Could not create the role."));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New role</DialogTitle>
          <DialogDescription>Name it after the job people do, e.g. Finishing Supervisor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Field id="role-name" label="Role name" error={nameError}>
            <Input
              {...fieldProps("role-name", nameError)}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Finishing Supervisor"
              autoComplete="off"
              autoFocus
              maxLength={40}
            />
          </Field>
          <Field id="role-copy" label="Start with the permissions of" description="You can change them right after">
            <Select items={sources} value={copyFrom} onValueChange={(next) => setCopyFrom(next ?? "")}>
              <SelectTrigger id="role-copy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((option) => (
                  <SelectItem key={option.value || "none"} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One role's name and permissions, saved together. Mount with a `key` per role version. */
function RoleEditor({
  role,
  catalog,
  canManage,
  onDuplicate,
}: {
  role: Role;
  catalog: PermissionGroup[];
  canManage: boolean;
  onDuplicate: () => void;
}) {
  const { data: user } = useCurrentUser();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState(role.name);
  const [granted, setGranted] = useState<Permission[]>(role.permissions);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locked = lockReason(role, canManage);
  const renamable = !role.builtIn && locked === null;
  const dirty = name.trim() !== role.name || !sameSet(granted, role.permissions);
  const total = catalog.reduce((sum, group) => sum + group.permissions.length, 0);
  // A right the editor does not hold can be neither granted nor taken away (the API enforces this too).
  const ownable = (permission: Permission) => hasPermission(user, permission);

  const toggle = (permission: Permission, on: boolean) =>
    setGranted((current) =>
      on ? [...new Set([...current, permission])] : current.filter((item) => item !== permission),
    );

  const save = async () => {
    setError(null);

    // Built-in roles keep their name, so none is sent for them.
    const input = role.builtIn
      ? { key: role.key, permissions: granted }
      : { key: role.key, name: name.trim(), permissions: granted };

    try {
      await update.mutateAsync(input);
      toast.success(`${name.trim() || role.name} saved. People with this role get the change right away.`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save the role.");
    }
  };

  const onDelete = async () => {
    try {
      await remove.mutateAsync(role.key);
      toast.success(`Role ${role.name} deleted.`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not delete the role.");
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <section aria-label={`${role.name} permissions`} className="grid content-start gap-4">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-4 sm:p-5">
        <div className="grid min-w-0 flex-1 gap-1.5">
          {renamable ? (
            <Field id="role-edit-name" label="Role name">
              <Input
                id="role-edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                className="max-w-xs"
              />
            </Field>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{role.name}</h2>
              <StatusChip tone={role.builtIn ? "neutral" : "info"}>{role.builtIn ? "Built-in" : "Custom"}</StatusChip>
            </div>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <Link
              href={`/users?role=${role.key}`}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Users className="size-3.5" aria-hidden />
              {role.userCount} user{role.userCount === 1 ? "" : "s"}
            </Link>
            <span className="tabular-nums">
              {granted.length} of {total} permissions
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && role.key !== "OWNER" ? (
            <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
              <Copy aria-hidden />
              Duplicate
            </Button>
          ) : null}
          {locked === null && !role.builtIn ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={role.userCount > 0}
              title={role.userCount > 0 ? "Give its users another role first." : undefined}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          ) : null}
        </div>
      </header>

      {locked ? (
        <p className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2.5 text-[13px] text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          {locked}
        </p>
      ) : null}
      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="grid items-start gap-3 xl:grid-cols-2">
        {catalog.map((group) => {
          const keys = group.permissions.map((permission) => permission.key);
          const on = keys.filter((key) => granted.includes(key)).length;
          const changeable = keys.filter(ownable);

          return (
            <fieldset key={group.module} className="overflow-hidden rounded-lg border bg-card">
              <legend className="sr-only">{group.module}</legend>
              <div className="flex items-center gap-3 border-b bg-surface-subtle px-4 py-2.5">
                <Checkbox
                  aria-label={`All ${group.module} permissions`}
                  checked={on === keys.length}
                  indeterminate={on > 0 && on < keys.length}
                  disabled={locked !== null || changeable.length === 0}
                  onCheckedChange={(checked) => {
                    for (const key of changeable) toggle(key, checked);
                  }}
                />
                <span className="text-[13px] font-semibold">{group.module}</span>
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-xs tabular-nums",
                    on > 0 ? "bg-primary-soft text-link" : "text-muted-foreground",
                  )}
                >
                  {on === keys.length ? "All" : on === 0 ? "None" : `${on} of ${keys.length}`}
                </span>
              </div>
              <ul className="divide-y">
                {group.permissions.map((permission) => {
                  const id = `perm-${role.key}-${permission.key}`;
                  const disabled = locked !== null || !ownable(permission.key);

                  return (
                    <li key={permission.key} className="flex items-start gap-3 px-4 py-2.5">
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={granted.includes(permission.key)}
                        disabled={disabled}
                        onCheckedChange={(checked) => toggle(permission.key, checked)}
                      />
                      <label htmlFor={id} className={cn("grid gap-0.5", !disabled && "cursor-pointer")}>
                        <span className="text-[13px] font-medium">{permission.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {permission.description}
                          {locked === null && !ownable(permission.key) ? " You don't have this one yourself." : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>

      {dirty && locked === null ? (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-[13px] font-medium">Unsaved changes to {role.name}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => {
                setName(role.name);
                setGranted(role.permissions);
              }}
            >
              Discard
            </Button>
            <Button type="button" disabled={update.isPending} onClick={() => void save()}>
              {update.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {role.name}?</DialogTitle>
            <DialogDescription>Nobody has this role. Deleting it cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep role
            </Button>
            <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => void onDelete()}>
              {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RoleList({
  roles,
  catalog,
  selected,
  onSelect,
}: {
  roles: Role[];
  catalog: PermissionGroup[];
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  const groups = [
    { title: "System", roles: roles.filter((role) => SYSTEM_ROLES.includes(role.key)) },
    { title: "Job roles", roles: roles.filter((role) => role.builtIn && !SYSTEM_ROLES.includes(role.key)) },
    { title: "Custom", roles: roles.filter((role) => !role.builtIn) },
  ].filter((group) => group.roles.length > 0);

  return (
    <>
      {/* Phones and tablets: a picker instead of the list. */}
      <Select
        items={roles.map((role) => ({ value: role.key, label: role.name }))}
        value={selected ?? null}
        onValueChange={(value) => (value ? onSelect(value) : undefined)}
      >
        <SelectTrigger className="w-full lg:hidden" aria-label="Role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.key} value={role.key}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <nav aria-label="Roles" className="hidden gap-4 rounded-lg border bg-card p-2 lg:grid">
        {groups.map((group) => (
          <div key={group.title} className="grid gap-0.5">
            <p className="px-3 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.title}
            </p>
            {group.roles.map((role) => (
              <button
                key={role.key}
                type="button"
                aria-current={role.key === selected ? "true" : undefined}
                onClick={() => onSelect(role.key)}
                className={cn(
                  "grid gap-0.5 rounded-md px-3 py-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                  role.key === selected && "bg-primary-soft hover:bg-primary-soft",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-[13px]", role.key === selected ? "font-semibold" : "font-medium")}>
                    {role.name}
                  </span>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums"
                    aria-label={`${role.userCount} users`}
                  >
                    <Users className="size-3" aria-hidden />
                    {role.userCount}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {role.key === "OWNER" ? "Everything" : modulesOf(role, catalog)}
                </span>
              </button>
            ))}
          </div>
        ))}
        <p className="border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">
          Give people a login and a role under{" "}
          <Link href="/karigar?tab=logins" className="text-link hover:underline">
            Staff &amp; Karigar · Login accounts
          </Link>
          .
        </p>
      </nav>
    </>
  );
}

export function RolesPage() {
  const { data: user } = useCurrentUser();
  const catalog = useRoleCatalog(hasPermission(user, "users.view"));
  const { filters, setFilters } = useUrlFilters(["role"]);
  const [creating, setCreating] = useState<{ key: number; copyFrom: string } | null>(null);
  const canManage = hasPermission(user, "roles.manage");

  const roles = catalog.data?.roles ?? [];
  const selected = roles.find((role) => role.key === filters.role) ?? roles.find((role) => role.editable) ?? roles[0];

  return (
    <RequirePermission permission="users.view" title="Roles & Permissions">
      <Page
        title="Roles & Permissions"
        description="A role is a set of permissions for a job. Change a role here and everyone with it gets the change."
        actions={
          canManage ? (
            <Button onClick={() => setCreating({ key: Date.now(), copyFrom: "" })}>
              <Plus aria-hidden />
              New role
            </Button>
          ) : null
        }
      >
        {catalog.isError ? (
          <ErrorState title="Could not load roles" error={catalog.error} onRetry={() => void catalog.refetch()} />
        ) : !catalog.data ? (
          <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-busy>
            <Skeleton className="h-96" />
            <Skeleton className="h-[32rem]" />
          </div>
        ) : roles.length === 0 ? (
          <EmptyState icon={Shield} title="No roles" />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-20">
              <RoleList
                roles={roles}
                catalog={catalog.data.catalog}
                selected={selected?.key}
                onSelect={(key) => setFilters({ role: key })}
              />
            </div>
            {selected ? (
              <RoleEditor
                key={`${selected.key}:${selected.name}:${selected.permissions.join(",")}`}
                role={selected}
                catalog={catalog.data.catalog}
                canManage={canManage}
                onDuplicate={() => setCreating({ key: Date.now(), copyFrom: selected.key })}
              />
            ) : null}
          </div>
        )}

        {creating ? (
          <NewRoleDialog
            key={creating.key}
            roles={roles}
            copyFrom={creating.copyFrom}
            onOpenChange={(open) => (open ? undefined : setCreating(null))}
            onCreated={(key) => setFilters({ role: key })}
          />
        ) : null}
      </Page>
    </RequirePermission>
  );
}
