"use client";

import { Eraser, Loader2, Plus, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Field, fieldProps } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { SuggestInput } from "@/components/form/suggest-input";
import { Button } from "@/components/ui/button";
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
import { todayISO } from "@/features/fabric/lib/format";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { useAvailableLots, useCreateIssue, useLotBalance, useTeams } from "../hooks/use-stitching";
import { issueNumber, pieces } from "../lib/format";
import type { BalanceRow } from "../types/stitching.types";

const MAX_TEAMS = 10;

const WORK_SUGGESTIONS = [
  "Full stitching",
  "Overlock",
  "Collar attach",
  "Sleeve attach",
  "Side seam",
  "Hemming",
  "Buttoning",
];

// Bulk: one row per size, every colour together.
const lineKey = (row: Pick<BalanceRow, "size">) => row.size;

/** A team the pieces go to, with how many of each size it gets (as typed). */
interface Slot {
  teamId: string;
  quantities: Record<string, string>;
}

const count = (text: string | undefined) => (text?.trim() ? Number(text) : 0);

const emptySlot = (teamId = ""): Slot => ({ teamId, quantities: {} });

/** Every waiting piece, divided as evenly as possible; the first teams take any remainder. */
function divideAll(rows: BalanceRow[], slots: Slot[]): Slot[] {
  return slots.map((slot, index) => ({
    ...slot,
    quantities: Object.fromEntries(
      rows.map((row) => {
        const share = Math.floor(row.unissued / slots.length) + (index < row.unissued % slots.length ? 1 : 0);

        return [lineKey(row), share > 0 ? String(share) : ""];
      }),
    ),
  }));
}

/**
 * Issue a lot's cut pieces to a Jogadi team, or divide them between several teams.
 * Each team gets its own issue number; all are posted together. Mount with a `key`.
 */
