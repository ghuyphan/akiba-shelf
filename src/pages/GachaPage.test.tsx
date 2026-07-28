import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { GachaPage } from "./GachaPage";
import { resetDocumentBranding } from "../lib/branding";
import { resetDocumentSeo } from "../lib/seo";

const { loadGachaLaunch, hasStoredGachaLaunch } = vi.hoisted(() => ({
  loadGachaLaunch: vi.fn(),
  hasStoredGachaLaunch: vi.fn(() => false),
}));
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "localStorage",
);

vi.mock("../lib/gacha/gachaLaunch", async () => {
  const actual = await vi.importActual<typeof import("../lib/gacha/gachaLaunch")>(
    "../lib/gacha/gachaLaunch",
  );
  return { ...actual, loadGachaLaunch, hasStoredGachaLaunch };
});

function launch(locale: "en" | "vi" = "en") {
  return {
    shop: { id: "shop-1", slug: "demo-shop", name: "Demo Shop" },
    booth: {
      shop_id: "shop-1",
      booth_name: "Demo Booth",
      catalog_locale: locale,
      logo_url: null,
      theme_background: "#fff8ef",
    },
    catalogs: {},
  };
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/s/demo-shop/play"]}>
      <Routes>
        <Route path="/s/:shopSlug/play" element={<GachaPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  resetDocumentBranding();
  resetDocumentSeo();
  document.documentElement.lang = "en";
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(
      window,
      "localStorage",
      originalLocalStorageDescriptor,
    );
  }
  vi.clearAllMocks();
});

describe("GachaPage route metadata", () => {
  it("sets non-indexable canonical metadata and restores it on unmount", async () => {
    loadGachaLaunch.mockResolvedValueOnce(launch("vi"));
    document.documentElement.lang = "fr";

    const view = renderRoute();
    await waitFor(() => expect(document.title).toBe("Demo Booth · Matsuri"));

    expect(document.documentElement.lang).toBe("vi");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe("https://matsuri.pro/s/demo-shop/play");
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content)
      .toBe("noindex, nofollow");

    view.unmount();
    expect(document.title).toBe("Matsuri");
    expect(document.documentElement.lang).toBe("fr");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toBe("https://matsuri.pro/");
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content)
      .toBe("noindex, nofollow");
  });

  it("continues with the network launch when local storage is blocked", async () => {
    loadGachaLaunch.mockResolvedValueOnce(launch());
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });

    renderRoute();
    await waitFor(() => expect(document.title).toBe("Demo Booth · Matsuri"));
  });
});
