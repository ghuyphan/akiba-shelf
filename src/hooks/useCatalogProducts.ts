import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicProducts } from "../lib/api/products";
import type { PublicProductSort } from "../lib/catalogQueries";
import { getErrorMessage, isSessionNoise, isTransportError } from "../lib/errors";
import { queryLocalCatalog } from "../lib/catalogQueries";
import type { Product } from "../types/catalog";
import { loadOfflineEventSession } from "../lib/offline/offlineEvents";

const PRODUCT_PAGE_SIZE = 24;

export type CatalogQuery = {
  category: string;
  search: string;
  sort: PublicProductSort;
};

type ProductCatalogPhase =
  | "initial-loading"
  | "refreshing"
  | "loading-more"
  | "ready";

type ProductsLoadedHandler = (products: Product[]) => void;

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return (
    candidate.name === "AbortError" ||
    (typeof candidate.message === "string" &&
      candidate.message.toLowerCase().includes("aborted"))
  );
}

export function useCatalogProducts(
  shopId: string | undefined,
  query: CatalogQuery,
  initialProducts: Product[],
  onProductsLoaded: ProductsLoadedHandler,
) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] =
    useState<ProductCatalogPhase>("initial-loading");
  const [error, setError] = useState("");
  const productsRef = useRef(products);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const completedInitialLoadRef = useRef(false);
  const queryKey = `${query.category}\u0000${query.search}\u0000${query.sort}`;
  const currentQueryKeyRef = useRef(queryKey);
  const previousQueryKeyRef = useRef(queryKey);
  currentQueryKeyRef.current = queryKey;

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    completedInitialLoadRef.current = false;
    productsRef.current = initialProducts;
    previousQueryKeyRef.current = currentQueryKeyRef.current;
    setProducts(initialProducts);
    setHasMore(false);
    setError("");
    setPhase("initial-loading");
  }, [initialProducts, shopId]);

  const requestProducts = useCallback(
    async ({
      offset,
      pageSize,
      append,
      clearBeforeLoad = false,
    }: {
      offset: number;
      pageSize: number;
      append: boolean;
      clearBeforeLoad?: boolean;
    }) => {
      if (!shopId) return;
      const requestId = ++requestIdRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (append) {
        setPhase("loading-more");
      } else if (completedInitialLoadRef.current) {
        setPhase("refreshing");
      } else {
        setPhase("initial-loading");
      }
      if (clearBeforeLoad) {
        productsRef.current = [];
        setProducts([]);
        setHasMore(false);
      }
      setError("");

      const applyLocalFallback = (sourceProducts = initialProducts) => {
        const page = queryLocalCatalog(
          sourceProducts,
          {
            category: query.category,
            search: query.search,
            sort: query.sort,
          },
          offset,
          pageSize,
        );
        if (requestId !== requestIdRef.current) return;
        const currentIds = new Set(
          append ? productsRef.current.map((product) => product.id) : [],
        );
        const nextProducts = append
          ? [
              ...productsRef.current,
              ...page.products.filter((product) => !currentIds.has(product.id)),
            ]
          : page.products;
        productsRef.current = nextProducts;
        setProducts(nextProducts);
        setHasMore(page.hasMore);
        onProductsLoaded(page.products);
      };

      const eventSession = await loadOfflineEventSession(shopId);
      if (eventSession?.status === "active") {
        applyLocalFallback(
          eventSession.allocations.map((allocation) => ({
            ...allocation.product,
            quantity_available:
              allocation.quantityAllocated - allocation.quantitySold,
            stock_status:
              allocation.quantityAllocated - allocation.quantitySold === 0
                ? "sold_out"
                : allocation.quantityAllocated - allocation.quantitySold <= 5
                  ? "limited"
                  : "in_stock",
          })),
        );
        completedInitialLoadRef.current = true;
        abortRef.current = null;
        setPhase("ready");
        return;
      }

      if (!navigator.onLine) {
        applyLocalFallback();
        completedInitialLoadRef.current = true;
        abortRef.current = null;
        setPhase("ready");
        return;
      }

      try {
        const page = await getPublicProducts(shopId, {
          offset,
          pageSize,
          category: query.category,
          search: query.search,
          sort: query.sort,
          signal: controller.signal,
        });
        if (requestId !== requestIdRef.current) return;

        const currentIds = new Set(
          append ? productsRef.current.map((product) => product.id) : [],
        );
        const nextProducts = append
          ? [
              ...productsRef.current,
              ...page.products.filter((product) => !currentIds.has(product.id)),
            ]
          : page.products;
        productsRef.current = nextProducts;
        setProducts(nextProducts);
        setHasMore(page.hasMore);
        onProductsLoaded(page.products);
      } catch (requestError) {
        if (
          requestId === requestIdRef.current &&
          !isAbortError(requestError) &&
          !isSessionNoise(requestError)
        ) {
          if (isTransportError(requestError) && initialProducts.length > 0) {
            applyLocalFallback();
          } else {
            setError(getErrorMessage(requestError, "Could not load catalog."));
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          completedInitialLoadRef.current = true;
          abortRef.current = null;
          setPhase("ready");
        }
      }
    },
    [initialProducts, onProductsLoaded, query.category, query.search, query.sort, shopId],
  );

  const loadFirstPage = useCallback(async () => {
    const queryChanged = previousQueryKeyRef.current !== queryKey;
    previousQueryKeyRef.current = queryKey;
    await requestProducts({
      offset: 0,
      pageSize: PRODUCT_PAGE_SIZE,
      append: false,
      clearBeforeLoad: queryChanged,
    });
  }, [queryKey, requestProducts]);

  const loadMore = useCallback(async () => {
    if (phase !== "ready" || !hasMore) return;
    await requestProducts({
      offset: productsRef.current.length,
      pageSize: PRODUCT_PAGE_SIZE,
      append: true,
    });
  }, [hasMore, phase, requestProducts]);

  const refreshVisible = useCallback(async () => {
    await requestProducts({
      offset: 0,
      pageSize: Math.max(PRODUCT_PAGE_SIZE, productsRef.current.length),
      append: false,
    });
  }, [requestProducts]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  return {
    products,
    hasMore,
    phase,
    error,
    isInitialLoading: phase === "initial-loading",
    isLoading: phase === "initial-loading" || phase === "refreshing",
    isLoadingMore: phase === "loading-more",
    loadMore,
    reload: loadFirstPage,
    refreshVisible,
  };
}
