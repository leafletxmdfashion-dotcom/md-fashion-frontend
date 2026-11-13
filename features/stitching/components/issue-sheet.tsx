"use client";

import { Loader2, PackageCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DetailList, DetailRow, DetailSection, DetailStats } from "@/components/detail-list";
import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { ErrorState } from "@/components/states";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate } from "@/features/fabric/lib/format";
import { moneyText } from "@/features/production/lib/format";
import { ApiError } from "@/lib/api-client";

import { useIssue, useReverseIssue, useReverseReceipt } from "../hooks/use-stitching";
import { issueNumber, lineLabel, pieces, receiptNumber } from "../lib/format";
import type { IssueDetail } from "../types/stitching.types";
import { ReceiveDialog } from "./receive-dialog";

type Reversing = { kind: "issue" } | { kind: "receipt"; id: string; number: number } | null;

function ReverseForm({
  target,
  issue,
  onDone,
}: {
  target: NonNullable<Reversing>;
  issue: IssueDetail;
  onDone: () => void;
}) {
  const reverseIssue = useReverseIssue();
  const reverseReceipt = useReverseReceipt();
  const [reason, setReason] = useState("");
  const pending = reverseIssue.isPending || reverseReceipt.isPending;
  const error = reverseIssue.error ?? reverseReceipt.error;
  const label = target.kind === "issue" ? issueNumber(issue.number) : receiptNumber(target.number);

  const submit = async () => {
    try {
      if (target.kind === "issue") await reverseIssue.mutateAsync({ id: issue.id, reason: reason.trim() });
      else await reverseReceipt.mutateAsync({ id: target.id, reason: reason.trim() });

      toast.success(
        target.kind === "issue"
          ? `${label} reversed. Its pieces are waiting for stitching again.`
          : `${label} reversed. The pieces are back with ${issue.team.name}; its pay was reversed.`,
      );
      onDone();
    } catch {
      // Shown below from the mutation's error.
    }
  };

  return (
    <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive-soft/40 p-3">
      <p className="text-[13px] font-medium">Reverse {label}?</p>
      {error ? <FormAlert>{error instanceof ApiError ? error.message : "Could not reverse."}</FormAlert> : null}
      <Field id="reverse-reason" label="Reason">
        <Textarea
          id="reverse-reason"
          rows={2}
          placeholder="e.g. Entered against the wrong team"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Keep it
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={reason.trim().length < 3 || pending}
          onClick={() => void submit()}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Reverse {label}
        </Button>
      </div>
    </div>
  );
}

