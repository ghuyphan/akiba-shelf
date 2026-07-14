import { describe, expect, it } from "vitest";
import type { CartItem, PaymentSettings, Product } from "../types/catalog";
import { generateVietQr, generateVietQrForCart } from "./vietqr";

const payment: PaymentSettings = {
  momo_qr_url: "",
  bank_qr_url: "",
  momo_label: "",
  bank_label: "",
  bank_acq_id: "970436",
  bank_account_no: "123456789",
  bank_account_name: "Matsuri Booth",
  bank_add_info_template: "{code} {item} {amount}",
  payment_instructions: "",
};

const product: Product = {
  id: "product-1",
  name: "Moonlight Stand",
  collection: "Moonlight",
  description: "",
  price_vnd: 120_000,
  item_code: "MOON-1",
  quantity_available: 5,
  category: "Acrylic",
  stock_status: "in_stock",
  stock_note: "",
  images: [],
  featured: false,
  sort_order: 0,
  active: true,
};

describe("VietQR image generation", () => {
  it("builds an encoded image URL without browser-side API credentials", async () => {
    const result = await generateVietQr(payment, product);

    expect(result?.source).toBe("image");
    expect(result?.src).toContain("/970436-123456789-compact2.png?");
    expect(result?.src).toContain("amount=120000");
    expect(result?.src).toContain("addInfo=MOON-1+Moonlight+Stand+120000");
    expect(result?.src).toContain("accountName=Matsuri+Booth");
  });

  it("limits cart transfer descriptions to VietQR's 50-character field", async () => {
    const cart: CartItem[] = [
      {
        product: {
          ...product,
          name: "A very long product name that must be shortened safely",
        },
        quantity: 2,
      },
    ];
    const result = await generateVietQrForCart(
      payment,
      cart,
      "ORDER-123456789",
    );
    const addInfo = new URL(result?.src ?? "").searchParams.get("addInfo");

    expect(addInfo).toHaveLength(50);
    expect(addInfo).toMatch(/^ORDER-123456789/);
  });

  it("returns null when bank details are incomplete", async () => {
    await expect(
      generateVietQr({ ...payment, bank_account_no: "" }, product),
    ).resolves.toBeNull();
  });
});
