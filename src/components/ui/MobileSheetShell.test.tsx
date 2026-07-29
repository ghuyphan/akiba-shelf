import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MobileSheetShell,
  SheetHandle,
} from "./MobileSheetShell";

beforeAll(() => {
  if (!window.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      public readonly pointerId: number;
      public readonly isPrimary: boolean;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    window.PointerEvent =
      PointerEventPolyfill as unknown as typeof PointerEvent;
  }
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
});

function mockPhoneLayout(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() {
      return matches;
    },
    media: "(max-width: 760px)",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => listeners.delete(listener),
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockImplementation((query) =>
    query === media.media
      ? media
      : ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList),
  );

  return (nextMatches: boolean) => {
    matches = nextMatches;
    const event = { matches, media: media.media } as MediaQueryListEvent;
    listeners.forEach((listener) => listener(event));
  };
}

function dragSheet(
  surface: HTMLElement,
  handle: Element,
  endY: number,
  times = { start: 0, move: 0, end: 0 },
) {
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    button: 0,
    clientY: 100,
    timeStamp: times.start,
  });
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    clientY: endY,
    timeStamp: times.move,
  });
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    clientY: endY,
    timeStamp: times.end,
  });
}

function ExpandableSheetHarness() {
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

describe("MobileSheetShell", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("removes the backdrop and restores body interaction after closing", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MobileSheetShell
        open
        onDismiss={() => undefined}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        Content
      </MobileSheetShell>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <MobileSheetShell
        open={false}
        onDismiss={() => undefined}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        Content
      </MobileSheetShell>,
    );
    act(() => vi.advanceTimersByTime(241));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    vi.useRealTimers();
  });

  it("preserves existing body scroll styles after the final sheet closes", () => {
    vi.useFakeTimers();
    document.body.style.overflow = "clip";
    document.body.style.paddingRight = "7px";
    const { rerender } = render(
      <MobileSheetShell
        open
        onDismiss={() => undefined}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        Content
      </MobileSheetShell>,
    );

    rerender(
      <MobileSheetShell
        open={false}
        onDismiss={() => undefined}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        Content
      </MobileSheetShell>,
    );
    act(() => vi.advanceTimersByTime(241));

    expect(document.body.style.overflow).toBe("clip");
    expect(document.body.style.paddingRight).toBe("7px");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  });

  it("keeps the older modal inert when stacked overlays close out of order", () => {
    vi.useFakeTimers();
    const renderStack = (firstOpen: boolean, secondOpen: boolean) => (
      <>
        <button type="button">Background action</button>
        <MobileSheetShell
          open={firstOpen}
          onDismiss={() => undefined}
          mode="modal"
          role="dialog"
          ariaLabel="First sheet"
        >
          First
        </MobileSheetShell>
        {secondOpen && (
          <MobileSheetShell
            open
            onDismiss={() => undefined}
            mode="modal"
            role="dialog"
            ariaLabel="Second sheet"
          >
            Second
          </MobileSheetShell>
        )}
      </>
    );
    const { rerender } = render(renderStack(true, false));
    rerender(renderStack(true, true));

    const background = screen.getByRole("button", {
      name: "Background action",
      hidden: true,
    });
    const firstBackdrop = document
      .querySelector('[aria-label="First sheet"]')
      ?.closest(".sheet-backdrop");
    expect(background).toHaveAttribute("inert");
    expect(firstBackdrop).toHaveAttribute("inert");

    rerender(renderStack(false, true));
    expect(background).toHaveAttribute("inert");
    expect(firstBackdrop).toHaveAttribute("inert");

    rerender(renderStack(false, false));
    act(() => vi.advanceTimersByTime(241));
    expect(background).not.toHaveAttribute("inert");
  });

  it("traps focus, inerts the background, and restores focus when closed", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);

    render(<ExpandableSheetHarness />);
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
  });

  it("releases modal behavior when the phone layout crosses to desktop", () => {
    vi.useFakeTimers();
    const setPhoneLayout = mockPhoneLayout(true);

    render(<ExpandableSheetHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open cart" }));
    act(() => vi.runOnlyPendingTimers());

    const outside = screen.getByRole("button", { name: "Outside action" });
    expect(screen.getByRole("dialog", { name: "Cart" })).toBeInTheDocument();
    expect(outside).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    act(() => setPhoneLayout(false));

    expect(screen.queryByRole("dialog", { name: "Cart" })).toBeNull();
    expect(outside).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
    act(() => vi.advanceTimersByTime(241));
    expect(document.querySelector(".sheet-backdrop")).toBeNull();
  });

  it("snaps back after a short handle drag", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);
    const dismiss = vi.fn();
    render(
      <MobileSheetShell
        open
        onDismiss={dismiss}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        <SheetHandle />
        Content
      </MobileSheetShell>,
    );

    const surface = screen.getByRole("dialog");
    const handle = surface.querySelector(".mobile-sheet-handle")!;
    dragSheet(surface, handle, 140, {
      start: 100,
      move: 1000,
      end: 1100,
    });

    expect(dismiss).not.toHaveBeenCalled();
    expect(surface.style.transform).toBe("translate3d(0, 0px, 0)");
  });

  it("dismisses after a deliberate downward handle drag", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);
    const dismiss = vi.fn();
    render(
      <MobileSheetShell
        open
        onDismiss={dismiss}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        <SheetHandle />
        Content
      </MobileSheetShell>,
    );

    const surface = screen.getByRole("dialog");
    const handle = surface.querySelector(".mobile-sheet-handle")!;
    dragSheet(surface, handle, 220, { start: 10, move: 30, end: 40 });

    expect(dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(181));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("uses the pointer-up position when the browser skips move events", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);
    const dismiss = vi.fn();
    render(
      <MobileSheetShell
        open
        onDismiss={dismiss}
        mode="modal"
        role="dialog"
        ariaLabel="Sheet"
      >
        <SheetHandle />
        Content
      </MobileSheetShell>,
    );

    const surface = screen.getByRole("dialog");
    const handle = surface.querySelector(".mobile-sheet-handle")!;
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientY: 100,
    });
    fireEvent.pointerUp(surface, {
      pointerId: 1,
      clientY: 220,
    });
    act(() => vi.advanceTimersByTime(181));

    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("uses the same drag behavior for the expandable cart sheet", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);
    const dismiss = vi.fn();
    const handleClick = vi.fn();
    render(
      <MobileSheetShell
        open
        onDismiss={dismiss}
        mode="expandable"
        role="dialog"
        ariaLabel="Cart"
      >
        <SheetHandle onClick={handleClick} label="Collapse cart" />
        Content
      </MobileSheetShell>,
    );

    const surface = screen.getByRole("dialog", { name: "Cart" });
    const handle = screen.getByRole("button", { name: "Collapse cart" });
    dragSheet(surface, handle, 220);
    fireEvent.click(handle);

    expect(handleClick).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(181));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("keeps a non-dismissible sheet fixed", () => {
    vi.useFakeTimers();
    mockPhoneLayout(true);
    const dismiss = vi.fn();
    render(
      <MobileSheetShell
        open
        onDismiss={dismiss}
        mode="modal"
        role="dialog"
        ariaLabel="Locked sheet"
        dragDismissible={false}
      >
        <SheetHandle />
        Content
      </MobileSheetShell>,
    );

    const surface = screen.getByRole("dialog", { name: "Locked sheet" });
    const handle = surface.querySelector(".mobile-sheet-handle")!;
    dragSheet(surface, handle, 240);
    act(() => vi.advanceTimersByTime(300));

    expect(surface.style.transform).toBe("");
    expect(dismiss).not.toHaveBeenCalled();
  });
});
