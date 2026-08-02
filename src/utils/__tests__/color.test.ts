import { describe, expect, it } from "vitest";
import {
  DEFAULT_STOREFRONT_PALETTE,
  defaultBooth,
  STOREFRONT_PALETTES,
} from "../../lib/constants";
import {
  ensureColorContrast,
  ensureSurfaceContrast,
  getContrastRatio,
  normalizeHexColor,
  readableTextColor,
} from "../color";
import { getThemeStyle } from "../theme";
import {
  getStorefrontColorGuidance,
  getStorefrontPalette,
} from "../storefrontColors";

describe("color contrast", () => {
  it("normalizes supported hex values and rejects malformed colors", () => {
    expect(normalizeHexColor(" #ABC ")).toBe("#aabbcc");
    expect(normalizeHexColor("#123456")).toBe("#123456");
    expect(normalizeHexColor("not-a-color")).toBeNull();
  });

  it("finds the nearest shade that reaches the requested contrast", () => {
    const adjusted = ensureColorContrast("#e56f92", "#ffffff", 4.5);
    expect(adjusted).not.toBe("#e56f92");
    expect(getContrastRatio(adjusted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(readableTextColor("#f4cf78")).toBe("#20304a");
  });

  it("derives accessible storefront semantic colors for every preset", () => {
    for (const palette of STOREFRONT_PALETTES) {
      const style = getThemeStyle({
        ...defaultBooth,
        theme_primary: palette.primary,
        theme_secondary: palette.secondary,
        theme_accent: palette.accent,
        theme_background: palette.background,
      });
      expect(style["--store-brand-primary"]).toBe(palette.primary);
      expect(
        getContrastRatio(style["--coral"], "#ffffff"),
        palette.name,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(style["--coral-strong"], "#ffffff"),
        palette.name,
      ).toBeGreaterThanOrEqual(6);
      expect(
        getContrastRatio(style["--teal"], "#ffffff"),
        palette.name,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(style["--blue"], style["--navy"]),
        palette.name,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("recommends a safe primary without mutating the stored palette", () => {
    const palette = getStorefrontPalette({
      ...defaultBooth,
      theme_primary: "#ffffff",
    });
    const guidance = getStorefrontColorGuidance("primary", palette);
    expect(guidance.passes).toBe(false);
    expect(guidance.current).toBe("#ffffff");
    expect(guidance.recommended).not.toBe(guidance.current);
    expect(
      getContrastRatio(guidance.recommended, guidance.reference),
    ).toBeGreaterThanOrEqual(guidance.target);
  });

  it("preserves the selected page background without runtime recoloring", () => {
    const style = getThemeStyle({
      ...defaultBooth,
      theme_secondary: "#20304a",
      theme_background: "#101820",
    });

    expect(style["--store-brand-page-bg"]).toBe("#101820");
    expect(style["--page-bg"]).toBe("#101820");
  });

  it("keeps light surface recommendations light", () => {
    const recommendation = ensureSurfaceContrast(
      "#ffeede",
      "#8d7343",
      4.5,
      DEFAULT_STOREFRONT_PALETTE.background,
    );

    expect(recommendation).toBe("#ffffff");
    expect(getContrastRatio(recommendation, "#8d7343")).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("preserves the demo booth page color at runtime", () => {
    const style = getThemeStyle({
      ...defaultBooth,
      theme_primary: "#628555",
      theme_secondary: "#ffd17a",
      theme_accent: "#f5d64c",
      theme_background: "#ffeede",
    });

    expect(style["--store-brand-page-bg"]).toBe("#ffeede");
    expect(style["--page-bg"]).toBe("#ffeede");
  });
});
