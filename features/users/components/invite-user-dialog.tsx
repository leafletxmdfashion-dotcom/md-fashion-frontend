"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
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

import { useInviteUser, useRoleCatalog } from "../hooks/use-users";
import type { CreatedLogin, IssuedInvitation } from "../types/user.types";
import {
  emptyLogin,
  LoginFields,
  LoginHandover,
  loginPayload,
  loginValuesSchema,
  type LoginValues,
} from "./login-fields";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long."),
  login: loginValuesSchema,
});

type Values = z.infer<typeof schema>;

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

/** A login for someone who is not on the payroll (office, owner's family). Staff and karigars get theirs from their record. */
export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{
    login: CreatedLogin;
    values: LoginValues;
  } | null>(null);
  const invite = useInviteUser();
  const roles = useRoleCatalog(open);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", login: emptyLogin() },
  });
  const { errors, isSubmitting } = form.formState;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      setCreated(null);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const login = await invite.mutateAsync({
        name: values.name,
        ...loginPayload(values.login),
      });
      setCreated({ login, values: values.login });
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden />
        Add login
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? "Login created" : "Add login"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Share these now. They are not shown again."
              : "For people who are not staff or karigars. Staff and karigars get their login from Staff & karigars."}
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <>
            <LoginHandover login={created.login} values={created.values} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
            <Field id="invite-name" label="Name" error={errors.name?.message}>
              <Input
                {...fieldProps("invite-name", errors.name?.message)}
                autoComplete="off"
                {...form.register("name")}
              />
            </Field>
            {roles.data ? (
              <LoginFields
                // SAFETY: Values has `login: LoginValues`; LoginFields only reads and writes login.*.
                form={form as unknown as UseFormReturn<{ login: LoginValues }>}
                roles={roles.data.roles}
                catalog={roles.data.catalog}
                idPrefix="invite"
              />
            ) : (
              <p className="text-[13px] text-muted-foreground">Loading roles…</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Create login
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
