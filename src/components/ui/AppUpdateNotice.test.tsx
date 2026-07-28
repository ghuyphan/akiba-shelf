import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppUpdateNotice, type AppUpdateNoticeCopy } from "./AppUpdateNotice";
import { ToastProvider } from "./ToastProvider";

const updateState = vi.hoisted(() => ({
  applyUpdate: vi.fn().mockResolvedValue(undefined),
  dismiss: vi.fn(),
  isUpdateAvailable: true,
  isUpdating: false,
}));

vi.mock("../../hooks/shared/useAppUpdate", () => ({
  useAppUpdate: () => updateState,
}));

const copy: AppUpdateNoticeCopy = {
  ariaLabel: "Matsuri update available",
  title: "A Matsuri update is ready",
  message: "Refresh when you are ready.",
  updateLabel: "Update now",
  updatingLabel: "Updating…",
  laterLabel: "Later",
  dismissLabel: "Dismiss update notice",
};

function renderNotice() {
  return render(
    <ToastProvider>
      <AppUpdateNotice copy={copy} />
    </ToastProvider>,
  );
}

afterEach(() => {
  cleanup();
  updateState.applyUpdate.mockClear();
  updateState.dismiss.mockClear();
  updateState.isUpdateAvailable = true;
  updateState.isUpdating = false;
});

describe("AppUpdateNotice", () => {
  it("offers a persistent explicit update action", async () => {
    const user = userEvent.setup();
    renderNotice();

    expect(
      screen.getByRole("status", { name: copy.ariaLabel }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy.updateLabel }));
    expect(updateState.applyUpdate).toHaveBeenCalledOnce();
  });

  it("can be deferred without applying the update", async () => {
    const user = userEvent.setup();
    renderNotice();

    await user.click(screen.getByRole("button", { name: copy.laterLabel }));
    expect(updateState.dismiss).toHaveBeenCalledOnce();
    expect(updateState.applyUpdate).not.toHaveBeenCalled();
  });

  it("does not render when the current release is active", () => {
    updateState.isUpdateAvailable = false;
    renderNotice();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
