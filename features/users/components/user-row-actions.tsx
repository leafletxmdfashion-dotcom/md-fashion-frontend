"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api-client";

import {
  useChangeRole,
  useDisableUser,
  useEnableUser,
  useResendInvitation,
  useRevokeInvitation,
  useRevokeUserSessions,
} from "../hooks/use-users";
import type { IssuedInvitation, ManagedUser, Role } from "../types/user.types";
import { InvitationLink } from "./invite-user-dialog";
import { RoleSelect } from "./role-select";

type Panel = "role" | "disable" | "sessions" | "invitation" | null;

function errorToast(fallback: string) {
  return (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
}

export function UserRowActions({ user, roles }: { user: ManagedUser; roles: Role[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [roleKey, setRoleKey] = useState(user.role.key);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);

  const changeRole = useChangeRole();
  const disable = useDisableUser();
  const enable = useEnableUser();
  const revokeSessions = useRevokeUserSessions();
  const resend = useResendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const close = () => setPanel(null);
  const isInvited = user.status === "INVITED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label={`Actions for ${user.name}`} />}
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {isInvited ? (
            <>
              <DropdownMenuItem
                onClick={() =>
                  resend.mutate(user.id, {
                    onSuccess: (invitation) => {
                      setIssued(invitation);
                      setPanel("invitation");
                    },
                    onError: errorToast("Could not resend the invitation."),
                  })
                }
              >
                Resend invitation
              </DropdownMenuItem>
              {user.invitation ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    revokeInvitation.mutate(user.id, {
                      onSuccess: () => toast.success("Invitation revoked."),
                      onError: errorToast("Could not revoke the invitation."),
                    })
                  }
                >
                  Revoke invitation
                </DropdownMenuItem>
              ) : null}
            </>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setRoleKey(user.role.key);
                  setPanel("role");
                }}
              >
                Change role
              </DropdownMenuItem>
              <DropdownMenuItem disabled={user.activeSessionCount === 0} onClick={() => setPanel("sessions")}>
                Sign out all sessions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.status === "DISABLED" || user.status === "LOCKED" ? (
                <DropdownMenuItem
                  onClick={() =>
                    enable.mutate(user.id, {
                      onSuccess: () => toast.success(`${user.name} can sign in again.`),
                      onError: errorToast("Could not enable the account."),
                    })
                  }
                >
                  {user.status === "LOCKED" ? "Unlock account" : "Enable account"}
                </DropdownMenuItem>
              ) : null}
              {user.status !== "DISABLED" ? (
                <DropdownMenuItem variant="destructive" onClick={() => setPanel("disable")}>
                  Disable account
                </DropdownMenuItem>
              ) : null}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={panel === "role"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              {user.name}&apos;s permissions change on their next request. Their sessions stay active.
            </DialogDescription>
          </DialogHeader>
          <RoleSelect id={`role-${user.id}`} roles={roles} value={roleKey} onChange={setRoleKey} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={changeRole.isPending || roleKey === user.role.key || !roleKey}
              onClick={() =>
                changeRole.mutate(
                  { userId: user.id, roleKey },
                  { onSuccess: () => {
                    toast.success("Role updated.");
                    close();
                  }, onError: errorToast("Could not change role.") },
                )
              }
            >
              {changeRole.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === "disable"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable {user.name}?</DialogTitle>
            <DialogDescription>
              They are signed out everywhere immediately and cannot sign in until re-enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={disable.isPending}
              onClick={() =>
                disable.mutate(user.id, {
                  onSuccess: () => {
                    toast.success("Account disabled.");
                    close();
                  },
                  onError: errorToast("Could not disable the account."),
                })
              }
            >
              {disable.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Disable account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === "sessions"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out {user.name} everywhere?</DialogTitle>
            <DialogDescription>Ends all {user.activeSessionCount} active sessions. They can sign in again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={revokeSessions.isPending}
              onClick={() =>
                revokeSessions.mutate(user.id, {
                  onSuccess: () => {
                    toast.success("Sessions revoked.");
                    close();
                  },
                  onError: errorToast("Could not revoke sessions."),
                })
              }
            >
              Sign out everywhere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={panel === "invitation" && issued !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New invitation link</DialogTitle>
            <DialogDescription>The previous link for {user.email} no longer works.</DialogDescription>
          </DialogHeader>
          {issued ? <InvitationLink invitation={issued} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
