import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultPayment } from "../lib/constants";
import { getCatalogCoreData, getPublicBoothSettings, getPublicPaymentSettings, getPublicProducts } from "../lib/api";
import { getErrorMessage, isSessionNoise } from "../lib/errors";
import { loadCatalogSnapshot, saveCatalogSnapshot } from "../lib/offline";
import { subscribeToCatalogChanges } from "../lib/realtime";
import { getStoredBoothTheme } from "../lib/theme";
import type { BoothSettings, PaymentSettings, Product } from "../types/catalog";

export function useCatalogData(onProductsLoaded: (products: Product[]) => void) {
  const cached = useMemo(() => loadCatalogSnapshot(), []);
  const [products, setProducts] = useState<Product[]>(() => cached?.products ?? []);
  const [booth, setBooth] = useState<BoothSettings>(() => cached?.booth ?? getStoredBoothTheme());
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [loadError, setLoadError] = useState("");
  const boothRef = useRef(booth);
  const productsRef = useRef(products);
  const paymentRequestRef = useRef<Promise<PaymentSettings> | null>(null);

  useEffect(() => { boothRef.current = booth; }, [booth]);
  useEffect(() => { productsRef.current = products; }, [products]);

  const reportError = useCallback((error: unknown) => {
    if (!isSessionNoise(error)) setLoadError(getErrorMessage(error, "Could not load catalog."));
  }, []);

  const loadProducts = useCallback(async () => {
    const nextProducts = await getPublicProducts();
    productsRef.current = nextProducts;
    setProducts(nextProducts);
    onProductsLoaded(nextProducts);
    saveCatalogSnapshot({ products: nextProducts, booth: boothRef.current, payment: defaultPayment });
    setLoadError("");
  }, [onProductsLoaded]);

  const loadBooth = useCallback(async () => {
    const nextBooth = await getPublicBoothSettings();
    boothRef.current = nextBooth;
    setBooth(nextBooth);
    saveCatalogSnapshot({ products: productsRef.current, booth: nextBooth, payment: defaultPayment });
    setLoadError("");
  }, []);

  const loadPayment = useCallback(() => {
    if (paymentRequestRef.current) return paymentRequestRef.current;
    const request = getPublicPaymentSettings()
      .then((nextPayment) => {
        setPayment(nextPayment);
        return nextPayment;
      })
      .finally(() => { paymentRequestRef.current = null; });
    paymentRequestRef.current = request;
    return request;
  }, []);

  const reloadAll = useCallback(async () => {
    const paymentRequest = loadPayment().catch(() => undefined);
    try {
      const data = await getCatalogCoreData();
      boothRef.current = data.booth;
      productsRef.current = data.products;
      setProducts(data.products);
      setBooth(data.booth);
      onProductsLoaded(data.products);
      saveCatalogSnapshot({ ...data, payment: defaultPayment });
      setLoadError("");
      await paymentRequest;
    } catch (error) {
      reportError(error);
    }
  }, [loadPayment, onProductsLoaded, reportError]);

  useEffect(() => { void reloadAll(); }, [reloadAll]);

  useEffect(() => {
    const timers = new Map<string, number>();
    const unsubscribe = subscribeToCatalogChanges({
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
  }, [loadBooth, loadPayment, loadProducts, reportError]);

  return { products, booth, payment, loadError, setLoadError, reloadAll, ensurePayment: loadPayment };
}
