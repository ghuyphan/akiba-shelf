import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultBooth } from "../lib/constants";
import { getCatalogCoreData } from "../lib/api/catalog";
import { getPublicGachaEnabled } from "../lib/api/gachaPublic";
import { getPublicProductsByIds } from "../lib/api/products";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import {
  loadCatalogSnapshot,
  replaceCompleteCatalogSnapshot,
  saveCatalogSnapshot,
} from "../lib/offline/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import type { Product } from "../types/catalog";
import { useCatalogProducts, type CatalogQuery } from "./useCatalogProducts";
import { useStorefrontBootstrap } from "./useStorefrontBootstrap";
import { OFFLINE_EVENT_UPDATED } from "../lib/offline/offlineEvents";
import { translations } from "../lib/i18n/catalogI18n";

const EMPTY_PRODUCTS: Product[] = [];

type ProductsLoadedHandler = (
  products: Product[],
  authoritativeIds?: string[],
) => void;

export function useCatalogData(
  shopId: string | undefined,
  query: CatalogQuery,
  cartProductIds: string[],
  onProductsLoaded: ProductsLoadedHandler,
  paymentEnabled = true,
) {
  const cached = useMemo(() => loadCatalogSnapshot(shopId), [shopId]);
  const initialProducts = cached?.products ?? EMPTY_PRODUCTS;
  const initialBooth = cached?.booth ?? defaultBooth;
  const [cartError, setCartError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [rewardProducts, setRewardProducts] = useState<Product[]>([]);
  const [gachaAvailability, setGachaAvailability] = useState<{
    shopId: string;
    enabled: boolean;
  } | null>(null);
  const resolvedGachaAvailability =
    gachaAvailability?.shopId === shopId ? gachaAvailability : null;
  const gachaEnabled =
    resolvedGachaAvailability?.enabled ?? cached?.gachaEnabled ?? false;

  useEffect(() => {
    let active = true;
    if (!shopId) return;
    void getPublicGachaEnabled(shopId)
      .then((enabled) => {
        if (active) setGachaAvailability({ shopId, enabled });
      })
      .catch(() => {
        if (active) {
          const snapshot = loadCatalogSnapshot(shopId);
          setGachaAvailability({
            shopId,
            enabled: snapshot?.gachaEnabled ?? false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [shopId]);

  const productCatalog = useCatalogProducts(
    shopId,
    query,
    initialProducts,
    onProductsLoaded,
  );
  const storefront = useStorefrontBootstrap(
    shopId,
    paymentEnabled,
    initialBooth,
    initialProducts,
    cached?.payment,
    cached?.promotion,
    cached?.categories,
  );
  const reloadProducts = productCatalog.reload;
  const refreshVisibleProducts = productCatalog.refreshVisible;
  const reloadStorefront = storefront.reload;
  const refreshProductMetadata = storefront.refreshProductMetadata;
  const refreshBooth = storefront.refreshBooth;
  const refreshPayment = storefront.refreshPayment;
  const refreshPromotion = storefront.refreshPromotion;
  const liveRefreshError =
    translations[storefront.booth.catalog_locale ?? "en"].liveRefreshFailed;

  useEffect(() => {
    if (!shopId) return;
    const refreshEventStock = (event: Event) => {
      const detail = (event as CustomEvent<{ shopId?: string }>).detail;
      if (!detail?.shopId || detail.shopId === shopId) void reloadProducts();
    };
    window.addEventListener(OFFLINE_EVENT_UPDATED, refreshEventStock);
    return () =>
      window.removeEventListener(OFFLINE_EVENT_UPDATED, refreshEventStock);
  }, [reloadProducts, shopId]);

  const refreshCompleteOfflineSnapshot = useCallback(async () => {
    if (!shopId || loadCatalogSnapshot(shopId)?.complete !== true) return;
    try {
      const completeCatalog = await getCatalogCoreData(shopId);
      replaceCompleteCatalogSnapshot(completeCatalog, shopId);
    } catch {
      // Keep the last complete snapshot when a background reconciliation fails.
    }
  }, [shopId]);

  // Latest-value refs keep the Realtime channel lifetime tied to shopId only:
  // the subscription effect reads these instead of closing over props/state
  // that change on every cart edit or catalog query change.
  const cartProductIdsRef = useRef(cartProductIds);
  cartProductIdsRef.current = cartProductIds;
  const loadedProductsRef = useRef(initialProducts);
  loadedProductsRef.current = productCatalog.products;

  const loadCartProducts = useCallback(
    async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
      const requestedIds = [...cartProductIdsRef.current];
      if (!shopId || requestedIds.length === 0) {
        setCartError("");
        return;
      }
      try {
        // Reconcile from the already-loaded product list where possible and
        // only fetch the ids missing from that cache (e.g. filtered out by
        // the current category/search). Realtime stock changes and manual
        // reloads bypass the cache to stay server-authoritative.
        const cached = new Map(
          loadedProductsRef.current.map((product) => [product.id, product]),
        );
        const missingIds = forceRefresh
          ? requestedIds
          : requestedIds.filter((id) => !cached.has(id));
        const fetched = missingIds.length
          ? await getPublicProductsByIds(shopId, missingIds)
          : [];
        const fetchedById = new Map(
          fetched.map((product) => [product.id, product]),
        );
        const nextProducts = requestedIds.flatMap((id) => {
          const product = cached.get(id) ?? fetchedById.get(id);
          return product ? [product] : [];
        });
        onProductsLoaded(nextProducts, requestedIds);
        setCartError("");
      } catch (error) {
        if (!isSessionNoise(error))
          setCartError(getErrorMessage(error, "Could not refresh your cart."));
      }
    },
    [onProductsLoaded, shopId],
  );

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadProducts(),
      reloadStorefront(),
      loadCartProducts({ forceRefresh: true }),
      refreshCompleteOfflineSnapshot(),
    ]);
    setRefreshError("");
  }, [
    loadCartProducts,
    refreshCompleteOfflineSnapshot,
    reloadProducts,
    reloadStorefront,
  ]);

  useEffect(() => {
    void loadCartProducts();
  }, [cartProductIds, loadCartProducts]);

  useEffect(() => {
    if (!shopId || storefront.promotion.reward_product_ids.length === 0) {
      setRewardProducts([]);
      return;
    }
    let active = true;
    void getPublicProductsByIds(shopId, storefront.promotion.reward_product_ids)
      .then((next) => {
        if (active) setRewardProducts(next);
      })
      .catch(() => {
        if (active) {
          const cachedMap = new Map(initialProducts.map((p) => [p.id, p]));
          const fallback = storefront.promotion.reward_product_ids
            .map((id) => cachedMap.get(id))
            .filter((p): p is Product => Boolean(p));
          setRewardProducts(fallback);
        }
      });
    return () => {
      active = false;
    };
  }, [shopId, storefront.promotion.reward_product_ids, initialProducts]);

  useEffect(() => {
    if (
      !shopId ||
      productCatalog.isLoading ||
      productCatalog.isInitialLoading ||
      storefront.isInitialLoading
    )
      return;
    saveCatalogSnapshot(
      {
        products: productCatalog.products,
        booth: storefront.booth,
        payment: storefront.paymentResolved ? storefront.payment : undefined,
        promotion: storefront.promotion,
        categories: storefront.categories,
        gachaEnabled: resolvedGachaAvailability?.enabled,
      },
      shopId,
    );
  }, [
    productCatalog.isInitialLoading,
    productCatalog.isLoading,
    productCatalog.products,
    shopId,
    resolvedGachaAvailability,
    storefront.booth,
    storefront.categories,
    storefront.isInitialLoading,
    storefront.payment,
    storefront.paymentResolved,
    storefront.promotion,
  ]);

  const realtimeHandlersRef = useRef({
    loadCartProducts,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    refreshProductMetadata,
    refreshVisibleProducts,
  });
  realtimeHandlersRef.current = {
    loadCartProducts,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    refreshProductMetadata,
    refreshVisibleProducts,
  };

  useEffect(() => {
    const timers = new Map<string, number>();
    if (!shopId) return;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: (table) => {
        window.clearTimeout(timers.get(table));
        timers.set(
          table,
          window.setTimeout(() => {
            const handlers = realtimeHandlersRef.current;
            const request =
              table === "products"
                ? Promise.all([
                    handlers.refreshVisibleProducts(),
                    handlers.refreshProductMetadata(),
                    handlers.loadCartProducts({ forceRefresh: true }),
                    refreshCompleteOfflineSnapshot(),
                  ])
                : table === "booth_settings"
                  ? handlers.refreshBooth()
                  : table === "payment_settings"
                    ? handlers.refreshPayment()
                    : handlers.refreshPromotion();
            void request
              .then(() => setRefreshError(""))
              .catch((error: unknown) => {
                if (!isSessionNoise(error))
                  setRefreshError(
                    getErrorMessage(error, liveRefreshError),
                  );
              });
          }, 150),
        );
      },
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, [liveRefreshError, refreshCompleteOfflineSnapshot, shopId]);

  return {
    products: productCatalog.products,
    featuredProducts: storefront.featuredProducts,
    categories: storefront.categories,
    booth: storefront.booth,
    payment: storefront.payment,
    promotion: storefront.promotion,
    rewardProducts,
    hasMore: productCatalog.hasMore,
    loadError:
      productCatalog.error || storefront.error || cartError || refreshError,
    isLoading: productCatalog.isLoading,
    isInitialLoading:
      (productCatalog.isInitialLoading || storefront.isInitialLoading) &&
      !cached,
    isLoadingMore: productCatalog.isLoadingMore,
    loadMore: productCatalog.loadMore,
    reloadAll,
    ensurePayment: storefront.ensurePayment,
    gachaEnabled,
  };
}
