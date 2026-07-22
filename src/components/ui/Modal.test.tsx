import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("restores focus after the exit animation", () => {
    vi.useFakeTimers();
    const trigger = document.createElement("button"); trigger.textContent = "Trigger"; document.body.append(trigger); trigger.focus();
    const { rerender } = render(<Modal title="Example" isOpen onClose={() => undefined}><button>Inside</button></Modal>);
    act(() => vi.runAllTimers());
    rerender(<Modal title="Example" isOpen={false} onClose={() => undefined}><button>Inside</button></Modal>);
    act(() => vi.advanceTimersByTime(221));
    expect(document.activeElement).toBe(trigger);
    trigger.remove(); vi.useRealTimers();
  });

  it("requests close on Escape", () => { const close = vi.fn(); render(<Modal title="Example" isOpen onClose={close}><button>Inside</button></Modal>); fireEvent.keyDown(document, { key: "Escape" }); expect(close).toHaveBeenCalled(); });

  it("locks every dismissal control when it is not dismissible", () => {
    const close = vi.fn();
    render(
      <Modal title="Example" isOpen dismissible={false} onClose={close}>
        <button>Inside</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(document.querySelector(".modal-backdrop")!);
    expect(close).not.toHaveBeenCalled();
    const closeButtons = document.querySelectorAll<HTMLButtonElement>(
      ".modal-header button",
    );
    expect(closeButtons[closeButtons.length - 1]).toBeDisabled();
  });

  it("keeps a mobile sheet mounted through its exit animation", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Modal title="Example" isOpen onClose={() => undefined} mobileSheet>
        <button>Inside</button>
      </Modal>,
    );

    rerender(
      <Modal title="Example" isOpen={false} onClose={() => undefined} mobileSheet>
        <button>Inside</button>
      </Modal>,
    );
    act(() => vi.advanceTimersByTime(221));
    expect(document.querySelector(".mobile-sheet-modal")).not.toBeNull();
    act(() => vi.advanceTimersByTime(20));
    expect(document.querySelector(".mobile-sheet-modal")).toBeNull();
    vi.useRealTimers();
  });
});
