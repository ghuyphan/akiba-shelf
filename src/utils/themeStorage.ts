import { defaultBooth } from "../lib/constants";
import { boothSettingsSchema } from "../lib/schemas";
import type { BoothSettings } from "../types/catalog";
import { applyAdminPageTheme, applyPageTheme, resetPageTheme } from "./theme";

const THEME_STORAGE_KEY = "merch-booth-theme";

function scopedThemeStorageKey(scope?: string) {
  return scope ? `${THEME_STORAGE_KEY}:${scope}` : THEME_STORAGE_KEY;
}

export function getStoredBoothTheme(scope?: string): BoothSettings {
  try {
    const stored = localStorage.getItem(scopedThemeStorageKey(scope));
    if (!stored) return defaultBooth;
    const parsed = boothSettingsSchema.partial().safeParse(JSON.parse(stored));
    if (parsed.success) return { ...defaultBooth, ...parsed.data };
  } catch {
    // Invalid or unavailable storage is cleared below when possible.
  }
  try {
    localStorage.removeItem(scopedThemeStorageKey(scope));
  } catch {
    // Ignore unavailable storage.
  }
  return defaultBooth;
}

export function hydrateInitialPageTheme() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const pathname = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || "/"
    : window.location.pathname;
  const storefrontMatch = pathname.match(/^\/s\/([^/?#]+)/);
  const activeShopId =
    pathname === "/admin"
      ? localStorage.getItem("akiba-active-shop")?.trim()
      : undefined;
  const scope = storefrontMatch
    ? `slug:${decodeURIComponent(storefrontMatch[1])}`
    : activeShopId
      ? `id:${activeShopId}`
      : undefined;

  if (scope && pathname === "/admin")
    applyAdminPageTheme(getStoredBoothTheme(scope), scope);
  else if (scope) applyPageTheme(getStoredBoothTheme(scope), scope);
  else resetPageTheme();
}
