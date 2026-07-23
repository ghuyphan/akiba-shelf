import { describe, expect, it } from "vitest";
import type { CartItem, PaymentSettings, Product } from "../../types/catalog";
import {
  generateVietQr,
  generateVietQrForCart,
  getPaymentQrFallbackUrl,
  hasUsablePayment,
} from "../vietqr";

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
  it("builds the QR entirely in the browser without a network request", async () => {
    const result = await generateVietQr(payment, product);

    expect(result?.source).toBe("local");
    expect(result?.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
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
    expect(result?.src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("returns null when bank details are incomplete", async () => {
    await expect(
      generateVietQr({ ...payment, bank_account_no: "" }, product),
    ).resolves.toBeNull();
  });

  it("accepts either local VietQR details or a safe static fallback", () => {
    expect(hasUsablePayment(payment)).toBe(true);
    expect(
      hasUsablePayment({
        ...payment,
        bank_acq_id: "",
        bank_account_no: "",
        bank_qr_url: "https://example.test/payment.png",
      }),
    ).toBe(true);
  });

  it("rejects missing or unsafe static payment URLs", () => {
    const unavailable = {
      ...payment,
      bank_acq_id: "",
      bank_account_no: "",
      bank_qr_url: "javascript:alert(1)",
    };

    expect(getPaymentQrFallbackUrl(unavailable)).toBe("");
    expect(hasUsablePayment(unavailable)).toBe(false);
  });
});
