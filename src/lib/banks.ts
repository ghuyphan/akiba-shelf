import vietQrBanks from "../data/vietQRBanks.json";

export type VietQrBank = {
  code: string;
  name: string;
  full_name: string;
  bin: string;
};

const banks = (vietQrBanks.banks as VietQrBank[]).sort((first, second) => first.name.localeCompare(second.name));

export function getVietQrBanks() {
  return banks;
}

export function getBankByCode(code?: string) {
  if (!code) return undefined;
  return banks.find((bank) => bank.code === code);
}

export function getBankByBin(bin?: string) {
  if (!bin) return undefined;
  return banks.find((bank) => bank.bin === bin);
}

export function getPaymentBank(code?: string, bin?: string) {
  return getBankByCode(code) ?? getBankByBin(bin);
}

export function getBankLogoUrl(bank?: Pick<VietQrBank, "code">) {
  return `${import.meta.env.BASE_URL}bank-logos/${bank?.code ?? "default"}.png`;
}
