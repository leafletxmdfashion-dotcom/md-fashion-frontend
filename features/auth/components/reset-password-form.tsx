"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { applyServerError } from "@/lib/form-errors";

import { useHashToken } from "../hooks/use-hash-token";
import { useResetPassword } from "../hooks/use-reset-password";
import { PASSWORD_MIN_LENGTH, resetPasswordSchema, type ResetPasswordValues } from "../schemas/auth.schema";
import { AuthHeading } from "./auth-heading";
import { AuthLoading } from "./auth-loading";
import { InvalidLink } from "./invalid-link";

const EXPIRED = {
  title: "This link is invalid or has expired",
  description: "Reset links work once and expire after 30 minutes. Request a new one to continue.",
  action: { href: "/forgot-password", label: "Request a new link" },
};

export function ResetPasswordForm() {
  const token = useHashToken();
  const resetPassword = useResetPassword();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (token === undefined) return <AuthLoading />;
  if (!token) return <InvalidLink {...EXPIRED} />;
  if (resetPassword.error instanceof ApiError && resetPassword.error.code === "TOKEN_INVALID") {
    return <InvalidLink {...EXPIRED} />;
  }

  if (resetPassword.isSuccess) {
    return (
      <>
        <AuthHeading title="Password updated" />
        <FormAlert variant="success">
          Your password has been changed and you have been signed out everywhere. Log in with your new password.
        </FormAlert>
        <Link href="/login" className={buttonVariants({ className: "mt-4 w-full" })}>
          Log in
        </Link>
      </>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync({ token, newPassword: values.newPassword });
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <>
      <AuthHeading title="Choose a new password" description="This will sign you out of every device." />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
        <Field
          id="newPassword"
          label="New password"
          error={errors.newPassword?.message}
          description={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase works well.`}
        >
          <PasswordInput
            {...fieldProps("newPassword", errors.newPassword?.message, "hint")}
            autoComplete="new-password"
            autoFocus
            {...form.register("newPassword")}
          />
        </Field>
        <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
          <PasswordInput
            {...fieldProps("confirmPassword", errors.confirmPassword?.message)}
            autoComplete="new-password"
            {...form.register("confirmPassword")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}
