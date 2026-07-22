import { afterEach, describe, expect, it } from "vitest";
import { applyDocumentSeo, PLATFORM_SITE_URL } from "../seo";

afterEach(() => {
  document.head
    .querySelectorAll(
      'meta[name="description"], meta[name="robots"], meta[name="googlebot"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"]',
    )
    .forEach((element) => element.remove());
});

describe("document SEO", () => {
  it("updates canonical, social, description, and indexing metadata", () => {
    document.title = "Example booth · Matsuri";
    applyDocumentSeo({
      description: "Browse an example artist booth.",
      canonicalPath: "/s/example-booth",
      robots: "index, follow",
      type: "profile",
    });

    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe(`${PLATFORM_SITE_URL}/s/example-booth`);
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content,
    ).toBe("Browse an example artist booth.");
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content,
    ).toBe("index, follow");
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')
        ?.content,
    ).toBe("Example booth · Matsuri");
    expect(
      document.querySelector<HTMLMetaElement>('meta[property="og:type"]')
        ?.content,
    ).toBe("profile");
  });
});
