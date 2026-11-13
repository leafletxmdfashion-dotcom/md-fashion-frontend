"use client";

import { Check, ChevronDown, GitMerge, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form/field";
import { FormAlert } from "@/components/form/form-alert";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerClassName,
} from "@/components/ui/select";
import { useFlowMutation } from "@/features/packing/packing.api";
import { api, ApiError, unwrap, type ApiSuccess } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { useArticleOptions } from "../hooks/use-production";
import { nameKey } from "../lib/form-model";
import type { Article } from "../types/production.types";

const useDeleteArticle = () =>
  useFlowMutation(async (id: string) => {
    await api.delete(`/articles/${id}`);
  });

const useMergeArticles = () =>
  useFlowMutation(async (input: { targetId: string; sourceIds: string[] }) =>
    unwrap(
      api.post<ApiSuccess<{ article: { name: string }; lots: number; removed: number }>>("/articles/merge", input, {
        timeout: 60_000,
      }),
    ),
  );

/** Items whose names look alike: one contains the other once case, spaces and punctuation are ignored. */
export function similarTo(name: string, items: Article[]): Article[] {
  const key = nameKey(name);

  if (key.length < 3) return [];

  return items.filter((item) => {
    const other = nameKey(item.name);

    return (
      other !== key && (other.includes(key) || key.includes(other) || other.replace(/s$/, "") === key.replace(/s$/, ""))
    );
  });
}

/**
 * The item / design field: pick a saved item (searchable), delete one typed by mistake, or
 * add a new one. Saved names keep spelling consistent ("Trouser", not "trousers" and "Trousr").
 */
