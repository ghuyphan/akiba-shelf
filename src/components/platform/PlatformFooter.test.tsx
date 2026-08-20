import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PLATFORM_CONTACT } from "../../lib/branding";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { PlatformFooter } from "./PlatformFooter";

describe("PlatformFooter", () => {
  beforeEach(() => localStorage.setItem("matsuri-platform-locale", "en"));
  afterEach(() => {
    cleanup();
    localStorage.removeItem("matsuri-platform-locale");
  });

  it("renders default footer links without support link on home and with Zalo support", () => {
    render(
      <MemoryRouter>
        <PlatformI18nProvider>
          <PlatformFooter showDemoLink={true} />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        "Made for independent artists, conventions, and pop-up booths.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Support Matsuri" })).toBeNull();
    expect(screen.getByRole("link", { name: "Demo booth" })).toHaveAttribute(
      "href",
      "/s/demo-booth",
    );
    expect(
      screen.getByRole("link", { name: "Chat with Matsuri on Zalo" }),
    ).toHaveAttribute("href", PLATFORM_CONTACT.zaloUrl);
    expect(screen.queryByRole("link", { name: "GitHub" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Back to Matsuri" })).toBeNull();
  });

  it("renders back to home link when configured", () => {
    render(
      <MemoryRouter>
        <PlatformI18nProvider>
          <PlatformFooter
            showHomeLink={true}
            showSupportLink={false}
            showDemoLink={true}
          />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Back to Matsuri" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("link", { name: "Support Matsuri" }),
    ).not.toBeInTheDocument();
  });
});
