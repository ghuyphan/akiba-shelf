import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { CatalogLocaleProvider } from "../../lib/i18n/catalogI18n";
import { SocialQrCard } from "./SocialQrCard";

vi.mock("qrcode", () => ({
  default: {
    create: vi.fn(() => ({ modules: { size: 1, get: () => false } })),
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SocialQrCard", () => {
  it("defers QR canvas work on phones until the customer opens a card", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(max-width: 760px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(
      <CatalogLocaleProvider locale="en">
        <SocialQrCard
          label="Instagram"
          url="https://instagram.com/matsuri"
          icon={<span aria-hidden="true">I</span>}
          deferOnPhone
        />
      </CatalogLocaleProvider>,
    );

    expect(QRCode.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(QRCode.create).toHaveBeenCalledOnce());
  });
});
