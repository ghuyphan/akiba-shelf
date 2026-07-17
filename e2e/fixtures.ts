import type { Page, Route } from "@playwright/test";

export const products = [
  {
    id: "moon-stand",
    name: "Moon Stand",
    collection: "Night",
    description: "A bright acrylic stand",
    price_vnd: 120000,
    sale_price_vnd: null,
    effective_price_vnd: 120000,
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
  },
  {
    id: "sun-print",
    name: "Sun Print",
    collection: "Day",
    description: "A warm art print",
    price_vnd: 80000,
    sale_price_vnd: null,
    effective_price_vnd: 80000,
    item_code: "SUN-1",
    quantity_available: 8,
    category: "Print",
    badge: "",
    badge_color: "#5f8d55",
    stock_status: "in_stock",
    stock_note: "In stock",
    images: ["https://example.test/sun.jpg"],
    image_variants: [],
    image_paths: [],
    featured: false,
    sort_order: 2,
    active: true,
  },
];

const booth = {
  id: "main",
  shop_id: "main",
  booth_name: "Fixture Booth",
  subtitle: "Artist merch",
  booth_code: "A1",
  location: "Hall A",
  open_hours: "10–18",
  logo_url: "",
  logo_path: "",
  instagram_url: "",
  instagram_visible: true,
  facebook_url: "",
  facebook_visible: true,
  tiktok_url: "",
  tiktok_visible: true,
  x_url: "",
  x_visible: true,
  threads_url: "",
  threads_visible: true,
  youtube_url: "",
  youtube_visible: true,
  social_qr_logo_url: "",
  social_qr_logo_path: "",
  theme_primary: "#5f8d55",
  theme_secondary: "#17233c",
  theme_accent: "#5f8d55",
  theme_background: "#fff8f2",
  layout_order: ["featured", "booth", "controls", "cart", "products"],
  corner_radius: 16,
  card_style: "soft",
  featured_style: "deck",
  controls_style: "panel",
  product_style: "classic",
  catalog_locale: "en",
  featured_autoplay: false,
};
const payment = {
  id: "main",
  momo_qr_url: "",
  bank_qr_url: "",
  momo_label: "MoMo",
  bank_label: "Bank",
  bank_code: "970436",
  bank_acq_id: "970436",
  bank_account_no: "123456",
  bank_account_name: "AKIBA",
  bank_add_info_template: "ORDER {orderCode}",
  payment_instructions: "Pay exactly",
};

function json(
  route: Route,
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });
}

