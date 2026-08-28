import type { CSSProperties } from "react";
import { DEFAULT_STOREFRONT_PALETTE, defaultBooth } from "../lib/constants";
import type { BoothSettings, StorefrontSection } from "../types/catalog";
import { PLATFORM_THEME_COLOR } from "../lib/branding";
import {
  ensureColorContrast,
  mixHexColors,
  normalizeHexColor,
  parseHexColor,
  readableTextColor,
} from "./color";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

const adminThemeStyle: ThemeStyle = {
  "--coral": "#d95c64",
  "--coral-strong": "#a93945",
  "--navy": "#20304a",
  "--teal-dark": "#20304a",
  "--blue": "#f6c85f",
  "--teal": "#ef806d",
  "--page-bg": "#f5f0e8",
  "--admin-primary": "#d95c64",
  "--admin-secondary": "#20304a",
  "--admin-accent": "#f6c85f",
  "--admin-page-bg": "#f5f0e8",
  "--admin-action": "#5c8657",
};

export function getStorefrontSectionStyleClass(
  section: StorefrontSection,
  booth: BoothSettings,
) {
  if (section === "featured")
    return `style-featured-${booth.featured_style ?? "deck"}`;
  if (section === "controls")
    return `style-controls-${booth.controls_style ?? "panel"}`;
  if (section === "products")
    return `style-product-${booth.product_style ?? "classic"}`;
  if (section === "booth")
    return `style-booth-${booth.booth_style ?? "classic"}`;
  if (section === "cart")
    return `style-cart-${booth.cart_style ?? "classic"}`;
  return "";
}

function color(value: string | undefined, fallback: string) {
  return normalizeHexColor(value ?? "") ?? fallback;
}

function getAdminBrandStyle(booth: BoothSettings): ThemeStyle {
  return {
    "--admin-brand-primary": color(
      booth.theme_primary,
      DEFAULT_STOREFRONT_PALETTE.primary,
    ),
    "--admin-brand-secondary": color(
      booth.theme_secondary,
      DEFAULT_STOREFRONT_PALETTE.secondary,
    ),
    "--admin-brand-accent": color(
      booth.theme_accent,
      DEFAULT_STOREFRONT_PALETTE.accent,
    ),
    "--admin-brand-page-bg": color(
      booth.theme_background,
      DEFAULT_STOREFRONT_PALETTE.background,
    ),
  };
}

export function getThemeStyle(booth: BoothSettings): ThemeStyle {
  const primary = color(
    booth.theme_primary,
    DEFAULT_STOREFRONT_PALETTE.primary,
  );
  const secondary = color(
    booth.theme_secondary,
    DEFAULT_STOREFRONT_PALETTE.secondary,
  );
  const accent = color(booth.theme_accent, DEFAULT_STOREFRONT_PALETTE.accent);
  const background = color(
    booth.theme_background,
    DEFAULT_STOREFRONT_PALETTE.background,
  );
  const primaryInteractive = ensureColorContrast(
    primary,
    "#ffffff",
    4.5,
    "#20304a",
  );
  const primaryStrong = ensureColorContrast(
    primary,
    "#ffffff",
    6,
    "#20304a",
  );
  const secondaryInteractive = ensureColorContrast(
    secondary,
    "#ffffff",
    4.5,
    "#20304a",
  );
  const pageBackground = background;
  const accentOnLight = ensureColorContrast(
    accent,
    "#ffffff",
    4.5,
    secondaryInteractive,
  );
  const accentOnSecondary = ensureColorContrast(
    accent,
    secondaryInteractive,
    4.5,
    "#ffffff",
  );
  const cornerRadius = Math.min(
    32,
    Math.max(0, booth.corner_radius ?? defaultBooth.corner_radius ?? 16),
  );
  const cardStyle = booth.card_style ?? defaultBooth.card_style ?? "soft";
  const playfulShadow = parseHexColor(accentOnSecondary)!;
  const cardTokens = {
    soft: {
      background: mixHexColors("#ffffff", pageBackground, 0.95) ?? "#ffffff",
      border: "rgba(222, 217, 207, 0.85)",
      shadow: "0 8px 24px -2px rgb(15 23 42 / 6%), 0 2px 6px -1px rgb(15 23 42 / 4%)",
    },
    outlined: {
      background: "#ffffff",
      border: "var(--line)",
      shadow: "none",
    },
    elevated: {
      background: "#ffffff",
      border: "1px solid rgb(15 23 42 / 4%)",
      shadow: "0 14px 34px -4px rgb(15 23 42 / 12%), 0 4px 12px -2px rgb(15 23 42 / 6%)",
    },
    playful: {
      background: "#ffffff",
      border:
        mixHexColors(primaryInteractive, "#ded9cf", 0.42) ?? "#ded9cf",
      shadow: `5px 6px 0 rgba(${playfulShadow.red}, ${playfulShadow.green}, ${playfulShadow.blue}, 0.42)`,
    },
  }[cardStyle];

  return {
    "--store-brand-primary": primary,
    "--store-brand-secondary": secondary,
    "--store-brand-accent": accent,
    "--store-brand-page-bg": background,
    "--coral": primaryInteractive,
    "--coral-strong": primaryStrong,
    "--on-coral": readableTextColor(primaryInteractive),
    "--navy": secondaryInteractive,
    "--teal-dark": secondaryInteractive,
    "--on-navy": readableTextColor(secondaryInteractive),
    "--blue": accentOnSecondary,
    "--teal": accentOnLight,
    "--page-bg": pageBackground,
    "--store-radius": `${cornerRadius}px`,
    "--store-card-background": cardTokens.background,
    "--store-card-border": cardTokens.border,
    "--store-card-shadow": cardTokens.shadow,
  };
}

