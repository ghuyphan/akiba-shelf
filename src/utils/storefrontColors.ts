import {
  DEFAULT_STOREFRONT_PALETTE,
  STOREFRONT_PALETTES,
} from "../lib/constants";
import type { BoothSettings } from "../types/catalog";
import {
  ensureColorContrast,
  ensureSurfaceContrast,
  getContrastRatio,
  normalizeHexColor,
} from "./color";

export type StorefrontColorRole =
  | "primary"
  | "secondary"
  | "accent"
  | "background";

export type StorefrontPalette = Record<StorefrontColorRole, string>;

export type StorefrontColorGuidance = {
  current: string;
  recommended: string;
  ratio: number;
  target: number;
  reference: string;
  referenceLabel: "light surfaces" | "dark palette color";
  passes: boolean;
};

const TARGET_CONTRAST = 4.5;

export function getStorefrontPalette(settings: BoothSettings): StorefrontPalette {
  return {
    primary:
      normalizeHexColor(settings.theme_primary ?? "") ??
      DEFAULT_STOREFRONT_PALETTE.primary,
    secondary:
      normalizeHexColor(settings.theme_secondary ?? "") ??
      DEFAULT_STOREFRONT_PALETTE.secondary,
    accent:
      normalizeHexColor(settings.theme_accent ?? "") ??
      DEFAULT_STOREFRONT_PALETTE.accent,
    background:
      normalizeHexColor(settings.theme_background ?? "") ??
      DEFAULT_STOREFRONT_PALETTE.background,
  };
}

export function getStorefrontRoleColors(role: StorefrontColorRole) {
  return Array.from(
    new Set(STOREFRONT_PALETTES.map((palette) => palette[role])),
  );
}

export function getStorefrontColorGuidance(
  role: StorefrontColorRole,
  palette: StorefrontPalette,
): StorefrontColorGuidance {
  const current = palette[role];
  const againstLightSurface = role === "primary" || role === "secondary";
  const safeSecondary = ensureColorContrast(
    palette.secondary,
    "#ffffff",
    TARGET_CONTRAST,
    DEFAULT_STOREFRONT_PALETTE.secondary,
  );
  const reference = againstLightSurface ? "#ffffff" : safeSecondary;
  const ratio = getContrastRatio(current, reference);
  return {
    current,
    recommended:
      role === "background"
        ? ensureSurfaceContrast(
            current,
            reference,
            TARGET_CONTRAST,
            DEFAULT_STOREFRONT_PALETTE.background,
          )
        : ensureColorContrast(
            current,
            reference,
            TARGET_CONTRAST,
            role === "accent"
              ? DEFAULT_STOREFRONT_PALETTE.accent
              : DEFAULT_STOREFRONT_PALETTE.secondary,
          ),
    ratio,
    target: TARGET_CONTRAST,
    reference,
    referenceLabel: againstLightSurface
      ? "light surfaces"
      : "dark palette color",
    passes: ratio >= TARGET_CONTRAST,
  };
}
