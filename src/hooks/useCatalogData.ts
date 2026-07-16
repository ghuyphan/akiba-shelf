import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultBooth } from "../lib/constants";
import { getPublicProductsByIds } from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../lib/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import type { Product } from "../types/catalog";
import {
  useCatalogProducts,
  type CatalogQuery,
} from "./useCatalogProducts";
import { useStorefrontBootstrap } from "./useStorefrontBootstrap";

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
  const [rewardProducts, setRewardProducts] = useState<Product[]>([]);

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
  );
  const reloadProducts = productCatalog.reload;
  const refreshVisibleProducts = productCatalog.refreshVisible;
  const reloadStorefront = storefront.reload;
  const refreshProductMetadata = storefront.refreshProductMetadata;
  const refreshBooth = storefront.refreshBooth;
  const refreshPayment = storefront.refreshPayment;
  const refreshPromotion = storefront.refreshPromotion;

  const loadCartProducts = useCallback(async () => {
    if (!shopId || cartProductIds.length === 0) {
      setCartError("");
      return;
    }
    try {
      const requestedIds = [...cartProductIds];
      const nextProducts = await getPublicProductsByIds(shopId, requestedIds);
      onProductsLoaded(nextProducts, requestedIds);
      setCartError("");
    } catch (error) {
      if (!isSessionNoise(error))
        setCartError(getErrorMessage(error, "Could not refresh your cart."));
    }
  }, [cartProductIds, onProductsLoaded, shopId]);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadProducts(),
      reloadStorefront(),
      loadCartProducts(),
    ]);
  }, [loadCartProducts, reloadProducts, reloadStorefront]);

  useEffect(() => {
    void loadCartProducts();
  }, [loadCartProducts]);

  useEffect(() => {
    if (!shopId || storefront.promotion.reward_product_ids.length === 0) {
      setRewardProducts([]);
      return;
    }
    let active = true;
    void getPublicProductsByIds(shopId, storefront.promotion.reward_product_ids)
      .then((next) => { if (active) setRewardProducts(next); })
      .catch(() => { if (active) setRewardProducts([]); });
    return () => { active = false; };
  }, [shopId, storefront.promotion.reward_product_ids]);

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
      },
      shopId,
    );
  }, [
    productCatalog.isInitialLoading,
    productCatalog.isLoading,
    productCatalog.products,
    shopId,
    storefront.booth,
    storefront.isInitialLoading,
  ]);

  useEffect(() => {
    const timers = new Map<string, number>();
    if (!shopId) return;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: (table) => {
        window.clearTimeout(timers.get(table));
        timers.set(
          table,
          window.setTimeout(() => {
            const request =
              table === "products"
                ? Promise.all([
                    refreshVisibleProducts(),
                    refreshProductMetadata(),
                    loadCartProducts(),
                  ])
                : table === "booth_settings"
                  ? refreshBooth()
                  : table === "payment_settings"
                    ? refreshPayment()
                    : refreshPromotion();
            void request;
          }, 150),
        );
      },
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, [
    loadCartProducts,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    refreshProductMetadata,
    refreshVisibleProducts,
    shopId,
  ]);

  return {
    products: productCatalog.products,
    featuredProducts: storefront.featuredProducts,
    categories: storefront.categories,
    booth: storefront.booth,
    payment: storefront.payment,
    promotion: storefront.promotion,
    rewardProducts,
    hasMore: productCatalog.hasMore,
    loadError: productCatalog.error || storefront.error || cartError,
    isLoading: productCatalog.isLoading,
    isInitialLoading:
      productCatalog.isInitialLoading || storefront.isInitialLoading,
    isLoadingMore: productCatalog.isLoadingMore,
    loadMore: productCatalog.loadMore,
    reloadAll,
    ensurePayment: storefront.ensurePayment,
  };
}
