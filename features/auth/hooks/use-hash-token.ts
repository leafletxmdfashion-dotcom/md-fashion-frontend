"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reads `#token=...` once on mount, then strips it from the address bar. Tokens
 * travel in the fragment so they never reach server logs or Referer headers.
 * `undefined` means "not read yet", `null` means "no token in the link".
 */
export function useHashToken(): string | null | undefined {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  // Survives StrictMode's double effect run, which would otherwise read the already-stripped hash.
  const captured = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (captured.current === undefined) {
      captured.current = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (captured.current) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
    }
    setToken(captured.current);
  }, []);

  return token;
}
