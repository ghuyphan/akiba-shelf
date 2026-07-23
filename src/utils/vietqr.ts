import QRCode from "qrcode";
import type { CartItem, PaymentSettings, Product } from "../types/catalog";
import { safePublicUrl } from "../lib/branding";
import { getProductPrice } from "./pricing";

type GeneratedVietQr = {
  src: string;
  source: "local";
};

const VIETQR_GUID = "A000000727";
const VIETQR_SERVICE = "QRIBFTTA";
const encoder = new TextEncoder();

function byteLength(value: string) {
  return encoder.encode(value).length;
}

function tlv(id: string, value: string) {
  return `${id}${String(byteLength(value)).padStart(2, "0")}${value}`;
}

function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of encoder.encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function truncateUtf8(value: string, maxBytes: number) {
  let result = "";
  for (const character of value) {
    if (byteLength(result + character) > maxBytes) break;
    result += character;
  }
  return result.trim();
}

function buildVietQrPayload(
  settings: PaymentSettings,
  amount: number,
  addInfo: string,
) {
  const acqId = settings.bank_acq_id?.trim() ?? "";
  const accountNo = settings.bank_account_no?.replace(/\s/g, "") ?? "";
  const beneficiary = tlv("00", acqId) + tlv("01", accountNo);
  const merchantAccount =
    tlv("00", VIETQR_GUID) +
    tlv("01", beneficiary) +
    tlv("02", VIETQR_SERVICE);
  let payload =
    tlv("00", "01") +
    tlv("01", amount > 0 ? "12" : "11") +
    tlv("38", merchantAccount) +
    tlv("53", "704");
  if (amount > 0) payload += tlv("54", String(Math.round(amount)));
  payload += tlv("58", "VN");
  if (addInfo) payload += tlv("62", tlv("08", truncateUtf8(addInfo, 50)));
  payload += "6304";
  return payload + crc16(payload);
}

function fillTemplate(
  template: string | undefined,
  product: Product | undefined,
) {
  const fallback = product
    ? `Booth order ${product.item_code}`
    : "Booth payment";
  if (!template) return fallback;

  return template
    .replace(/\{code\}/g, product?.item_code ?? "")
    .replace(/\{item\}/g, product?.name ?? "")
    .replace(/\{amount\}/g, product ? String(getProductPrice(product)) : "")
    .trim();
}

async function renderVietQr(
  settings: PaymentSettings,
  amount: number,
  addInfo: string,
): Promise<GeneratedVietQr> {
  const payload = buildVietQrPayload(settings, amount, addInfo);
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: "#07152a", light: "#ffffff" },
  });
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    source: "local",
  };
}

export function canGenerateVietQr(settings: PaymentSettings) {
  return Boolean(
    settings.bank_acq_id?.trim() && settings.bank_account_no?.trim(),
  );
}

export function getPaymentQrFallbackUrl(settings: PaymentSettings) {
  return (
    safePublicUrl(settings.bank_qr_url) ??
    safePublicUrl(settings.momo_qr_url) ??
    ""
  );
}

export function hasUsablePayment(settings: PaymentSettings | undefined) {
  return Boolean(
    settings &&
      (canGenerateVietQr(settings) || getPaymentQrFallbackUrl(settings)),
  );
}

export async function generateVietQr(
  settings: PaymentSettings,
  product?: Product,
): Promise<GeneratedVietQr | null> {
  if (!canGenerateVietQr(settings)) return null;
  const amount = product ? getProductPrice(product) : 0;
  return renderVietQr(
    settings,
    amount,
    fillTemplate(settings.bank_add_info_template, product),
  );
}

export async function generateVietQrForCart(
  settings: PaymentSettings,
  cart: CartItem[],
  orderCode?: string,
  amountOverride?: number,
): Promise<GeneratedVietQr | null> {
  if (!canGenerateVietQr(settings)) return null;

  const amount =
    amountOverride ??
    cart.reduce(
      (sum, item) => sum + getProductPrice(item.product) * item.quantity,
      0,
    );
  const codes = cart
    .map((item) => {
      const quantity = item.quantity + (item.reward_quantity ?? 0);
      return `${item.product.item_code}${quantity > 1 ? `x${quantity}` : ""}`;
    })
    .join(" ");
  const items = cart
    .map(
      (item) =>
        `${item.quantity + (item.reward_quantity ?? 0)}x ${item.product.name}`,
    )
    .join(", ");
  let addInfo = orderCode ?? `Booth order ${codes}`;
  if (settings.bank_add_info_template) {
    addInfo = settings.bank_add_info_template
      .replace(/\{code\}/g, orderCode ? `${orderCode} ${codes}` : codes)
      .replace(/\{item\}/g, items)
      .replace(/\{amount\}/g, String(amount))
      .trim();
  }
  return renderVietQr(settings, amount, truncateUtf8(addInfo, 50));
}
