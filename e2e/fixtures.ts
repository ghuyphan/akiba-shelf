import type { Page, Route } from "@playwright/test";

export const products = [
  {
    id: "moon-stand",
    name: "Moon Stand",
    collection: "Night",
    description: "A bright acrylic stand",
    price_vnd: 120000,
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
  facebook_url: "",
  tiktok_url: "",
  social_qr_logo_url: "",
  social_qr_logo_path: "",
  theme_primary: "#5f8d55",
  theme_secondary: "#17233c",
  theme_accent: "#5f8d55",
  theme_background: "#fff8f2",
  layout_order: ["featured", "booth", "controls", "cart", "products"],
  corner_radius: 16,
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
  } = {},
) {
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
      return json(route, products);
    if (url.pathname.includes("/rest/v1/rpc/get_admin_booth_settings"))
      return json(route, booth);
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
    if (url.pathname.includes("/rest/v1/products")) {
      const id = url.searchParams.get("shop_id")?.replace(/^eq\./, "");
      return json(
        route,
        options.multiShop
          ? products.map((product) => ({
              ...product,
              id: `${id}-${product.id}`,
              name: `${id} ${product.name}`,
              shop_id: id,
            }))
          : products,
      );
    }
    if (url.pathname.includes("/rest/v1/booth_settings")) {
      const id = url.searchParams.get("shop_id")?.replace(/^eq\./, "");
      return json(
        route,
        options.multiShop
          ? { ...booth, id, shop_id: id, booth_name: `Booth ${id}` }
          : booth,
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
