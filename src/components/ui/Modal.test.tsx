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
});