export function getAdminThemeStyle(booth: BoothSettings): ThemeStyle {
  const brandStyle = getAdminBrandStyle(booth);
  const primary = brandStyle["--admin-brand-primary"];
  const secondary = brandStyle["--admin-brand-secondary"];
  const accent = brandStyle["--admin-brand-accent"];
  const pageBackground = brandStyle["--admin-brand-page-bg"];
  const safePageBackground =
    mixHexColors(pageBackground, "#f5f0e8", 0.22) ??
    adminThemeStyle["--page-bg"];
  const interactive = ensureColorContrast(
    primary,
    "#ffffff",
    4.5,
    adminThemeStyle["--coral"],
  );
  const readableSecondary = ensureColorContrast(
    secondary,
    "#ffffff",
    4.5,
    adminThemeStyle["--admin-secondary"],
  );
  const readableAccent = ensureColorContrast(
    accent,
    "#ffffff",
    4.5,
    adminThemeStyle["--teal-dark"],
  );
  return {
    ...adminThemeStyle,
    ...brandStyle,
    "--coral": interactive,
    "--coral-strong": ensureColorContrast(
      primary,
      "#ffffff",
      6,
      adminThemeStyle["--coral-strong"],
    ),
    "--on-coral": readableTextColor(interactive),
    "--navy": readableSecondary,
    "--teal-dark": readableAccent,
    "--on-navy": readableTextColor(readableSecondary),
    "--blue": readableAccent,
    "--teal": readableAccent,
    "--page-bg": safePageBackground,
    "--admin-primary": interactive,
    "--admin-brand-interactive": interactive,
    "--admin-secondary": readableSecondary,
    "--admin-accent": accent,
    "--admin-page-bg": safePageBackground,
    "--admin-action": interactive,
  };
}

function applyThemeStyle(style: ThemeStyle) {
  Object.entries(style).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", style["--page-bg"]);
}

function cacheBoothTheme(booth: BoothSettings, scope?: string) {
  try {
    const key = scope ? `merch-booth-theme:${scope}` : "merch-booth-theme";
    localStorage.setItem(key, JSON.stringify(booth));
  } catch {
    // Theme caching is a visual enhancement; ignore storage failures.
  }
}

export function applyPageTheme(booth: BoothSettings, scope?: string) {
  const style = getThemeStyle(booth);
  applyThemeStyle(style);
  cacheBoothTheme(booth, scope);
}

export function applyAdminPageTheme(booth: BoothSettings, scope?: string) {
  applyThemeStyle(getAdminThemeStyle(booth));
  cacheBoothTheme(booth, scope);
}

export function resetPageTheme() {
  const root = document.documentElement;
  [
    "--coral",
    "--coral-strong",
    "--on-coral",
    "--navy",
    "--on-navy",
    "--teal-dark",
    "--blue",
    "--teal",
    "--page-bg",
    "--store-radius",
    "--store-card-background",
    "--store-card-border",
    "--store-card-shadow",
    "--store-brand-primary",
    "--store-brand-secondary",
    "--store-brand-accent",
    "--store-brand-page-bg",
    "--admin-primary",
    "--admin-secondary",
    "--admin-accent",
    "--admin-page-bg",
    "--admin-action",
    "--admin-brand-primary",
    "--admin-brand-secondary",
    "--admin-brand-accent",
    "--admin-brand-page-bg",
    "--admin-brand-interactive",
  ].forEach((key) => root.style.removeProperty(key));
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", PLATFORM_THEME_COLOR);
}
