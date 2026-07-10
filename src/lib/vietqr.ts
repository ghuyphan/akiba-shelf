import type { CartItem, PaymentSettings, Product } from "../types/catalog";

type VietQrResponse = {
  data?: {
    qrDataURL?: string;
  };
};

type GeneratedVietQr = {
  src: string;
  source: "api" | "image";
};

const DEFAULT_VIETQR_GENERATE_URL = "https://api.vietqr.io/v2/generate";
const DEFAULT_VIETQR_IMAGE_BASE = "https://img.vietqr.io/image";

function fillTemplate(template: string | undefined, product: Product | undefined) {
  const fallback = product ? `Booth order ${product.item_code}` : "Booth payment";
  if (!template) return fallback;

  return template
    .replace(/\{code\}/g, product?.item_code ?? "")
    .replace(/\{item\}/g, product?.name ?? "")
    .replace(/\{amount\}/g, product ? String(product.price_vnd) : "")
    .trim();
}

function buildImageFallbackUrl(settings: PaymentSettings, amount: number, addInfo: string) {
  const acqId = settings.bank_acq_id?.trim();
  const accountNo = settings.bank_account_no?.trim();
  if (!acqId || !accountNo) return "";

  const params = new URLSearchParams();
  if (amount > 0) params.set("amount", String(amount));
  if (addInfo) params.set("addInfo", addInfo);
  if (settings.bank_account_name) params.set("accountName", settings.bank_account_name);

  return `${DEFAULT_VIETQR_IMAGE_BASE}/${acqId}-${accountNo}-compact2.png?${params.toString()}`;
}

export function canGenerateVietQr(settings: PaymentSettings) {
  return Boolean(settings.bank_acq_id?.trim() && settings.bank_account_no?.trim());
}

export async function generateVietQr(settings: PaymentSettings, product?: Product): Promise<GeneratedVietQr | null> {
  if (!canGenerateVietQr(settings)) return null;

  const amount = product?.price_vnd ?? 0;
  const addInfo = fillTemplate(settings.bank_add_info_template, product);
  const imageUrl = buildImageFallbackUrl(settings, amount, addInfo);
  if (imageUrl) return { src: imageUrl, source: "image" };

  const apiUrl = import.meta.env.VITE_VIETQR_API_URL_GENERATE || DEFAULT_VIETQR_GENERATE_URL;
  const clientId = import.meta.env.VITE_VIETQR_API_CLIENT_ID;
  const apiKey = import.meta.env.VITE_VIETQR_API_CLIENT_SECRET;

  if (clientId && apiKey) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          accountNo: settings.bank_account_no,
          accountName: settings.bank_account_name,
          acqId: settings.bank_acq_id,
          amount,
          addInfo,
          template: "compact",
        }),
      });

      if (!response.ok) throw new Error(`VietQR request failed with ${response.status}`);
      const data = (await response.json()) as VietQrResponse;
      if (data.data?.qrDataURL) return { src: data.data.qrDataURL, source: "api" };
    } catch (error) {
      console.warn("Could not generate VietQR from API:", error);
    }
  }

  return null;
}

export async function generateVietQrForCart(
  settings: PaymentSettings,
  cart: CartItem[],
  orderCode?: string,
  amountOverride?: number,
): Promise<GeneratedVietQr | null> {
  if (!canGenerateVietQr(settings)) return null;

  const amount = amountOverride ?? cart.reduce((sum, item) => sum + item.product.price_vnd * item.quantity, 0);

  // Construct combined info
  const codesStr = cart.map(item => `${item.product.item_code}${item.quantity > 1 ? `x${item.quantity}` : ""}`).join(" ");
  const itemsStr = cart.map(item => `${item.quantity}x ${item.product.name}`).join(", ");

  const fallback = orderCode ? `${orderCode}` : `Booth order ${codesStr}`;
  let addInfo = fallback;
  if (settings.bank_add_info_template) {
    addInfo = settings.bank_add_info_template
      .replace(/\{code\}/g, orderCode ? `${orderCode} ${codesStr}` : codesStr)
      .replace(/\{item\}/g, itemsStr)
      .replace(/\{amount\}/g, String(amount))
      .trim();
  } else if (orderCode) {
    addInfo = `${orderCode}`;
  }

  if (addInfo.length > 50) {
    addInfo = addInfo.substring(0, 50).trim();
  }

  const imageUrl = buildImageFallbackUrl(settings, amount, addInfo);
  if (imageUrl) return { src: imageUrl, source: "image" };

  const apiUrl = import.meta.env.VITE_VIETQR_API_URL_GENERATE || DEFAULT_VIETQR_GENERATE_URL;
  const clientId = import.meta.env.VITE_VIETQR_API_CLIENT_ID;
  const apiKey = import.meta.env.VITE_VIETQR_API_CLIENT_SECRET;

  if (clientId && apiKey) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          accountNo: settings.bank_account_no,
          accountName: settings.bank_account_name,
          acqId: settings.bank_acq_id,
          amount,
          addInfo,
          template: "compact",
        }),
      });

      if (!response.ok) throw new Error(`VietQR request failed with ${response.status}`);
      const data = (await response.json()) as VietQrResponse;
      if (data.data?.qrDataURL) return { src: data.data.qrDataURL, source: "api" };
    } catch (error) {
      console.warn("Could not generate VietQR from API:", error);
    }
  }

  return null;
}
