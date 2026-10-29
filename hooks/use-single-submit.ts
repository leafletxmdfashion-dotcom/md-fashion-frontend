import { useCallback, useRef } from "react";

/**
 * Runs a one-off action (reverse, finalize) once at a time. A double-click fires twice
 * before React Query's `isPending` disables the button, and the second request would
 * fail ("already reversed") and hide the first one's success. The action calls
 * `release` when it settles.
 */
export function useSingleSubmit() {
  const busy = useRef(false);
  return useCallback((action: (release: () => void) => void) => {
    if (busy.current) return;
    busy.current = true;
    action(() => {
      busy.current = false;
    });
  }, []);
}
