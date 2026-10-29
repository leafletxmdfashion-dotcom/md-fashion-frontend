"use client";

import { format } from "date-fns";
import { Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { DetailList, DetailRow, DetailSection, DetailStats } from "@/components/detail-list";
import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useSingleSubmit } from "@/hooks/use-single-submit";
import { ApiError } from "@/lib/api-client";

import { useReverseInward } from "../hooks/use-fabric";
import { formatDate, formatMoney, formatQty, inwardNumber, UNIT_LABEL } from "../lib/format";
import type { Inward } from "../types/fabric.types";

export function InwardDetailSheet({
  inward,
  canReverse,
  onOpenChange,
}: {
  inward: Inward | null;
  canReverse: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reverse = useReverseInward();
  const single = useSingleSubmit();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState("");

  const close = (open: boolean) => {
    if (!open) {
      setReversing(false);
      setReason("");
      reverse.reset();
    }
    onOpenChange(open);
  };

  const onReverse = () => {
    if (!inward) return;
    single((release) =>
      reverse.mutate(
        { id: inward.id, reason: reason.trim() },
        {
          onSuccess: () => {
            toast.success(
              `${inwardNumber(inward.number)} reversed. Stock reduced by ${formatQty(inward.quantity, inward.fabric.unit)}.`,
            );
            close(false);
          },
          onSettled: release,
        },
      ),
    );
  };

  const error = reverse.error instanceof ApiError ? reverse.error : null;

  return (
    <Sheet open={inward !== null} onOpenChange={close}>
      <SheetContent>
        {inward ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{inwardNumber(inward.number)}</span>
                {inward.reversal ? (
                  <StatusChip tone="danger">Reversed</StatusChip>
                ) : (
                  <StatusChip tone="success">Posted</StatusChip>
                )}
              </div>
              <SheetTitle>{inward.fabric.name}</SheetTitle>
              <SheetDescription>
                Purchased on {formatDate(inward.inwardDate)}
                {inward.supplier ? ` from ${inward.supplier}` : ""}
              </SheetDescription>
              {canReverse && !inward.reversal && !reversing ? (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setReversing(true)}>
                    <Undo2 aria-hidden />
                    Reverse purchase
                  </Button>
                </div>
              ) : null}
            </SheetHeader>

            <SheetBody className="grid content-start gap-6">
              <DetailStats
                items={[
                  { label: "Quantity", value: formatQty(inward.quantity, inward.fabric.unit) },
                  // Rate and amount are null for users without costing.view.
                  ...(inward.rate != null && inward.amount != null
                    ? [
                        { label: "Rate", value: `${formatMoney(inward.rate)} / ${UNIT_LABEL[inward.fabric.unit]}` },
                        {
                          label: "Amount",
                          value: formatMoney(inward.amount),
                          tone: inward.reversal ? ("muted" as const) : undefined,
                        },
                      ]
                    : []),
                ]}
              />

              {reversing ? (
                <div className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive-soft/40 p-4">
                  <p className="text-[13px]">
                    Reversing posts an equal stock-out of {formatQty(inward.quantity, inward.fabric.unit)}. The purchase
                    stays on record, marked reversed.
                  </p>
                  {error && error.code !== "VALIDATION_ERROR" ? <FormAlert>{error.message}</FormAlert> : null}
                  <Field
                    id="reverse-reason"
                    label="Reason"
                    error={error?.code === "VALIDATION_ERROR" ? error.details?.reason?.[0] : undefined}
                  >
                    <Textarea
                      id="reverse-reason"
                      rows={2}
                      autoFocus
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Entered against the wrong fabric"
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setReversing(false)}>
                      Keep purchase
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={reason.trim().length < 3 || reverse.isPending}
                      onClick={onReverse}
                    >
                      {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                      Reverse purchase
                    </Button>
                  </div>
                </div>
              ) : null}

              <DetailSection title="Purchase">
                <DetailList>
                  <DetailRow label="Fabric">
                    <Link href={`/fabric/ledger?fabric=${inward.fabric.id}`} className="text-link hover:underline">
                      {inward.fabric.name}
                    </Link>
                    <span className="ml-1.5 font-mono text-xs text-muted-foreground">{inward.fabric.code}</span>
                  </DetailRow>
                  <DetailRow label="Supplier">{inward.supplier}</DetailRow>
                  <DetailRow label="Invoice / bill">{inward.invoiceRef}</DetailRow>
                  <DetailRow label="Notes">{inward.notes}</DetailRow>
                </DetailList>
              </DetailSection>

              <DetailSection title="Record">
                <DetailList>
                  <DetailRow label="Posted by">{inward.createdBy}</DetailRow>
                  <DetailRow label="Posted at">{format(new Date(inward.createdAt), "d MMM yyyy, h:mm a")}</DetailRow>
                  {inward.reversal ? (
                    <>
                      <DetailRow label="Reversed by">{inward.reversal.by}</DetailRow>
                      <DetailRow label="Reversed at">
                        {format(new Date(inward.reversal.at), "d MMM yyyy, h:mm a")}
                      </DetailRow>
                      <DetailRow label="Reason">{inward.reversal.reason}</DetailRow>
                    </>
                  ) : null}
                </DetailList>
              </DetailSection>
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
