const bootstrapRequests = new Map<string, Promise<unknown>>();

function storefrontBootstrapEndpoint() {
  const value = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!value || !key) throw new Error("Supabase is not configured.");
  const origin = new URL(value);
  if (!/^https?:$/.test(origin.protocol))
    throw new Error("Supabase URL is invalid.");
  if (!origin.pathname.endsWith("/")) origin.pathname += "/";
  return {
    key,
    url: new URL("rest/v1/rpc/get_storefront_bootstrap", origin),
  };
}

function preloadFeaturedImage(value: unknown) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!value || typeof value !== "object") return;
  const products = (value as { products?: unknown }).products;
  if (!Array.isArray(products)) return;
  const product = products.find(
    (item): item is Record<string, unknown> =>
      Boolean(item) &&
      typeof item === "object" &&
      (item as { featured?: unknown }).featured === true,
  );
  const variants = product?.image_variants;
  const images = product?.images;
  const candidate =
    (Array.isArray(variants) &&
    variants[0] &&
    typeof variants[0] === "object" &&
    typeof (variants[0] as { thumbnail?: unknown }).thumbnail === "string"
      ? (variants[0] as { thumbnail: string }).thumbnail
      : undefined) ??
    (Array.isArray(images) && typeof images[0] === "string"
      ? images[0]
      : undefined);
  if (!candidate || candidate.startsWith("//")) return;
  try {
    const imageUrl = new URL(candidate, window.location.origin);
    if (
      imageUrl.protocol !== "https:" &&
      !(
        imageUrl.protocol === "http:" &&
        imageUrl.origin === window.location.origin
      )
    )
      return;
    if (
      Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel="preload"][as="image"]',
        ),
      ).some((link) => link.href === imageUrl.href)
    )
      return;
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = imageUrl.href;
    preload.fetchPriority = "high";
    document.head.appendChild(preload);
  } catch {
    // Runtime schema validation handles malformed product image URLs.
  }
}

function fetchStorefrontBootstrap(shopSlug: string) {
  return (async () => {
    const { key, url } = storefrontBootstrapEndpoint();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_shop_slug: shopSlug }),
    });
    if (!response.ok) {
      throw new Error(`Storefront bootstrap failed (${response.status}).`);
    }
    const data = (await response.json()) as unknown;
    preloadFeaturedImage(data);
    return data;
  })();
}

export function requestStorefrontBootstrap(shopSlug: string) {
  const cached = bootstrapRequests.get(shopSlug);
  if (cached) return cached;

  const request = fetchStorefrontBootstrap(shopSlug);
  bootstrapRequests.set(shopSlug, request);
  void request.catch(() => bootstrapRequests.delete(shopSlug));
  return request;
}

export function releaseStorefrontBootstrapRequest(
  shopSlug: string,
  request: Promise<unknown>,
) {
  if (bootstrapRequests.get(shopSlug) === request) {
    bootstrapRequests.delete(shopSlug);
  }
}

export function prefetchStorefrontBootstrapFromPath(
  pathname: string,
  baseUrl: string,
) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  if (!pathname.startsWith(normalizedBase)) return;
  const relativePath = pathname.slice(normalizedBase.length);
  const match = /^s\/([^/]+)\/?$/.exec(relativePath);
  if (!match) return;
  try {
    void requestStorefrontBootstrap(decodeURIComponent(match[1])).catch(
      () => undefined,
    );
  } catch {
    // Route handling owns malformed slug and configuration errors.
  }
}
