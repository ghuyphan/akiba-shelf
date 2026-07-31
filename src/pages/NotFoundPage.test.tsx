import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../lib/i18n/platformI18n";
import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  beforeEach(() => localStorage.setItem("matsuri-platform-locale", "en"));
  afterEach(() => localStorage.removeItem("matsuri-platform-locale"));

  it("renders a focused 404 with recovery links", () => {
    render(
      <MemoryRouter initialEntries={["/missing-booth"]}>
        <PlatformI18nProvider>
          <NotFoundPage />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "This page wandered off.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Matsuri" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Visit the demo booth" }),
    ).toHaveAttribute("href", "/s/demo-booth");
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("/missing-booth")).not.toBeInTheDocument();
  });
});