export async function mockSupabase(
  page: Page,
  options: {
    staffRole?: "owner" | "admin" | "staff" | null;
    staffActive?: boolean;
    checkoutFails?: boolean;
    multiShop?: boolean;
    manyCategories?: boolean;
    manyProducts?: boolean;
    manyShops?: boolean;
    ownedShopCount?: number;
    teamMembers?: boolean;
    socialLinks?: boolean;
    catalogLocale?: "en" | "vi";
  } = {},
) {
  const catalogProducts = options.manyProducts
    ? Array.from({ length: 30 }, (_, index) => ({
        ...products[index % products.length],
        id: `product-${index + 1}`,
        name: `Product ${String(index + 1).padStart(2, "0")}`,
        item_code: `PRODUCT-${index + 1}`,
        featured: index < 2,
        sort_order: index + 1,
      }))
    : options.manyCategories
      ? [
        ...products,
        ...["Badge", "Sticker pack", "Apparel", "Charm", "Stationery"].map(
          (category, index) => ({
            ...products[1],
            id: `category-${index}`,
            name: `${category} fixture`,
            item_code: `CATEGORY-${index}`,
            category,
            sort_order: index + 3,
          }),
        ),
        ]
      : products;

  await page.route("**/mock-supabase/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.includes("/auth/v1/token")) {
      const payload = JSON.parse(request.postData() || "{}");
      const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
      const claims = btoa(
        JSON.stringify({
          sub: "10000000-0000-4000-8000-000000000001",
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      return json(route, {
        access_token: `${header}.${claims}.test`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fixture-refresh",
        user: {
          id: "10000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: payload.email,
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (url.pathname.endsWith("/auth/v1/user"))
      return json(route, {
        id: "10000000-0000-4000-8000-000000000001",
        aud: "authenticated",
        role: "authenticated",
        email: "staff@test.local",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      });
    if (url.pathname.includes("/rest/v1/rpc/get_my_shop_memberships"))
      return json(
        route,
        options.staffRole
          ? [
              {
                shop_id: "main",
                shop_name: "Fixture Booth",
                shop_slug: "akiba-shelf",
                role: options.staffRole,
                active: options.staffActive ?? true,
                shop_active: true,
              },
              ...(options.manyShops || options.ownedShopCount
                ? Array.from(
                    {
                      length: options.ownedShopCount
                        ? Math.max(0, options.ownedShopCount - 1)
                        : 10,
                    },
                    (_, index) => ({
                      shop_id: `shop-${index}`,
                      shop_name: `Fixture Shop ${index + 1}`,
                      shop_slug: `fixture-shop-${index + 1}`,
                      role: options.staffRole!,
                      active: true,
                      shop_active: true,
                    }),
                  )
                : []),
            ]
          : [],
      );
    if (url.pathname.includes("/rest/v1/rpc/get_shop_workspace_summary"))
      return json(route, {
        shop_id: "main",
        shop_name: "Fixture Booth",
        shop_slug: "akiba-shelf",
        booth_name: booth.booth_name,
        logo_url: booth.logo_url,
        theme_background: booth.theme_background,
      });
    if (url.pathname.includes("/rest/v1/rpc/get_admin_products"))
      return json(route, catalogProducts);
    if (url.pathname.includes("/rest/v1/rpc/get_admin_booth_settings"))
      return json(route, booth);
    if (url.pathname.includes("/rest/v1/rpc/get_shop_members"))
      return json(
        route,
        options.teamMembers
          ? [
              {
                user_id: "10000000-0000-4000-8000-000000000001",
                email: "owner@test.local",
                role: "owner",
                active: true,
              },
              {
                user_id: "10000000-0000-4000-8000-000000000002",
                email: "admin@test.local",
                role: "admin",
                active: true,
              },
              {
                user_id: "10000000-0000-4000-8000-000000000003",
                email: "staff@test.local",
                role: "staff",
                active: true,
              },
            ]
          : [],
      );
    if (url.pathname.includes("/rest/v1/rpc/get_order_status_counts"))
      return json(route, {
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        expired: 0,
        all: 0,
      });
    if (url.pathname.includes("/rest/v1/rpc/get_public_product_categories"))
      return json(
        route,
        [...new Set(catalogProducts.map((product) => product.category))]
          .filter((category) => category.trim() !== "")
          .sort()
          .map((category) => ({ category })),
      );
    if (url.pathname.includes("/rest/v1/shops")) {
      const requestedSlug =
        url.searchParams.get("slug")?.replace(/^eq\./, "") ?? "akiba-shelf";
      const slug = options.multiShop ? requestedSlug : "akiba-shelf";
      return json(route, [
        {
          id: options.multiShop ? `id-${slug}` : "main",
          name: options.multiShop ? `Fixture ${slug}` : "Fixture Booth",
          slug,
          active: true,
        },
      ]);
    }
    if (url.pathname.includes("/rest/v1/rpc/create_order"))
      return options.checkoutFails
        ? json(route, { message: "Stock changed" }, 409)
        : json(route, [
            {
              id: "40000000-0000-4000-8000-000000000001",
              order_code: "A100",
              customer_name: "Customer",
              total_amount: 120000,
              status: "pending",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 600000).toISOString(),
              confirmed_at: null,
              cancelled_at: null,
              expired_at: null,
            },
          ]);
    if (url.pathname.includes("/rest/v1/rpc/get_customer_order"))
      return json(route, []);
    if (url.pathname.includes("/functions/v1/notify-new-order"))
      return json(route, { sent: 0 });
    if (url.pathname.includes("/rest/v1/promotion_products"))
      return json(
        route,
        catalogProducts.map((product) => ({
          product_id: product.id,
          role: "both",
        })),
      );
    if (url.pathname.includes("/rest/v1/promotions"))
      return json(route, {
        enabled: true,
        buy_quantity: 3,
        free_quantity: 1,
        repeatable: true,
      });
    if (url.pathname.includes("/rest/v1/products")) {
      const id = url.searchParams.get("shop_id")?.replace(/^eq\./, "");
      let matchingProducts = options.multiShop
        ? catalogProducts.map((product) => ({
            ...product,
            id: `${id}-${product.id}`,
            name: `${id} ${product.name}`,
            shop_id: id,
          }))
        : [...catalogProducts];
      const category = url.searchParams
        .get("category")
        ?.replace(/^eq\./, "");
      if (category)
        matchingProducts = matchingProducts.filter(
          (product) => product.category === category,
        );
      if (url.searchParams.get("featured") === "eq.true")
        matchingProducts = matchingProducts.filter(
          (product) => product.featured,
        );
      const searchFilter = url.searchParams.get("or") ?? "";
      const searchTerm = searchFilter.match(/ilike\.\*([^*]+)\*/)?.[1];
      if (searchTerm) {
        const normalized = searchTerm.toLowerCase();
        matchingProducts = matchingProducts.filter((product) =>
          [
            product.name,
            product.item_code,
            product.collection,
            product.description,
          ].some((value) => value.toLowerCase().includes(normalized)),
        );
      }
      const requestedIds = url.searchParams.get("id")?.match(/^in\.\((.*)\)$/)?.[1];
      if (requestedIds) {
        const ids = new Set(requestedIds.split(","));
        matchingProducts = matchingProducts.filter((product) =>
          ids.has(product.id),
        );
      }
      const order = url.searchParams.get("order") ?? "";
      matchingProducts.sort((first, second) => {
        if (order.startsWith("effective_price_vnd.asc"))
          return (first.sale_price_vnd ?? first.price_vnd) - (second.sale_price_vnd ?? second.price_vnd);
        if (order.startsWith("effective_price_vnd.desc"))
          return (second.sale_price_vnd ?? second.price_vnd) - (first.sale_price_vnd ?? first.price_vnd);
        if (order.startsWith("quantity_available.desc"))
          return second.quantity_available - first.quantity_available;
        if (order.startsWith("name.asc"))
          return first.name.localeCompare(second.name);
        if (order.startsWith("featured.desc") && first.featured !== second.featured)
          return first.featured ? -1 : 1;
        return first.sort_order - second.sort_order;
      });
      const total = matchingProducts.length;
      const range = request.headers()["range"]?.split("-").map(Number);
      const offset = Number(url.searchParams.get("offset") ?? range?.[0] ?? 0);
      const limit = Number(
        url.searchParams.get("limit") ??
          (range?.length === 2 ? range[1] - range[0] + 1 : total),
      );
      matchingProducts = matchingProducts.slice(offset, offset + limit);
      const responseBody = url.searchParams.get("select") === "category"
        ? matchingProducts.map((product) => ({ category: product.category }))
        : matchingProducts;
      return json(
        route,
        responseBody,
        200,
        { "content-range": `0-${Math.max(0, matchingProducts.length - 1)}/${total}` },
      );
    }
    if (url.pathname.includes("/rest/v1/booth_settings")) {
      const id = url.searchParams.get("shop_id")?.replace(/^eq\./, "");
      const catalogBooth = options.socialLinks
        ? {
            ...booth,
            instagram_url: "https://instagram.com/fixture.artist",
            facebook_url: "https://facebook.com/fixture.booth",
            tiktok_url: "https://tiktok.com/@fixture.artist",
            x_url: "https://x.com/fixture_artist",
            x_visible: true,
            threads_url: "https://threads.net/@fixture.artist",
            threads_visible: false,
            youtube_url: "https://youtube.com/@fixtureartist",
            youtube_visible: true,
          }
        : booth;
      const localizedBooth = options.catalogLocale
        ? { ...catalogBooth, catalog_locale: options.catalogLocale }
        : catalogBooth;
      return json(
        route,
        options.multiShop
          ? { ...localizedBooth, id, shop_id: id, booth_name: `Booth ${id}` }
          : localizedBooth,
      );
    }
    if (url.pathname.includes("/rest/v1/payment_settings")) {
      const id = url.searchParams.get("shop_id")?.replace(/^eq\./, "");
      return json(
        route,
        options.multiShop
          ? { ...payment, id, shop_id: id, bank_account_name: `PAY ${id}` }
          : payment,
      );
    }
    if (url.pathname.includes("/rest/v1/orders"))
      return json(route, [], 200, { "content-range": "0-0/0" });
    if (url.pathname.includes("/rest/v1/staff_members")) return json(route, []);
    return json(route, []);
  });
}