export function IssueDialog({
  defaultLotId = "",
  defaultTeamId = "",
  onOpenChange,
  onIssued,
}: {
  defaultLotId?: string;
  defaultTeamId?: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the new issue's id when the pieces went to one team. */
  onIssued: (issueId: string) => void;
}) {
  const lots = useAvailableLots("");
  const teams = useTeams({ activeOnly: true });
  const create = useCreateIssue();
  const [lotId, setLotId] = useState(defaultLotId);
  const [operation, setOperation] = useState("Full stitching");
  const [rate, setRate] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([emptySlot(defaultTeamId)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const balance = useLotBalance(lotId || undefined);

  const waiting = (balance.data?.rows ?? []).filter((row) => row.unissued > 0);
  const lot = lots.data?.find((item) => item.id === lotId);

  const lotItems = (lots.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.lotNumber} · ${item.articleName}`,
  }));

  const teamName = (teamId: string) => teams.data?.find((team) => team.id === teamId)?.name ?? "";
  const divided = slots.length > 1;

  const slotTotal = (slot: Slot) =>
    waiting.reduce((sum, row) => sum + Math.max(0, count(slot.quantities[lineKey(row)]) || 0), 0);

  const total = slots.reduce((sum, slot) => sum + slotTotal(slot), 0);

  const leftOf = (row: BalanceRow) =>
    row.unissued - slots.reduce((sum, slot) => sum + (count(slot.quantities[lineKey(row)]) || 0), 0);

  const anyEntered = slots.some((slot) => Object.values(slot.quantities).some((value) => value.trim() !== ""));

  const updateSlot = (index: number, patch: Partial<Slot>) =>
    setSlots((current) => current.map((slot, at) => (at === index ? { ...slot, ...patch } : slot)));

  const setQuantity = (index: number, key: string, value: string) =>
    setSlots((current) =>
      current.map((slot, at) => (at === index ? { ...slot, quantities: { ...slot.quantities, [key]: value } } : slot)),
    );

  const toggleAll = () =>
    setSlots((current) => (anyEntered ? current.map((slot) => emptySlot(slot.teamId)) : divideAll(waiting, current)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    if (!lotId) next.lotId = "Choose a lot.";

    if (!operation.trim()) next.operation = "Enter the work, e.g. Full stitching.";

    if (!/^\d{1,5}(\.\d{1,2})?$/.test(rate.trim())) next.rate = "Enter the rate per piece, e.g. 12.50.";

    slots.forEach((slot, index) => {
      if (!slot.teamId) next[`team.${index}`] = "Choose a team.";
      else if (slots.findIndex((other) => other.teamId === slot.teamId) !== index)
        next[`team.${index}`] = "Chosen twice.";
      else if (divided && lotId && slotTotal(slot) === 0) next[`team.${index}`] = "Give this team some pieces.";
    });

    for (const row of waiting) {
      const key = lineKey(row);
      const typed = slots.map((slot) => count(slot.quantities[key]));

      if (typed.some((value) => !Number.isInteger(value) || value < 0)) next[key] = "Whole pieces only.";
      else if (leftOf(row) < 0) next[key] = `${-leftOf(row)} more than waiting.`;
    }

    if (lotId && total === 0) next.lines = "Enter how many pieces to issue, or use Issue all.";

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    const sent = slots.map((slot) => ({
      teamId: slot.teamId,
      rows: waiting.filter((row) => count(slot.quantities[lineKey(row)]) > 0),
      slot,
    }));

    try {
      const issues = await create.mutateAsync({
        lotId,
        operation: operation.trim(),
        rate: Number(rate),
        issueDate,
        notes: notes.trim() || null,
        teams: sent.map((entry) => ({
          teamId: entry.teamId,
          lines: entry.rows.map((row) => ({
            sizeLabel: row.size,
            quantity: count(entry.slot.quantities[lineKey(row)]),
          })),
        })),
      });

      toast.success(
        issues.length === 1
          ? `${issueNumber(issues[0]!.number)}: ${pieces(total)} issued to ${issues[0]!.team.name}.`
          : `${pieces(total)} divided between ${issues.length} teams: ${issues.map((issue) => `${issueNumber(issue.number)} ${issue.team.name}`).join(", ")}.`,
      );

      if (issues.length === 1) onIssued(issues[0]!.id);

      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      // Errors come back on the sent arrays; map them to the team and the size on screen.
      const mapped = Object.fromEntries(
        Object.entries(apiError?.details ?? {}).map(([path, messages]) => {
          const line = /^teams\.(\d+)\.lines\.(\d+)\./.exec(path);
          const team = /^teams\.(\d+)\.teamId$/.exec(path);
          const row = line ? sent[Number(line[1])]?.rows[Number(line[2])] : undefined;

          return [row ? lineKey(row) : team ? `team.${team[1]}` : path, messages[0] ?? ""];
        }),
      );

      setErrors(mapped);
      setFormError(apiError?.message ?? "Could not issue the pieces.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Issue to Jogadi</DialogTitle>
          <DialogDescription>
            Give cut pieces to a stitching team, or divide them between teams. Only pieces still waiting can be issued.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5">
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="issue-lot"
              label="Lot"
              error={errors.lotId}
              description={lot ? `${pieces(lot.available)} waiting for stitching` : undefined}
            >
              <Select
                items={lotItems}
                value={lotId || null}
                onValueChange={(value) => {
                  setLotId(value ?? "");
                  setSlots((current) => current.map((slot) => emptySlot(slot.teamId)));
                }}
              >
                <SelectTrigger id="issue-lot" className="w-full" aria-invalid={errors.lotId ? true : undefined}>
                  <SelectValue placeholder={lots.isLoading ? "Loading…" : "Choose a lot with cut pieces"} />
                </SelectTrigger>
                <SelectContent>
                  {(lots.data ?? []).map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      description={
                        <>
                          {item.articleName} · {pieces(item.available)} waiting
                        </>
                      }
                    >
                      {item.lotNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lots.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No cut pieces are waiting. Finalize a cutting first.</p>
              ) : null}
            </Field>
            <Field id="issue-operation" label="Work" error={errors.operation}>
              <SuggestInput
                {...fieldProps("issue-operation", errors.operation)}
                suggestions={WORK_SUGGESTIONS}
                value={operation}
                onChange={setOperation}
                placeholder="e.g. Full stitching"
                maxLength={60}
              />
            </Field>
            <Field id="issue-rate" label="Rate per piece" error={errors.rate} description="Paid for every Good piece">
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>Rs</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...fieldProps("issue-rate", errors.rate)}
                  inputMode="decimal"
                  placeholder="e.g. 12.50"
                  className="text-right tabular-nums"
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                />
              </InputGroup>
            </Field>
            <Field id="issue-date" label="Date">
              <Input
                id="issue-date"
                type="date"
                max={todayISO()}
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </Field>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-medium text-foreground/90">
              {divided ? "Divide between teams" : "Jogadi team"}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot, index) => {
                const error = errors[`team.${index}`];
                const team = teams.data?.find((item) => item.id === slot.teamId);

                const options = (teams.data ?? []).filter(
                  (item) => item.id === slot.teamId || !slots.some((other) => other.teamId === item.id),
                );

                return (
                  <div key={index} className="grid gap-1">
                    <div className="flex items-center gap-1.5">
                      <Select
                        items={options.map((item) => ({
                          value: item.id,
                          label: item.name,
                        }))}
                        value={slot.teamId || null}
                        onValueChange={(value) => updateSlot(index, { teamId: value ?? "" })}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-label={divided ? `Team ${index + 1}` : "Jogadi team"}
                          aria-invalid={error ? true : undefined}
                        >
                          <SelectValue placeholder={teams.isLoading ? "Loading…" : "Choose a team"} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((item) => (
                            <SelectItem
                              key={item.id}
                              value={item.id}
                              description={
                                <>
                                  {item.members.length} member
                                  {item.members.length === 1 ? "" : "s"}
                                </>
                              }
                            >
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {divided ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${team?.name ?? `team ${index + 1}`}`}
                          onClick={() => setSlots((current) => current.filter((_, at) => at !== index))}
                        >
                          <X aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
                      {error || (team ? team.members.map((member) => member.name).join(", ") : "")}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {slots.length < Math.min(MAX_TEAMS, teams.data?.length ?? 0) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSlots((current) => [...current, emptySlot()])}
                >
                  <Plus aria-hidden />
                  {divided ? "Add another team" : "Divide with another team"}
                </Button>
              ) : null}
              {teams.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active teams.{" "}
                  <Link href="/jogadi" className="text-link hover:underline">
                    Create one in Jogadi Teams
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </fieldset>

          {lotId ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground/90">Pieces</span>
                {waiting.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                    {anyEntered ? <Eraser aria-hidden /> : <Wand2 aria-hidden />}
                    {anyEntered ? "Clear all" : divided ? "Divide all equally" : "Issue all waiting"}
                  </Button>
                ) : null}
              </div>
              {balance.isLoading ? (
                <Skeleton className="h-28" />
              ) : waiting.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                  Every cut piece of this lot has been issued.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-[13px]">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Size</th>
                        <th className="px-3 py-2 text-right font-medium">Waiting</th>
                        {slots.map((slot, index) => (
                          <th key={index} className="w-28 px-2 py-2 text-right font-medium">
                            {divided ? teamName(slot.teamId) || `Team ${index + 1}` : "Issue"}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right font-medium">Left</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {waiting.map((row) => {
                        const key = lineKey(row);
                        const left = leftOf(row);
                        const error = errors[key];
                        const label = `Size ${row.size}`;

                        return (
                          <tr key={key} className="align-top">
                            <td className="px-3 py-2 font-medium">
                              {row.size}
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">all colours</span>
                              {error ? <p className="mt-0.5 font-normal text-destructive">{error}</p> : null}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.unissued}</td>
                            {slots.map((slot, index) => (
                              <td key={index} className="px-2 py-1.5">
                                <Input
                                  aria-label={
                                    divided
                                      ? `${teamName(slot.teamId) || `Team ${index + 1}`}, ${label}`
                                      : `Issue ${label}`
                                  }
                                  aria-invalid={error ? true : undefined}
                                  inputMode="numeric"
                                  placeholder="0"
                                  className="h-8 text-right tabular-nums"
                                  value={slot.quantities[key] ?? ""}
                                  onChange={(event) => setQuantity(index, key, event.target.value)}
                                />
                              </td>
                            ))}
                            <td
                              className={cn(
                                "px-3 py-2 text-right tabular-nums",
                                left < 0 ? "font-semibold text-destructive" : left === 0 ? "text-muted-foreground" : "",
                              )}
                            >
                              {left}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {divided ? (
                      <tfoot className="border-t bg-muted/30 text-xs">
                        <tr>
                          <td className="px-3 py-2 font-medium" colSpan={2}>
                            Each team gets
                          </td>
                          {slots.map((slot, index) => (
                            <td key={index} className="px-2 py-2 text-right font-semibold tabular-nums">
                              {slotTotal(slot)}
                            </td>
                          ))}
                          <td />
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              )}
              {errors.lines ? <p className="text-xs text-destructive">{errors.lines}</p> : null}
            </div>
          ) : null}

          <Field id="issue-notes" label="Notes" description="Optional">
            <Textarea
              id="issue-notes"
              rows={2}
              maxLength={500}
              placeholder="e.g. Use black thread; return by Friday"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {total > 0 ? (
                <>
                  <strong className="text-foreground tabular-nums">{pieces(total)}</strong> to issue
                  {divided ? ` to ${slots.length} teams` : ""}
                </>
              ) : null}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {divided ? "Issue to teams" : "Issue pieces"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
