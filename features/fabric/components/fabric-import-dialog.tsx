"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useState } from "react";
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
import { ApiError } from "@/lib/api-client";
import { downloadCsv, parseCsv } from "@/lib/csv";

import { useImportFabrics } from "../hooks/use-fabric";

const TEMPLATE_HEADER = ["Code", "Name", "Unit", "Category", "Reorder level", "Description"];
const MAX_ROWS = 500;

// Header aliases accepted in an uploaded file (lower-cased, spaces removed).
const FIELD_BY_HEADER: Record<string, string> = {
  code: "code",
  fabriccode: "code",
  name: "name",
  fabric: "name",
  fabricname: "name",
  unit: "unit",
  category: "category",
  reorderlevel: "lowStockThreshold",
  reorderat: "lowStockThreshold",
  lowstockthreshold: "lowStockThreshold",
  description: "description",
};

const UNIT_ALIASES: Record<string, string> = {
  kg: "KG",
  kilogram: "KG",
  kilograms: "KG",
  m: "METER",
  meter: "METER",
  meters: "METER",
  metre: "METER",
  metres: "METER",
};

/** Maps CSV rows to API rows; unknown columns are ignored, values are normalised. */
function toRows(table: string[][]): { rows: Record<string, unknown>[]; missing: string[] } {
  const [header = [], ...body] = table;
  const fields = header.map((cell) => FIELD_BY_HEADER[cell.toLowerCase().replace(/[\s_-]/g, "")]);
  const missing = ["code", "name", "unit"].filter((field) => !fields.includes(field));
  const rows = body.map((cells) => {
    const row: Record<string, unknown> = {};
    fields.forEach((field, index) => {
      const value = (cells[index] ?? "").trim();
      if (!field) return;
      if (field === "unit") row.unit = UNIT_ALIASES[value.toLowerCase()] ?? value.toUpperCase();
      else if (field === "category") row.category = value || null;
      else if (field === "lowStockThreshold") row.lowStockThreshold = value === "" ? null : Number(value);
      else if (field === "description") row.description = value || null;
      else row[field] = value;
    });
    return row;
  });
  return { rows, missing };
}

/** Field names in API error keys → column names the user sees in their file. */
const COLUMN_NAME: Record<string, string> = {
  code: "Code",
  name: "Name",
  unit: "Unit",
  category: "Category",
  lowStockThreshold: "Reorder level",
  description: "Description",
  row: "Row",
};

export function FabricImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importFabrics = useImportFabrics();
  const [file, setFile] = useState<{ name: string; rows: Record<string, unknown>[] } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const error = importFabrics.error instanceof ApiError ? importFabrics.error : null;
  const rowErrors = Object.entries(error?.details ?? {})
    .map(([key, messages]) => {
      const [, row, field] = /^rows\.(\d+)\.(\w+)$/.exec(key) ?? [];
      return row ? { row: Number(row), column: COLUMN_NAME[field ?? ""] ?? field, message: messages[0] } : null;
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => a.row - b.row);

  const onFile = async (input: File | undefined) => {
    importFabrics.reset();
    setProblem(null);
    setFile(null);
    if (!input) return;
    if (input.size > 2_000_000) return setProblem("This file is larger than 2 MB. Split it into smaller files.");
    const { rows, missing } = toRows(parseCsv(await input.text()));
    if (missing.length)
      return setProblem(
        `Missing column${missing.length > 1 ? "s" : ""}: ${missing.map((field) => COLUMN_NAME[field]).join(", ")}.`,
      );
    if (rows.length === 0) return setProblem("The file has a header but no rows.");
    if (rows.length > MAX_ROWS)
      return setProblem(`The file has ${rows.length} rows. Import up to ${MAX_ROWS} at a time.`);
    setFile({ name: input.name, rows });
  };

  const submit = () => {
    if (!file) return;
    importFabrics.mutate(file.rows, {
      onSuccess: (count) => {
        toast.success(`${count} fabric${count === 1 ? "" : "s"} imported.`);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import fabrics</DialogTitle>
          <DialogDescription>
            Upload a CSV with the columns Code, Name and Unit (kg or m), and optionally Category, Reorder level and
            Description. Nothing is saved unless every row is valid.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/40">
            <FileSpreadsheet className="size-6 text-muted-foreground" aria-hidden />
            <span className="text-[13px] font-medium">{file ? file.name : "Choose a CSV file"}</span>
            <span className="text-xs text-muted-foreground">
              {file
                ? `${file.rows.length} row${file.rows.length === 1 ? "" : "s"} ready to import`
                : "Up to 500 rows, 2 MB"}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="CSV file"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>

          {problem ? <FormAlert>{problem}</FormAlert> : null}
          {error && rowErrors.length === 0 ? <FormAlert>{error.message}</FormAlert> : null}
          {rowErrors.length > 0 ? (
            <div className="grid gap-2">
              <FormAlert>
                {rowErrors.length} problem{rowErrors.length === 1 ? "" : "s"} found. Fix the file and choose it again.
              </FormAlert>
              <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-[13px]">
                {rowErrors.map((entry) => (
                  <li key={`${entry.row}-${entry.column}`} className="flex gap-3 px-3 py-2">
                    <span className="w-14 shrink-0 text-muted-foreground tabular-nums">Row {entry.row}</span>
                    <span>
                      <span className="font-medium">{entry.column}:</span> {entry.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            className="justify-self-start text-[13px] font-medium text-link hover:underline"
            onClick={() =>
              downloadCsv("fabric-import-template", TEMPLATE_HEADER, [
                ["FB-CTJ", "Cotton Jersey", "kg", "Knit", 50, "180 GSM, 72 inch"],
                ["FB-PPL", "Poplin", "m", "Woven", 150, ""],
              ])
            }
          >
            Download a template
          </button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || importFabrics.isPending}>
            {importFabrics.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            Import {file ? `${file.rows.length} ` : ""}fabric{file?.rows.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
