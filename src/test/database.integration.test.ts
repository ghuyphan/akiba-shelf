import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const run = Boolean(url && anonKey && serviceKey);

describe.skipIf(!run)("database concurrency", () => {
  const admin = createClient(
    url || "http://127.0.0.1:54321",
    serviceKey || "disabled",
    { auth: { persistSession: false, storageKey: "akiba-db-admin" } },
  );
  const customer = createClient(
    url || "http://127.0.0.1:54321",
    anonKey || "disabled",
    { auth: { persistSession: false, storageKey: "akiba-db-customer" } },
  );
  const suffix = crypto.randomUUID();
  const productId = `concurrency-${suffix}`;
  const shopId = crypto.randomUUID();
  const shopSlug = `concurrency-${suffix}`;
  const staffEmail = `staff-${suffix}@test.local`;
  const staffPassword = `Test-${suffix}!`;
  let staffUserId = "";
  let staff: ReturnType<typeof createClient>;

  const checkout = (args: Record<string, unknown>) =>
    admin.rpc("create_order_rate_limited", {
      ...args,
      p_fingerprint_hash: "a".repeat(64),
    });

  beforeAll(async () => {
    const { data: created, error: userError } =
      await admin.auth.admin.createUser({
        email: staffEmail,
        password: staffPassword,
        email_confirm: true,
      });
    if (userError) throw userError;
    staffUserId = created.user.id;
    const { error: shopError } = await admin
      .from("shops")
      .insert({
        id: shopId,
        name: "Concurrency",
        slug: shopSlug,
        created_by: staffUserId,
      });
    if (shopError) throw shopError;
    const { error: memberError } = await admin
      .from("shop_members")
      .insert({ shop_id: shopId, user_id: staffUserId, role: "staff" });
    if (memberError) throw memberError;
    const { error: productError } = await admin
      .from("products")
      .insert({
        id: productId,
        shop_id: shopId,
        name: "Concurrency",
        item_code: `C-${suffix}`,
        price_vnd: 12345,
        quantity_available: 5,
        category: "Test",
        active: true,
      });
    if (productError) throw productError;
    staff = createClient(url!, anonKey!, {
      auth: { persistSession: false, storageKey: "akiba-db-staff" },
    });
    const { error: loginError } = await staff.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });
    if (loginError) throw loginError;
  });

  afterAll(async () => {
    await admin
      .from("orders")
      .delete()
      .like("customer_name", `test-${suffix}%`);
    await admin
      .from("shop_members")
      .delete()
      .eq("shop_id", shopId)
      .eq("user_id", staffUserId);
    await admin.from("products").delete().eq("id", productId);
    await admin.from("shops").delete().eq("id", shopId);
    if (staffUserId) await admin.auth.admin.deleteUser(staffUserId);
  });

  it("serializes retries and prevents overselling", async () => {
    const requestId = crypto.randomUUID();
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const args = {
      p_shop_slug: shopSlug,
      p_customer_name: `test-${suffix}-retry`,
      p_items: [{ product_id: productId, quantity: 2 }],
      p_client_request_id: requestId,
      p_recovery_token: token,
    };
    const retries = await Promise.all([
      checkout(args),
      checkout(args),
      checkout(args),
    ]);
    expect(retries.every((result) => !result.error)).toBe(true);
    expect(new Set(retries.map((result) => result.data?.[0]?.id)).size).toBe(1);

    const competing = await Promise.all([
      checkout({
        ...args,
        p_customer_name: `test-${suffix}-a`,
        p_client_request_id: crypto.randomUUID(),
        p_recovery_token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        p_items: [{ product_id: productId, quantity: 3 }],
      }),
      checkout({
        ...args,
        p_customer_name: `test-${suffix}-b`,
        p_client_request_id: crypto.randomUUID(),
        p_recovery_token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        p_items: [{ product_id: productId, quantity: 3 }],
      }),
    ]);
    expect(competing.filter((result) => !result.error)).toHaveLength(1);
    const { data: product } = await admin
      .from("products")
      .select("quantity_available")
      .eq("id", productId)
      .single();
    expect(product?.quantity_available).toBe(0);
  });

  it("allows only one terminal transition", async () => {
    await admin
      .from("products")
      .update({ quantity_available: 2, stock_status: "limited" })
      .eq("id", productId);
    const recoveryToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data, error } = await checkout({
      p_shop_slug: shopSlug,
      p_customer_name: `test-${suffix}-terminal`,
      p_items: [{ product_id: productId, quantity: 1 }],
      p_client_request_id: crypto.randomUUID(),
      p_recovery_token: recoveryToken,
    });
    if (error) throw error;
    const orderId = data[0].id;
    const [confirmation, cancellation] = await Promise.all([
      (staff.rpc as any)("confirm_order_payment", { target_order_id: orderId }),
      customer.rpc("cancel_customer_order", {
        p_order_id: orderId,
        p_recovery_token: recoveryToken,
      }),
    ]);
    const outcomes = [
      (confirmation.data as { outcome?: string } | null)?.outcome,
      (cancellation.data as { outcome?: string } | null)?.outcome,
    ];
    expect(
      outcomes.filter(
        (outcome) => outcome === "confirmed" || outcome === "cancelled",
      ),
    ).toHaveLength(1);
    const { data: order } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    expect(["confirmed", "cancelled"]).toContain(order?.status);
  });

  it("charges and snapshots the database sale price", async () => {
    const { error: priceError } = await admin
      .from("products")
      .update({
        price_vnd: 40_000,
        sale_price_vnd: 32_000,
        quantity_available: 2,
      })
      .eq("id", productId);
    if (priceError) throw priceError;

    const { data, error } = await checkout({
      p_shop_slug: shopSlug,
      p_customer_name: `test-${suffix}-sale`,
      p_items: [{ product_id: productId, quantity: 1 }],
      p_client_request_id: crypto.randomUUID(),
      p_recovery_token: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    });
    if (error) throw error;

    expect(data[0].total_amount).toBe(32_000);
    const { data: item, error: itemError } = await admin
      .from("order_items")
      .select("unit_price")
      .eq("order_id", data[0].id)
      .single();
    if (itemError) throw itemError;
    expect(item.unit_price).toBe(32_000);
  });
});

