import fs from "node:fs";
import path from "node:path";
import {
  FunctionsFetchError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBooth } from "../../constants";
import {
  activateOfflineEventSession,
  CheckoutOutcomeUnknownError,
  createOrder,
  finalizeOfflineEventSession,
  getCustomerOrder,
  getOfflineEventDraft,
  getOfflineEventOrders,
  getOrderStatusCounts,
  getOrderNotificationStatus,
  retryOrderNotification,
  getStorefrontBootstrap,
  listOfflineEvents,
  normalizeProduct,
  publishGachaConfiguration,
  saveOfflineEventDraft,
  syncOfflineEventOrders,
  updateOrderFulfillment,
} from "../../api";
import {
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "../../offline/offline";
import { defaultGachaSettings } from "../../../types/gacha";
import type {
  CartItem,
  OfflineEventOrder,
  OfflineEventSession,
  Product,
} from "../../../types/catalog";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../../supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: mocks.from,
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

const shopId = "11000000-0000-4000-8000-000000000001";
const orderId = "40000000-0000-4000-8000-000000000001";

const product: Product = {
  id: "moon-stand",
  name: "Moon Stand",
  collection: "Night",
  description: "A bright acrylic stand",
  price_vnd: 120000,
  sale_price_vnd: null,
  effective_price_vnd: 120000,
  promotion_eligible: true,
  item_code: "MOON-1",
  quantity_available: 2,
  category: "Acrylic",
  badge: "Limited",
  badge_color: "#5f8d55",
  stock_status: "limited",
  stock_note: "Limited stock",
  images: ["https://example.test/moon.jpg"],
  image_variants: [],
  image_paths: [],
  featured: true,
  sort_order: 1,
  active: true,
};

const orderResponse = {
  id: orderId,
  order_code: "A100",
  customer_name: "Customer",
  total_amount: "120000",
  discount_amount: "0",
  status: "pending",
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z",
  expires_at: "2026-07-21T00:10:00.000Z",
  confirmed_at: null,
  cancelled_at: null,
  expired_at: null,
};

const eventSession: OfflineEventSession = {
  version: 1,
  id: "71000000-0000-4000-8000-000000000001",
  shopId,
  shopSlug: "event-shop",
  deviceId: "72000000-0000-4000-8000-000000000001",
  name: "Convention day",
  status: "active",
  allocations: [{ product, quantityAllocated: 2, quantitySold: 1 }],
  payment: {
    momo_qr_url: "",
    bank_qr_url: "",
    momo_label: "MoMo",
    bank_label: "Bank",
    payment_instructions: "",
  },
  promotion: {
    enabled: false,
    buy_quantity: 3,
    free_quantity: 1,
    repeatable: false,
    qualifying_product_ids: [],
    reward_product_ids: [],
  },
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:01:00.000Z",
};

const eventOfflineOrder: OfflineEventOrder = {
  version: 1,
  id: "73000000-0000-4000-8000-000000000001",
  sessionId: eventSession.id,
  shopId,
  orderCode: "EVT-00000001",
  customerName: "Walk-in",
  totalAmount: 120000,
  status: "confirmed",
  paymentMethod: "cash",
  paymentState: "cash_confirmed",
  clientRevision: 3,
  fulfillmentStatus: "preparing",
  items: [
    {
      product_id: product.id,
      quantity: 1,
      unit_price: 120000,
      discount_amount: 0,
    },
  ],
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:01:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.invoke.mockResolvedValue({ data: { sent: 0 }, error: null });
  mocks.upsert.mockResolvedValue({ data: null, error: null });
});

