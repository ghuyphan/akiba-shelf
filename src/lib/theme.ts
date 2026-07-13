import type { CSSProperties } from "react";
import { defaultBooth } from "./constants";
import type { BoothSettings } from "../types/catalog";
import { PLATFORM_THEME_COLOR } from "./branding";
import { boothSettingsSchema } from "./schemas";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

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
  const primary = color(booth.theme_primary, defaultBooth.theme_primary ?? "#5c8657");
  const secondary = color(booth.theme_secondary, defaultBooth.theme_secondary ?? "#20304a");
  const accent = color(booth.theme_accent, defaultBooth.theme_accent ?? "#f6c85f");
  const background = color(booth.theme_background, defaultBooth.theme_background ?? "#f5f0e8");
  const cornerRadius = Math.min(32, Math.max(0, booth.corner_radius ?? defaultBooth.corner_radius ?? 16));

  return {
    "--coral": primary,
    "--coral-strong": primary,
    "--navy": secondary,
    "--teal-dark": secondary,
    "--blue": accent,
    "--teal": accent,
    "--page-bg": background,
    "--store-radius": `${cornerRadius}px`,
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
  ["--coral", "--coral-strong", "--navy", "--teal-dark", "--blue", "--teal", "--page-bg", "--store-radius"].forEach((key) => root.style.removeProperty(key));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PLATFORM_THEME_COLOR);
}
