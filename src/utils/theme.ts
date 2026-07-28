import type { CSSProperties } from "react";
import { DEFAULT_STOREFRONT_PALETTE, defaultBooth } from "../lib/constants";
import type { BoothSettings, StorefrontSection } from "../types/catalog";
import { PLATFORM_THEME_COLOR } from "../lib/branding";

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
  return "";
}

function color(value: string | undefined, fallback: string) {
  const parsed = parseHexColor(value?.trim() || fallback);
  return parsed ? rgbToHex(parsed) : fallback;
}

type Rgb = { red: number; green: number; blue: number };

function parseHexColor(value: string): Rgb | null {
  const match = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const hex =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((character) => character + character)
          .join("")
      : match[1];
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelLuminance(channel: number) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance({ red, green, blue }: Rgb) {
  return (
    channelLuminance(red) * 0.2126 +
    channelLuminance(green) * 0.7152 +
    channelLuminance(blue) * 0.0722
  );
}

function contrastRatio(first: Rgb, second: Rgb) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHex({ red, green, blue }: Rgb) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function readableBrandColor(value: string, fallback: string, target = 4.5) {
  const source = parseHexColor(value) ?? parseHexColor(fallback);
  if (!source) return fallback;
  const white = { red: 255, green: 255, blue: 255 };
  if (contrastRatio(source, white) >= target) return rgbToHex(source);

  for (let amount = 0.08; amount <= 1; amount += 0.08) {
    const darkened = {
      red: source.red * (1 - amount),
      green: source.green * (1 - amount),
      blue: source.blue * (1 - amount),
    };
    if (contrastRatio(darkened, white) >= target) return rgbToHex(darkened);
  }
  return "#20304a";
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
  const cornerRadius = Math.min(
    32,
    Math.max(0, booth.corner_radius ?? defaultBooth.corner_radius ?? 16),
  );
  const cardStyle = booth.card_style ?? defaultBooth.card_style ?? "soft";
  const cardTokens = {
    soft: {
      background: "color-mix(in srgb, #fff 92%, var(--page-bg))",
      border: "color-mix(in srgb, var(--line) 72%, transparent)",
      shadow: "0 10px 28px rgb(15 23 42 / 6%)",
    },
    outlined: {
      background: "#fff",
      border: "var(--line)",
      shadow: "none",
    },
    elevated: {
      background: "#fff",
      border: "transparent",
      shadow: "0 20px 46px rgb(15 23 42 / 12%)",
    },
    playful: {
      background: "#fff",
      border: "color-mix(in srgb, var(--coral) 42%, var(--line))",
      shadow: "5px 6px 0 color-mix(in srgb, var(--blue) 42%, transparent)",
    },
  }[cardStyle];

  return {
    "--coral": primary,
    "--coral-strong": primary,
    "--navy": secondary,
    "--teal-dark": secondary,
    "--blue": accent,
    "--teal": accent,
    "--page-bg": background,
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
  const safePageBackground = `color-mix(in srgb, ${pageBackground} 22%, #f5f0e8)`;
  const interactive = readableBrandColor(primary, adminThemeStyle["--coral"]);
  const readableSecondary = readableBrandColor(
    secondary,
    adminThemeStyle["--admin-secondary"],
  );
  return {
    ...adminThemeStyle,
    ...brandStyle,
    "--coral": interactive,
    "--coral-strong": readableBrandColor(
      primary,
      adminThemeStyle["--coral-strong"],
      6,
    ),
    "--navy": readableSecondary,
    "--teal-dark": readableBrandColor(accent, adminThemeStyle["--teal-dark"]),
    "--blue": accent,
    "--teal": accent,
    "--page-bg": safePageBackground,
    "--admin-primary": interactive,
    "--admin-brand-interactive": interactive,
    "--admin-secondary": readableSecondary,
    "--admin-accent": accent,
    "--admin-page-bg": safePageBackground,
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
    "--navy",
    "--teal-dark",
    "--blue",
    "--teal",
    "--page-bg",
    "--store-radius",
    "--store-card-background",
    "--store-card-border",
    "--store-card-shadow",
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
