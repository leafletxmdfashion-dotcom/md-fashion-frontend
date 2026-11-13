"use client";

import { Check, Copy, KeyRound, Link2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";

import type { CreatedLogin, PermissionGroup, Role } from "../types/user.types";
import { RoleSelect } from "./role-select";

export type LoginMode = "INVITE" | "PASSWORD";

export interface LoginValues {
  email: string;
  phone: string;
  roleKey: string;
  mode: LoginMode;
  password: string;
}

export const emptyLogin = (phone = "", roleKey = ""): LoginValues => ({
  email: "",
  phone,
  roleKey,
  mode: "INVITE",
  password: "",
});

const PHONE = /^\+?[\d\s()-]{7,20}$/;

/** Fast feedback only; the API re-validates (and applies the password policy). */
export const loginValuesSchema = z
  .object({
    email: z.string().trim().max(254),
    phone: z.string().trim().max(32),
    roleKey: z.string().min(1, "Choose a role."),
    mode: z.enum(["INVITE", "PASSWORD"]),
    password: z.string().max(128, "Use at most 128 characters."),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter an email or a phone number.",
      });
    }
    if (value.email && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email address.",
      });
    }
    if (value.phone && !PHONE.test(value.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Enter a valid phone number.",
      });
    }
    if (value.mode === "PASSWORD" && value.password.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Use at least 12 characters.",
      });
    }
  });

export function loginPayload(values: LoginValues) {
  return {
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    roleKey: values.roleKey,
    mode: values.mode,
    ...(values.mode === "PASSWORD" ? { password: values.password } : {}),
  };
}

// No look-alike characters (0/O, 1/l/I), grouped for reading out loud or typing from a slip.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A random temporary password, e.g. "kx7P-m3Qa-9tRw-Hd4e" (about 93 bits). */
export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(16));
  const chars = Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** What the chosen role may do, grouped by module, so the admin sees it before granting it. */
export function RolePermissions({
  role,
  catalog,
  forPerson = false,
}: {
  role: Role | undefined;
  catalog: PermissionGroup[];
  /** The login belongs to a staff / karigar record, so it also sees that person's own ledger. */
  forPerson?: boolean;
}) {
  if (!role) return null;

  if (role.key === "OWNER") {
    return <p className="text-xs text-muted-foreground">Everything, including users, roles and money.</p>;
  }

  const granted = new Set(role.permissions);
  const groups = catalog
    .map((group) => ({
      module: group.module,
      labels: group.permissions.filter((p) => granted.has(p.key)).map((p) => p.label),
    }))
    .filter((group) => group.labels.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {forPerson
          ? "No other permissions: they see only their own ledger."
          : "No permissions yet: they can sign in but see nothing."}
      </p>
    );
  }

  return (
    <dl className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs" aria-label={`${role.name} can`}>
      {groups.map((group) => (
        <div key={group.module} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
          <dt className="font-medium text-foreground/80">{group.module}</dt>
          <dd className="text-muted-foreground">{group.labels.join(", ")}</dd>
        </div>
      ))}
      {forPerson ? (
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
          <dt className="font-medium text-foreground/80">Own ledger</dt>
          <dd className="text-muted-foreground">Their earnings, payments and balance</dd>
        </div>
      ) : null}
    </dl>
  );
}

type WithLogin = { login: LoginValues };

/**
 * Email, phone, role (with what it allows) and how the person gets their password.
 * Field names are `login.*`, matching the API's error paths.
 */
