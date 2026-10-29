"use client";

import { CheckCheck, Eraser, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
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
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { todayISO } from "@/features/fabric/lib/format";
import { moneyText } from "@/features/production/lib/format";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { useReceive, useRejectReasons } from "../hooks/use-stitching";
import { pieces, previewSplit, receiptNumber, toPaisa } from "../lib/format";
import type { IssueDetail, SplitMethod } from "../types/stitching.types";

interface LineValues {
  good: string;
  rework: string;
  reject: string;
  reason: string;
  other: string;
}

const count = (text: string) => (text.trim() === "" ? 0 : Number(text));

const METHODS: { value: SplitMethod; label: string }[] = [
  { value: "EQUAL", label: "Equally" },
  { value: "PERCENT", label: "By share %" },
  { value: "AMOUNT", label: "By amount" },
];

/** Receive stitched pieces of one issue: Good, Rework, Reject per line, and how the team's pay is split. */
export function ReceiveDialog({ issue, onOpenChange }: { issue: IssueDetail; onOpenChange: (open: boolean) => void }) {
  const { data: user } = useCurrentUser();
  const reasons = useRejectReasons();
  const receive = useReceive();
  const canSeeMoney = hasPermission(user, "costing.view");
  const open = issue.lines.filter((line) => line.outstanding > 0);
  const [date, setDate] = useState(todayISO());

  const [values, setValues] = useState<Record<string, LineValues>>(
    Object.fromEntries(open.map((line) => [line.id, { good: "", rework: "", reject: "", reason: "", other: "" }])),
  );

  const [method, setMethod] = useState<SplitMethod>(issue.splitMethod);

  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(issue.members.map((member) => [member.karigarId, member.sharePercent?.toString() ?? ""])),
  );

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const set = (id: string, patch: Partial<LineValues>) =>
    setValues((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));

  const anyEntered = open.some((line) => {
    const value = values[line.id]!;

    return [value.good, value.rework, value.reject].some((text) => text.trim() !== "");
  });

  const good = open.reduce((sum, line) => sum + count(values[line.id]!.good), 0);
  const rework = open.reduce((sum, line) => sum + count(values[line.id]!.rework), 0);
  const reject = open.reduce((sum, line) => sum + count(values[line.id]!.reject), 0);
  const ratePaisa = issue.rate === null ? null : toPaisa(issue.rate);
  const totalPaisa = ratePaisa === null ? null : good * ratePaisa;

  const weights =
    method === "EQUAL"
      ? issue.members.map(() => 1)
      : issue.members.map((member) => Math.round(Number(shares[member.karigarId] || 0) * 100));

  const shareTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const preview = totalPaisa === null ? null : previewSplit(totalPaisa, weights);
  const amountTotal = issue.members.reduce((sum, member) => sum + (toPaisa(amounts[member.karigarId] || "0") ?? 0), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const next: Record<string, string> = {};

    for (const line of open) {
      const value = values[line.id]!;
      const numbers = [value.good, value.rework, value.reject].map(count);
      const received = numbers.reduce((sum, number) => sum + number, 0);

      if (numbers.some((number) => !Number.isInteger(number) || number < 0)) next[line.id] = "Whole pieces only.";
      else if (received > line.outstanding) next[line.id] = `${received} entered; the team holds ${line.outstanding}.`;
      else if (count(value.reject) > 0 && !value.reason) next[`${line.id}.reason`] = "Choose why.";
      else if (value.reason === "Other" && count(value.reject) > 0 && !value.other.trim())
        next[`${line.id}.reason`] = "Say what was wrong.";
    }

    if (good + rework + reject === 0) next.lines = "Enter the pieces received.";

    if (method === "PERCENT" && shareTotal !== 10_000)
      next.split = `Shares add up to ${(shareTotal / 100).toFixed(2)}%; make them 100%.`;

    if (method === "AMOUNT" && totalPaisa !== null && amountTotal !== totalPaisa) {
      next.split = `Amounts add up to ${moneyText(amountTotal / 100)}; the team earned ${moneyText(totalPaisa / 100)}.`;
    }

    setErrors(next);

    if (Object.keys(next).length > 0) return;

    try {
      const updated = await receive.mutateAsync({
        issueId: issue.id,
        receiptDate: date,
        notes: null,
        lines: open.map((line) => {
          const value = values[line.id]!;

          return {
            issueLineId: line.id,
            good: count(value.good),
            rework: count(value.rework),
            reject: count(value.reject),
            rejectReason:
              count(value.reject) > 0
                ? value.reason === "Other"
                  ? `Other: ${value.other.trim()}`
                  : value.reason
                : null,
          };
        }),
        split: {
          method,
          members: issue.members.map((member) => ({
            karigarId: member.karigarId,
            percent: method === "PERCENT" ? Number(shares[member.karigarId] || 0) : null,
            amount: method === "AMOUNT" ? Number(amounts[member.karigarId] || 0) : null,
          })),
        },
      });

      const receipt = updated.receipts.at(-1);

      toast.success(
        `${receipt ? receiptNumber(receipt.number) : "Receipt"}: ${pieces(good)} Good${rework ? `, ${rework} rework` : ""}${reject ? `, ${reject} rejected` : ""}.`,
      );
      onOpenChange(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;

      setFormError(apiError?.message ?? "Could not record the receipt.");
    }
  };

  const reasonItems = (reasons.data ?? []).map((reason) => ({ value: reason, label: reason }));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Receive from {issue.team.name}</DialogTitle>
          <DialogDescription>
            Count what came back: Good is paid now, Rework goes to the rework list, Reject is written off with a reason.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field id="receive-date" label="Date">
              <Input
                id="receive-date"
                type="date"
                max={todayISO()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-44"
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setValues(
                  Object.fromEntries(
                    open.map((line) => [
                      line.id,
                      {
                        good: anyEntered ? "" : String(line.outstanding),
                        rework: "",
                        reject: "",
                        reason: "",
                        other: "",
                      },
                    ]),
                  ),
                )
              }
            >
              {anyEntered ? <Eraser aria-hidden /> : <CheckCheck aria-hidden />}
              {anyEntered ? "Clear all" : "All Good"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-[13px]">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Colour · size</th>
                  <th className="px-3 py-2 text-right font-medium">With team</th>
                  <th className="w-24 px-2 py-2 text-right font-medium">Good</th>
                  <th className="w-24 px-2 py-2 text-right font-medium">Rework</th>
                  <th className="w-24 px-2 py-2 text-right font-medium">Reject</th>
                  <th className="w-48 px-3 py-2 text-left font-medium">Reject reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {open.map((line) => {
                  const value = values[line.id]!;
                  const label = `${line.colour} ${line.sizeLabel}`;
                  const rejecting = count(value.reject) > 0;
                  const error = errors[line.id];
                  const reasonError = errors[`${line.id}.reason`];

                  return (
                    <tr key={line.id} className="align-top">
                      <td className="px-3 py-2 font-medium">
                        {label}
                        {error ? <p className="mt-1 font-normal text-destructive">{error}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.outstanding}</td>
                      {(["good", "rework", "reject"] as const).map((field) => (
                        <td key={field} className="px-2 py-1.5">
                          <Input
                            aria-label={`${field === "good" ? "Good" : field === "rework" ? "Rework" : "Reject"}, ${label}`}
                            aria-invalid={error ? true : undefined}
                            inputMode="numeric"
                            placeholder="0"
                            className="h-8 text-right tabular-nums"
                            value={value[field]}
                            onChange={(event) => set(line.id, { [field]: event.target.value })}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5">
                        {rejecting ? (
                          <div className="grid gap-1">
                            <Select
                              items={reasonItems}
                              value={value.reason || null}
                              onValueChange={(next) => set(line.id, { reason: next ?? "" })}
                            >
                              <SelectTrigger
                                className="h-8 w-full"
                                aria-label={`Reject reason, ${label}`}
                                aria-invalid={reasonError ? true : undefined}
                              >
                                <SelectValue placeholder="Choose why" />
                              </SelectTrigger>
                              <SelectContent>
                                {(reasons.data ?? []).map((reason) => (
                                  <SelectItem key={reason} value={reason}>
                                    {reason}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {value.reason === "Other" ? (
                              <Input
                                aria-label={`What was wrong, ${label}`}
                                placeholder="What was wrong?"
                                className="h-8"
                                maxLength={150}
                                value={value.other}
                                onChange={(event) => set(line.id, { other: event.target.value })}
                              />
                            ) : null}
                            {reasonError ? <p className="text-xs text-destructive">{reasonError}</p> : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors.lines ? <p className="text-xs text-destructive">{errors.lines}</p> : null}

          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-[13px] font-medium">Pay for {pieces(good)} Good</legend>
            <div
              role="radiogroup"
              aria-label="Split the pay"
              className="grid w-fit grid-flow-col gap-1 rounded-lg bg-muted p-1"
            >
              {/* Splitting by amount shows money, so it needs costing.view (the API re-checks). */}
              {(canSeeMoney ? METHODS : METHODS.slice(0, 2)).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={method === item.value}
                  onClick={() => {
                    setMethod(item.value);

                    if (item.value === "AMOUNT" && preview) {
                      setAmounts(
                        Object.fromEntries(
                          issue.members.map((member, index) => [
                            member.karigarId,
                            ((preview[index] ?? 0) / 100).toFixed(2),
                          ]),
                        ),
                      );
                    }
                  }}
                  className={cn(
                    "h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    method === item.value && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <ul className="divide-y text-[13px]">
              {issue.members.map((member, index) => (
                <li key={member.karigarId} className="flex items-center justify-between gap-3 py-1.5">
                  <span>{member.name}</span>
                  <span className="flex items-center gap-3">
                    {method === "PERCENT" ? (
                      <InputGroup className="w-28">
                        <InputGroupInput
                          aria-label={`Share, ${member.name}`}
                          inputMode="decimal"
                          className="h-8 text-right tabular-nums"
                          value={shares[member.karigarId] ?? ""}
                          onChange={(event) =>
                            setShares((current) => ({ ...current, [member.karigarId]: event.target.value }))
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>%</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    ) : null}
                    {method === "AMOUNT" ? (
                      <InputGroup className="w-36">
                        <InputGroupAddon>
                          <InputGroupText>Rs</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          aria-label={`Amount, ${member.name}`}
                          inputMode="decimal"
                          className="h-8 text-right tabular-nums"
                          value={amounts[member.karigarId] ?? ""}
                          onChange={(event) =>
                            setAmounts((current) => ({ ...current, [member.karigarId]: event.target.value }))
                          }
                        />
                      </InputGroup>
                    ) : preview ? (
                      <span className="w-24 text-right font-medium tabular-nums">
                        {moneyText((preview[index] ?? 0) / 100)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {totalPaisa !== null ? (
              <p className="text-right text-[13px]">
                Team earns <strong className="tabular-nums">{moneyText(totalPaisa / 100)}</strong>
                <span className="text-muted-foreground"> at {moneyText(issue.rate)} a piece</span>
              </p>
            ) : null}
            {errors.split ? <p className="text-xs text-destructive">{errors.split}</p> : null}
          </fieldset>

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {good + rework + reject > 0 ? `${pieces(good + rework + reject)} received` : null}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={receive.isPending}>
                {receive.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Record receipt
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
