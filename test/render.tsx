import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type * as React from "react";

export function renderWithClient(ui: React.ReactElement, client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}