describe("order API contracts", () => {
  it("keeps checkout creation on the server-owned queue boundary", async () => {
    const cart: CartItem[] = [{ product, quantity: 2, reward_quantity: 1 }];
    mocks.invoke.mockResolvedValueOnce({ data: orderResponse, error: null });

    const order = await createOrder(
      "akiba-shelf",
      "  Customer  ",
      cart,
      "client-request-1",
      "recovery-token-1",
    );

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "create-order", {
      body: {
        shopSlug: "akiba-shelf",
        customerName: "Customer",
        items: [{ product_id: "moon-stand", quantity: 3, reward_quantity: 1 }],
        clientRequestId: "client-request-1",
        recoveryToken: "recovery-token-1",
        deviceId: expect.any(String),
      },
    });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(order).toMatchObject({
      id: orderId,
      total_amount: 120000,
      status: "pending",
    });
  });

  it("treats an invalid success response as an unknown retryable outcome", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { id: orderId }, error: null });

    await expect(
      createOrder(
        "akiba-shelf",
        "Customer",
        [{ product, quantity: 1 }],
        "client-request-1",
        "recovery-token-1",
      ),
    ).rejects.toBeInstanceOf(CheckoutOutcomeUnknownError);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    new FunctionsFetchError(new Error("network interrupted")),
    new FunctionsRelayError(new Response(null, { status: 503 })),
  ])("treats %s as an unknown retryable outcome", async (error) => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error });

    await expect(
      createOrder(
        "akiba-shelf",
        "Customer",
        [{ product, quantity: 1 }],
        "client-request-1",
        "recovery-token-1",
      ),
    ).rejects.toBeInstanceOf(CheckoutOutcomeUnknownError);
  });

  it("parses customer recovery rows and empty responses without changing shape", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [orderResponse], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(
      getCustomerOrder(orderId, "recovery-token-1"),
    ).resolves.toMatchObject({ id: orderId, total_amount: 120000 });
    await expect(
      getCustomerOrder(orderId, "recovery-token-1"),
    ).resolves.toBeNull();
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "get_customer_order", {
      p_order_id: orderId,
      p_recovery_token: "recovery-token-1",
    });
  });

  it("normalizes order status counts returned as numeric strings", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        pending: "2",
        confirmed: "3",
        cancelled: "4",
        expired: "5",
        all: "14",
      },
      error: null,
    });

    await expect(
      getOrderStatusCounts(shopId, {
        createdAfter: "2026-07-01T00:00:00.000Z",
        createdBefore: "2026-08-01T00:00:00.000Z",
      }),
    ).resolves.toEqual({
      pending: 2,
      confirmed: 3,
      cancelled: 4,
      expired: 5,
      all: 14,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_order_status_counts", {
      p_shop_id: shopId,
      p_created_after: "2026-07-01T00:00:00.000Z",
      p_created_before: "2026-08-01T00:00:00.000Z",
    });
  });

  it("validates durable order notification status and queue aggregates", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          order_id: orderId,
          status: "retryable_failed",
          attempt_count: "2",
          failed_endpoint_count: "1",
          next_attempt_at: "2026-07-23T09:45:00.000Z",
          delivered_at: null,
          skipped_at: null,
          dead_lettered_at: null,
          updated_at: "2026-07-23T09:44:00.000Z",
          last_error: "push_provider_unavailable",
          due_count: "3",
          oldest_due_at: "2026-07-23T09:30:00.000Z",
          retryable_failed_count: "2",
          dead_letter_count: "1",
        },
      ],
      error: null,
    });

    await expect(getOrderNotificationStatus(shopId, 999)).resolves.toEqual([
      expect.objectContaining({
        order_id: orderId,
        status: "retryable_failed",
        attempt_count: 2,
        failed_endpoint_count: 1,
        due_count: 3,
        retryable_failed_count: 2,
        dead_letter_count: 1,
      }),
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("get_order_notification_status", {
      p_shop_id: shopId,
      p_limit: 200,
    });
  });

  it("requeues an eligible terminal notification through the guarded RPC", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });

    await expect(
      retryOrderNotification(shopId, orderId, "admin_attention_panel"),
    ).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("retry_order_notification", {
      p_shop_id: shopId,
      p_order_id: orderId,
      p_reason: "admin_attention_panel",
    });
  });

  it("normalizes the guarded Event order list response", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        orders: [
          {
            ...orderResponse,
            source: "offline_event",
            offline_event_session_id: "71000000-0000-4000-8000-000000000001",
            offline_event_name: "Convention day",
            payment_method: "vietqr",
            payment_state: "bank_verification_pending",
            fulfillment_status: "preparing",
            order_items: [
              {
                id: `${orderId}:moon-stand`,
                order_id: orderId,
                product_id: "moon-stand",
                quantity: "2",
                unit_price: "60000",
                discount_amount: "0",
                product: {
                  id: "moon-stand",
                  name: "Moon Stand",
                  item_code: "MOON-1",
                  images: [],
                },
              },
            ],
          },
        ],
        total: "1",
        counts: {
          pending: "1",
          confirmed: "0",
          cancelled: "0",
          expired: "0",
          all: "1",
        },
      },
      error: null,
    });

    await expect(
      getOfflineEventOrders(shopId, {
        page: 2,
        pageSize: 8,
        createdAfter: "2026-07-01T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      total: 1,
      orders: [
        {
          source: "offline_event",
          offline_event_name: "Convention day",
          order_items: [{ quantity: 2, unit_price: 60000 }],
        },
      ],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_offline_event_orders", {
      p_shop_id: shopId,
      p_page: 2,
      p_page_size: 8,
      p_status: "all",
      p_created_after: "2026-07-01T00:00:00.000Z",
      p_created_before: null,
      p_session_id: null,
    });
  });

  it("persists, lists, and activates scheduled Event drafts", async () => {
    const draftBundle = {
      session: {
        id: eventSession.id,
        shop_id: shopId,
        device_id: null,
        name: "Convention day",
        status: "draft",
        scheduled_start_at: "2026-08-01T01:00:00.000Z",
        scheduled_end_at: "2026-08-01T09:00:00.000Z",
        started_at: null,
        closed_at: null,
        payment_snapshot: {},
        promotion_snapshot: {},
        created_at: "2026-07-22T00:00:00.000Z",
        updated_at: "2026-07-22T00:00:00.000Z",
      },
      allocations: [
        {
          product_id: product.id,
          quantity_allocated: 2,
          quantity_sold: 0,
          product_snapshot: product,
        },
      ],
    };
    const activeBundle = {
      ...draftBundle,
      session: {
        ...draftBundle.session,
        device_id: eventSession.deviceId,
        status: "active",
        started_at: "2026-08-01T00:55:00.000Z",
        payment_snapshot: eventSession.payment,
        promotion_snapshot: eventSession.promotion,
      },
    };
    mocks.rpc
      .mockResolvedValueOnce({ data: draftBundle, error: null })
      .mockResolvedValueOnce({ data: draftBundle, error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: eventSession.id,
            shop_id: shopId,
            name: "Convention day",
            status: "draft",
            scheduled_start_at: draftBundle.session.scheduled_start_at,
            scheduled_end_at: draftBundle.session.scheduled_end_at,
            started_at: null,
            closed_at: null,
            created_at: draftBundle.session.created_at,
            updated_at: draftBundle.session.updated_at,
            product_count: "1",
            quantity_allocated: "2",
            quantity_sold: "0",
            order_count: "0",
            order_total: "0",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: activeBundle, error: null });

    const saved = await saveOfflineEventDraft({
      shopId,
      shopSlug: "event-shop",
      name: "Convention day",
      scheduledStartAt: draftBundle.session.scheduled_start_at,
      scheduledEndAt: draftBundle.session.scheduled_end_at,
      products: [{ id: product.id, quantity: 2 }],
    });
    await expect(
      getOfflineEventDraft(shopId, "event-shop", saved.id),
    ).resolves.toMatchObject({
      status: "draft",
      allocations: [{ quantityAllocated: 2 }],
    });
    await expect(listOfflineEvents(shopId)).resolves.toMatchObject([
      { id: eventSession.id, status: "draft", quantityAllocated: 2 },
    ]);
    await expect(
      activateOfflineEventSession(
        saved.id,
        eventSession.deviceId,
        "event-shop",
      ),
    ).resolves.toMatchObject({
      status: "active",
      scheduledStartAt: draftBundle.session.scheduled_start_at,
    });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "save_offline_event_draft", {
      p_shop_id: shopId,
      p_session_id: null,
      p_name: "Convention day",
      p_scheduled_start_at: draftBundle.session.scheduled_start_at,
      p_scheduled_end_at: draftBundle.session.scheduled_end_at,
      p_allocations: [{ product_id: product.id, quantity: 2 }],
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "get_offline_event_draft", {
      p_shop_id: shopId,
      p_session_id: eventSession.id,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, "list_offline_events", {
      p_shop_id: shopId,
      p_limit: 50,
    });
  });

  it("sends and acknowledges revisioned Event orders during sync and close", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: {
          inserted: 0,
          updated: 1,
          stale: 0,
          acknowledged_revisions: { [eventOfflineOrder.id]: 3 },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          sync: {
            inserted: 0,
            updated: 0,
            stale: 1,
            acknowledged_revisions: { [eventOfflineOrder.id]: 3 },
          },
          status: "closed",
        },
        error: null,
      });

    await expect(
      syncOfflineEventOrders(eventSession, [eventOfflineOrder]),
    ).resolves.toEqual([{ id: eventOfflineOrder.id, clientRevision: 3 }]);
    await expect(
      finalizeOfflineEventSession(eventSession, [eventOfflineOrder]),
    ).resolves.toEqual({
      acknowledgements: [{ id: eventOfflineOrder.id, clientRevision: 3 }],
      status: "closed",
    });

    const expectedOrder = expect.objectContaining({
      id: eventOfflineOrder.id,
      client_revision: 3,
      fulfillment_status: "preparing",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "sync_offline_event_orders", {
      p_session_id: eventSession.id,
      p_device_id: eventSession.deviceId,
      p_orders: [expectedOrder],
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "finalize_offline_event_session",
      {
        p_session_id: eventSession.id,
        p_device_id: eventSession.deviceId,
        p_orders: [expectedOrder],
      },
    );
  });

  it("refuses to close local Event state without an exact server receipt", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        sync: {
          acknowledged_revisions: {
            "71000000-0000-4000-8000-000000000099": 3,
          },
        },
        status: "closed",
      },
      error: null,
    });

    await expect(
      finalizeOfflineEventSession(eventSession, [eventOfflineOrder]),
    ).rejects.toThrow("Offline finalization acknowledgements are incomplete.");
  });

  it("keeps Event orders dirty unless the server explicitly acknowledges them", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: { inserted: 0, updated: 0, stale: 1 },
        error: null,
      })
      .mockResolvedValueOnce({ data: "malformed", error: null });

    await expect(
      syncOfflineEventOrders(eventSession, [eventOfflineOrder]),
    ).resolves.toEqual([]);
    await expect(
      syncOfflineEventOrders(eventSession, [eventOfflineOrder]),
    ).rejects.toThrow();
  });

  it("updates fulfilment through the guarded order RPC", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        outcome: "updated",
        order: {
          ...orderResponse,
          status: "confirmed",
          fulfillment_status: "ready",
        },
      },
      error: null,
    });

    await expect(
      updateOrderFulfillment(orderId, "ready"),
    ).resolves.toMatchObject({
      outcome: "updated",
      order: { fulfillment_status: "ready" },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("update_order_fulfillment", {
      target_order_id: orderId,
      next_status: "ready",
    });
  });
});

