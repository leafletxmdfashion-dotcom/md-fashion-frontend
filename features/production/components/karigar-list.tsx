"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable, useDataTableState, type DataColumn } from "@/components/data-table/data-table";
import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { UsersPanel } from "@/features/users/components/users-table";
import {
  emptyLogin,
  LoginFields,
  LoginHandover,
  loginPayload,
  loginValuesSchema,
  type LoginValues,
} from "@/features/users/components/login-fields";
import { useRoleCatalog, useUsers } from "@/features/users/hooks/use-users";
import type { CreatedLogin } from "@/features/users/types/user.types";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { applyServerError } from "@/lib/form-errors";

import { useKarigars, useSaveKarigar } from "../hooks/use-production";
import { CATEGORY_LABEL, karigarCode, moneyText, PAY_MODE_LABEL, PAY_UNIT } from "../lib/format";
import type { Karigar, KarigarCategory, PayMode } from "../types/production.types";
import { ProductionPage } from "./production-pages";

// SAFETY: the label map is a total Record over the union, so its keys are exactly the union members.
const CATEGORIES = Object.keys(CATEGORY_LABEL) as KarigarCategory[];

// SAFETY: the label map is a total Record over the union, so its keys are exactly the union members.
const PAY_MODES = Object.keys(PAY_MODE_LABEL) as PayMode[];

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(100),
    phone: z
      .string()
      .trim()
      .max(20, "Keep the phone under 20 characters.")
      .regex(/^$|^\+?[\d\s()-]{7,}$/, "Enter a phone number, digits only."),
    category: z.enum(["CUTTING_MASTER", "TAILOR", "HELPER", "PACKER", "STAFF", "OTHER"]),
    payMode: z.enum(["PER_PIECE", "PER_PALA", "PER_KG", "FIXED_JOB", "SALARY"]),
    payRate: z.number({ invalid_type_error: "Enter the rate." }).min(0, "Rate cannot be negative."),
    active: z.boolean(),
    notes: z.string().trim().max(500),
    /** NONE: no login · NEW: create one now · EXISTING: link a login that already exists. */
    loginChoice: z.enum(["NONE", "NEW", "EXISTING"]),
    /** The linked login (EXISTING); "" = none chosen yet. */
    userId: z.string(),
    login: z.custom<LoginValues>(),
  })
  .superRefine((values, ctx) => {
    if (values.loginChoice === "EXISTING" && !values.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userId"],
        message: "Choose a login, or pick No login.",
      });
    }
    if (values.loginChoice !== "NEW") return;
    const result = loginValuesSchema.safeParse(values.login);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ["login", ...issue.path],
        });
      }
    }
  });

type Values = z.infer<typeof schema>;

/** The role a new login usually gets for each kind of worker (used when this admin may grant it). */
const DEFAULT_ROLE: Record<KarigarCategory, string> = {
  CUTTING_MASTER: "KARIGAR",
  TAILOR: "KARIGAR",
  HELPER: "KARIGAR",
  PACKER: "PACKING_STAFF",
  STAFF: "STAFF",
  OTHER: "KARIGAR",
};

const LOGIN_CHOICES = [
  { value: "NONE", label: "No login" },
  { value: "NEW", label: "Create login" },
  { value: "EXISTING", label: "Link existing" },
] as const;

