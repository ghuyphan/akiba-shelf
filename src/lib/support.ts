import type { PaymentSettings } from "../types/catalog";

export const SUPPORT_LINK = "https://buymeacoffee.com/ghuyphan";
export const SUPPORT_PRESET_AMOUNTS = [
  20_000, 50_000, 100_000, 250_000,
] as const;
export const SUPPORT_TRANSFER_NOTE = "SUPPORT MATSURI";

export const SUPPORT_BANK_PAYMENT: PaymentSettings = {
  momo_qr_url: "",
  bank_qr_url: "",
  momo_label: "MoMo",
  bank_label: "TPBank",
  bank_code: "TPBank",
  bank_acq_id: "970423",
  bank_account_no: "0853300850",
  bank_account_name: "Phan Gia Huy",
  bank_add_info_template: SUPPORT_TRANSFER_NOTE,
  payment_instructions: "",
};

export const SUPPORT_MOMO = {
  phone: "0853300850",
  accountName: "Pha Gia Huy",
} as const;

export const SUPPORT_MOMO_LINK = `https://nhantien.momo.vn/${SUPPORT_MOMO.phone}`;
