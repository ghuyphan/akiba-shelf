import type { CSSProperties } from "react";
import { defaultBooth } from "./constants";
import type { BoothSettings } from "../types/catalog";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

const themeStorageKey = "merch-booth-theme";

function color(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function isThemeSettings(value: unknown): value is Partial<BoothSettings> {
  return Boolean(value && typeof value === "object");
}

export function getThemeStyle(booth: BoothSettings): ThemeStyle {
  const primary = color(booth.theme_primary, defaultBooth.theme_primary ?? "#ff6fae");
  const secondary = color(booth.theme_secondary, defaultBooth.theme_secondary ?? "#24324f");
  const accent = color(booth.theme_accent, defaultBooth.theme_accent ?? "#6fc7ff");
  const background = color(booth.theme_background, defaultBooth.theme_background ?? "#fff3f8");

  return {
    "--coral": primary,
    "--coral-strong": primary,
    "--navy": secondary,
    "--teal-dark": secondary,
    "--blue": accent,
    "--teal": accent,
    "--page-bg": background,
  };
}

export function applyPageTheme(booth: BoothSettings) {
  const style = getThemeStyle(booth);
  Object.entries(style).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  try {
    localStorage.setItem(themeStorageKey, JSON.stringify(booth));
  } catch {
    // Theme caching is a visual enhancement; ignore storage failures.
  }
}

export function applyStoredPageTheme() {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (!stored) return;
    const parsed = JSON.parse(stored) as unknown;
    if (isThemeSettings(parsed)) {
      applyPageTheme({ ...defaultBooth, ...parsed });
    }
  } catch {
    try {
      localStorage.removeItem(themeStorageKey);
    } catch {
      // Ignore unavailable storage.
    }
  }
}