export function ItemPicker({
  id,
  value,
  onChange,
  invalid,
  disabled,
  canManage,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Delete unused items (production.manage). */
  canManage: boolean;
}) {
  const articles = useArticleOptions();
  const remove = useDeleteArticle();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => articles.data ?? [], [articles.data]);
  const needle = nameKey(search);
  const shown = needle ? items.filter((item) => nameKey(`${item.name}${item.code}`).includes(needle)) : items;
  const exact = needle ? items.find((item) => nameKey(item.name) === needle) : undefined;
  const similar = search.trim() && !exact ? similarTo(search, items) : [];
  const selected = items.find((item) => nameKey(item.name) === nameKey(value));

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
    setConfirming(null);
  };

  const del = async (item: Article) => {
    try {
      await remove.mutateAsync(item.id);
      toast.success(`${item.name} deleted.`);

      if (nameKey(value) === nameKey(item.name)) onChange("");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not delete the item.");
    } finally {
      setConfirming(null);
    }
  };

  if (disabled) {
    return <Input id={id} value={value} readOnly className="bg-muted" />;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (next) setTimeout(() => searchRef.current?.focus(), 0);
        else setConfirming(null);
      }}
    >
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            aria-describedby={invalid ? `${id}-error` : undefined}
            className={cn(
              selectTriggerClassName,
              "w-full",
              invalid && "border-destructive ring-3 ring-destructive/20",
              !value && "text-muted-foreground",
            )}
          />
        }
      >
        <span className="truncate">
          {value || "Choose or add an item"}
          {value && !selected ? <span className="ml-1.5 text-xs text-muted-foreground">new</span> : null}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
            aria-label="Search items"
            placeholder="Search or type a new item…"
            className="h-10 w-full bg-transparent text-sm outline-none"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;

              e.preventDefault();

              if (exact) choose(exact.name);
              else if (search.trim()) choose(search.trim());
            }}
          />
        </div>
        <ul role="listbox" aria-label="Items" className="max-h-64 overflow-y-auto p-1">
          {articles.isLoading ? (
            <li className="px-2 py-1.5 text-[13px] text-muted-foreground">Loading…</li>
          ) : shown.length === 0 ? (
            <li className="px-2 py-1.5 text-[13px] text-muted-foreground">
              {items.length === 0 ? "No items yet." : "No saved item matches."}
            </li>
          ) : (
            shown.map((item) => {
              const active = nameKey(item.name) === nameKey(value);
              const deletable = canManage && item.lots === 0;

              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={active}
                  className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-accent"
                >
                  {confirming === item.id ? (
                    <div className="flex w-full items-center justify-between gap-2">
                      <span>Delete {item.name}?</span>
                      <span className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={remove.isPending}
                          onClick={() => void del(item)}
                        >
                          {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                          Delete
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          Keep
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => choose(item.name)}
                      >
                        <Check className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")} aria-hidden />
                        <span className="truncate font-medium">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.code}
                          {item.lots ? ` · ${item.lots} lot${item.lots === 1 ? "" : "s"}` : " · unused"}
                        </span>
                      </button>
                      {deletable ? (
                        <button
                          type="button"
                          aria-label={`Delete ${item.name}`}
                          title="Delete (typed by mistake)"
                          className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                          onClick={() => setConfirming(item.id)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t p-1">
          {search.trim() && !exact ? (
            <>
              {similar.length > 0 ? (
                <p className="px-2 pt-1 text-xs text-warning">
                  Looks like {similar.map((item) => item.name).join(", ")}. Pick it above to keep one spelling.
                </p>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-link hover:bg-accent"
                onClick={() => choose(search.trim())}
              >
                <Plus className="size-4" aria-hidden />
                Add new item “{search.trim()}”
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent"
              onClick={() => searchRef.current?.focus()}
            >
              <Plus className="size-4" aria-hidden />
              Add new: type its name above
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Merges near-duplicate items into one: their lots and godown stock move to the item kept. */
export function MergeItemsDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const articles = useArticleOptions();
  const merge = useMergeArticles();
  const [targetId, setTargetId] = useState("");
  const [sources, setSources] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => articles.data ?? [], [articles.data]);
  const target = items.find((item) => item.id === targetId);
  const similar = target ? new Set(similarTo(target.name, items).map((item) => item.id)) : new Set<string>();
  // Look-alikes of the kept item first.
  const others = items
    .filter((item) => item.id !== targetId)
    .sort((a, b) => Number(similar.has(b.id)) - Number(similar.has(a.id)) || a.name.localeCompare(b.name));

  const submit = async () => {
    if (!targetId) return setError("Choose the item to keep.");

    if (sources.size === 0) return setError("Tick the items to merge into it.");

    try {
      const result = await merge.mutateAsync({
        targetId,
        sourceIds: [...sources],
      });

      toast.success(`${result.removed} merged into ${result.article.name}; ${result.lots} lots moved.`);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not merge.");
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge similar items</DialogTitle>
          <DialogDescription>
            For one design saved under different spellings, e.g. “trouser”, “Trousers”, “Black trouser”. Their lots,
            history and godown stock move to the item you keep; the others are removed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Field id="merge-target" label="Keep this item">
            <Select
              items={items.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              value={targetId || null}
              onValueChange={(value) => {
                setTargetId(value ?? "");
                setSources(new Set());
              }}
            >
              <SelectTrigger id="merge-target" className="w-full">
                <SelectValue placeholder={articles.isLoading ? "Loading…" : "Choose the correct item"} />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    description={
                      <>
                        {item.code} · {item.lots} lots
                      </>
                    }
                  >
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {target ? (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-[13px] font-medium">Merge into {target.name}</legend>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                {others.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-1.5">
                    <Checkbox
                      id={`merge-${item.id}`}
                      checked={sources.has(item.id)}
                      onCheckedChange={(checked) =>
                        setSources((current) => {
                          const next = new Set(current);

                          if (checked === true) next.add(item.id);
                          else next.delete(item.id);

                          return next;
                        })
                      }
                    />
                    <Label htmlFor={`merge-${item.id}`} className="flex-1 text-[13px] font-normal">
                      {item.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {item.code} · {item.lots} lots
                      </span>
                    </Label>
                    {similar.has(item.id) ? <span className="text-xs text-warning">looks alike</span> : null}
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={merge.isPending || !targetId || sources.size === 0}
            onClick={() => void submit()}
          >
            {merge.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <GitMerge aria-hidden />}
            Merge {sources.size || ""} into {target?.name ?? "item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Button that opens the merge dialog; for pages listing items. */
export function MergeItemsButton() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(Date.now())}>
        <GitMerge aria-hidden />
        Merge items
      </Button>
      {open ? <MergeItemsDialog key={open} onOpenChange={(value) => (value ? undefined : setOpen(null))} /> : null}
    </>
  );
}
