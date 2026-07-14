import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultBooth, defaultPayment } from "../lib/constants";
import {
  getPublicBoothSettings,
  getPublicFeaturedProducts,
  getPublicPaymentSettings,
  getPublicProductCategories,
  getPublicProducts,
  getPublicProductsByIds,
  type PublicProductSort,
} from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../lib/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";

const PRODUCT_PAGE_SIZE = 24;

type CatalogQuery = {
  category: string;
  search: string;
  sort: PublicProductSort;
};

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
  const [products, setProducts] = useState<Product[]>(
    () => cached?.products ?? [],
  );
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(
    () => cached?.products.filter((product) => product.featured) ?? [],
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [booth, setBooth] = useState<BoothSettings>(
    () => cached?.booth ?? defaultBooth,
  );
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const boothRef = useRef(booth);
  const productsRef = useRef(products);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);
  const productRequestRef = useRef(0);
  const shopIdentityRef = useRef(0);
  const queryKey = `${query.category}\u0000${query.search}\u0000${query.sort}`;
  const previousQueryKeyRef = useRef(queryKey);

  useEffect(() => {
    boothRef.current = booth;
  }, [booth]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    shopIdentityRef.current += 1;
    productRequestRef.current += 1;
    const next = loadCatalogSnapshot(shopId);
    setProducts(next?.products ?? []);
    setFeaturedProducts(
      next?.products.filter((product) => product.featured) ?? [],
    );
    setCategories([]);
    setBooth(next?.booth ?? defaultBooth);
    setPayment(defaultPayment);
    setHasMore(false);
    setLoadError("");
    setIsLoading(true);
    setIsLoadingMore(false);
  }, [paymentEnabled, shopId]);

  const reportError = useCallback((error: unknown) => {
    if (!isSessionNoise(error))
      setLoadError(getErrorMessage(error, "Could not load catalog."));
  }, []);

  const requestProducts = useCallback(
    async (offset: number, pageSize: number, replace: boolean) => {
      if (!shopId) return;
      const requestId = ++productRequestRef.current;
      if (replace) {
        setIsLoading(true);
        setIsLoadingMore(false);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const page = await getPublicProducts(shopId, {
          offset,
          pageSize,
          category: query.category,
          search: query.search,
          sort: query.sort,
        });
        if (requestId !== productRequestRef.current) return;

        const nextProducts = replace
          ? page.products
          : [
              ...productsRef.current,
              ...page.products.filter(
                (product) =>
                  !productsRef.current.some(
                    (current) => current.id === product.id,
                  ),
              ),
            ];
        productsRef.current = nextProducts;
        setProducts(nextProducts);
        setHasMore(page.hasMore);
        onProductsLoaded(page.products);
        saveCatalogSnapshot(
          {
            products: nextProducts,
            booth: boothRef.current,
            payment: defaultPayment,
          },
          shopId,
        );
        setLoadError("");
      } catch (error) {
        if (requestId === productRequestRef.current) reportError(error);
      } finally {
        if (requestId === productRequestRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [onProductsLoaded, query.category, query.search, query.sort, reportError, shopId],
  );

  const loadFirstPage = useCallback(async () => {
    if (previousQueryKeyRef.current !== queryKey) {
      previousQueryKeyRef.current = queryKey;
      productsRef.current = [];
      setProducts([]);
      setHasMore(false);
    }
    await requestProducts(0, PRODUCT_PAGE_SIZE, true);
  }, [queryKey, requestProducts]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isLoadingMore) return;
    await requestProducts(productsRef.current.length, PRODUCT_PAGE_SIZE, false);
  }, [hasMore, isLoading, isLoadingMore, requestProducts]);

  const refreshVisibleProducts = useCallback(async () => {
    await requestProducts(
      0,
      Math.max(PRODUCT_PAGE_SIZE, productsRef.current.length),
      true,
    );
  }, [requestProducts]);

  const loadBooth = useCallback(async () => {
    if (!shopId) return;
    const identity = shopIdentityRef.current;
    const nextBooth = await getPublicBoothSettings(shopId);
    if (identity !== shopIdentityRef.current) return;
    boothRef.current = nextBooth;
    setBooth(nextBooth);
    saveCatalogSnapshot(
      {
        products: productsRef.current,
        booth: nextBooth,
        payment: defaultPayment,
      },
      shopId,
    );
    setLoadError("");
  }, [shopId]);

  const loadFeatured = useCallback(async () => {
    if (!shopId) return;
    const identity = shopIdentityRef.current;
    const nextFeatured = await getPublicFeaturedProducts(shopId);
    if (identity === shopIdentityRef.current) setFeaturedProducts(nextFeatured);
  }, [shopId]);

  const loadCategories = useCallback(async () => {
    if (!shopId) return;
    const identity = shopIdentityRef.current;
    const nextCategories = await getPublicProductCategories(shopId);
    if (identity === shopIdentityRef.current) setCategories(nextCategories);
  }, [shopId]);

  const loadCartProducts = useCallback(async () => {
    if (!shopId || cartProductIds.length === 0) return;
    const requestedIds = [...cartProductIds];
    const nextProducts = await getPublicProductsByIds(shopId, requestedIds);
    onProductsLoaded(nextProducts, requestedIds);
  }, [cartProductIds, onProductsLoaded, shopId]);

  const loadPayment = useCallback(() => {
    if (!paymentEnabled) return Promise.resolve(defaultPayment);
    if (paymentRequestRef.current) return paymentRequestRef.current;
    if (!shopId) return Promise.reject(new Error("Shop is not loaded."));
    const identity = shopIdentityRef.current;
    const request = getPublicPaymentSettings(shopId)
      .then((nextPayment) => {
        if (identity === shopIdentityRef.current) setPayment(nextPayment);
        return nextPayment;
      })
      .finally(() => {
        paymentRequestRef.current = null;
      });
    paymentRequestRef.current = request;
    return request;
  }, [paymentEnabled, shopId]);

  const reloadSupportingData = useCallback(async () => {
    if (!shopId) return;
    const requests: Promise<unknown>[] = [
      loadBooth(),
      loadFeatured(),
      loadCategories(),
    ];
    if (paymentEnabled) requests.push(loadPayment());
    const results = await Promise.allSettled(requests);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejected) reportError(rejected.reason);
  }, [
    loadBooth,
    loadCategories,
    loadFeatured,
    loadPayment,
    paymentEnabled,
    reportError,
    shopId,
  ]);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadFirstPage(),
      reloadSupportingData(),
      loadCartProducts(),
    ]);
  }, [loadCartProducts, loadFirstPage, reloadSupportingData]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    void reloadSupportingData();
  }, [reloadSupportingData]);

  useEffect(() => {
    void loadCartProducts().catch(reportError);
  }, [loadCartProducts, reportError]);

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
                    loadFeatured(),
                    loadCategories(),
                    loadCartProducts(),
                  ])
                : table === "booth_settings"
                  ? loadBooth()
                  : loadPayment();
            void request.catch(reportError);
          }, 150),
        );
      },
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, [
    loadBooth,
    loadCartProducts,
    loadCategories,
    loadFeatured,
    loadPayment,
    refreshVisibleProducts,
    reportError,
    shopId,
  ]);

  return {
    products,
    featuredProducts,
    categories,
    booth,
    payment,
    hasMore,
    loadError,
    setLoadError,
    isLoading,
    isLoadingMore,
    loadMore,
    reloadAll,
    ensurePayment: loadPayment,
  };
}
