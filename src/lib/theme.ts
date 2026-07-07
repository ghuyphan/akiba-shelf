import type { CSSProperties } from "react";
import { defaultBooth } from "./constants";
import type { BoothSettings } from "../types/catalog";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

function color(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
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
}
