"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { applyServerError } from "@/lib/form-errors";

import { useChangePassword } from "../hooks/use-change-password";
import { useCurrentUser } from "../hooks/use-current-user";
import { changePasswordSchema, PASSWORD_MIN_LENGTH, type ChangePasswordValues } from "../schemas/auth.schema";

export function ChangePasswordForm() {
  const { data: user } = useCurrentUser();
  const changePassword = useChangePassword();
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      form.reset();
      toast.success("Password changed. Your other devices were signed out.");
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-sm gap-4">
      {/* Lets password managers associate the new password with this account. */}
      <input type="text" name="username" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
      {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
      <Field id="currentPassword" label="Current password" error={errors.currentPassword?.message}>
        <PasswordInput
          {...fieldProps("currentPassword", errors.currentPassword?.message)}
          autoComplete="current-password"
          {...form.register("currentPassword")}
        />
      </Field>
      <Field
        id="newPassword"
        label="New password"
        error={errors.newPassword?.message}
        description={`At least ${PASSWORD_MIN_LENGTH} characters. A passphrase works well.`}
      >
        <PasswordInput
          {...fieldProps("newPassword", errors.newPassword?.message, "hint")}
          autoComplete="new-password"
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
      <div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
