import { api } from "@/lib/api-client";

type Cell = string | number | null | undefined;

/** RFC 4180 cell. Values a spreadsheet would run as a formula get a leading '. */
function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads rows already in the browser (e.g. the selected rows). */
export function downloadCsv(name: string, header: string[], rows: Cell[][]) {
  const stamp = new Date().toISOString().slice(0, 10);
  // BOM so spreadsheet apps read the file as UTF-8.
  saveBlob(new Blob([`﻿${toCsv(header, rows)}`], { type: "text/csv;charset=utf-8" }), `${name}-${stamp}.csv`);
}

/** Downloads a server-built CSV (every row matching `params`), keeping the server's file name. */
export async function downloadServerCsv(path: string, params: Record<string, string>) {
  const response = await api.get<Blob>(path, { params, responseType: "blob", timeout: 60_000 });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "export.csv";
  saveBlob(response.data, filename);
}
