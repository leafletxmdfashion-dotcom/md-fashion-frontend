"use client";

import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";

import { useRoles, useUsers } from "../hooks/use-users";
import type { ManagedUser, Role } from "../types/user.types";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserRowActions } from "./user-row-actions";

function StatusLabel({ user }: { user: ManagedUser }) {
  const expired = user.status === "INVITED" && (!user.invitation || user.invitation.expired);
  const [label, dot] =
    user.status === "ACTIVE" ? ["Active", "bg-success"]
    : user.status === "LOCKED" ? ["Locked", "bg-warning"]
    : user.status === "DISABLED" ? ["Disabled", "bg-muted-foreground/50"]
    : expired ? ["Invite expired", "bg-muted-foreground/50"]
    : ["Invited", "bg-info"];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

export function UsersTable() {
  const { data: currentUser } = useCurrentUser();
  const users = useUsers();
  const roles = useRoles();
  const canManage = hasPermission(currentUser, "users.manage");

  // Mirrors the API hierarchy so we only offer actions likely to succeed (UX only).
  const roleList: Role[] = roles.data ?? [];
  const actorRank = roleList.find((role) => role.key === currentUser?.role.key)?.rank ?? 0;
  const isOwner = currentUser?.role.key === "OWNER";
  const manageable = (user: ManagedUser) =>
    canManage && user.id !== currentUser?.id && (isOwner || user.role.rank < actorRank);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">
          {users.data ? `${users.data.length} member${users.data.length === 1 ? "" : "s"}` : " "}
        </p>
        {canManage && roles.data ? <InviteUserDialog roles={roles.data} /> : null}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {users.isPending ? (
          <div className="grid gap-2 p-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
        ) : users.isError ? (
          <p className="p-4 text-[13px] text-muted-foreground">Could not load members.</p>
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 text-xs font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="h-8 text-xs font-medium text-muted-foreground">Role</TableHead>
                <TableHead className="h-8 text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="hidden h-8 text-xs font-medium text-muted-foreground md:table-cell">
                  Last sign-in
                </TableHead>
                <TableHead className="h-8 w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {user.name}
                          {user.id === currentUser?.id ? <span className="text-muted-foreground"> (you)</span> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-muted-foreground">{user.role.name}</TableCell>
                  <TableCell className="py-2">
                    <StatusLabel user={user} />
                  </TableCell>
                  <TableCell className="hidden py-2 text-muted-foreground md:table-cell">
                    {user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "Never"}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    {manageable(user) ? <UserRowActions user={user} roles={roleList} /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
