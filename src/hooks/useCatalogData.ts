import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultPayment } from "../lib/constants";
import {
  getCatalogCoreData,
  getPublicBoothSettings,
  getPublicPaymentSettings,
  getPublicProducts,
} from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../lib/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { defaultBooth } from "../lib/constants";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";

export function useCatalogData(
  shopId: string | undefined,
  onProductsLoaded: (products: Product[]) => void,
  paymentEnabled = true,
) {
  const cached = useMemo(() => loadCatalogSnapshot(shopId), [shopId]);
  const [products, setProducts] = useState<Product[]>(
    () => cached?.products ?? [],
  );
  const [booth, setBooth] = useState<BoothSettings>(
    () => cached?.booth ?? defaultBooth,
  );
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const boothRef = useRef(booth);
  const productsRef = useRef(products);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);
  const requestIdentityRef = useRef(0);

  useEffect(() => {
    boothRef.current = booth;
  }, [booth]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);
  useEffect(() => {
    requestIdentityRef.current += 1;
    const next = loadCatalogSnapshot(shopId);
    setProducts(next?.products ?? []);
    setBooth(next?.booth ?? defaultBooth);
    setPayment(defaultPayment);
    setLoadError("");
    setIsLoading(true);
  }, [paymentEnabled, shopId]);

  const reportError = useCallback((error: unknown) => {
    if (!isSessionNoise(error))
      setLoadError(getErrorMessage(error, "Could not load catalog."));
  }, []);

  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    const identity = requestIdentityRef.current;
    const nextProducts = await getPublicProducts(shopId);
    if (identity !== requestIdentityRef.current) return;
    productsRef.current = nextProducts;
    setProducts(nextProducts);
    onProductsLoaded(nextProducts);
    saveCatalogSnapshot(
      {
        products: nextProducts,
        booth: boothRef.current,
        payment: defaultPayment,
      },
      shopId,
    );
    setLoadError("");
  }, [onProductsLoaded, shopId]);

  const loadBooth = useCallback(async () => {
    if (!shopId) return;
    const identity = requestIdentityRef.current;
    const nextBooth = await getPublicBoothSettings(shopId);
    if (identity !== requestIdentityRef.current) return;
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

  const loadPayment = useCallback(() => {
    if (!paymentEnabled) return Promise.resolve(defaultPayment);
    if (paymentRequestRef.current) return paymentRequestRef.current;
    if (!shopId) return Promise.reject(new Error("Shop is not loaded."));
    const identity = requestIdentityRef.current;
    const request = getPublicPaymentSettings(shopId)
      .then((nextPayment) => {
        if (identity !== requestIdentityRef.current) return nextPayment;
        setPayment(nextPayment);
        return nextPayment;
      })
      .finally(() => {
        paymentRequestRef.current = null;
      });
    paymentRequestRef.current = request;
    return request;
  }, [paymentEnabled, shopId]);

  const reloadAll = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    const identity = requestIdentityRef.current;
    const paymentRequest = paymentEnabled
      ? loadPayment().catch(() => undefined)
      : Promise.resolve(undefined);
    try {
      const data = await getCatalogCoreData(shopId);
      if (identity !== requestIdentityRef.current) return;
      boothRef.current = data.booth;
      productsRef.current = data.products;
      setProducts(data.products);
      setBooth(data.booth);
      onProductsLoaded(data.products);
      saveCatalogSnapshot({ ...data, payment: defaultPayment }, shopId);
      setLoadError("");
      await paymentRequest;
    } catch (error) {
      if (identity === requestIdentityRef.current) reportError(error);
    } finally {
      if (identity === requestIdentityRef.current) setIsLoading(false);
    }
  }, [loadPayment, onProductsLoaded, paymentEnabled, reportError, shopId]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

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
                ? loadProducts()
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
  }, [loadBooth, loadPayment, loadProducts, reportError, shopId]);

  return {
    products,
    booth,
    payment,
    loadError,
    setLoadError,
    isLoading,
    reloadAll,
    ensurePayment: loadPayment,
  };
}
