import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useToast } from "../../components/ui/ToastProvider";
import { getAdminCatalogData } from "../../lib/api/catalog";
import {
  defaultBooth,
  defaultPayment,
  defaultPromotion,
} from "../../lib/constants";
import {
  getErrorMessage,
  isSessionNoise,
  isTransportError,
} from "../../lib/errors";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import {
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "../../lib/offline/offline";
import { subscribeToCatalogChanges } from "../../lib/realtime";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
  PromotionSettings,
} from "../../types/catalog";
import { getStoredBoothTheme } from "../../utils/themeStorage";

const localWriteQuietMs = 2_000;

function getInitialBooth() {
  const activeShopId = localStorage.getItem("akiba-active-shop")?.trim();
  return activeShopId
    ? getStoredBoothTheme(`id:${activeShopId}`)
    : defaultBooth;
}

export function useAdminCatalogWorkspace({
  enabled,
  shopId,
}: {
  enabled: boolean;
  shopId: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [booth, setBooth] = useState<BoothSettings>(getInitialBooth);
  const [payment, setPayment] = useState<PaymentSettings>(defaultPayment);
  const [promotion, setPromotion] =
    useState<PromotionSettings>(defaultPromotion);
  const [loadedShopId, setLoadedShopId] = useState("");
  const requestRef = useRef(0);
  const activeShopIdRef = useRef(shopId);
  const loadRef = useRef<{ shopId: string; promise: Promise<void> } | null>(
    null,
  );
  const lastLocalWriteRef = useRef(0);
  const toast = useToast();
  const { t } = usePlatformI18n();
  const tRef = useRef(t);

  useLayoutEffect(() => {
    activeShopIdRef.current = shopId;
    requestRef.current += 1;
    loadRef.current = null;
  }, [shopId]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    setProducts([]);
    setCatalogLoading(false);
    setSelectedProduct(undefined);
    setBooth(shopId ? getStoredBoothTheme(`id:${shopId}`) : defaultBooth);
    setPayment(defaultPayment);
    setPromotion(defaultPromotion);
    setLoadedShopId("");
  }, [shopId]);

  const markLocalWrite = useCallback(() => {
    lastLocalWriteRef.current = Date.now();
  }, []);

  const reload = useCallback(() => {
    if (loadRef.current?.shopId === shopId) return loadRef.current.promise;
    const requestId = ++requestRef.current;
    const requestedShopId = shopId;
    setCatalogLoading(true);
    const promise = getAdminCatalogData(requestedShopId)
      .then((catalog) => {
        if (
          requestId !== requestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        setBooth(catalog.booth);
        setPayment(catalog.payment);
        setPromotion(catalog.promotion);
        setProducts(catalog.products);
        saveCatalogSnapshot(catalog, requestedShopId, {
          replaceProducts: true,
          complete: true,
        });
        setLoadedShopId(requestedShopId);
        setSelectedProduct((current) => {
          if (!current) return undefined;
          return catalog.products.find((product) => product.id === current.id);
        });
      })
      .catch((error) => {
        if (
          requestId !== requestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        if (navigator.onLine && !isTransportError(error)) throw error;
        const snapshot = loadCatalogSnapshot(requestedShopId);
        if (!snapshot?.complete || !snapshot.payment || !snapshot.promotion)
          throw error;
        if (
          requestId !== requestRef.current ||
          requestedShopId !== activeShopIdRef.current
        )
          return;
        setBooth(snapshot.booth);
        setPayment(snapshot.payment);
        setPromotion(snapshot.promotion);
        setProducts(snapshot.products);
        setLoadedShopId(requestedShopId);
      })
      .finally(() => {
        if (requestId === requestRef.current) setCatalogLoading(false);
        if (loadRef.current?.promise === promise) loadRef.current = null;
      });
    loadRef.current = { shopId: requestedShopId, promise };
    return promise;
  }, [shopId]);

  useEffect(() => {
    if (!enabled || !shopId) return undefined;
    let reloadTimer: number | undefined;
    const unsubscribe = subscribeToCatalogChanges(shopId, {
      onChange: () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          if (Date.now() - lastLocalWriteRef.current < localWriteQuietMs)
            return;
          reload().catch((error) => {
            if (isSessionNoise(error)) return;
            toast.error(
              tRef.current(
                getErrorMessage(error, "Could not refresh admin data."),
              ),
              tRef.current("Refresh failed"),
            );
          });
        }, 150);
      },
      onStatus: () => undefined,
    });
    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [enabled, reload, shopId, toast]);

  return {
    booth,
    catalogLoading,
    loadedShopId,
    markLocalWrite,
    payment,
    products,
    promotion,
    reload,
    selectedProduct,
    setBooth,
    setPayment,
    setProducts,
    setPromotion,
    setSelectedProduct,
  };
}