describe("gacha publish contract", () => {
  it("keeps draft persistence and the v6 publish payload stable", async () => {
    const settings = {
      ...defaultGachaSettings(shopId),
      enabled: true,
      title: "  Event Wish  ",
      description: "  Featured shelf  ",
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    const banner = {
      id: "banner-1",
      shop_id: shopId,
      name: "Character Event Wish",
      description: "Featured finds",
      kind: "character" as const,
      theme: "anemo" as const,
      display_limit: 3,
      sort_order: 7,
      active: true,
      starts_at: null,
      ends_at: null,
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    const entry = {
      shop_id: shopId,
      banner_id: banner.id,
      product_id: product.id,
      kind: "character" as const,
      element: "anemo" as const,
      weapon_type: "sword" as const,
      rarity: 5 as const,
      weight: 100,
      featured: true,
      active: true,
      updated_at: "2026-07-21T00:00:00.000Z",
    };
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });

    await publishGachaConfiguration(shopId, "genshin", {
      settings,
      banners: [banner],
      entries: [entry],
    });

    expect(mocks.from).toHaveBeenCalledWith("gacha_game_configs");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        shop_id: shopId,
        game_type: "genshin",
        config: expect.objectContaining({
          settings: expect.objectContaining({
            title: "Event Wish",
            description: "Featured shelf",
          }),
        }),
      },
      { onConflict: "shop_id,game_type" },
    );
    expect(mocks.rpc).toHaveBeenCalledWith("publish_gacha_configuration_v6", {
      p_shop_id: shopId,
      p_game_type: "genshin",
      p_config: {
        settings: {
          ...settings,
          title: "Event Wish",
          description: "Featured shelf",
        },
        banners: [
          {
            id: banner.id,
            name: banner.name,
            description: banner.description,
            kind: banner.kind,
            theme: banner.theme,
            display_limit: 4,
            active: true,
            starts_at: null,
            ends_at: null,
          },
        ],
        entries: [
          {
            banner_id: banner.id,
            product_id: product.id,
            kind: entry.kind,
            element: entry.element,
            weapon_type: entry.weapon_type,
            rarity: entry.rarity,
            weight: entry.weight,
            featured: true,
            active: true,
          },
        ],
      },
    });
  });
});

