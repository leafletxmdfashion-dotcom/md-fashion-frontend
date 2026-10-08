"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyServerError } from "@/lib/form-errors";

import { useInviteUser } from "../hooks/use-users";
import type { IssuedInvitation, Role } from "../types/user.types";
import { RoleSelect } from "./role-select";

const inviteSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
  roleKey: z.string().min(1, "Choose a role."),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function InvitationLink({ invitation }: { invitation: IssuedInvitation }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <FormAlert variant="success">
        Invitation sent. You can also share this single-use link directly. It expires in 72 hours.
      </FormAlert>
      <div className="flex gap-2">
        <Input readOnly value={invitation.inviteUrl} aria-label="Invitation link" className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy invitation link"
          onClick={() => {
            void navigator.clipboard.writeText(invitation.inviteUrl).then(() => setCopied(true));
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export function InviteUserDialog({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const invite = useInviteUser();
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", name: "", roleKey: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      invite.reset();
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus aria-hidden />
        Invite member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>They will set their own password from the invitation link.</DialogDescription>
        </DialogHeader>
        {invite.data ? (
          <>
            <InvitationLink invitation={invite.data} />
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
            <Field id="invite-email" label="Email" error={errors.email?.message}>
              <Input
                {...fieldProps("invite-email", errors.email?.message)}
                type="email"
                autoComplete="off"
                {...form.register("email")}
              />
            </Field>
            <Field id="invite-name" label="Name" error={errors.name?.message}>
              <Input
                {...fieldProps("invite-name", errors.name?.message)}
                autoComplete="off"
                {...form.register("name")}
              />
            </Field>
            <Field id="invite-role" label="Role" error={errors.roleKey?.message}>
              <Controller
                control={form.control}
                name="roleKey"
                render={({ field }) => (
                  <RoleSelect
                    id="invite-role"
                    roles={roles}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.roleKey)}
                  />
                )}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
