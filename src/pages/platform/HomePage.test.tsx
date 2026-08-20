import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PlatformI18nProvider } from "../../lib/i18n/platformI18n";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  beforeEach(() => localStorage.setItem("matsuri-platform-locale", "en"));
  afterEach(() => {
    cleanup();
    localStorage.removeItem("matsuri-platform-locale");
  });

  it("renders landing hero, benefits, flow, toolkit, demo table, and support sections with artful SVGs", () => {
    const { container } = render(
      <MemoryRouter>
        <PlatformI18nProvider>
          <HomePage />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    // Hero title & CTA
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Sell merch.",
    );
    expect(
      screen.getAllByRole("link", { name: /See the demo booth/i }).length,
    ).toBeGreaterThanOrEqual(1);

    // Artful SVGs presence
    const paperclips = container.querySelectorAll(".landing-art-paperclip");
    expect(paperclips.length).toBeGreaterThanOrEqual(4);

    const pushpins = container.querySelectorAll(".landing-art-pushpin");
    expect(pushpins.length).toBeGreaterThanOrEqual(3);

    const washiTapes = container.querySelectorAll(".landing-art-washitape");
    expect(washiTapes.length).toBeGreaterThanOrEqual(4);

    const clamp = container.querySelector(".landing-art-clipboard-clamp");
    expect(clamp).toBeInTheDocument();

    const palette = container.querySelector(".landing-art-palette");
    expect(palette).toBeInTheDocument();

    const highlighter = container.querySelector(".landing-art-highlighter");
    expect(highlighter).toBeInTheDocument();

    // Scroll progress bar
    const progressBar = container.querySelector(
      ".platform-home-scroll-progress",
    );
    expect(progressBar).toBeInTheDocument();

    // Reveal elements count
    const revealSections = container.querySelectorAll("[data-home-reveal]");
    expect(revealSections.length).toBeGreaterThanOrEqual(6);
  });
});
