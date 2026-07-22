import { afterEach, describe, expect, it } from "vitest";
import { defaultBooth } from "../../lib/constants";
import {
  getStorefrontSectionStyleClass,
  getThemeStyle,
  hydrateInitialPageTheme,
  resetPageTheme,
} from "../theme";

afterEach(() => {
  resetPageTheme();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("storefront card styles", () => {
  it("maps persisted card personalities to distinct safe CSS tokens", () => {
    const outlined = getThemeStyle({ ...defaultBooth, card_style: "outlined" });
    const playful = getThemeStyle({ ...defaultBooth, card_style: "playful" });

    expect(outlined["--store-card-shadow"]).toBe("none");
    expect(playful["--store-card-shadow"]).toContain("color-mix");
    expect(playful["--store-card-border"]).toContain("--coral");
  });

  it("maps section presets to scoped storefront classes", () => {
    const booth = { ...defaultBooth, featured_style: "poster" as const, controls_style: "compact" as const, product_style: "framed" as const };
    expect(getStorefrontSectionStyleClass("featured", booth)).toBe("style-featured-poster");
    expect(getStorefrontSectionStyleClass("controls", booth)).toBe("style-controls-compact");
    expect(getStorefrontSectionStyleClass("products", booth)).toBe("style-product-framed");
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
