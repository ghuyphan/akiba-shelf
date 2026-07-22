import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlatformI18nProvider } from "../lib/i18n/platformI18n";
import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  beforeEach(() => localStorage.setItem("matsuri-platform-locale", "en"));
  afterEach(() => localStorage.removeItem("matsuri-platform-locale"));

  it("renders a real 404 with recovery links", () => {
    render(
      <MemoryRouter initialEntries={["/missing-booth"]}>
        <PlatformI18nProvider>
          <NotFoundPage />
        </PlatformI18nProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Wrong aisle. There’s no booth here.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("/missing-booth")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Open demo storefront" }),
    ).toHaveAttribute("href", "/s/demo-booth");
  });
});
