import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileSheetShell } from "./MobileSheetShell";

describe("MobileSheetShell", () => {
  it("removes the backdrop and restores body interaction after closing", () => {
    vi.useFakeTimers();
    const { rerender } = render(<MobileSheetShell open onDismiss={() => undefined} mode="modal" role="dialog" ariaLabel="Sheet">Content</MobileSheetShell>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<MobileSheetShell open={false} onDismiss={() => undefined} mode="modal" role="dialog" ariaLabel="Sheet">Content</MobileSheetShell>);
    act(() => vi.advanceTimersByTime(241));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    vi.useRealTimers();
  });
});
