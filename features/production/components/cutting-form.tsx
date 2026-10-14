"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageMinus, Save, Scissors, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { hasPermission } from "@/features/auth/lib/permissions";
import { useFabric, useFabricOptions } from "@/features/fabric/hooks/use-fabric";
import { ApiError } from "@/lib/api-client";

import { productionKeys } from "../api/production.api";
import {
  useArticleOptions,
  useCreateLot,
  useDeleteBatch,
  useFinalizeBatch,
  useIssueBatch,
  useLots,
  useSaveBatch,
  useUpdateLot,
} from "../hooks/use-production";
import { calculateBatch, parseScaled, type Issue } from "../lib/cutting-calc";
import { cutNumber, microKgText } from "../lib/format";
import {
  calcInputsOf,
  draftPayloadOf,
  markerValuesOf,
  nameKey,
  sizeValuesOf,
  stepOf,
  STEPS,
  type CuttingFormValues,
  type StepId,
} from "../lib/form-model";
import type { Article, Batch, LotListItem } from "../types/production.types";
import { Figure } from "./form-parts";
import { StepDetails } from "./step-details";
import { StepMarker } from "./step-marker";
import { RejectedPieces, SummaryAside, type Blocker } from "./step-review";
import { StepThaan } from "./step-thaan";

export type FormMode = { kind: "new" } | { kind: "edit"; batch: Batch };

type Intent = "save" | "issue" | "finalize";

/** "Enter …", "Add …", "Choose …" problems are noise until the operator tries to save or post. */
const isRequiredIssue = (message: string) => /^(Enter|Add|Choose) /.test(message);

const lotKey = (lotNumber: string) => lotNumber.trim().toLowerCase();

/** Server field paths → form field paths (the lot API nests the draft under `cutting`). */
function formPathOf(path: string): string {
  if (path === "article" || path.startsWith("article.")) return "articleName";

  return path.replace(/^cutting\./, "");
}