describe.skipIf(!run)("create_shop authorization and concurrency", () => {
  const admin = createClient(
    url || "http://127.0.0.1:54321",
    serviceKey || "disabled",
    { auth: { persistSession: false, storageKey: "shop-create-admin" } },
  );
  const createdUsers: string[] = [];
  const createdShops: string[] = [];

  async function newClient(confirmed: boolean) {
    const token = crypto.randomUUID();
    const email = `create-${token}@test.local`;
    const password = `Safe-${token}!`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: confirmed,
    });
    if (error) throw error;
    createdUsers.push(data.user.id);
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, storageKey: `shop-create-${token}` },
    });
    if (confirmed) {
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    }
    return { client, userId: data.user.id };
  }

  afterAll(async () => {
    if (createdShops.length)
      await admin.from("shops").delete().in("id", createdShops);
    for (const userId of createdUsers)
      await admin.auth.admin.deleteUser(userId);
  });

  it("rejects unauthenticated and unconfirmed callers", async () => {
    const anonymous = createClient(url!, anonKey!, {
      auth: { persistSession: false, storageKey: "shop-create-anon" },
    });
    expect(
      (
        await anonymous.rpc("create_shop", {
          p_name: "No session",
          p_slug: "no-session",
        })
      ).error,
    ).toBeTruthy();
    const { userId } = await newClient(false);
    const { data: user } = await admin.auth.admin.getUserById(userId);
    expect(user.user?.email_confirmed_at).toBeFalsy();
  });

  it("serializes concurrent requests before cooldown checks and creates complete rows atomically", async () => {
    const { client } = await newClient(true);
    const suffix = crypto.randomUUID().slice(0, 8);
    const results = await Promise.all([
      client.rpc("create_shop", {
        p_name: "Concurrent A",
        p_slug: `concurrent-a-${suffix}`,
      }),
      client.rpc("create_shop", {
        p_name: "Concurrent B",
        p_slug: `concurrent-b-${suffix}`,
      }),
    ]);
    const successful = results.filter((result) => !result.error);
    expect(successful).toHaveLength(1);
    expect(results.filter((result) => result.error)).toHaveLength(1);
    const shop = successful[0].data as { id: string };
    createdShops.push(shop.id);
    const [membershipResult, boothResult, paymentResult] = await Promise.all([
        admin
          .from("shop_members")
          .select("shop_id", { count: "exact", head: true })
          .eq("shop_id", shop.id)
          .eq("role", "owner"),
        admin
          .from("booth_settings")
          .select("shop_id", { count: "exact", head: true })
          .eq("shop_id", shop.id),
        admin
          .from("payment_settings")
          .select("shop_id", { count: "exact", head: true })
          .eq("shop_id", shop.id),
      ]);
    for (const result of [membershipResult, boothResult, paymentResult]) {
      if (result.error) throw result.error;
    }
    expect([
      membershipResult.count,
      boothResult.count,
      paymentResult.count,
    ]).toEqual([1, 1, 1]);
  });

  it("rejects a sixth owned shop", async () => {
    const { client, userId } = await newClient(true);
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: crypto.randomUUID(),
      name: `Limit ${index}`,
      slug: `limit-${crypto.randomUUID()}`,
      created_by: userId,
      created_at: new Date(Date.now() - 120_000).toISOString(),
    }));
    createdShops.push(...rows.map((row) => row.id));
    const { error: insertError } = await admin.from("shops").insert(rows);
    if (insertError) throw insertError;
    const result = await client.rpc("create_shop", {
      p_name: "Sixth",
      p_slug: `sixth-${crypto.randomUUID()}`,
    });
    expect(result.error?.message).toContain("Shop creation limit reached");
  });
});
