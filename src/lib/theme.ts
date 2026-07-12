import type { CSSProperties } from "react";
import { defaultBooth } from "./constants";
import type { BoothSettings } from "../types/catalog";
import { applyPwaIdentity } from "./pwa";
import { boothSettingsSchema } from "./schemas";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

const themeStorageKey = "merch-booth-theme";

function color(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function isThemeSettings(value: unknown): value is Partial<BoothSettings> {
  return boothSettingsSchema.partial().safeParse(value).success;
}

export function getStoredBoothTheme(): BoothSettings {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (!stored) return defaultBooth;
    const parsed = JSON.parse(stored) as unknown;
    if (isThemeSettings(parsed)) {
      return { ...defaultBooth, ...parsed };
    }
  } catch {
    try {
      localStorage.removeItem(themeStorageKey);
    } catch {
      // Ignore unavailable storage.
    }
  }

  return defaultBooth;
}

export function getThemeStyle(booth: BoothSettings): ThemeStyle {
  const primary = color(booth.theme_primary, defaultBooth.theme_primary ?? "#628555");
  const secondary = color(booth.theme_secondary, defaultBooth.theme_secondary ?? "#1e293b");
  const accent = color(booth.theme_accent, defaultBooth.theme_accent ?? "#ffd17a");
  const background = color(booth.theme_background, defaultBooth.theme_background ?? "#faf7f2");
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

export function applyPageTheme(booth: BoothSettings) {
  const style = getThemeStyle(booth);
  Object.entries(style).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", style["--page-bg"]);
  applyPwaIdentity(booth);

  try {
    localStorage.setItem(themeStorageKey, JSON.stringify(booth));
  } catch {
    // Theme caching is a visual enhancement; ignore storage failures.
  }
}

export function applyStoredPageTheme() {
  applyPageTheme(getStoredBoothTheme());
}
