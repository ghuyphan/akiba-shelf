import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ToastLocalization,
  ToastProvider,
  useToast,
} from "./ToastProvider";

function ToastTrigger() {
  const toast = useToast();
  return <button onClick={() => toast.success("Your changes are live.", "Published")}>Show toast</button>;
}

function DefaultToastTrigger() {
  const toast = useToast();
  return (
    <button onClick={() => toast.success("Thay đổi đã được lưu.")}>
      Show localized toast
    </button>
  );
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

  it("localizes default titles and the dismiss control", () => {
    render(
      <ToastProvider>
        <ToastLocalization
          labels={{
            successTitle: "Hoàn tất",
            errorTitle: "Đã xảy ra lỗi",
            infoTitle: "Thông báo",
            dismiss: "Đóng thông báo",
          }}
        />
        <DefaultToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show localized toast" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Hoàn tất");
    expect(
      screen.getByRole("button", { name: "Đóng thông báo" }),
    ).toBeInTheDocument();
  });
});
