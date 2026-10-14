"use client";

import { format } from "date-fns";
import { Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";

import { useReverseInward } from "../hooks/use-fabric";
import { formatDate, formatMoney, formatQty, inwardNumber, UNIT_LABEL } from "../lib/format";
import type { Inward } from "../types/fabric.types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

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
    reverse.mutate(
      { id: inward.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(
            `${inwardNumber(inward.number)} reversed. Stock reduced by ${formatQty(inward.quantity, inward.fabric.unit)}.`,
          );
          close(false);
        },
      },
    );
  };

  const error = reverse.error instanceof ApiError ? reverse.error : null;

  return (
    <Sheet open={inward !== null} onOpenChange={close}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {inward ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle className="font-mono">{inwardNumber(inward.number)}</SheetTitle>
                {inward.reversal ? <Badge variant="destructive">Reversed</Badge> : null}
              </div>
              <SheetDescription>
                Purchase of {inward.fabric.name} on {formatDate(inward.inwardDate)}
              </SheetDescription>
            </SheetHeader>

            <div className="px-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatQty(inward.quantity, inward.fabric.unit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-base font-semibold tabular-nums">{formatMoney(inward.amount)}</p>
                </div>
              </div>

              <dl className="mt-2 divide-y text-[13px]">
                <Row label="Fabric">
                  <Link href={`/fabric/ledger?fabric=${inward.fabric.id}`} className="text-link hover:underline">
                    {inward.fabric.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">{inward.fabric.code}</span>
                </Row>
                <Row label="Rate">
                  {formatMoney(inward.rate)} / {UNIT_LABEL[inward.fabric.unit]}
                </Row>
                <Row label="Supplier">{inward.supplier}</Row>
                <Row label="Invoice / bill">{inward.invoiceRef}</Row>
                <Row label="Notes">{inward.notes}</Row>
                <Row label="Posted by">
                  {inward.createdBy ?? "—"}
                  <span className="text-muted-foreground">
                    {" "}
                    · {format(new Date(inward.createdAt), "d MMM yyyy, h:mm a")}
                  </span>
                </Row>
                {inward.reversal ? (
                  <>
                    <Row label="Reversed by">
                      {inward.reversal.by ?? "—"}
                      <span className="text-muted-foreground">
                        {" "}
                        · {format(new Date(inward.reversal.at), "d MMM yyyy, h:mm a")}
                      </span>
                    </Row>
                    <Row label="Reason">{inward.reversal.reason}</Row>
                  </>
                ) : null}
              </dl>

              {reversing ? (
                <div className="mt-4 grid gap-3 rounded-lg border border-destructive/30 p-3">
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
            </div>

            {canReverse && !inward.reversal && !reversing ? (
              <SheetFooter>
                <Button variant="outline" onClick={() => setReversing(true)}>
                  <Undo2 aria-hidden />
                  Reverse purchase
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