describe("catalog response contracts", () => {
  it("normalizes the one-call storefront bootstrap response", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        shop: {
          id: shopId,
          name: "Akiba Shelf",
          slug: "akiba-shelf",
          active: true,
          accepting_orders: true,
          catalog_source_shop_id: null,
        },
        catalog_shop_id: shopId,
        products: [product],
        has_more: true,
        booth: { ...defaultBooth, shop_id: shopId },
        categories: ["Acrylic"],
        promotion: {
          shop_id: shopId,
          enabled: false,
          buy_quantity: 3,
          free_quantity: 1,
          repeatable: true,
          qualifying_product_ids: [],
          reward_product_ids: [],
        },
        gacha_enabled: true,
      },
      error: null,
    });

    await expect(getStorefrontBootstrap("akiba-shelf")).resolves.toMatchObject({
      shop: { id: shopId, slug: "akiba-shelf" },
      catalogShopId: shopId,
      products: [expect.objectContaining({ id: product.id })],
      hasMore: true,
      categories: ["Acrylic"],
      gachaEnabled: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_storefront_bootstrap", {
      p_shop_slug: "akiba-shelf",
    });
  });

  it("normalizes public product values and filters unsafe image URLs", () => {
    expect(
      normalizeProduct({
        ...product,
        price_vnd: "120000" as unknown as number,
        quantity_available: 0,
        images: ["https://example.test/moon.jpg", "javascript:alert(1)"],
      }),
    ).toMatchObject({
      id: "moon-stand",
      price_vnd: 120000,
      quantity_available: 0,
      stock_status: "sold_out",
      images: ["https://example.test/moon.jpg"],
    });
  });

  it("preserves complete and partial catalog snapshot semantics", () => {
    saveCatalogSnapshot({ products: [product], booth: defaultBooth }, shopId, {
      replaceProducts: true,
      complete: false,
    });
    expect(loadCatalogSnapshot(shopId)).toMatchObject({
      products: [product],
      complete: false,
    });

    saveCatalogSnapshot(
      {
        products: [{ ...product, id: "sun-print", name: "Sun Print" }],
        booth: defaultBooth,
      },
      shopId,
      { complete: true },
    );
    expect(loadCatalogSnapshot(shopId)).toMatchObject({
      products: [
        product,
        expect.objectContaining({ id: "sun-print", name: "Sun Print" }),
      ],
      complete: true,
    });
  });
});

