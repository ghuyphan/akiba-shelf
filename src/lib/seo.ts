export const PLATFORM_SITE_URL = "https://matsuri.pro";
export const PLATFORM_SOCIAL_IMAGE = `${PLATFORM_SITE_URL}/brand/matsuri-icon-512.png`;

export type DocumentSeo = {
  description: string;
  canonicalPath: string;
  robots?: "index, follow" | "noindex, nofollow";
  type?: "website" | "profile";
};

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(path: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = new URL(path, PLATFORM_SITE_URL).href;
}

export function applyDocumentSeo({
  description,
  canonicalPath,
  robots = "index, follow",
  type = "website",
}: DocumentSeo) {
  const canonicalUrl = new URL(canonicalPath, PLATFORM_SITE_URL).href;
  setCanonical(canonicalPath);
  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[name="robots"]', "name", "robots", robots);
  setMeta('meta[name="googlebot"]', "name", "googlebot", robots);
  setMeta('meta[property="og:title"]', "property", "og:title", document.title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  setMeta('meta[property="og:type"]', "property", "og:type", type);
  setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  setMeta('meta[property="og:image"]', "property", "og:image", PLATFORM_SOCIAL_IMAGE);
  setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary");
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", document.title);
  setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", PLATFORM_SOCIAL_IMAGE);
}
