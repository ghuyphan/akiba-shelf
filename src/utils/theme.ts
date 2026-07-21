import type { CSSProperties } from "react";
import { DEFAULT_STOREFRONT_PALETTE, defaultBooth } from "../lib/constants";
import type { BoothSettings, StorefrontSection } from "../types/catalog";
import { PLATFORM_THEME_COLOR } from "../lib/branding";
import { boothSettingsSchema } from "../lib/schemas";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export function getStorefrontSectionStyleClass(
  section: StorefrontSection,
  booth: BoothSettings,
) {
  if (section === "featured") return `style-featured-${booth.featured_style ?? "deck"}`;
  if (section === "controls") return `style-controls-${booth.controls_style ?? "panel"}`;
  if (section === "products") return `style-product-${booth.product_style ?? "classic"}`;
  return "";
}

const themeStorageKey = "merch-booth-theme";

function scopedThemeStorageKey(scope?: string) {
  return scope ? `${themeStorageKey}:${scope}` : themeStorageKey;
}

function color(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function isThemeSettings(value: unknown): value is Partial<BoothSettings> {
  return boothSettingsSchema.partial().safeParse(value).success;
}

export function getStoredBoothTheme(scope?: string): BoothSettings {
  try {
    const stored = localStorage.getItem(scopedThemeStorageKey(scope));
    if (!stored) return defaultBooth;
    const parsed = JSON.parse(stored) as unknown;
    if (isThemeSettings(parsed)) {
      return { ...defaultBooth, ...parsed };
    }
  } catch {
    try {
      localStorage.removeItem(scopedThemeStorageKey(scope));
    } catch {
      // Ignore unavailable storage.
    }
  }

  return defaultBooth;
}

export function getThemeStyle(booth: BoothSettings): ThemeStyle {
  const primary = color(booth.theme_primary, DEFAULT_STOREFRONT_PALETTE.primary);
  const secondary = color(booth.theme_secondary, DEFAULT_STOREFRONT_PALETTE.secondary);
  const accent = color(booth.theme_accent, DEFAULT_STOREFRONT_PALETTE.accent);
  const background = color(booth.theme_background, DEFAULT_STOREFRONT_PALETTE.background);
  const cornerRadius = Math.min(32, Math.max(0, booth.corner_radius ?? defaultBooth.corner_radius ?? 16));
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

export function applyPageTheme(booth: BoothSettings, scope?: string) {
  const style = getThemeStyle(booth);
  Object.entries(style).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", style["--page-bg"]);

  try {
    localStorage.setItem(scopedThemeStorageKey(scope), JSON.stringify(booth));
  } catch {
    // Theme caching is a visual enhancement; ignore storage failures.
  }
}

export function hydrateInitialPageTheme() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || "/"
    : window.location.pathname;
  const storefrontMatch = pathname.match(/^\/s\/([^/?#]+)/);
  const activeShopId = pathname === "/admin"
    ? localStorage.getItem("akiba-active-shop")?.trim()
    : undefined;
  const scope = storefrontMatch
    ? `slug:${decodeURIComponent(storefrontMatch[1])}`
    : activeShopId
      ? `id:${activeShopId}`
      : undefined;

  if (scope) applyPageTheme(getStoredBoothTheme(scope), scope);
  else resetPageTheme();
}

export function resetPageTheme() {
  const root = document.documentElement;
  ["--coral", "--coral-strong", "--navy", "--teal-dark", "--blue", "--teal", "--page-bg", "--store-radius", "--store-card-background", "--store-card-border", "--store-card-shadow"].forEach((key) => root.style.removeProperty(key));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PLATFORM_THEME_COLOR);
}
