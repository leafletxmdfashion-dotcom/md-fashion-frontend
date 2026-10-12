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
import { downloadCsv } from "@/lib/csv";
import { initials } from "@/lib/initials";

import { useRoles, useUsers } from "../hooks/use-users";
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

// The member list is small and loaded whole, so search, filters and sorting run here.
function applyTable(
  users: ManagedUser[],
  filters: Record<string, string>,
  sort: { id: string; dir: "asc" | "desc" } | null,
) {
  const query = (filters.q ?? "").toLowerCase();
  const name = (filters.name ?? "").toLowerCase();
  const roles = (filters.role ?? "").split(",").filter(Boolean);
  const statuses = (filters.status ?? "").split(",").filter(Boolean);
  const from = filters.lastLoginFrom;
  const to = filters.lastLoginTo;
  const rows = users.filter((user) => {
    const text = `${user.name} ${user.email}`.toLowerCase();
    const day = user.lastLoginAt?.slice(0, 10);
    return (
      (!query || text.includes(query)) &&
      (!name || text.includes(name)) &&
      (roles.length === 0 || roles.includes(user.role.key)) &&
      (statuses.length === 0 || statuses.includes(statusOf(user))) &&
      (!from || (day !== undefined && day >= from)) &&
      (!to || (day !== undefined && day <= to))
    );
  });
  if (!sort) return rows;
  const value = (user: ManagedUser): string | number => {
    if (sort.id === "role") return user.role.rank;
    if (sort.id === "status") return STATUS[statusOf(user)].label;
    if (sort.id === "lastLogin") return user.lastLoginAt ?? "";
    return user.name.toLowerCase();
  };
  const direction = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => (value(a) > value(b) ? direction : value(a) < value(b) ? -direction : 0));
}

export function UsersTable() {
  const { data: currentUser } = useCurrentUser();
  const users = useUsers();
  const roles = useRoles();
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
      filter: { type: "text", placeholder: "Name or email contains…" },
      skeleton: { sub: true, avatar: true, width: "w-36" },
      csv: (user) => `${user.name} <${user.email}>`,
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
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      filter: { type: "enum", options: roleList.map((role) => ({ value: role.key, label: role.name })) },
      skeleton: { width: "w-20" },
      csv: (user) => user.role.name,
      cell: (user) => <span className="text-muted-foreground">{user.role.name}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      filter: {
        type: "enum",
        options: (Object.keys(STATUS) as StatusKey[]).map((value) => ({ value, label: STATUS[value].label })),
      },
      skeleton: { width: "w-16" },
      csv: (user) => STATUS[statusOf(user)].label,
      cell: (user) => <StatusChip tone={STATUS[statusOf(user)].tone}>{STATUS[statusOf(user)].label}</StatusChip>,
    },
    {
      id: "lastLogin",
      header: "Last sign-in",
      className: "hidden md:table-cell",
      sortable: true,
      filter: { type: "date" },
      skeleton: { width: "w-24" },
      csv: (user) => user.lastLoginAt ?? "Never",
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
  const filtered = users.data ? applyTable(users.data, table.filters, table.sort) : undefined;
  const pageRows = filtered?.slice((table.page - 1) * table.pageSize, table.page * table.pageSize);
  const exportable = columns.filter((column) => column.csv);

  return (
    <RequirePermission permission="users.view" title="Users">
      <Page title="Users" description="Invite members, set their roles and control who can sign in.">
        <DataTable
          id="users"
          columns={columns}
          rows={pageRows}
          rowId={(user) => user.id}
          total={filtered?.length}
          state={table}
          isFetching={users.isFetching}
          error={users.error}
          onRetry={() => void users.refetch()}
          searchLabel="Search members"
          searchPlaceholder="Search name or email…"
          isEmpty={users.data?.length === 0}
          empty={{ icon: Users, title: "No members yet", description: "Invite people to give them access." }}
          onExport={async () =>
            downloadCsv(
              "members",
              exportable.map((column) => column.header),
              (filtered ?? []).map((user) => exportable.map((column) => column.csv!(user) ?? null)),
            )
          }
          toolbarEnd={canManage && roles.data ? <InviteUserDialog roles={roles.data} /> : null}
        />
      </Page>
    </RequirePermission>
  );
}