function loginLabel(login: { name: string; email: string | null; phone: string | null }) {
  return [login.name, login.email ?? login.phone].filter(Boolean).join(" · ");
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function KarigarDialog({ karigar, onOpenChange }: { karigar?: Karigar; onOpenChange: (open: boolean) => void }) {
  const save = useSaveKarigar();
  const { data: user } = useCurrentUser();
  // Logins (new or linked) let the person sign in; only user managers may make or link them.
  const canLink = hasPermission(user, "users.manage");
  const logins = useUsers(canLink);
  const roles = useRoleCatalog(canLink);
  const [handover, setHandover] = useState<{
    login: CreatedLogin;
    values: LoginValues;
    name: string;
  } | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: karigar?.name ?? "",
      phone: karigar?.phone ?? "",
      category: karigar?.category ?? "CUTTING_MASTER",
      payMode: karigar?.payMode ?? "PER_PIECE",
      payRate: karigar?.payRate ?? 0,
      active: karigar?.active ?? true,
      notes: karigar?.notes ?? "",
      loginChoice: karigar?.user ? "EXISTING" : "NONE",
      userId: karigar?.user?.id ?? "",
      login: emptyLogin(),
    },
  });

  const { errors, isSubmitting } = form.formState;
  const payMode = useWatch({ control: form.control, name: "payMode" });
  const loginChoice = useWatch({ control: form.control, name: "loginChoice" });
  const unit = PAY_UNIT[payMode];
  // A person who already has a login can only keep, change or remove the link here.
  const choices = karigar?.user ? LOGIN_CHOICES.filter((choice) => choice.value !== "NEW") : LOGIN_CHOICES;
  // Each login belongs to one person: offer free logins plus this person's current one.
  const linkable = (logins.data ?? []).filter((login) => login.id === karigar?.user?.id || !login.linkedTo);

  const chooseLogin = (next: Values["loginChoice"]) => {
    form.setValue("loginChoice", next);
    form.clearErrors(["login", "userId"]);

    if (next === "NEW") {
      const { phone, category } = form.getValues();
      const roleKey = DEFAULT_ROLE[category];
      const assignable = roles.data?.roles.some((role) => role.key === roleKey && role.assignable);
      form.setValue("login", emptyLogin(phone, assignable ? roleKey : ""));
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { userId, login, loginChoice: choice, ...rest } = values;
      const saved = await save.mutateAsync({
        id: karigar?.id,
        ...rest,
        payRate: values.payMode === "SALARY" ? 0 : values.payRate,
        phone: values.phone || null,
        notes: values.notes || null,
        ...(canLink && choice === "NEW" ? { login: loginPayload(login) } : {}),
        ...(canLink && choice === "EXISTING" ? { userId: userId || null } : {}),
        ...(canLink && choice === "NONE" ? { userId: null } : {}),
      });

      toast.success(`${saved.karigar.name} saved.`);

      if (saved.login)
        setHandover({
          login: saved.login,
          values: login,
          name: saved.karigar.name,
        });
      else onOpenChange(false);
    } catch (error) {
      applyServerError(error, form);
    }
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {handover ? `Login for ${handover.name}` : karigar ? `Edit ${karigar.name}` : "New staff or karigar"}
          </DialogTitle>
          <DialogDescription>
            {handover
              ? "Share these now. They are not shown again."
              : "Everyone who is paid: karigars, packers and office staff. The pay mode decides what each job earns; a new rate applies to future jobs only."}
          </DialogDescription>
        </DialogHeader>
        {handover ? (
          <>
            <LoginHandover login={handover.login} values={handover.values} />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            {errors.root?.server ? <FormAlert>{errors.root.server.message}</FormAlert> : null}
            <section className="grid gap-4" aria-labelledby="karigar-details-heading">
              <SectionHeading id="karigar-details-heading">Details</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="karigar-name" label="Name" error={errors.name?.message}>
                  <Input {...fieldProps("karigar-name", errors.name?.message)} autoFocus {...form.register("name")} />
                </Field>
                <Field id="karigar-phone" label="Phone" error={errors.phone?.message}>
                  <Input
                    {...fieldProps("karigar-phone", errors.phone?.message)}
                    type="tel"
                    {...form.register("phone")}
                  />
                </Field>
                <Field id="karigar-category" label="Category" error={errors.category?.message}>
                  <Controller
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <Select
                        items={CATEGORIES.map((value) => ({
                          value,
                          label: CATEGORY_LABEL[value],
                        }))}
                        value={field.value}
                        onValueChange={(next) => next && field.onChange(next)}
                      >
                        <SelectTrigger id="karigar-category" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {CATEGORY_LABEL[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
            </section>

            <section className="grid gap-4 border-t pt-5" aria-labelledby="karigar-pay-heading">
              <SectionHeading id="karigar-pay-heading">Pay</SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="karigar-pay" label="Paid" error={errors.payMode?.message}>
                  <Controller
                    control={form.control}
                    name="payMode"
                    render={({ field }) => (
                      <Select
                        items={PAY_MODES.map((value) => ({
                          value,
                          label: PAY_MODE_LABEL[value],
                        }))}
                        value={field.value}
                        onValueChange={(next) => next && field.onChange(next)}
                      >
                        <SelectTrigger id="karigar-pay" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAY_MODES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {PAY_MODE_LABEL[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                {unit ? (
                  <Field id="karigar-rate" label="Rate" error={errors.payRate?.message}>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>Rs</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        {...fieldProps("karigar-rate", errors.payRate?.message)}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        {...form.register("payRate", { valueAsNumber: true })}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>/ {unit}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                ) : (
                  <p className="self-end rounded-lg border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
                    Paid daily or by salary: finalized jobs post no per-job earning.
                  </p>
                )}
              </div>
              <Field id="karigar-notes" label="Notes" error={errors.notes?.message}>
                <Textarea
                  {...fieldProps("karigar-notes", errors.notes?.message)}
                  rows={2}
                  {...form.register("notes")}
                />
              </Field>
            </section>

            {canLink ? (
              <section className="grid gap-4 border-t pt-5" aria-labelledby="karigar-login-heading">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-0.5">
                    <SectionHeading id="karigar-login-heading">Login</SectionHeading>
                    <p className="text-xs text-muted-foreground">
                      Lets them sign in and use what their role allows, including their own ledger.
                    </p>
                  </div>
                  <SegmentedControl
                    aria-label="Login"
                    value={loginChoice}
                    onValueChange={chooseLogin}
                    options={choices}
                  />
                </div>
                {loginChoice === "NEW" ? (
                  roles.data ? (
                    <LoginFields
                      // SAFETY: Values has `login: LoginValues`; LoginFields only reads and writes login.*.
                      form={form as unknown as UseFormReturn<{ login: LoginValues }>}
                      roles={roles.data.roles}
                      catalog={roles.data.catalog}
                      idPrefix="karigar-login"
                      forPerson
                    />
                  ) : (
                    <p className="text-[13px] text-muted-foreground">Loading roles…</p>
                  )
                ) : loginChoice === "EXISTING" ? (
                  <Field
                    id="karigar-login"
                    label="Existing login"
                    error={errors.userId?.message}
                    description="Logins made under Login accounts. Each login belongs to one person."
                  >
                    <Controller
                      control={form.control}
                      name="userId"
                      render={({ field }) => (
                        <Select
                          items={linkable.map((login) => ({
                            value: login.id,
                            label: loginLabel(login),
                          }))}
                          value={field.value || null}
                          onValueChange={(next) => field.onChange(next ?? "")}
                        >
                          <SelectTrigger
                            id="karigar-login"
                            className="w-full"
                            aria-invalid={errors.userId ? true : undefined}
                          >
                            <SelectValue placeholder={logins.isLoading ? "Loading…" : "Choose a login"} />
                          </SelectTrigger>
                          <SelectContent>
                            {linkable.map((login) => (
                              <SelectItem key={login.id} value={login.id} description={login.role.name}>
                                {loginLabel(login)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                ) : null}
              </section>
            ) : null}

            {karigar ? (
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <div className="flex items-center gap-2 border-t pt-4">
                    <Checkbox
                      id="karigar-active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor="karigar-active" className="text-[13px] font-normal">
                      Active (can be chosen for new work)
                    </Label>
                  </div>
                )}
              />
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {loginChoice === "NEW" ? "Save and create login" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function columns(showPay: boolean, showEarned: boolean): DataColumn<Karigar>[] {
  const all: (DataColumn<Karigar> | null)[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      hideable: false,
      filter: { type: "text", placeholder: "Name or phone contains…" },
      skeleton: { sub: true, width: "w-28" },
      cell: (karigar) => (
        <>
          <p className="font-medium">{karigar.name}</p>
          <p className="text-xs text-muted-foreground">
            {karigarCode(karigar.number)}
            {karigar.phone ? ` · ${karigar.phone}` : ""}
            {karigar.user ? ` · login ${karigar.user.email ?? karigar.user.phone ?? ""}` : ""}
          </p>
        </>
      ),
    },
    {
      id: "category",
      header: "Works as",
      sortable: true,
      filter: {
        type: "enum",
        options: CATEGORIES.map((value) => ({
          value,
          label: CATEGORY_LABEL[value],
        })),
      },
      skeleton: { width: "w-24" },
      cell: (karigar) => CATEGORY_LABEL[karigar.category],
    },
    {
      id: "payMode",
      header: "Paid",
      className: "hidden md:table-cell",
      sortable: true,
      filter: {
        type: "enum",
        options: PAY_MODES.map((value) => ({
          value,
          label: PAY_MODE_LABEL[value],
        })),
      },
      skeleton: { width: "w-28" },
      cell: (karigar) => (
        <span className="text-muted-foreground">
          {PAY_MODE_LABEL[karigar.payMode]}
          {showPay && karigar.payRate !== null && PAY_UNIT[karigar.payMode]
            ? ` · ${moneyText(karigar.payRate)} / ${PAY_UNIT[karigar.payMode]}`
            : ""}
        </span>
      ),
    },
    showEarned
      ? {
          id: "earned",
          header: "Earned",
          align: "right",
          sortable: true,
          filter: { type: "number", unit: "Rs" },
          skeleton: { width: "w-20" },
          cell: (karigar) => <span className="font-medium tabular-nums">{moneyText(karigar.earned)}</span>,
        }
      : null,
    {
      id: "status",
      header: "Status",
      sortable: true,
      filter: {
        type: "enum",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      skeleton: { width: "w-14" },
      cell: (karigar) => (
        <StatusChip tone={karigar.active ? "success" : "neutral"}>{karigar.active ? "Active" : "Inactive"}</StatusChip>
      ),
    },
  ];

  return all.flatMap((column) => (column ? [column] : []));
}

// Rates show with karigar.manage or costing.view; lifetime earnings with costing.view only.
const WITH_PAY = columns(true, true);

const RATES_ONLY = columns(true, false);

const WITHOUT_PAY = columns(false, false);

function PeopleTable() {
  const { data: user } = useCurrentUser();
  const router = useRouter();
  const canManage = hasPermission(user, "karigar.manage");
  const canSeeCost = hasPermission(user, "costing.view");
  const canSeeLedger = hasPermission(user, "payments.view");
  const cols = canSeeCost ? WITH_PAY : canManage ? RATES_ONLY : WITHOUT_PAY;
  const table = useDataTableState(WITH_PAY);
  const list = useKarigars({
    ...table.params,
    page: table.page,
    pageSize: table.pageSize,
  });
  const [dialog, setDialog] = useState<{
    karigar?: Karigar;
    key: number;
  } | null>(null);

  const newButton = canManage ? (
    <Button onClick={() => setDialog({ key: Date.now() })}>
      <Plus aria-hidden />
      Add person
    </Button>
  ) : null;

  return (
    <>
      <DataTable
        id="karigars"
        exportPath="/karigars/export"
        columns={cols}
        rows={list.data?.karigars}
        rowId={(karigar) => karigar.id}
        total={list.data?.total}
        state={table}
        isFetching={list.isFetching}
        isPlaceholderData={list.isPlaceholderData}
        error={list.error}
        onRetry={() => void list.refetch()}
        searchLabel="Search staff and karigars"
        searchPlaceholder="Search name or phone…"
        isEmpty={list.data !== undefined && list.data.total === 0 && !table.isFiltered}
        empty={{
          icon: UserRound,
          title: "No staff or karigars yet",
          description: "Add cutting masters, tailors, packers and office staff with how each is paid.",
          action: newButton,
        }}
        toolbarEnd={newButton}
        onRowClick={canManage ? (karigar) => setDialog({ karigar, key: Date.now() }) : undefined}
        rowActions={
          canManage || canSeeLedger
            ? (karigar) => (
                <>
                  {canManage ? (
                    <DropdownMenuItem onClick={() => setDialog({ karigar, key: Date.now() })}>Edit</DropdownMenuItem>
                  ) : null}
                  {canSeeLedger ? (
                    <DropdownMenuItem onClick={() => router.push(`/karigar/payments?person=${karigar.id}`)}>
                      Payments &amp; ledger
                    </DropdownMenuItem>
                  ) : null}
                </>
              )
            : undefined
        }
      />
      {dialog ? (
        <KarigarDialog
          key={dialog.key}
          karigar={dialog.karigar}
          onOpenChange={(open) => (open ? null : setDialog(null))}
        />
      ) : null}
    </>
  );
}

/** Staff & Karigar: everyone who is paid, and the login accounts people sign in with, in one place. */
export function KarigarList() {
  const { data: user } = useCurrentUser();
  const { filters, resetTo: setFilters } = useUrlFilters(["tab"]);
  const canSeeLogins = hasPermission(user, "users.view");
  const tab = canSeeLogins && filters.tab === "logins" ? "logins" : "people";

  return (
    <ProductionPage
      title="Staff & Karigar"
      description="Everyone who works here and how each is paid, and the logins people sign in with."
      permission="karigar.view"
    >
      <div className="grid gap-4">
        {canSeeLogins ? (
          <Tabs value={tab} onValueChange={(value) => setFilters({ tab: value === "logins" ? "logins" : "" })}>
            <TabsList>
              <TabsTrigger value="people">Staff &amp; karigars</TabsTrigger>
              <TabsTrigger value="logins">Login accounts</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
        {tab === "logins" ? <UsersPanel /> : <PeopleTable />}
      </div>
    </ProductionPage>
  );
}
