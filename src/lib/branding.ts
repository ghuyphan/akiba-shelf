import { useEffect } from "react";

export const PLATFORM_BRAND = {
  name: "Matsuri",
  descriptor: "Artist booth platform",
  tagline: "Your merch booth, beautifully organized.",
  description: "A storefront and live order platform for independent artist booths.",
} as const;

export const PLATFORM_THEME_COLOR = "#faf7f2";
export const PLATFORM_FAVICON = `${import.meta.env.BASE_URL}brand/matsuri-favicon.svg`;

export type DocumentBranding = {
  title: string;
  faviconUrl?: string;
  themeColor?: string;
};

export function safePublicUrl(value: string | null | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate || candidate.startsWith("//")) return undefined;
  if (!candidate.startsWith("/") && !/^https:/i.test(candidate)) return undefined;
  try {
    const url = new URL(candidate, window.location.origin);
    if (url.protocol === "https:") return url.href;
    if (url.origin === window.location.origin && (url.protocol === "http:" || url.protocol === "https:")) return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

export function getPlatformBranding(title: string = PLATFORM_BRAND.name): DocumentBranding {
  return { title, faviconUrl: PLATFORM_FAVICON, themeColor: PLATFORM_THEME_COLOR };
}

export function getShopName(shopName?: string, boothName?: string) {
  return boothName?.trim() || shopName?.trim() || "Shop";
}

export function getShopBranding(shopName?: string, boothName?: string, logoUrl?: string, themeColor?: string): DocumentBranding {
  const name = getShopName(shopName, boothName);
  return {
    title: `${name} · ${PLATFORM_BRAND.name}`,
    faviconUrl: safePublicUrl(logoUrl) ?? PLATFORM_FAVICON,
    themeColor: themeColor?.trim() || PLATFORM_THEME_COLOR,
  };
}

export function getAdminBranding(shopName?: string, boothName?: string, logoUrl?: string, themeColor?: string): DocumentBranding {
  const name = getShopName(shopName, boothName);
  return { ...getShopBranding(shopName, boothName, logoUrl, themeColor), title: `${name} Admin · ${PLATFORM_BRAND.name}` };
}

function managedFavicon() {
  const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'));
  const favicon = icons[0] ?? document.head.appendChild(document.createElement("link"));
  favicon.rel = "icon";
  favicon.dataset.branding = "managed";
  icons.slice(1).forEach((icon) => icon.remove());
  return favicon;
}

export function applyDocumentBranding(branding: DocumentBranding) {
  if (document.title !== branding.title) document.title = branding.title;
  const favicon = managedFavicon();
  const requestedIcon = safePublicUrl(branding.faviconUrl) ?? PLATFORM_FAVICON;
  if (favicon.href !== requestedIcon) favicon.href = requestedIcon;
  favicon.onerror = () => {
    favicon.onerror = null;
    favicon.href = PLATFORM_FAVICON;
  };
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const color = branding.themeColor || PLATFORM_THEME_COLOR;
  if (meta && meta.content !== color) meta.content = color;
}

export function resetDocumentBranding(title?: string) {
  applyDocumentBranding(getPlatformBranding(title));
}

export function useDocumentBranding(branding: DocumentBranding | null | undefined) {
  useEffect(() => {
    applyDocumentBranding(branding ?? getPlatformBranding());
    return () => resetDocumentBranding();
  }, [branding]);
}
