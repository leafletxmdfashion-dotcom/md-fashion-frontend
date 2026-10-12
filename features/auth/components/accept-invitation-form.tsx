"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { applyServerError } from "@/lib/form-errors";

import { useHashToken } from "../hooks/use-hash-token";
import { useAcceptInvitation, useInvitation } from "../hooks/use-invitation";
import {
  acceptInvitationSchema,
  PASSWORD_MIN_LENGTH,
  type AcceptInvitationValues,
} from "../schemas/auth.schema";
import { AuthHeading } from "./auth-heading";
import { AuthLoading } from "./auth-loading";
import { InvalidLink } from "./invalid-link";

const INVALID = {
  title: "This invitation is no longer valid",
  description:
    "Invitations work once and expire after 72 hours. Ask your administrator to send a new one.",
};

export function AcceptInvitationForm() {
  const token = useHashToken();
  const invitation = useInvitation(token ?? null);
  const accept = useAcceptInvitation();
  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { name: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const invitedName = invitation.data?.name;

  useEffect(() => {
    if (invitedName && !form.getValues("name"))
      form.setValue("name", invitedName);
  }, [invitedName, form]);

  if (token === undefined || (token && invitation.isPending))
    return <AuthLoading />;
  if (!token || !invitation.data) return <InvalidLink {...INVALID} />;
  if (accept.error instanceof ApiError && accept.error.code === "TOKEN_INVALID")
    return <InvalidLink {...INVALID} />;

  if (accept.isSuccess) {
    return (
      <>
        <AuthHeading title="Your account is ready" />
        <FormAlert variant="success">
          Your account is active. Log in with your email and new password.
        </FormAlert>
        <Link
          href="/login"
          className={buttonVariants({ className: "mt-4 w-full" })}
        >
          Log in
        </Link>
      </>
    );
  }

  const details = invitation.data;
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await accept.mutateAsync({
        token,
        name: values.name,
        newPassword: values.newPassword,
      });
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <>
      <AuthHeading
        title="Join MD Fashion Center"
        description={
          <>
            You were invited as{" "}
            <span className="font-medium text-foreground">
              {details.roleName}
            </span>
            .
          </>
        }
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {errors.root?.server ? (
          <FormAlert>{errors.root.server.message}</FormAlert>
        ) : null}
        <Field id="invite-email" label="Email">
          <Input
            id="invite-email"
            type="email"
            value={details.email}
            readOnly
            autoComplete="username"
          />
        </Field>
        <Field id="name" label="Full name" error={errors.name?.message}>
          <Input
            {...fieldProps("name", errors.name?.message)}
            autoComplete="name"
            {...form.register("name")}
          />
        </Field>
        <Field
          id="newPassword"
          label="Password"
          error={errors.newPassword?.message}
          description={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase works well.`}
        >
          <PasswordInput
            {...fieldProps("newPassword", errors.newPassword?.message, "hint")}
            autoComplete="new-password"
            {...form.register("newPassword")}
          />
        </Field>
        <Field
          id="confirmPassword"
          label="Confirm password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            {...fieldProps("confirmPassword", errors.confirmPassword?.message)}
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          {isSubmitting ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </>
  );
}
