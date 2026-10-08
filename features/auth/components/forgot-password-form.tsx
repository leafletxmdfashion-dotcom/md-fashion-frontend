"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerError } from "@/lib/form-errors";

import { useForgotPassword } from "../hooks/use-forgot-password";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas/auth.schema";
import { AuthHeading } from "./auth-heading";

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgotPassword.mutateAsync(values);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  if (forgotPassword.isSuccess) {
    return (
      <>
        <AuthHeading title="Check your email" />
        <FormAlert variant="success">{forgotPassword.data}</FormAlert>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          The link expires in 30 minutes.{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter your work email and we will send you a link to choose a new password."
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldProps("email", errors.email?.message)}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            {...form.register("email")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">
          Back to log in
        </Link>
      </p>
    </>
  );
}
