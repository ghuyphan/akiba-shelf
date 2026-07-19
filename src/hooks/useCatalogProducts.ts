import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicProducts,
  type PublicProductSort,
} from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import type { Product } from "../types/catalog";

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

      if (!navigator.onLine) {
        let filtered = [...initialProducts];

        if (query.category && query.category !== "All") {
          filtered = filtered.filter((p) => p.category === query.category);
        }

        const searchTerm = query.search.trim().toLowerCase();
        if (searchTerm) {
          filtered = filtered.filter((p) =>
            [p.name, p.item_code, p.collection, p.description].some((val) =>
              val?.toLowerCase().includes(searchTerm)
            )
          );
        }

        if (query.sort === "price-asc") {
          filtered.sort((a, b) => (a.effective_price_vnd ?? a.price_vnd) - (b.effective_price_vnd ?? b.price_vnd));
        } else if (query.sort === "price-desc") {
          filtered.sort((a, b) => (b.effective_price_vnd ?? b.price_vnd) - (a.effective_price_vnd ?? a.price_vnd));
        } else if (query.sort === "quantity") {
          filtered.sort((a, b) => b.quantity_available - a.quantity_available);
        } else if (query.sort === "name") {
          filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else {
          filtered.sort((a, b) => {
            if (a.featured !== b.featured) {
              return a.featured ? -1 : 1;
            }
            return a.sort_order - b.sort_order;
          });
        }

        const pageProducts = filtered.slice(offset, offset + pageSize);
        const hasMoreProducts = offset + pageSize < filtered.length;

        if (requestId !== requestIdRef.current) return;

        const currentIds = new Set(
          append ? productsRef.current.map((product) => product.id) : [],
        );
        const nextProducts = append
          ? [
              ...productsRef.current,
              ...pageProducts.filter((product) => !currentIds.has(product.id)),
            ]
          : pageProducts;

        productsRef.current = nextProducts;
        setProducts(nextProducts);
        setHasMore(hasMoreProducts);
        onProductsLoaded(pageProducts);

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
          setError(getErrorMessage(requestError, "Could not load catalog."));
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
