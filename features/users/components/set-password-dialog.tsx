"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";

import { useSetUserPassword } from "../hooks/use-users";
import type { ManagedUser } from "../types/user.types";
import { generatePassword, LoginHandover } from "./login-fields";

/**
 * Admin sets a temporary password (for people without email, or who forgot theirs). The person is
 * signed out everywhere and must choose their own password at the next sign-in.
 */
export function SetPasswordDialog({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const setPassword = useSetUserPassword();
  const [password, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    setFormError(null);

    if (password.length < 12) {
      setFieldError("Use at least 12 characters.");
      return;
    }

    try {
      await setPassword.mutateAsync({ userId: user.id, password });
      setDone(true);
    } catch (caught) {
      const policy = caught instanceof ApiError ? caught.details?.password?.[0] : undefined;
      if (policy) setFieldError(policy);
      else setFormError(caught instanceof ApiError ? caught.message : "Could not set the password. Try again.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{done ? "Password set" : `New password for ${user.name}`}</DialogTitle>
          <DialogDescription>
            {done
              ? "Share these now. They are not shown again."
              : "They are signed out everywhere and must choose their own password when they next sign in."}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <LoginHandover
              login={{ userId: user.id, mode: "PASSWORD", invitation: null }}
              values={{
                email: user.email ?? "",
                phone: user.phone ?? "",
                password,
              }}
            />
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
            {formError ? <FormAlert>{formError}</FormAlert> : null}
            <Field
              id="set-password"
              label="Temporary password"
              error={fieldError ?? undefined}
              description="At least 12 characters."
              action={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
                  onClick={() => setValue(generatePassword())}
                >
                  <Wand2 className="size-3.5" aria-hidden />
                  Generate
                </button>
              }
            >
              <PasswordInput
                {...fieldProps("set-password", fieldError ?? undefined, "hint")}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setValue(event.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={setPassword.isPending}>
                {setPassword.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Set password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