describe("Playwright Supabase request inventory", () => {
  it("records every mocked RPC and table path", () => {
    const fixture = fs.readFileSync(
      path.resolve(process.cwd(), "e2e/fixtures.ts"),
      "utf8",
    );
    const actual = [
      ...fixture.matchAll(/\/(?:rest|functions)\/v1\/[A-Za-z0-9_/-]+/g),
    ].map(([value]) => value);

    expect([...new Set(actual)].sort()).toEqual([
      "/functions/v1/create-order",
      "/rest/v1/booth_settings",
      "/rest/v1/gacha_game_configs",
      "/rest/v1/gacha_published_configs",
      "/rest/v1/orders",
      "/rest/v1/payment_settings",
      "/rest/v1/products",
      "/rest/v1/promotion_products",
      "/rest/v1/promotions",
      "/rest/v1/rpc/activate_offline_event_session",
      "/rest/v1/rpc/finalize_offline_event_session",
      "/rest/v1/rpc/get_active_offline_event_session",
      "/rest/v1/rpc/get_admin_booth_settings",
      "/rest/v1/rpc/get_admin_products",
      "/rest/v1/rpc/get_customer_order",
      "/rest/v1/rpc/get_my_shop_memberships",
      "/rest/v1/rpc/get_offline_event_draft",
      "/rest/v1/rpc/get_offline_event_orders",
      "/rest/v1/rpc/get_order_notification_status",
      "/rest/v1/rpc/get_order_status_counts",
      "/rest/v1/rpc/get_public_product_categories",
      "/rest/v1/rpc/get_shop_members",
      "/rest/v1/rpc/get_shop_workspace_summary",
      "/rest/v1/rpc/get_storefront_bootstrap",
      "/rest/v1/rpc/list_offline_events",
      "/rest/v1/rpc/publish_gacha_configuration_v6",
      "/rest/v1/rpc/retry_order_notification",
      "/rest/v1/rpc/save_offline_event_draft",
      "/rest/v1/rpc/start_offline_event_session",
      "/rest/v1/rpc/sync_offline_event_orders",
      "/rest/v1/rpc/update_order_fulfillment",
      "/rest/v1/shops",
      "/rest/v1/staff_members",
    ]);
  });
});
