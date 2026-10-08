import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthLoading } from "@/features/auth/components/auth-loading";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginForm />
    </Suspense>
  );
}
