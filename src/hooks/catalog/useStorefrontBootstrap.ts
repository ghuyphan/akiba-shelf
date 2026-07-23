import { useCallback, useEffect, useRef, useState } from "react";
import { defaultPayment, defaultPromotion } from "../../lib/constants";
import { getStorefrontBootstrap } from "../../lib/api/catalog";
import { getPublicGachaEnabled } from "../../lib/api/gachaPublic";
import {
  getPublicBoothSettings,
  getPublicPaymentSettings,
  getPublicPromotionSettings,
} from "../../lib/api/settings";
import {
  getPublicFeaturedProducts,
  getPublicProductCategories,
} from "../../lib/api/products";
import { getErrorMessage, isSessionNoise } from "../../lib/errors";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
  PromotionSettings,
  StorefrontBootstrap,
} from "../../types/catalog";

type BootstrapPhase = "initial-loading" | "ready";
type InitialProductPage = {
  shopId: string;
  products: Product[];
  hasMore: boolean;
};

type BootstrapLoadState = {
  phase: BootstrapPhase;
  productPage: InitialProductPage | null;
};

const EMPTY_CATEGORIES: string[] = [];
const INITIAL_LOAD_STATE: BootstrapLoadState = {
  phase: "initial-loading",
  productPage: null,
};

export function useStorefrontBootstrap(
  shopId: string | undefined,
  shopSlug: string,
  paymentEnabled: boolean,
  initialBooth: BoothSettings,
  initialProducts: Product[],
  initialPayment?: PaymentSettings,
  initialPromotion: PromotionSettings = defaultPromotion,
  initialCategories: string[] = EMPTY_CATEGORIES,
  initialBootstrap: StorefrontBootstrap | null | undefined = undefined,
) {
  const [booth, setBooth] = useState(initialBooth);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>(
    initialProducts.filter((product) => product.featured),
  );
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [payment, setPayment] = useState<PaymentSettings>(
    initialPayment ?? defaultPayment,
  );
  const [paymentResolved, setPaymentResolved] = useState(
    initialPayment !== undefined,
  );
  const [promotion, setPromotion] =
    useState<PromotionSettings>(initialPromotion);
  const [loadState, setLoadState] =
    useState<BootstrapLoadState>(INITIAL_LOAD_STATE);
  const [error, setError] = useState("");
  const [gachaEnabled, setGachaEnabled] = useState<boolean | null>(null);
  const shopIdentityRef = useRef(0);
  const consumedInitialBootstrapRef = useRef(false);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);
  const paymentLoadedRef = useRef(false);
  const paymentRef = useRef(initialPayment ?? defaultPayment);

  paymentRef.current = payment;

  useEffect(() => {
    shopIdentityRef.current += 1;
    consumedInitialBootstrapRef.current = false;
    paymentRequestRef.current = null;
    paymentLoadedRef.current = false;
    setBooth(initialBooth);
    setFeaturedProducts(initialProducts.filter((product) => product.featured));
    setCategories(initialCategories);
    setPayment(initialPayment ?? defaultPayment);
    setPaymentResolved(initialPayment !== undefined);
    setPromotion(initialPromotion);
    setLoadState(INITIAL_LOAD_STATE);
    setGachaEnabled(null);
    setError("");
  }, [
    initialBooth,
    initialCategories,
    initialPayment,
    initialProducts,
    initialPromotion,
    shopId,
    shopSlug,
  ]);

  const captureError = useCallback((requestError: unknown) => {
    if (!isSessionNoise(requestError))
      setError(getErrorMessage(requestError, "Could not load catalog."));
  }, []);

  const loadBooth = useCallback(async () => {
    if (!shopId) return;
    if (!navigator.onLine) {
      setBooth(initialBooth);
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const nextBooth = await getPublicBoothSettings(shopId);
      if (identity === shopIdentityRef.current) setBooth(nextBooth);
    } catch {
      if (identity === shopIdentityRef.current) setBooth(initialBooth);
    }
  }, [shopId, initialBooth]);

  const loadFeatured = useCallback(async () => {
    if (!shopId) return;
    if (!navigator.onLine) {
      setFeaturedProducts(
        initialProducts.filter((product) => product.featured),
      );
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const nextFeatured = await getPublicFeaturedProducts(shopId);
      if (identity === shopIdentityRef.current)
        setFeaturedProducts(nextFeatured);
    } catch {
      if (identity === shopIdentityRef.current)
        setFeaturedProducts(
          initialProducts.filter((product) => product.featured),
        );
    }
  }, [shopId, initialProducts]);

  const loadCategories = useCallback(async () => {
    if (!shopId) return;
    if (!navigator.onLine) {
      setCategories(initialCategories);
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const nextCategories = await getPublicProductCategories(shopId);
      if (identity === shopIdentityRef.current) setCategories(nextCategories);
    } catch {
      if (identity === shopIdentityRef.current)
        setCategories(initialCategories);
    }
  }, [shopId, initialCategories]);

  const loadPromotion = useCallback(async () => {
    if (!shopId) return;
    if (!navigator.onLine) {
      setPromotion(initialPromotion);
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const nextPromotion = await getPublicPromotionSettings(shopId);
      if (identity === shopIdentityRef.current) setPromotion(nextPromotion);
    } catch {
      if (identity === shopIdentityRef.current) setPromotion(initialPromotion);
    }
  }, [shopId, initialPromotion]);

  const loadGacha = useCallback(async () => {
    if (!shopId || !navigator.onLine) return;
    try {
      setGachaEnabled(await getPublicGachaEnabled(shopId));
    } catch {
      setGachaEnabled(null);
    }
  }, [shopId]);

  const ensurePayment = useCallback(() => {
    if (!paymentEnabled) return Promise.resolve(defaultPayment);
    if (paymentRequestRef.current) return paymentRequestRef.current;
    if (paymentLoadedRef.current) return Promise.resolve(paymentRef.current);
    if (!shopId) return Promise.reject(new Error("Shop is not loaded."));
    if (!navigator.onLine && initialPayment)
      return Promise.resolve(initialPayment);
    const identity = shopIdentityRef.current;
    const request = getPublicPaymentSettings(shopId)
      .then((nextPayment) => {
        if (identity === shopIdentityRef.current) {
          paymentLoadedRef.current = true;
          paymentRef.current = nextPayment;
          setPayment(nextPayment);
          setPaymentResolved(true);
        }
        return nextPayment;
      })
      .catch((err) => {
        if (identity === shopIdentityRef.current && initialPayment) {
          paymentLoadedRef.current = true;
          paymentRef.current = initialPayment;
          setPayment(initialPayment);
          setPaymentResolved(true);
          return initialPayment;
        }
        throw err;
      })
      .finally(() => {
        paymentRequestRef.current = null;
      });
    paymentRequestRef.current = request;
    return request;
  }, [initialPayment, paymentEnabled, shopId]);

  const settleRequests = useCallback(
    async (requests: Promise<unknown>[]) => {
      const results = await Promise.allSettled(requests);
      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (rejected) captureError(rejected.reason);
      else setError("");
    },
    [captureError],
  );

  const reload = useCallback(async () => {
    if (!shopId) return;
    if (initialBootstrap === undefined) return;
    const applyBootstrap = (bootstrap: StorefrontBootstrap) => {
      setBooth(bootstrap.booth);
      setFeaturedProducts(
        bootstrap.products.filter((product) => product.featured),
      );
      setCategories(bootstrap.categories);
      setPromotion(bootstrap.promotion);
      setGachaEnabled(bootstrap.gachaEnabled);
      setError("");
      return {
        shopId: bootstrap.catalogShopId,
        products: bootstrap.products,
        hasMore: bootstrap.hasMore,
      } satisfies InitialProductPage;
    };
    if (!consumedInitialBootstrapRef.current && initialBootstrap) {
      consumedInitialBootstrapRef.current = true;
      const productPage =
        initialBootstrap.catalogShopId === shopId
          ? applyBootstrap(initialBootstrap)
          : null;
      setLoadState({ phase: "ready", productPage });
      return;
    }
    if (!consumedInitialBootstrapRef.current && initialBootstrap === null) {
      consumedInitialBootstrapRef.current = true;
      await settleRequests([
        loadBooth(),
        loadFeatured(),
        loadCategories(),
        loadPromotion(),
        loadGacha(),
      ]);
      setLoadState({ phase: "ready", productPage: null });
      return;
    }
    if (!navigator.onLine) {
      setLoadState({
        phase: "ready",
        productPage: { shopId, products: initialProducts, hasMore: false },
      });
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const bootstrap = await getStorefrontBootstrap(shopSlug);
      if (identity !== shopIdentityRef.current) return;
      setLoadState({
        phase: "ready",
        productPage: applyBootstrap(bootstrap),
      });
    } catch {
      if (identity !== shopIdentityRef.current) return;
      await settleRequests([
        loadBooth(),
        loadFeatured(),
        loadCategories(),
        loadPromotion(),
        loadGacha(),
      ]);
      setLoadState({ phase: "ready", productPage: null });
    }
  }, [
    initialProducts,
    initialBootstrap,
    loadBooth,
    loadCategories,
    loadFeatured,
    loadGacha,
    loadPromotion,
    settleRequests,
    shopId,
    shopSlug,
  ]);

  const refreshProductMetadata = useCallback(async () => {
    await settleRequests([loadFeatured(), loadCategories()]);
  }, [loadCategories, loadFeatured, settleRequests]);

  const refreshBooth = useCallback(async () => {
    await settleRequests([loadBooth()]);
  }, [loadBooth, settleRequests]);

  const refreshPayment = useCallback(async () => {
    paymentLoadedRef.current = false;
    await settleRequests([ensurePayment()]);
  }, [ensurePayment, settleRequests]);

  const refreshPromotion = useCallback(async () => {
    await settleRequests([loadPromotion()]);
  }, [loadPromotion, settleRequests]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    booth,
    featuredProducts,
    categories,
    payment,
    paymentResolved,
    promotion,
    initialProductPage: loadState.productPage,
    gachaEnabled,
    phase: loadState.phase,
    error,
    isInitialLoading: loadState.phase === "initial-loading",
    reload,
    refreshProductMetadata,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    ensurePayment,
  };
}
