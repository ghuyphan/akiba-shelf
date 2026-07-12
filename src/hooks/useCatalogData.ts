import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultPayment } from "../lib/constants";
import { getCatalogCoreData, getPublicBoothSettings, getPublicPaymentSettings, getPublicProducts } from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../lib/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { getStoredBoothTheme } from "../lib/theme";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";

export function useCatalogData(shopId: string | undefined, onProductsLoaded: (products: Product[]) => void) {
  const cached = useMemo(() => loadCatalogSnapshot(shopId), [shopId]);
  const [products, setProducts] = useState<Product[]>(() => cached?.products ?? []);
  const [booth, setBooth] = useState<BoothSettings>(() => cached?.booth ?? getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(() => !cached);
  const boothRef = useRef(booth);
  const productsRef = useRef(products);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);

  useEffect(() => { boothRef.current = booth; }, [booth]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => {
    const next = loadCatalogSnapshot(shopId);
    setProducts(next?.products ?? []);
    setBooth(next?.booth ?? getStoredBoothTheme());
    setPayment(defaultPayment);
    setLoadError("");
    setIsLoading(true);
  }, [shopId]);

  const reportError = useCallback((error: unknown) => {
    if (!isSessionNoise(error)) setLoadError(getErrorMessage(error, "Could not load catalog."));
  }, []);

  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    const nextProducts = await getPublicProducts(shopId);
    productsRef.current = nextProducts;
    setProducts(nextProducts);
    onProductsLoaded(nextProducts);
    saveCatalogSnapshot({ products: nextProducts, booth: boothRef.current, payment: defaultPayment }, shopId);
    setLoadError("");
  }, [onProductsLoaded, shopId]);

  const loadBooth = useCallback(async () => {
    if (!shopId) return;
    const nextBooth = await getPublicBoothSettings(shopId);
    boothRef.current = nextBooth;
    setBooth(nextBooth);
    saveCatalogSnapshot({ products: productsRef.current, booth: nextBooth, payment: defaultPayment }, shopId);
    setLoadError("");
  }, [shopId]);

  const loadPayment = useCallback(() => {
    if (paymentRequestRef.current) return paymentRequestRef.current;
    if (!shopId) return Promise.reject(new Error("Shop is not loaded."));
    const request = getPublicPaymentSettings(shopId)
      .then((nextPayment) => {
        setPayment(nextPayment);
        return nextPayment;
      })
      .finally(() => { paymentRequestRef.current = null; });
    paymentRequestRef.current = request;
    return request;
  }, [shopId]);

  const reloadAll = useCallback(async () => {
    setIsLoading(true);
    const paymentRequest = loadPayment().catch(() => undefined);
    try {
      if (!shopId) return;
      const data = await getCatalogCoreData(shopId);
      boothRef.current = data.booth;
      productsRef.current = data.products;
      setProducts(data.products);
      setBooth(data.booth);
      onProductsLoaded(data.products);
      saveCatalogSnapshot({ ...data, payment: defaultPayment }, shopId);
      setLoadError("");
      await paymentRequest;
    } catch (error) {
      reportError(error);
    } finally {
      setIsLoading(false);
    }
  }, [loadPayment, onProductsLoaded, reportError, shopId]);

  useEffect(() => { void reloadAll(); }, [reloadAll]);

  useEffect(() => {
    const timers = new Map<string, number>();
    if (!shopId) return;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: (table) => {
        window.clearTimeout(timers.get(table));
        timers.set(table, window.setTimeout(() => {
          const request = table === "products" ? loadProducts() : table === "booth_settings" ? loadBooth() : loadPayment();
          void request.catch(reportError);
        }, 150));
      },
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      unsubscribe();
    };
  }, [loadBooth, loadPayment, loadProducts, reportError, shopId]);

  return { products, booth, payment, loadError, setLoadError, isLoading, reloadAll, ensurePayment: loadPayment };
}
