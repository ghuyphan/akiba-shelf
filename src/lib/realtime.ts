import { supabase } from "./supabase";

const CATALOG_TABLES = ["products", "booth_settings", "payment_settings", "promotions", "promotion_products"] as const;

type CatalogTable = (typeof CATALOG_TABLES)[number];

type CatalogChangeHandlers = {
  onChange: (table: CatalogTable) => void;
  onStatus?: (status: string, error?: unknown) => void;
};

export function subscribeToCatalogChanges(shopId: string, { onChange, onStatus }: CatalogChangeHandlers) {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = CATALOG_TABLES.reduce(
    (currentChannel, table) =>
      currentChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `shop_id=eq.${shopId}`,
        },
        () => onChange(table),
      ),
    client.channel(`shop-${shopId}-catalog-db-changes`),
  );

  channel.subscribe((status, error) => {
    onStatus?.(status, error);
  });

  return () => {
    void client.removeChannel(channel);
  };
}
