import { useCallback, useEffect, useRef, useState } from "react";
import { getStorefrontBootstrapFast } from "../../lib/api/storefrontBootstrap";
import { getUserFacingErrorMessage } from "../../lib/errors";
import { loadShopSnapshot, saveShopSnapshot } from "../../lib/offline/offline";
import type { Shop, StorefrontBootstrap } from "../../types/catalog";

export function useStorefrontShop({
  shopSlug,
  connectError,
  onOnline,
}: {
  shopSlug: string;
  connectError: string;
  onOnline: () => void;
}) {
  const [initialShop] = useState(() => loadShopSnapshot(shopSlug));
  const connectErrorRef = useRef(connectError);
  const onOnlineRef = useRef(onOnline);
  const loadRequestRef = useRef(0);
  const [shop, setShop] = useState<Shop | null | undefined>(
    () => initialShop ?? undefined,
  );
  const [initialBootstrap, setInitialBootstrap] = useState<
    StorefrontBootstrap | null | undefined
  >(undefined);
  const [catalogShopId, setCatalogShopId] = useState<string | undefined>(
    () => initialShop?.catalog_source_shop_id ?? initialShop?.id,
  );
  const [shopLoadError, setShopLoadError] = useState("");

  useEffect(() => {
    connectErrorRef.current = connectError;
    onOnlineRef.current = onOnline;
  }, [connectError, onOnline]);

  const loadShop = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const cachedShop = loadShopSnapshot(shopSlug);
    setShop(cachedShop ?? undefined);
    setInitialBootstrap(undefined);
    setCatalogShopId(
      cachedShop?.catalog_source_shop_id ?? cachedShop?.id,
    );
    setShopLoadError("");
    try {
      const bootstrap = await getStorefrontBootstrapFast(shopSlug);
      if (requestId !== loadRequestRef.current) return;
      setInitialBootstrap(bootstrap);
      setCatalogShopId(bootstrap.catalogShopId);
      setShop(bootstrap.shop);
      saveShopSnapshot(bootstrap.shop, shopSlug);
      onOnlineRef.current();
    } catch (bootstrapError) {
      if (requestId !== loadRequestRef.current) return;
      setInitialBootstrap(null);
      try {
        // Keep mixed-version deployments available until every region has the RPC.
        const { getPublicShop } = await import("../../lib/api/shops");
        const legacyShop = await getPublicShop(shopSlug);
        if (requestId !== loadRequestRef.current) return;
        if (!legacyShop) throw bootstrapError;
        setCatalogShopId(legacyShop.catalog_source_shop_id ?? legacyShop.id);
        setShop(legacyShop);
        saveShopSnapshot(legacyShop, shopSlug);
        onOnlineRef.current();
      } catch (fallbackError) {
        if (requestId !== loadRequestRef.current) return;
        setCatalogShopId(cachedShop?.catalog_source_shop_id ?? cachedShop?.id);
        if (!cachedShop) setShop(null);
        setShopLoadError(
          getUserFacingErrorMessage(fallbackError, connectErrorRef.current),
        );
      }
    }
  }, [shopSlug]);

  useEffect(() => {
    void loadShop();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadShop]);

  return {
    shop,
    initialBootstrap,
    catalogShopId,
    shopLoadError,
    loadShop,
  };
}
