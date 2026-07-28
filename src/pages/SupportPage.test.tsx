import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../lib/i18n/platformI18n";
import { formatVnd } from "../utils/format";
import { SupportPage } from "./SupportPage";

describe("SupportPage", () => {
  beforeEach(() => localStorage.setItem("matsuri-platform-locale", "en"));
  afterEach(() => {
    cleanup();
    localStorage.removeItem("matsuri-platform-locale");
  });

  it("presents optional support methods without subscriptions", async () => {
    render(
      <MemoryRouter initialEntries={["/support"]}>
        <PlatformI18nProvider>
          <SupportPage />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Keep Matsuri free for artists.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Buy me a coffee/i }),
    ).toHaveAttribute("href", "https://buymeacoffee.com/ghuyphan");
    expect(screen.getByText("Phan Gia Huy")).toBeInTheDocument();
    expect(screen.getByText("Pha Gia Huy")).toBeInTheDocument();
    expect(screen.getAllByText("0853300850")).toHaveLength(2);
    expect(
      screen.getByText(
        "One-time support is enough. There is no automatic renewal.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open MoMo" })).toHaveAttribute(
      "href",
      "https://nhantien.momo.vn/0853300850",
    );
    expect(
      await screen.findByAltText("TPBank QR code to support Matsuri"),
    ).toHaveAttribute("src", expect.stringMatching(/^data:image\/svg\+xml/));
  });

  it("updates the bank QR amount from the preset controls", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/support"]}>
        <PlatformI18nProvider>
          <SupportPage />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    const qr = await screen.findByAltText("TPBank QR code to support Matsuri");
    const initialSource = qr.getAttribute("src");
    const amountButton = screen.getByRole("button", {
      name: formatVnd(100_000),
    });

    await user.click(amountButton);

    expect(amountButton).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(qr.getAttribute("src")).not.toBe(initialSource));
  });

  it("returns to the previous route instead of always going home", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/auth", key: "auth" },
          { pathname: "/support", key: "support" },
        ]}
        initialIndex={1}
      >
        <PlatformI18nProvider>
          <Routes>
            <Route path="/auth" element={<p>Previous auth page</p>} />
            <Route path="/support" element={<SupportPage />} />
          </Routes>
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("Previous auth page")).toBeInTheDocument();
  });

  it("falls back home when opened directly", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/support"]}>
        <PlatformI18nProvider>
          <Routes>
            <Route path="/" element={<p>Home page</p>} />
            <Route path="/support" element={<SupportPage />} />
          </Routes>
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});
