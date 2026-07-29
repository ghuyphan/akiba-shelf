import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventPinDialog } from "./EventPinDialog";

const copy = {
  title: "Protect this tablet",
  message: "Create a local PIN.",
  pinLabel: "6-digit tablet PIN",
  confirmPinLabel: "Confirm tablet PIN",
  cancelLabel: "Cancel",
  submitLabel: "Save PIN",
  submittingLabel: "Saving…",
  invalidPin: "Enter exactly 6 digits.",
  pinMismatch: "The PINs do not match.",
  submitError: "Could not check the PIN.",
  closeLabel: "Close modal",
};

describe("EventPinDialog", () => {
  afterEach(cleanup);

  it("rejects an incomplete PIN before submission", async () => {
    const onSubmit = vi.fn();
    render(
      <EventPinDialog
        isOpen
        mode="verify"
        copy={copy}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(copy.pinLabel), "12345");
    await userEvent.click(
      within(dialog).getByRole("button", { name: copy.submitLabel }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(copy.invalidPin);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires matching PINs during setup", async () => {
    const onSubmit = vi.fn();
    render(
      <EventPinDialog
        isOpen
        mode="setup"
        copy={copy}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(copy.pinLabel),
      "123456",
    );
    await userEvent.type(
      within(dialog).getByLabelText(copy.confirmPinLabel),
      "654321",
    );
    fireEvent.submit(
      within(dialog)
        .getByRole("button", {
          name: copy.submitLabel,
        })
        .closest("form")!,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(copy.pinMismatch);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a normalized matching PIN", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <EventPinDialog
        isOpen
        mode="setup"
        copy={copy}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(copy.pinLabel),
      "12a34 56",
    );
    await userEvent.type(
      within(dialog).getByLabelText(copy.confirmPinLabel),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: copy.submitLabel }),
    );

    expect(onSubmit).toHaveBeenCalledWith("123456");
  });

  it("shows a stable error when local verification fails unexpectedly", async () => {
    render(
      <EventPinDialog
        isOpen
        mode="verify"
        copy={copy}
        onClose={() => undefined}
        onSubmit={() => Promise.reject(new Error("Storage unavailable"))}
      />,
    );

    const dialog = screen.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(copy.pinLabel),
      "123456",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: copy.submitLabel }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      copy.submitError,
    );
  });
});
