"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyServerError } from "@/lib/form-errors";

import { useUpdateProfile } from "../hooks/use-account";
import { profileSchema, type ProfileValues } from "../schemas/auth.schema";
import type { CurrentUser } from "../types/auth.types";

export function ProfileForm({ user }: { user: CurrentUser }) {
  const updateProfile = useUpdateProfile();
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: { name: user.name } });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync(values);
      toast.success("Profile updated.");
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-sm gap-4">
      {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
      <Field id="name" label="Full name" error={errors.name?.message}>
        <Input {...fieldProps("name", errors.name?.message)} autoComplete="name" {...form.register("name")} />
      </Field>
      <Field id="account-email" label="Email" description="Contact an administrator to change your email.">
        <Input {...fieldProps("account-email", undefined, "hint")} value={user.email} readOnly disabled />
      </Field>
      <div>
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
