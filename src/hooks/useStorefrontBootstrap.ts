import { useCallback, useEffect, useRef, useState } from "react";
import { defaultPayment, defaultPromotion } from "../lib/constants";
import {
  getPublicBoothSettings,
  getPublicFeaturedProducts,
  getPublicPaymentSettings,
  getPublicProductCategories,
  getPublicPromotionSettings,
} from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import type { BoothSettings, PaymentSettings, Product, PromotionSettings } from "../types/catalog";

type BootstrapPhase = "initial-loading" | "ready";
const EMPTY_CATEGORIES: string[] = [];

export function useStorefrontBootstrap(
  shopId: string | undefined,
  paymentEnabled: boolean,
  initialBooth: BoothSettings,
  initialProducts: Product[],
  initialPayment?: PaymentSettings,
  initialPromotion: PromotionSettings = defaultPromotion,
  initialCategories: string[] = EMPTY_CATEGORIES,
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
  const [promotion, setPromotion] = useState<PromotionSettings>(initialPromotion);
  const [phase, setPhase] = useState<BootstrapPhase>("initial-loading");
  const [error, setError] = useState("");
  const shopIdentityRef = useRef(0);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);
  const paymentLoadedRef = useRef(false);
  const paymentRef = useRef(initialPayment ?? defaultPayment);

  paymentRef.current = payment;

  useEffect(() => {
    shopIdentityRef.current += 1;
    paymentRequestRef.current = null;
    paymentLoadedRef.current = false;
    setBooth(initialBooth);
    setFeaturedProducts(
      initialProducts.filter((product) => product.featured),
    );
    setCategories(initialCategories);
    setPayment(initialPayment ?? defaultPayment);
    setPaymentResolved(initialPayment !== undefined);
    setPromotion(initialPromotion);
    setError("");
    setPhase("initial-loading");
  }, [initialBooth, initialCategories, initialPayment, initialProducts, initialPromotion, shopId]);

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
      setFeaturedProducts(initialProducts.filter((product) => product.featured));
      return;
    }
    const identity = shopIdentityRef.current;
    try {
      const nextFeatured = await getPublicFeaturedProducts(shopId);
      if (identity === shopIdentityRef.current)
        setFeaturedProducts(nextFeatured);
    } catch {
      if (identity === shopIdentityRef.current)
        setFeaturedProducts(initialProducts.filter((product) => product.featured));
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
      if (identity === shopIdentityRef.current) setCategories(initialCategories);
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
    await settleRequests([
      loadBooth(),
      loadFeatured(),
      loadCategories(),
      loadPromotion(),
    ]);
    setPhase("ready");
  }, [loadBooth, loadCategories, loadFeatured, loadPromotion, settleRequests, shopId]);

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
    phase,
    error,
    isInitialLoading: phase === "initial-loading",
    reload,
    refreshProductMetadata,
    refreshBooth,
    refreshPayment,
    refreshPromotion,
    ensurePayment,
  };
}
