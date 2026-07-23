import { supabase } from "./supabase";
import { trackClientEvent } from "./observability";

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

  let intentionalClose = false;
  channel.subscribe((status, error) => {
    onStatus?.(status, error);
    if (
      !intentionalClose &&
      (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
    ) {
      trackClientEvent("realtime_disconnect", {
        surface: "storefront",
        status,
      }, "warning");
    }
  });

  return () => {
    intentionalClose = true;
    void client.removeChannel(channel);
  };
}

export function subscribeToAdminOrderChanges(
  shopId: string,
  onChange: () => void,
) {
  const client = supabase;
  if (!client) return () => undefined;

  let intentionalClose = false;
  const channel = client
    .channel("admin-orders-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `shop_id=eq.${shopId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_items",
        filter: `shop_id=eq.${shopId}`,
      },
      onChange,
    )
    .subscribe((status) => {
      if (
        !intentionalClose &&
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
      ) {
        trackClientEvent("realtime_disconnect", {
          surface: "admin_orders",
          status,
        }, "warning");
      }
    });

  return () => {
    intentionalClose = true;
    void client.removeChannel(channel);
  };
}
