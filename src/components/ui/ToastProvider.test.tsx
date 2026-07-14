import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

function ToastTrigger() {
  const toast = useToast();
  return <button onClick={() => toast.success("Your changes are live.", "Published")}>Show toast</button>;
}

describe("ToastProvider", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the short exit state before removing a toast", () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastTrigger /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Show toast" }));
    expect(screen.getByRole("status")).toHaveClass("is-open", "toast-success");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.getByRole("status")).toHaveClass("is-closing");

    act(() => vi.advanceTimersByTime(179));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
