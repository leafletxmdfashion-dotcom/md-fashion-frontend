"use client";

import { format } from "date-fns";
import { Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
import { StatusChip } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { formatDate } from "@/features/fabric/lib/format";
import { ApiError } from "@/lib/api-client";

import { useReverseBatch } from "../hooks/use-production";
import { BATCH_STATUS, cutNumber, kgText, LOT_STATUS, moneyText } from "../lib/format";
import type { Batch } from "../types/production.types";
import { Figure } from "./form-parts";

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ReverseForm({ batch, onDone }: { batch: Batch; onDone: () => void }) {
  const reverse = useReverseBatch();
  const [reason, setReason] = useState("");
  const error = reverse.error instanceof ApiError ? reverse.error : null;

  const submit = () =>
    reverse.mutate(
      { id: batch.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`${cutNumber(batch.number)} reversed. Fabric is back in the store.`);
          onDone();
        },
      },
    );

  return (
    <div className="grid gap-3 rounded-lg border border-destructive/30 p-4">
      <p className="text-[13px]">
        Reversing keeps this batch on record and posts linked reversals: consumed and wasted fabric go back to the store
        with everything still in cutting, fabric cost and the cutting master&apos;s earning are reversed, and its cut pieces
        are withdrawn. It is blocked if any piece has gone on to stitching.
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
          placeholder="Wrong Pala weight was used"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>
          Keep batch
        </Button>
        <Button variant="destructive" size="sm" disabled={reason.trim().length < 3 || reverse.isPending} onClick={submit}>
          {reverse.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Reverse cutting
        </Button>
      </div>
    </div>
  );
}

/** A batch that can no longer be edited (finalized or reversed), or one the user may only view. */
export function BatchView({ batch }: { batch: Batch }) {
  const { data: user } = useCurrentUser();
  const [reversing, setReversing] = useState(false);
  const canReverse = hasPermission(user, "cutting.reverse") && batch.status === "FINALIZED";
  const sizes = [...new Set(batch.outputs.map((output) => output.sizeLabel))];
  const colours = [...new Set(batch.outputs.map((output) => output.colourName))];
  const repetitions = batch.marker.repetitionsPerLayer;

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={BATCH_STATUS[batch.status].tone}>{BATCH_STATUS[batch.status].label}</StatusChip>
          <StatusChip tone={LOT_STATUS[batch.lot.status].tone}>Lot {LOT_STATUS[batch.lot.status].label.toLowerCase()}</StatusChip>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Figure
            label="Lot"
            value={
              <span className="font-mono">{batch.lot.lotNumber}</span>
            }
          />
          <Figure label="Item / design" value={batch.lot.article.name} hint={batch.lot.article.code} />
          <Figure label="Fabric" value={batch.lot.fabric.name} hint={batch.lot.fabric.code} />
          <Figure label="Cutting master" value={batch.cuttingMaster?.name ?? "—"} />
          <Figure label="Cutting date" value={formatDate(batch.cuttingDate)} />
          <Figure
            label="Pala weight"
            value={kgText(batch.marker.activePalaKg)}
            hint={batch.marker.weightSource === "MEASURED" ? "Measured" : "Calculated"}
          />
        </dl>
        {batch.notes ? <p className="mt-4 text-[13px] text-muted-foreground">{batch.notes}</p> : null}
      </section>

      {batch.posted ? (
        <Card title="Material reconciliation">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Issued" value={kgText(batch.posted.issuedKg)} />
            <Figure label="Consumed" value={kgText(batch.posted.consumedKg)} hint={`${batch.posted.pala} Pala`} />
            <Figure label="Returned" value={kgText(batch.posted.returnedKg)} />
            <Figure label="Wastage" value={kgText(batch.posted.wastageKg)} hint="Pala remainder" />
            <Figure label="Pieces" value={String(batch.posted.acceptedPieces)} />
            {batch.costs ? (
              <Figure
                label="Fabric cost"
                value={moneyText(batch.costs.fabricCost)}
                hint={batch.costs.earningAmount ? `Cutting labour ${moneyText(batch.costs.earningAmount)}` : "No per-job labour"}
              />
            ) : null}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Finalized {format(new Date(batch.posted.finalizedAt), "d MMM yyyy, h:mm a")}
            {batch.posted.finalizedBy ? ` by ${batch.posted.finalizedBy}` : ""} · calculation v{batch.posted.calculationVersion}
          </p>
        </Card>
      ) : null}

      <Card title="Thaan">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Colour</th>
                <th className="pb-2 font-medium">Thaan</th>
                <th className="pb-2 text-right font-medium">Issued</th>
                <th className="pb-2 text-right font-medium">Returned</th>
                <th className="pb-2 text-right font-medium">Est. Pala</th>
                <th className="pb-2 text-right font-medium">{repetitions > 1 ? "Layers / Pala" : "Pala"}</th>
                <th className="pb-2 text-right font-medium">Consumed</th>
                <th className="pb-2 text-right font-medium">Wastage</th>
              </tr>
            </thead>
            <tbody>
              {batch.colours.flatMap((colour) =>
                colour.rolls.map((roll) => (
                  <tr key={roll.id} className="border-b last:border-b-0">
                    <td className="py-2">{colour.name}</td>
                    <td className="py-2 font-mono text-xs">{roll.thaan}</td>
                    <td className="py-2 text-right tabular-nums">{kgText(roll.issuedKg)}</td>
                    <td className="py-2 text-right tabular-nums">{kgText(roll.returnedKg)}</td>
                    <td className="py-2 text-right tabular-nums">{roll.estimatedPala ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">
                      {repetitions > 1 ? `${roll.confirmedLayers ?? "—"} / ` : ""}
                      {roll.confirmedPala ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{kgText(roll.consumedKg)}</td>
                    <td className="py-2 text-right tabular-nums">{kgText(roll.wastageKg)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {batch.outputs.length > 0 ? (
        <Card title="Cut pieces by colour and size">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Colour</th>
                  {sizes.map((size) => (
                    <th key={size} className="pb-2 text-right font-medium">
                      {size}
                    </th>
                  ))}
                  <th className="pb-2 text-right font-medium">Total</th>
                  <th className="pb-2 text-right font-medium">For stitching</th>
                </tr>
              </thead>
              <tbody>
                {colours.map((colour) => {
                  const rows = batch.outputs.filter((output) => output.colourName === colour);

                  return (
                    <tr key={colour} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{colour}</td>
                      {sizes.map((size) => {
                        const output = rows.find((row) => row.sizeLabel === size);

                        return (
                          <td key={size} className="py-2 text-right tabular-nums">
                            {output?.accepted ?? 0}
                          </td>
                        );
                      })}
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {rows.reduce((sum, row) => sum + row.accepted, 0)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{rows.reduce((sum, row) => sum + row.available, 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {batch.reversal ? (
        <Card title="Reversal">
          <p className="text-[13px]">{batch.reversal.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {batch.reversal.by ?? "—"} · {format(new Date(batch.reversal.at), "d MMM yyyy, h:mm a")}
          </p>
        </Card>
      ) : null}

      {canReverse ? (
        reversing ? (
          <ReverseForm batch={batch} onDone={() => setReversing(false)} />
        ) : (
          <div>
            <Button variant="outline" onClick={() => setReversing(true)}>
              <Undo2 aria-hidden />
              Reverse cutting
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
