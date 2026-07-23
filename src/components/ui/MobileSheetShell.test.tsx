import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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

  it("traps focus, inerts the background, and restores focus when closed", () => {
    vi.useFakeTimers();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open cart
          </button>
          <button type="button">Outside action</button>
          <MobileSheetShell
            open={open}
            onDismiss={() => setOpen(false)}
            mode="expandable"
            role={open ? "dialog" : undefined}
            ariaModal={open || undefined}
            ariaLabel={open ? "Cart" : undefined}
            tabIndex={-1}
          >
            <button type="button">First action</button>
            <button type="button" onClick={() => setOpen(false)}>
              Close cart
            </button>
          </MobileSheetShell>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open cart" });
    const outside = screen.getByRole("button", { name: "Outside action" });
    trigger.focus();
    fireEvent.click(trigger);
    act(() => vi.runOnlyPendingTimers());

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Close cart" });
    expect(first).toHaveFocus();
    expect(outside).toHaveAttribute("inert");

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.click(last);
    expect(trigger).toHaveFocus();
    expect(outside).not.toHaveAttribute("inert");
    vi.useRealTimers();
  });
});
