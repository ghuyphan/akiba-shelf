import { afterEach, describe, expect, it } from "vitest";
import { defaultBooth } from "../../lib/constants";
import {
  getAdminThemeStyle,
  getStorefrontSectionStyleClass,
  getThemeStyle,
  resetPageTheme,
} from "../theme";
import { hydrateInitialPageTheme } from "../themeStorage";

afterEach(() => {
  resetPageTheme();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("storefront card styles", () => {
  it("keeps the shop palette visible in admin with safe semantic colors", () => {
    const admin = getAdminThemeStyle({
      ...defaultBooth,
      theme_primary: "#ffffff",
      theme_secondary: "#f4f4f4",
      theme_accent: "#fff000",
      theme_background: "#101820",
    });

    expect(admin["--admin-brand-primary"]).toBe("#ffffff");
    expect(admin["--admin-primary"]).not.toBe("#ffffff");
    expect(admin["--admin-brand-interactive"]).toBe(admin["--admin-primary"]);
    expect(admin["--admin-secondary"]).not.toBe("#f4f4f4");
    expect(admin["--admin-secondary"]).toBe(admin["--navy"]);
    expect(admin["--admin-accent"]).toBe("#fff000");
    expect(admin["--coral"]).not.toBe("#ffffff");
    expect(admin["--navy"]).not.toBe("#f4f4f4");
    expect(admin["--page-bg"]).toBe("#c3c0bc");
    expect(admin["--admin-action"]).toBe(admin["--admin-primary"]);
  });

  it("maps persisted card personalities to distinct safe CSS tokens", () => {
    const outlined = getThemeStyle({ ...defaultBooth, card_style: "outlined" });
    const playful = getThemeStyle({ ...defaultBooth, card_style: "playful" });

    expect(outlined["--store-card-shadow"]).toBe("none");
    expect(playful["--store-card-shadow"]).toMatch(/^5px 6px 0 rgba\(/);
    expect(playful["--store-card-border"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("maps section presets to scoped storefront classes", () => {
    const booth = {
      ...defaultBooth,
      featured_style: "poster" as const,
      controls_style: "compact" as const,
      product_style: "framed" as const,
    };
    expect(getStorefrontSectionStyleClass("featured", booth)).toBe(
      "style-featured-poster",
    );
    expect(getStorefrontSectionStyleClass("controls", booth)).toBe(
      "style-controls-compact",
    );
    expect(getStorefrontSectionStyleClass("products", booth)).toBe(
      "style-product-framed",
    );
    expect(getStorefrontSectionStyleClass("booth", booth)).toBe("");
  });

  it("hydrates the admin from the active shop theme", () => {
    window.history.replaceState({}, "", "/admin");
    localStorage.setItem("akiba-active-shop", "shop-1");
    localStorage.setItem(
      "merch-booth-theme:id:shop-1",
      JSON.stringify({ theme_primary: "#123456" }),
    );

    hydrateInitialPageTheme();

    expect(document.documentElement.style.getPropertyValue("--coral")).toBe(
      "#123456",
    );
  });
});