function Section({ id, index, children }: { id: StepId; index: number; children: React.ReactNode }) {
  const section = STEPS[index]!;

  return (
    <section id={`section-${id}`} aria-labelledby={`section-${id}-title`} className="grid scroll-mt-20 gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground tabular-nums"
        >
          {index + 1}
        </span>
        <div>
          <h2 id={`section-${id}-title`} className="text-base font-semibold">
            {section.title}
          </h2>
          <p className="text-[13px] text-muted-foreground">{section.description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function CuttingForm({ mode, defaultValues }: { mode: FormMode; defaultValues: CuttingFormValues }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const form = useForm<CuttingFormValues>({ defaultValues });
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"finalize" | "delete" | null>(null);
  const [busy, setBusy] = useState<Intent | "delete" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const createLot = useCreateLot();
  const saveBatch = useSaveBatch();
  const updateLot = useUpdateLot();
  const issue = useIssueBatch();
  const finalize = useFinalizeBatch();
  const deleteBatch = useDeleteBatch();
  const articles = useArticleOptions();
  const fabrics = useFabricOptions();
  const openLots = useLots({ status: "DRAFT,ACTIVE", page: 1, pageSize: 100 });

  // Re-render on every edit so the calculation is always live; read the typed values afterwards.
  useWatch({ control: form.control });

  const values = form.getValues();
  const inputs = calcInputsOf(values);
  const calc = calculateBatch(inputs.marker, inputs.colours);
  const batch = mode.kind === "edit" ? mode.batch : null;
  const fabricId = batch ? batch.lot.fabric.id : values.fabricId;
  const canSeeCost = hasPermission(user, "costing.view");
  const fabric = useFabric(canSeeCost && fabricId ? fabricId : undefined);

  const can = {
    issue: hasPermission(user, "cutting.issue"),
    finalize: hasPermission(user, "cutting.finalize"),
    defaults: hasPermission(user, "production.manage"),
  };

  const kgFabrics = (fabrics.data ?? []).filter((option) => option.unit === "KG");
  const selectedFabric = fabrics.data?.find((option) => option.id === fabricId);
  const storeKg = selectedFabric ? (parseScaled(String(selectedFabric.balance), 6) ?? 0n) : null;
  const allRolls = values.colours.flatMap((colour) => colour.rolls);

  const toIssueKg = allRolls.reduce(
    (sum, roll) => (roll.status === "DRAFT" ? sum + (parseScaled(roll.issuedKg, 6) ?? 0n) : sum),
    0n,
  );

  const pendingRolls = allRolls.filter((roll) => roll.status === "DRAFT" && roll.issuedKg.trim()).length;

  const matchedLot: LotListItem | undefined =
    !batch && values.lotNumber.trim()
      ? openLots.data?.lots.find((lot) => lotKey(lot.lotNumber) === lotKey(values.lotNumber))
      : undefined;

  const matchedArticle: Article | undefined =
    !batch && !matchedLot && values.articleName.trim()
      ? articles.data?.find((article) => nameKey(article.name) === nameKey(values.articleName))
      : undefined;

  const targetText = values.targetQuantity.trim();
  const target = targetText === "" ? null : Number(targetText);

  // Typing an open lot's number adds this cutting to it: its item, fabric and target come along.
  const matchedLotId = matchedLot?.id;

  useEffect(() => {
    const lot = openLots.data?.lots.find((item) => item.id === matchedLotId);

    if (!lot) return;

    form.setValue("articleName", lot.article.name);
    form.setValue("fabricId", lot.fabric.id);

    if (lot.targetQuantity !== null && !form.getValues("targetQuantity").trim()) {
      form.setValue("targetQuantity", String(lot.targetQuantity));
    }
  }, [matchedLotId, openLots.data, form]);

  // An item's saved measurements fill in, unless they were already edited here.
  const articleKey = nameKey(values.articleName);

  useEffect(() => {
    if (batch || !articleKey) return;

    const article = articles.data?.find((item) => nameKey(item.name) === articleKey);

    if (!article) return;

    if (article.defaultFabric && !form.getValues("fabricId")) form.setValue("fabricId", article.defaultFabric.id);

    if (article.defaultMarker && !form.getFieldState("marker").isDirty && !form.getFieldState("sizes").isDirty) {
      form.setValue("marker", markerValuesOf(article.defaultMarker));
      form.setValue("sizes", sizeValuesOf(article.defaultMarker.sizes));
    }
  }, [articleKey, articles.data, batch, form]);

  // Unsaved work is never dropped silently.
  const dirty = form.formState.isDirty;

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Problems the calculator cannot see: the lot itself, and what posting needs.
  const formIssues: Issue[] = [];

  if (!batch && !values.lotNumber.trim()) formIssues.push({ path: "lotNumber", message: "Enter the lot number." });

  if (!batch && !values.articleName.trim()) formIssues.push({ path: "articleName", message: "Enter the item / design." });

  if (!batch && !values.fabricId) formIssues.push({ path: "fabricId", message: "Choose a fabric." });

  if (target !== null && (!Number.isInteger(target) || target < 1)) {
    formIssues.push({ path: "targetQuantity", message: "Enter whole pieces, 1 or more." });
  }

  const masterIssues: Issue[] = values.cuttingMasterId
    ? []
    : [{ path: "cuttingMasterId", message: "Choose the cutting master." }];

  const finalizeIssues = [
    ...formIssues,
    ...calc.issues,
    ...masterIssues,
    ...(target === null ? [{ path: "targetQuantity", message: "Confirm the lot's target quantity." }] : []),
  ];

  const issueIssues = [
    ...formIssues,
    ...masterIssues,
    ...calc.issues.filter((item) => /(thaan|issuedKg|returnedKg)$/.test(item.path)),
  ];

  const issueMap = new Map<string, string>();

  for (const item of attempted ? finalizeIssues : [...formIssues, ...calc.issues]) {
    if (!issueMap.has(item.path)) issueMap.set(item.path, item.message);
  }

  const errorAt = (path: string) => {
    const message = issueMap.get(path);
    const visible = message !== undefined && (attempted || !isRequiredIssue(message));

    return serverErrors[path] ?? (visible ? message : undefined);
  };

  const scrollTo = (id: StepId) =>
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const fail = (apiError: ApiError | null, toFormPath: (path: string) => string) => {
    const details = Object.fromEntries(
      Object.entries(apiError?.details ?? {}).map(([key, messages]) => [toFormPath(formPathOf(key)), messages[0] ?? ""]),
    );

    const first = STEPS.find((item) => Object.keys(details).some((path) => stepOf(path) === item.id));

    setServerErrors(details);
    setFormError(apiError?.message ?? "Something went wrong. Please try again.");

    if (first) scrollTo(first.id);
    else topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /** Saves the form (creating the cutting, and the lot if new), then runs the requested posting. */
  const run = async (intent: Intent) => {
    setFormError(null);
    setServerErrors({});
    setBusy(intent);

    const { draft, toFormPath } = draftPayloadOf(values);

    try {
      let saved: Batch | null = batch;

      if (!batch) {
        const created = await createLot.mutateAsync({
          lotNumber: values.lotNumber.trim(),
          article: matchedArticle
            ? { id: matchedArticle.id }
            : { name: (matchedLot?.article.name ?? values.articleName).trim(), code: null },
          fabricId: values.fabricId,
          productionDate: values.cuttingDate,
          targetQuantity: target,
          notes: null,
          cutting: draft,
        });

        saved = created.batch;
      } else {
        if (target !== batch.lot.targetQuantity) await updateLot.mutateAsync({ id: batch.lot.id, targetQuantity: target });

        if (form.formState.isDirty || intent === "save") saved = await saveBatch.mutateAsync({ id: batch.id, ...draft });
      }

      if (!saved) return;

      try {
        if (intent === "issue") saved = await issue.mutateAsync(saved.id);

        if (intent === "finalize") saved = await finalize.mutateAsync(saved.id);
      } catch (error) {
        // The draft exists now; a failed posting is shown on its own page.
        if (!batch) {
          form.reset(form.getValues());
          toast.error(error instanceof ApiError ? error.message : "Saved as a draft, but posting failed.");
          router.replace(`/cutting/${saved.id}`);

          return;
        }

        throw error;
      }

      queryClient.setQueryData(productionKeys.batch(saved.id), saved);
      form.reset(form.getValues());
      toast.success(
        intent === "finalize"
          ? `${cutNumber(saved.number)} finalized: ${saved.posted?.acceptedPieces ?? 0} pieces cut.`
          : intent === "issue"
            ? `${cutNumber(saved.number)}: fabric issued to cutting.`
            : `${cutNumber(saved.number)} saved as a draft.`,
      );

      if (!batch) router.replace(`/cutting/${saved.id}`);
    } catch (error) {
      fail(error instanceof ApiError ? error : null, toFormPath);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  /** Marks every problem in `issues` and scrolls to the first; true when there are none. */
  const check = (issues: Issue[]) => {
    if (issues.length === 0) return true;

    setAttempted(true);

    const first = STEPS.find((item) => issues.some((issue) => stepOf(issue.path) === item.id));

    if (first) scrollTo(first.id);

    toast.error("Some details are missing. They are marked in red.");

    return false;
  };

  const save = () => {
    if (!check(formIssues)) return;

    void run("save");
  };

  const onDelete = async () => {
    if (!batch) return;

    setBusy("delete");

    try {
      await deleteBatch.mutateAsync(batch.id);
      form.reset(form.getValues());
      toast.success(`${cutNumber(batch.number)} deleted.`);
      router.replace("/cutting");
    } catch (error) {
      fail(error instanceof ApiError ? error : null, (path) => path);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const blockers: Blocker[] = [...new Map(finalizeIssues.map((item) => [item.message, item])).values()].map(
    (item) => ({ step: stepOf(item.path), message: item.message }),
  );

  const stepProps = { form, calc, errorAt };

  const buttons = (vertical: boolean) => (
    <>
      {can.finalize ? (
        <Button
          type="button"
          className={vertical ? "w-full" : undefined}
          disabled={busy !== null}
          onClick={() => (check(finalizeIssues) ? setConfirm("finalize") : undefined)}
        >
          {busy === "finalize" ? <Loader2 className="animate-spin" aria-hidden /> : <Scissors aria-hidden />}
          Finalize cutting
        </Button>
      ) : null}
      {can.issue && (pendingRolls > 0 || !batch) ? (
        <Button
          type="button"
          variant="outline"
          className={vertical ? "w-full" : undefined}
          disabled={busy !== null}
          onClick={() => (check(issueIssues) ? void run("issue") : undefined)}
        >
          {busy === "issue" ? <Loader2 className="animate-spin" aria-hidden /> : <PackageMinus aria-hidden />}
          Issue fabric
        </Button>
      ) : null}
      <Button type="button" variant="outline" className={vertical ? "w-full" : undefined} disabled={busy !== null} onClick={save}>
        {busy === "save" ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
        Save draft
      </Button>
      {batch?.status === "DRAFT" ? (
        <Button
          type="button"
          variant="ghost"
          className={vertical ? "w-full" : undefined}
          disabled={busy !== null}
          onClick={() => setConfirm("delete")}
        >
          <Trash2 aria-hidden />
          Delete draft
        </Button>
      ) : null}
    </>
  );

  return (
    <div ref={topRef} className="mx-auto grid w-full max-w-7xl scroll-mt-20 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 gap-10">
        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <Section id="details" index={0}>
          <StepDetails
            {...stepProps}
            locked={batch !== null}
            openLots={openLots.data?.lots ?? []}
            matchedLot={matchedLot}
            articles={articles.data ?? []}
            matchedArticle={matchedArticle}
            fabrics={kgFabrics}
            storeKg={storeKg}
          />
        </Section>

        <Section id="marker" index={1}>
          <StepMarker {...stepProps} canSaveDefault={can.defaults} />
        </Section>

        <Section id="thaan" index={2}>
          <StepThaan {...stepProps} storeKg={storeKg} toIssueKg={toIssueKg} fabricName={selectedFabric?.name ?? null} />
        </Section>

        <Section id="review" index={3}>
          <RejectedPieces {...stepProps} />
        </Section>
      </div>

      <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <SummaryAside
          calc={calc}
          target={target}
          blockers={blockers}
          onGoTo={(id) => {
            setAttempted(true);
            scrollTo(id);
          }}
          fabricRate={canSeeCost ? (fabric.data?.avgRate ?? null) : null}
          storeKg={storeKg}
          toIssueKg={toIssueKg}
          actions={
            <div className="hidden gap-2 border-t pt-3 lg:grid">
              {buttons(true)}
              {dirty ? <p className="text-center text-xs text-warning">Unsaved changes</p> : null}
            </div>
          }
        />
      </div>

      {/* Phones and tablets: the actions stay reachable at the bottom while scrolling. */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 rounded-t-lg border border-b-0 bg-background/95 px-3 py-3 shadow-[0_-4px_12px_-8px_rgb(0_0_0/0.25)] backdrop-blur lg:hidden">
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          <strong className="text-foreground tabular-nums">{calc.totals.acceptedPieces}</strong> pieces ·{" "}
          {calc.totals.confirmedPala} Pala
          {dirty ? <span className="ml-2 text-warning">Unsaved</span> : null}
        </p>
        <div className="ml-auto flex flex-row-reverse flex-wrap gap-2">{buttons(false)}</div>
      </div>

      <Dialog open={confirm === "finalize"} onOpenChange={(open) => (open ? null : setConfirm(null))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Finalize cutting?</DialogTitle>
            <DialogDescription>
              Issues any Thaan still in the store, posts consumption and wastage, makes the accepted pieces available for
              stitching, books fabric cost and the cutting master&apos;s earning, and locks the cutting. Later corrections
              need a reversal.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 sm:grid-cols-3">
            <Figure label="Issued" value={microKgText(calc.totals.issuedKg)} />
            <Figure label="Consumed" value={microKgText(calc.totals.consumedKg)} />
            <Figure label="Returned" value={microKgText(calc.totals.returnedKg)} />
            <Figure
              label="Wastage"
              value={microKgText(calc.totals.wastageKg)}
              tone={calc.totals.wastageKg > 0n ? "warning" : "default"}
            />
            <Figure label="Pala" value={String(calc.totals.confirmedPala)} />
            <Figure label="Accepted pieces" value={String(calc.totals.acceptedPieces)} />
          </dl>
          {calc.warnings.length > 0 ? (
            <ul className="grid gap-1 text-[13px] text-warning">
              {calc.warnings.map((warning) => (
                <li key={warning.path}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Keep editing
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void run("finalize")}>
              {busy === "finalize" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "delete"} onOpenChange={(open) => (open ? null : setConfirm(null))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>Nothing has been issued from the store yet, so deleting leaves no trace in stock.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Keep draft
            </Button>
            <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void onDelete()}>
              {busy === "delete" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
