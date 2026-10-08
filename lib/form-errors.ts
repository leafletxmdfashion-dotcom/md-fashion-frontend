import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError } from "./api-client";

/**
 * Maps API validation details onto matching form fields; anything else becomes
 * the form-level `root.server` error. Messages come from the API, branching from codes.
 */
export function applyServerError<T extends FieldValues>(error: unknown, form: UseFormReturn<T>): void {
  const apiError =
    error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "Something went wrong. Please try again.");
  const fields = Object.keys(form.getValues());
  let mapped = false;

  for (const [key, messages] of Object.entries(apiError.details ?? {})) {
    if (fields.includes(key) && messages[0]) {
      form.setError(key as Path<T>, { type: "server", message: messages[0] });
      mapped = true;
    }
  }
  if (!mapped) form.setError("root.server", { type: apiError.code, message: apiError.message });
}
