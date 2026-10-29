import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSingleSubmit } from "./use-single-submit";

describe("useSingleSubmit", () => {
  it("ignores a second submit (a double-click) until the first one settles", () => {
    const { result } = renderHook(() => useSingleSubmit());
    const action = vi.fn();

    result.current(action);
    result.current(action);
    expect(action).toHaveBeenCalledTimes(1);

    const release = action.mock.calls[0]![0] as () => void;
    release();
    result.current(action);
    expect(action).toHaveBeenCalledTimes(2);
  });
});