export function LoginFields({
  form,
  roles,
  catalog,
  idPrefix,
  forPerson = false,
}: {
  form: UseFormReturn<WithLogin>;
  roles: Role[];
  catalog: PermissionGroup[];
  idPrefix: string;
  /** Made with a staff / karigar record (they also see their own ledger). */
  forPerson?: boolean;
}) {
  const { errors } = form.formState;
  const err = errors.login;
  const mode = useWatch({ control: form.control, name: "login.mode" });
  const roleKey = useWatch({ control: form.control, name: "login.roleKey" });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("email")} label="Email" error={err?.email?.message} description="Optional if phone is given">
          <Input
            {...fieldProps(id("email"), err?.email?.message)}
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            {...form.register("login.email")}
          />
        </Field>
        <Field id={id("phone")} label="Phone" error={err?.phone?.message} description="They can sign in with either">
          <Input
            {...fieldProps(id("phone"), err?.phone?.message)}
            type="tel"
            autoComplete="off"
            placeholder="98XXXXXXXX"
            {...form.register("login.phone")}
          />
        </Field>
      </div>
      <Field id={id("role")} label="Role" error={err?.roleKey?.message}>
        <Controller
          control={form.control}
          name="login.roleKey"
          render={({ field }) => (
            <RoleSelect
              id={id("role")}
              roles={roles}
              value={field.value}
              onChange={field.onChange}
              invalid={Boolean(err?.roleKey)}
            />
          )}
        />
      </Field>
      <RolePermissions role={roles.find((role) => role.key === roleKey)} catalog={catalog} forPerson={forPerson} />
      <Field id={id("mode")} label="Password">
        <Controller
          control={form.control}
          name="login.mode"
          render={({ field }) => (
            <SegmentedControl
              id={id("mode")}
              aria-label="How they get their password"
              fill
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next);
                if (next === "INVITE") form.setValue("login.password", "");
              }}
              options={[
                {
                  value: "INVITE",
                  label: "Send a link to set it",
                  icon: Link2,
                },
                { value: "PASSWORD", label: "Set it now", icon: KeyRound },
              ]}
            />
          )}
        />
      </Field>
      {mode === "PASSWORD" ? (
        <Field
          id={id("password")}
          label="Temporary password"
          error={err?.password?.message}
          description="Give it to them yourself. They must choose their own at first sign-in."
          action={
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
              onClick={() =>
                form.setValue("login.password", generatePassword(), {
                  shouldValidate: true,
                })
              }
            >
              <Wand2 className="size-3.5" aria-hidden />
              Generate
            </button>
          }
        >
          <PasswordInput
            {...fieldProps(id("password"), err?.password?.message, "hint")}
            autoComplete="new-password"
            {...form.register("login.password")}
          />
        </Field>
      ) : (
        <p className="text-xs text-muted-foreground">
          With an email the link is emailed. You also get the link to share on WhatsApp or SMS. It works once, for 72
          hours.
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  );
}

/** Shown once after a login is made: the invitation link, or the sign-in details to hand over. */
export function LoginHandover({
  login,
  values,
}: {
  login: CreatedLogin;
  values: Pick<LoginValues, "email" | "phone" | "password">;
}) {
  const signInWith = [values.email.trim(), values.phone.trim()].filter(Boolean).join(" or ");

  if (login.invitation) {
    return (
      <div className="grid gap-2">
        <FormAlert variant="success">
          {values.email.trim() ? "Invitation emailed. " : ""}Share this single-use link with them. It expires in 72
          hours.
        </FormAlert>
        <div className="flex gap-2">
          <Input
            readOnly
            value={login.invitation.inviteUrl}
            aria-label="Invitation link"
            className="font-mono text-xs"
          />
          <CopyButton text={login.invitation.inviteUrl} label="Copy invitation link" />
        </div>
      </div>
    );
  }

  const details = `Sign in at ${window.location.origin}/login\nEmail or phone: ${signInWith}\nTemporary password: ${values.password}`;

  return (
    <div className="grid gap-2">
      <FormAlert variant="success">
        Login created. Give them these details; they will choose their own password at first sign-in. The password is
        not shown again.
      </FormAlert>
      <div className="flex items-start gap-2">
        <pre
          aria-label="Sign-in details"
          className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap"
        >
          {details}
        </pre>
        <CopyButton text={details} label="Copy sign-in details" />
      </div>
    </div>
  );
}
