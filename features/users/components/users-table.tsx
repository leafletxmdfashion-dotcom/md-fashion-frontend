"use client";

import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";
import { useMemo } from "react";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Page } from "@/components/page-header";
import { StatusChip, type StatusTone } from "@/components/status-chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { initials } from "@/lib/initials";

import { useRoles, useUsersPage } from "../hooks/use-users";
import type { ManagedUser, Role } from "../types/user.types";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserRowActions } from "./user-row-actions";

type StatusKey = "ACTIVE" | "INVITED" | "EXPIRED" | "LOCKED" | "DISABLED";

const STATUS: Record<StatusKey, { label: string; tone: StatusTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INVITED: { label: "Invited", tone: "info" },
  EXPIRED: { label: "Invite expired", tone: "neutral" },
  LOCKED: { label: "Locked", tone: "warning" },
  DISABLED: { label: "Disabled", tone: "neutral" },
};

function statusOf(user: ManagedUser): StatusKey {
  if (user.status === "INVITED") return !user.invitation || user.invitation.expired ? "EXPIRED" : "INVITED";
  return user.status;
}

const lastSignIn = (user: ManagedUser) =>
  user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "Never";

/** Login accounts: who can sign in and with which role. Used on Users and inside Staff & Karigar. */
export function UsersPanel() {
  const { data: currentUser } = useCurrentUser();
  // RequirePermission shows the no-access state; skip requests the API would refuse.
  const canView = hasPermission(currentUser, "users.view");
  const roles = useRoles(canView);
  const canManage = hasPermission(currentUser, "users.manage");

  // Mirrors the API hierarchy so we only offer actions likely to succeed (UX only).
  const roleList: Role[] = useMemo(() => roles.data ?? [], [roles.data]);
  const actorRank = roleList.find((role) => role.key === currentUser?.role.key)?.rank ?? 0;
  const isOwner = currentUser?.role.key === "OWNER";
  const manageable = (user: ManagedUser) =>
    canManage && user.id !== currentUser?.id && (isOwner || user.role.rank < actorRank);

  const columns: DataColumn<ManagedUser>[] = [
    {
      id: "name",
      header: "Member",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Name, email or phone contains…" },
      skeleton: { sub: true, avatar: true, width: "w-36" },
      cell: (user) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-link">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">
              {user.name}
              {user.id === currentUser?.id ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[user.email, user.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      filter: {
        type: "enum",
        options: roleList.map((role) => ({
          value: role.key,
          label: role.name,
        })),
      },
      skeleton: { width: "w-20" },
      cell: (user) => <span className="text-muted-foreground">{user.role.name}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      filter: {
        type: "enum",
        options: (Object.keys(STATUS) as StatusKey[]).map((value) => ({
          value,
          label: STATUS[value].label,
        })),
      },
      skeleton: { width: "w-16" },
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusChip tone={STATUS[statusOf(user)].tone}>{STATUS[statusOf(user)].label}</StatusChip>
          {user.mustChangePassword ? <StatusChip tone="warning">Temporary password</StatusChip> : null}
        </span>
      ),
    },
    {
      id: "linked",
      header: "Staff / karigar",
      className: "hidden lg:table-cell",
      filter: {
        type: "enum",
        options: [
          { value: "linked", label: "Linked to a person" },
          { value: "unlinked", label: "Not linked" },
        ],
      },
      skeleton: { width: "w-24" },
      cell: (user) => <span className="text-muted-foreground">{user.linkedTo?.name ?? "—"}</span>,
    },
    {
      id: "lastLogin",
      header: "Last sign-in",
      className: "hidden md:table-cell",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-24" },
      cell: (user) => <span className="text-muted-foreground">{lastSignIn(user)}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      headerHidden: true,
      hideable: false,
      align: "right",
      className: "w-12",
      skeleton: { width: "w-6" },
      cell: (user) => (manageable(user) ? <UserRowActions user={user} roles={roleList} /> : null),
    },
  ];

  const table = useDataTableState(columns);
  // Search, filters and sort run on the server, so the list and its export always agree.
  const users = useUsersPage({ ...table.params, page: table.page, pageSize: table.pageSize }, canView);

  return (
    <DataTable
      id="users"
      columns={columns}
      rows={users.data?.users}
      rowId={(user) => user.id}
      total={users.data?.total}
      state={table}
      isFetching={users.isFetching}
      error={users.error}
      onRetry={() => void users.refetch()}
      searchLabel="Search members"
      searchPlaceholder="Search name or email…"
      isPlaceholderData={users.isPlaceholderData}
      isEmpty={users.data?.total === 0 && Object.keys(table.params).length === 0}
      empty={{
        icon: Users,
        title: "No members yet",
        description: "Invite people to give them access.",
      }}
      exportPath="/users/export"
      toolbarEnd={canManage && roles.data ? <InviteUserDialog /> : null}
    />
  );
}

export function UsersTable() {
  return (
    <RequirePermission permission="users.view" title="Users">
      <Page title="Users" description="Invite members, set their roles and control who can sign in.">
        <UsersPanel />
      </Page>
    </RequirePermission>
  );
}
