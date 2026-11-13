import { api, ApiError, type ApiErrorCode } from "@/lib/api-client";

// Every export is built by the server (same filters, sort and permissions as the list, every
// matching row); the browser only saves the file it gets back.

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The API's error from a failed blob response, e.g. "More than 50,000 rows match…". */
export async function exportError(status: number, body: Blob | undefined): Promise<ApiError> {
  try {
    const parsed = JSON.parse((await body?.text()) ?? "") as { error?: { code?: ApiErrorCode; message?: string } };
    if (parsed.error?.code && parsed.error.message)
      return new ApiError(status, parsed.error.code, parsed.error.message);
  } catch {
    // Not JSON: fall through to the generic message.
  }
  return new ApiError(status, "UNKNOWN_ERROR", "Could not export. Please try again.");
}

/** Downloads a server-built CSV (every row matching `params`), keeping the server's file name. */
export async function downloadServerCsv(path: string, params: Record<string, string | number | undefined>) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
  const response = await api.get<Blob>(path, {
    params: query,
    responseType: "blob",
    timeout: 120_000,
    // Read error bodies here: as a blob they would otherwise lose the server's message.
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) throw await exportError(response.status, response.data);

  const disposition = String(response.headers["content-disposition"] ?? "");
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "export.csv";
  saveBlob(response.data, filename);
}
