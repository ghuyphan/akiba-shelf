import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/ToastProvider";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
} from "../../lib/constants";

const mocks = vi.hoisted(() => ({
  storefront: {
    shop: undefined,
    initialBootstrap: undefined,
    catalogShopId: "",
    shopLoadError: "",
    loadShop: vi.fn(),
  } as Record<string, unknown>,
  catalogData: {} as Record<string, unknown>,
  loadCatalog: vi.fn(),
  setCart: vi.fn(),
}));

vi.mock("../../hooks/catalog/useStorefrontShop", () => ({
  useStorefrontShop: () => mocks.storefront,
}));
vi.mock("../../hooks/catalog/useCatalogData", () => ({
  useCatalogData: () => mocks.catalogData,
}));

function createCatalogData() {
  return {
    products: [],
    featuredProducts: [],
    categories: [],
    booth: defaultBooth,
    payment: defaultPayment,
    promotion: defaultPromotion,
    rewardProducts: [],
    hasMore: false,
    loadError: "",
    isLoading: false,
    isInitialLoading: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    reloadAll: mocks.loadCatalog,
    ensurePayment: vi.fn().mockResolvedValue(defaultPayment),
    gachaEnabled: false,
  };
}
vi.mock("../../hooks/catalog/usePersistentCart", () => ({
  usePersistentCart: () => ({
    cart: [],
    setCart: mocks.setCart,
    reconcileCart: vi.fn(),
    reconciliationNotice: null,
    clearReconciliationNotice: vi.fn(),
  }),
}));
vi.mock("../../hooks/catalog/useAddToCartFeedback", () => ({
  useAddToCartFeedback: () => ({ flyingItems: [], animateAdd: vi.fn() }),
}));
vi.mock("../../hooks/catalog/useCatalogEventState", () => ({
  useCatalogEventState: () => ({ salesActive: false, adminPinRequired: false }),
}));
vi.mock("../../lib/branding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/branding")>()),
  getShopBranding: vi.fn(),
  useDocumentBranding: vi.fn(),
}));
vi.mock("../../lib/seo", () => ({ applyDocumentSeo: vi.fn() }));
vi.mock("../../lib/network", () => ({ prefersLightweightCatalog: () => false }));
vi.mock("../../lib/offline/checkoutSession", () => ({
  loadCheckoutSession: () => null,
}));
vi.mock("../../lib/offline/offline", () => ({
  loadCatalogSnapshot: () => null,
}));
vi.mock("./ShopUnavailablePage", () => ({
  ShopUnavailablePage: ({ hasLoadError }: { hasLoadError: boolean }) => (
    <p>{hasLoadError ? "Shop connection failed" : "Shop unavailable"}</p>
  ),
}));

import { CatalogPage } from "./CatalogPage";

function renderCatalog() {
  return render(
    <MemoryRouter initialEntries={["/s/test-shop"]}>
      <ToastProvider>
        <Routes>
          <Route path="/s/:shopSlug" element={<CatalogPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.className = "";
});

describe("CatalogPage shop orchestration", () => {
  it("keeps a stable loading state while the shop identity resolves", () => {
    mocks.catalogData = createCatalogData();
    mocks.storefront = {
      shop: undefined,
      initialBootstrap: undefined,
      catalogShopId: "",
      shopLoadError: "",
      loadShop: vi.fn(),
    };

    renderCatalog();

    expect(screen.getByText("Opening the shop…")).toBeInTheDocument();
  });

  it("shows the unavailable route when the shop does not exist", async () => {
    mocks.catalogData = createCatalogData();
    mocks.storefront = {
      shop: null,
      initialBootstrap: undefined,
      catalogShopId: "",
      shopLoadError: "",
      loadShop: vi.fn(),
    };

    renderCatalog();

    expect(await screen.findByText("Shop unavailable")).toBeInTheDocument();
  });

  it("distinguishes connection failures from a confirmed missing shop", async () => {
    mocks.catalogData = createCatalogData();
    mocks.storefront = {
      shop: null,
      initialBootstrap: undefined,
      catalogShopId: "",
      shopLoadError: "Could not connect",
      loadShop: vi.fn(),
    };

    renderCatalog();

    expect(await screen.findByText("Shop connection failed")).toBeInTheDocument();
  });
});