/** One stitching issue: what the team holds, its receipts, and the actions on it. */
export function IssueSheet({
  issueId,
  onOpenChange,
}: {
  issueId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: user } = useCurrentUser();
  const query = useIssue(issueId ?? undefined);
  const [receiving, setReceiving] = useState(0);
  const [reversing, setReversing] = useState<Reversing>(null);
  const issue = query.data;

  const can = {
    receive: hasPermission(user, "stitching.receive"),
    reverse: hasPermission(user, "stitching.reverse"),
  };

  const holding = issue ? issue.lines.reduce((sum, line) => sum + line.outstanding, 0) : 0;
  const posted = issue?.receipts.filter((receipt) => receipt.status === "POSTED") ?? [];

  const nameOf = (karigarId: string) =>
    issue?.members.find((member) => member.karigarId === karigarId)?.name ?? "Karigar";

  const issued = issue ? issue.lines.reduce((sum, line) => sum + line.quantity, 0) : 0;
  const received = issue ? issue.lines.reduce((sum, line) => sum + line.received, 0) : 0;
  const canReceive = issue?.status === "POSTED" && can.receive && holding > 0;
  const canReverseIssue = issue?.status === "POSTED" && can.reverse && posted.length === 0;

  return (
    <Sheet
      open={issueId !== null}
      onOpenChange={(open) => {
        if (!open) setReversing(null);

        onOpenChange(open);
      }}
    >
      <SheetContent className="sm:max-w-2xl">
        {query.isError ? (
          <ErrorState title="Could not load this issue" error={query.error} onRetry={() => void query.refetch()} />
        ) : !issue ? (
          <div className="grid gap-3 p-6" aria-busy>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-4 h-16" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{issueNumber(issue.number)}</span>
                {issue.status === "REVERSED" ? (
                  <StatusChip tone="danger">Reversed</StatusChip>
                ) : holding > 0 ? (
                  <StatusChip tone="warning">With team</StatusChip>
                ) : (
                  <StatusChip tone="success">Done</StatusChip>
                )}
              </div>
              <SheetTitle>
                {issue.lot.lotNumber} · {issue.lot.articleName}
              </SheetTitle>
              <SheetDescription>
                {issue.operation}, issued to {issue.team.name} on {formatDate(issue.date)}
                {issue.rate !== null ? ` at ${moneyText(issue.rate)} a piece` : ""}.
              </SheetDescription>
              {canReceive || canReverseIssue ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canReceive ? (
                    <Button size="sm" onClick={() => setReceiving(Date.now())}>
                      <PackageCheck aria-hidden />
                      Receive pieces
                    </Button>
                  ) : null}
                  {canReverseIssue ? (
                    <Button size="sm" variant="outline" onClick={() => setReversing({ kind: "issue" })}>
                      <Undo2 aria-hidden />
                      Reverse issue
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </SheetHeader>

            <SheetBody className="grid content-start gap-6 text-[13px]">
              <DetailStats
                items={[
                  { label: "Issued", value: pieces(issued) },
                  { label: "Received", value: pieces(received) },
                  { label: "With team", value: pieces(holding) },
                ]}
              />

              {reversing ? <ReverseForm target={reversing} issue={issue} onDone={() => setReversing(null)} /> : null}

              <DetailSection title="Pieces">
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Size</th>
                        <th className="px-4 py-2 text-right font-medium">Issued</th>
                        <th className="px-4 py-2 text-right font-medium">Received</th>
                        <th className="px-4 py-2 text-right font-medium">With team</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-t">
                      {issue.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2">
                            {lineLabel(line.colour, line.sizeLabel)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{line.quantity}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{line.received}</td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums">{line.outstanding}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DetailSection>

              <DetailSection title={`Receipts (${issue.receipts.length})`}>
                {issue.receipts.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground">
                    Nothing received yet.
                  </p>
                ) : null}
                {issue.receipts.map((receipt) => (
                  <article key={receipt.id} className="overflow-hidden rounded-lg border">
                    <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2">
                      <span className="font-mono text-xs">{receiptNumber(receipt.number)}</span>
                      <span className="text-muted-foreground">{formatDate(receipt.date)}</span>
                      {receipt.status === "REVERSED" ? <StatusChip tone="danger">Reversed</StatusChip> : null}
                      {!receipt.reversal && can.reverse && issue.status === "POSTED" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="ml-auto text-muted-foreground"
                          onClick={() => setReversing({ kind: "receipt", id: receipt.id, number: receipt.number })}
                        >
                          <Undo2 aria-hidden />
                          Reverse
                        </Button>
                      ) : null}
                    </header>
                    <ul className="grid gap-1 px-4 py-2.5">
                      {receipt.lines.map((line) => (
                        <li key={`${line.colour}-${line.sizeLabel}`} className="flex justify-between gap-3">
                          <span>
                            {lineLabel(line.colour, line.sizeLabel)}
                          </span>
                          <span className="text-right tabular-nums">
                            {line.good} Good
                            {line.rework ? <span className="text-warning"> · {line.rework} rework</span> : null}
                            {line.reject ? (
                              <span className="text-destructive">
                                {" "}
                                · {line.reject} reject ({line.rejectReason})
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {receipt.earning !== null ? (
                      <p className="border-t px-4 py-2 text-muted-foreground">
                        Paid <span className="font-medium text-foreground">{moneyText(receipt.earning)}</span>
                        {receipt.allocations && receipt.allocations.length > 0
                          ? `: ${receipt.allocations.map((item) => `${nameOf(item.karigarId)} ${moneyText(item.amount)}`).join(", ")}`
                          : ""}
                      </p>
                    ) : null}
                    {receipt.reversal ? (
                      <p className="border-t px-4 py-2 text-xs text-destructive">
                        Reversed by {receipt.reversal.by ?? "someone"}: {receipt.reversal.reason}
                      </p>
                    ) : null}
                  </article>
                ))}
              </DetailSection>

              <DetailSection title="Record">
                <DetailList>
                  <DetailRow label="Team when issued">
                    {issue.members
                      .map((member) =>
                        member.sharePercent === null ? member.name : `${member.name} (${member.sharePercent}%)`,
                      )
                      .join(", ")}
                    {issue.splitMethod === "EQUAL" ? (
                      <span className="text-muted-foreground"> · split equally</span>
                    ) : null}
                  </DetailRow>
                  <DetailRow label="Issued by">{issue.createdBy}</DetailRow>
                  <DetailRow label="Notes">{issue.notes}</DetailRow>
                  {issue.reversal ? (
                    <DetailRow label="Reversed">
                      <span className="text-destructive">
                        by {issue.reversal.by ?? "someone"} on {formatDate(issue.reversal.at.slice(0, 10))}:{" "}
                        {issue.reversal.reason}
                      </span>
                    </DetailRow>
                  ) : null}
                </DetailList>
              </DetailSection>
            </SheetBody>

            {receiving ? (
              <ReceiveDialog
                key={receiving}
                issue={issue}
                onOpenChange={(open) => (open ? undefined : setReceiving(0))}
              />
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
