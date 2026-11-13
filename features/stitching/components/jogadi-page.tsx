"use client";

import { Loader2, Plus, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Page } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { EmptyState, ErrorState } from "@/components/states";
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
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { useKarigarOptions } from "@/features/production/hooks/use-production";
import { CATEGORY_LABEL, karigarCode } from "@/features/production/lib/format";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { ApiError } from "@/lib/api-client";

import { useCreateTeam, useTeams, useUpdateTeam } from "../hooks/use-stitching";
import type { JogadiTeam } from "../types/stitching.types";

interface MemberRow {
  karigarId: string;
  share: string;
}

/** Shares as typed: all empty (equal split) or all filled, adding up to 100. */
function shareProblem(rows: MemberRow[]): string | null {
  const filled = rows.filter((row) => row.share.trim() !== "");

  if (filled.length === 0) return null;

  if (filled.length < rows.length) return "Give every member a share, or leave all empty to split equally.";

  const total = filled.reduce((sum, row) => sum + Math.round(Number(row.share) * 100), 0);

  return total === 10_000 ? null : `Shares add up to ${(total / 100).toFixed(2)}%; they must make exactly 100%.`;
}

function TeamDialog({ team, onOpenChange }: { team: JogadiTeam | null; onOpenChange: (open: boolean) => void }) {
  const karigars = useKarigarOptions();
  const create = useCreateTeam();
  const update = useUpdateTeam();
  const [name, setName] = useState(team?.name ?? "");
  const [active, setActive] = useState(team?.active ?? true);
  const [notes, setNotes] = useState(team?.notes ?? "");

  const [rows, setRows] = useState<MemberRow[]>(
    team?.members.map((member) => ({
      karigarId: member.karigarId,
      share: member.sharePercent?.toString() ?? "",
    })) ?? [{ karigarId: "", share: "" }],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const saving = create.isPending || update.isPending;

  // Current members stay listed even if their karigar was since made inactive.
  const options = [
    ...(karigars.data ?? []),
    ...(team?.members ?? [])
      .filter((member) => !karigars.data?.some((karigar) => karigar.id === member.karigarId))
      .map((member) => ({
        id: member.karigarId,
        number: null,
        name: member.name,
        category: member.category,
      })),
  ];

  const items = options.map((karigar) => ({
    value: karigar.id,
    label: karigar.name,
  }));
  const problem = shareProblem(rows);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    if (!name.trim()) next.name = "Enter the team name.";

    rows.forEach((row, index) => {
      if (!row.karigarId) next[`members.${index}.karigarId`] = "Choose a karigar.";
      else if (rows.findIndex((other) => other.karigarId === row.karigarId) !== index)
        next[`members.${index}.karigarId`] = "Listed twice.";
    });

    if (problem) next.members = problem;

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    const input = {
      name: name.trim(),
      active,
      notes: notes.trim() || null,
      members: rows.map((row) => ({
        karigarId: row.karigarId,
        sharePercent: row.share.trim() ? Number(row.share) : null,
      })),
    };

    try {
      const saved = team ? await update.mutateAsync({ id: team.id, ...input }) : await create.mutateAsync(input);

      toast.success(team ? `${saved.name} saved.` : `${saved.name} (${saved.code}) created.`);
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      setErrors(
        Object.fromEntries(Object.entries(apiError?.details ?? {}).map(([key, messages]) => [key, messages[0] ?? ""])),
      );
      setFormError(apiError?.message ?? "Could not save the team.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{team ? `Edit ${team.name}` : "New Jogadi team"}</DialogTitle>
          <DialogDescription>
            Work issued to the team is paid to these members. Changes apply to new work only; issued work keeps the team
            it was given to.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}
          <Field id="team-name" label="Team name" error={errors.name}>
            <Input
              {...fieldProps("team-name", errors.name)}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Ram's team"
              autoComplete="off"
              autoFocus
              maxLength={60}
            />
          </Field>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium text-foreground/90">Members</legend>
            <p className="text-xs text-muted-foreground">
              Leave Share empty to split earnings equally, or give every member a share adding up to 100%.
            </p>
            {rows.map((row, index) => {
              const error = errors[`members.${index}.karigarId`];

              return (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_2.25rem] items-start gap-2">
                  <div>
                    <Select
                      items={items}
                      value={row.karigarId || null}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((item, at) => (at === index ? { ...item, karigarId: value ?? "" } : item)),
                        )
                      }
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Member ${index + 1}`}
                        aria-invalid={error ? true : undefined}
                      >
                        <SelectValue placeholder={karigars.isLoading ? "Loading…" : "Choose a karigar"} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((karigar) => (
                          <SelectItem
                            key={karigar.id}
                            value={karigar.id}
                            description={
                              <>
                                {karigar.number !== null ? `${karigarCode(karigar.number)} · ` : ""}
                                {CATEGORY_LABEL[karigar.category]}
                              </>
                            }
                          >
                            {karigar.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                  </div>
                  <InputGroup>
                    <InputGroupInput
                      aria-label={`Share, member ${index + 1}`}
                      inputMode="decimal"
                      placeholder="Equal"
                      className="text-right tabular-nums"
                      value={row.share}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, at) => (at === index ? { ...item, share: event.target.value } : item)),
                        )
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove member ${index + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              );
            })}
            {errors.members || problem ? <p className="text-xs text-destructive">{errors.members ?? problem}</p> : null}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((current) => [...current, { karigarId: "", share: "" }])}
              >
                <Plus aria-hidden />
                Add member
              </Button>
            </div>
            {karigars.data?.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No karigars yet.{" "}
                <Link href="/karigar" className="text-link hover:underline">
                  Add them in Staff &amp; Karigar
                </Link>
                .
              </p>
            ) : null}
          </fieldset>

          <Field id="team-notes" label="Notes" description="Optional">
            <Textarea
              id="team-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Specialises in collars"
            />
          </Field>

          {team ? (
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={active} onCheckedChange={(checked) => setActive(checked)} />
              Active · inactive teams cannot be given new work
            </label>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {team ? "Save team" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_ITEMS = [
  { value: "", label: "All teams" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function JogadiPage() {
  const { data: user } = useCurrentUser();
  const teams = useTeams();
  const [editing, setEditing] = useState<{
    team: JogadiTeam | null;
    key: number;
  } | null>(null);
  const canManage = hasPermission(user, "karigar.manage");
  const { filters, setFilters, clearFilters, isFiltered } = useUrlFilters(["q", "status"]);
  // ponytail: teams are few (tens), so they are searched here rather than on the server.
  const needle = filters.q.toLowerCase();

  const shown = teams.data?.filter(
    (team) =>
      (!filters.status || (filters.status === "active") === team.active) &&
      (!needle ||
        [team.name, team.code, ...team.members.map((member) => member.name)].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );

  return (
    <RequirePermission permission="karigar.view" title="Jogadi Teams">
      <Page
        title="Jogadi Teams"
        description="Stitching teams. Cut pieces are issued to a team, and what it earns is split over its members."
        actions={
          canManage ? (
            <Button onClick={() => setEditing({ team: null, key: Date.now() })}>
              <Plus aria-hidden />
              New team
            </Button>
          ) : null
        }
      >
        {teams.isError ? (
          <ErrorState title="Could not load teams" error={teams.error} onRetry={() => void teams.refetch()} />
        ) : !teams.data ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-36" />
            ))}
          </div>
        ) : teams.data.length === 0 ? (
          <div className="rounded-lg border bg-card">
            <EmptyState
              icon={UsersRound}
              title="No Jogadi teams yet"
              description="Create a team from your karigars to start issuing cut pieces for stitching."
            />
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                label="Search teams"
                placeholder="Search team, code or member…"
                value={filters.q}
                onChange={(q) => setFilters({ q })}
                className="w-full bg-card sm:w-80"
              />
              <Select
                items={STATUS_ITEMS}
                value={filters.status}
                onValueChange={(value) => setFilters({ status: String(value ?? "") })}
              >
                <SelectTrigger aria-label="Filter by status" className="w-full bg-card sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isFiltered ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  Reset
                </Button>
              ) : null}
            </div>
            {shown?.length === 0 ? (
              <div className="rounded-lg border bg-card">
                <EmptyState
                  title="No teams match"
                  description="Try another search, or clear the filters."
                  action={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : null}
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown?.map((team) => (
                <li key={team.id} className="grid content-start gap-3 rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold">{team.name}</h2>
                      <p className="text-xs text-muted-foreground">{team.code}</p>
                    </div>
                    {team.active ? (
                      <StatusChip tone="success">Active</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Inactive</StatusChip>
                    )}
                  </div>
                  <ul className="flex flex-wrap gap-1.5" aria-label={`${team.name} members`}>
                    {team.members.map((member) => (
                      <li key={member.karigarId} className="rounded-md border px-2 py-0.5 text-[13px]">
                        {member.name}
                        {member.sharePercent !== null ? (
                          <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                            {member.sharePercent}%
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between gap-3 border-t pt-3 text-[13px]">
                    <span className="text-muted-foreground">
                      {team.members.some((member) => member.sharePercent !== null) ? "Split by share" : "Split equally"}{" "}
                      ·{" "}
                      <Link href={`/stitching?team=${team.id}`} className="text-link hover:underline">
                        {team.piecesHeld.toLocaleString("en-IN")} pieces with team
                      </Link>
                    </span>
                    {canManage ? (
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ team, key: Date.now() })}>
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {editing ? (
          <TeamDialog
            key={editing.key}
            team={editing.team}
            onOpenChange={(open) => (open ? undefined : setEditing(null))}
          />
        ) : null}
      </Page>
    </RequirePermission>
  );
}
