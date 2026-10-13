"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerError } from "@/lib/form-errors";
import { getSafeRedirect } from "@/lib/safe-redirect";

import { useCurrentUser } from "../hooks/use-current-user";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginValues } from "../schemas/auth.schema";
import { AuthHeading } from "./auth-heading";

// Shown after a sign-out the user did not ask for, or to confirm one they did.
const SIGN_OUT_MESSAGES: Record<string, string> = {
  "signed-out": "You have been logged out.",
  elsewhere: "You were logged out in another tab.",
  expired: "Your session has ended. Please log in again.",
  idle: "You were logged out after a period of inactivity.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = getSafeRedirect(searchParams.get("next"));
  const signedOut = SIGN_OUT_MESSAGES[searchParams.get("reason") ?? ""];
  const { data: currentUser } = useCurrentUser();
  const login = useLogin();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // Already signed in: skip the form.
  useEffect(() => {
    if (currentUser) router.replace(destination);
  }, [currentUser, destination, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(destination);
    } catch (error) {
      form.resetField("password");
      applyServerError(error, form);
    }
  });

  return (
    <>
      <AuthHeading title="Welcome back" description="Log in to your MD Fashion Center account." />
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        {errors.root?.server ? (
          <FormAlert>{errors.root.server.message}</FormAlert>
        ) : signedOut ? (
          <FormAlert variant="info">{signedOut}</FormAlert>
        ) : null}
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldProps("email", errors.email?.message)}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            placeholder="you@company.com"
            {...form.register("email")}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          error={errors.password?.message}
          action={
            <Link
              href="/forgot-password"
              className="rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            {...fieldProps("password", errors.password?.message)}
            autoComplete="current-password"
            {...form.register("password")}
          />
        </Field>
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          {isSubmitting ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        Accounts are created by invitation. Ask an administrator if you need
        access.
      </p>
    </>
  );
}
