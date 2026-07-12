import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const run = Boolean(url && anonKey && serviceKey);

describe.skipIf(!run)("database concurrency", () => {
  const admin = createClient(url || "http://127.0.0.1:54321", serviceKey || "disabled", { auth: { persistSession: false, storageKey: "akiba-db-admin" } });
  const customer = createClient(url || "http://127.0.0.1:54321", anonKey || "disabled", { auth: { persistSession: false, storageKey: "akiba-db-customer" } });
  const suffix = crypto.randomUUID();
  const productId = `concurrency-${suffix}`;
  const staffEmail = `staff-${suffix}@test.local`;
  const staffPassword = `Test-${suffix}!`;
  let staffUserId = "";
  let staff: ReturnType<typeof createClient>;

  beforeAll(async () => {
    const { error: productError } = await admin.from("products").insert({ id: productId, name: "Concurrency", item_code: `C-${suffix}`, price_vnd: 12345, quantity_available: 5, category: "Test", active: true });
    if (productError) throw productError;
    const { data: created, error: userError } = await admin.auth.admin.createUser({ email: staffEmail, password: staffPassword, email_confirm: true });
    if (userError) throw userError;
    staffUserId = created.user.id;
    const { error: memberError } = await admin.from("staff_members").insert({ user_id: staffUserId, role: "staff" });
    if (memberError) throw memberError;
    staff = createClient(url!, anonKey!, { auth: { persistSession: false, storageKey: "akiba-db-staff" } });
    const { error: loginError } = await staff.auth.signInWithPassword({ email: staffEmail, password: staffPassword });
    if (loginError) throw loginError;
  });

  afterAll(async () => {
    await admin.from("orders").delete().like("customer_name", `test-${suffix}%`);
    await admin.from("staff_members").delete().eq("user_id", staffUserId);
    if (staffUserId) await admin.auth.admin.deleteUser(staffUserId);
    await admin.from("products").delete().eq("id", productId);
  });

  it("serializes retries and prevents overselling", async () => {
    const requestId = crypto.randomUUID();
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const args = { p_customer_name: `test-${suffix}-retry`, p_items: [{ product_id: productId, quantity: 2 }], p_client_request_id: requestId, p_recovery_token: token };
    const retries = await Promise.all([customer.rpc("create_order", args), customer.rpc("create_order", args), customer.rpc("create_order", args)]);
    expect(retries.every((result) => !result.error)).toBe(true);
    expect(new Set(retries.map((result) => result.data?.[0]?.id)).size).toBe(1);

    const competing = await Promise.all([
      customer.rpc("create_order", { ...args, p_customer_name: `test-${suffix}-a`, p_client_request_id: crypto.randomUUID(), p_recovery_token: `${crypto.randomUUID()}${crypto.randomUUID()}`, p_items: [{ product_id: productId, quantity: 3 }] }),
      customer.rpc("create_order", { ...args, p_customer_name: `test-${suffix}-b`, p_client_request_id: crypto.randomUUID(), p_recovery_token: `${crypto.randomUUID()}${crypto.randomUUID()}`, p_items: [{ product_id: productId, quantity: 3 }] }),
    ]);
    expect(competing.filter((result) => !result.error)).toHaveLength(1);
    const { data: product } = await admin.from("products").select("quantity_available").eq("id", productId).single();
    expect(product?.quantity_available).toBe(0);
  });

  it("allows only one terminal transition", async () => {
    await admin.from("products").update({ quantity_available: 2, stock_status: "limited" }).eq("id", productId);
    const recoveryToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data, error } = await customer.rpc("create_order", { p_customer_name: `test-${suffix}-terminal`, p_items: [{ product_id: productId, quantity: 1 }], p_client_request_id: crypto.randomUUID(), p_recovery_token: recoveryToken });
    if (error) throw error;
    const orderId = data[0].id;
    const [confirmation, cancellation] = await Promise.all([
      (staff.rpc as any)("confirm_order_payment", { target_order_id: orderId }),
      customer.rpc("cancel_customer_order", { p_order_id: orderId, p_recovery_token: recoveryToken }),
    ]);
    const outcomes = [(confirmation.data as { outcome?: string } | null)?.outcome, (cancellation.data as { outcome?: string } | null)?.outcome];
    expect(outcomes.filter((outcome) => outcome === "confirmed" || outcome === "cancelled")).toHaveLength(1);
    const { data: order } = await admin.from("orders").select("status").eq("id", orderId).single();
    expect(["confirmed", "cancelled"]).toContain(order?.status);
  });
});
