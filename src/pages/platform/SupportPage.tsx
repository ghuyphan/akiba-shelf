import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Heart,
  Palette,
  PenLine,
} from "lucide-react";
import { AppHeader } from "../../components/ui/AppHeader";
import { PlatformFooter } from "../../components/platform/PlatformFooter";
import { PlatformHeaderBrand } from "../../components/platform/PlatformHeaderBrand";
import { PlatformLanguageToggle } from "../../components/platform/PlatformLanguageToggle";
import {
  DoodleSparkleArt,
  HighlighterStrokeArt,
  PaperClipArt,
  PushPinArt,
  WashiTapeArt,
} from "../../components/platform/LandingArt";
import { PLATFORM_BRAND } from "../../lib/branding";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";
import {
  SUPPORT_BANK_PAYMENT,
  SUPPORT_LINK,
  SUPPORT_MOMO,
  SUPPORT_MOMO_LINK,
  SUPPORT_PRESET_AMOUNTS,
  SUPPORT_TRANSFER_NOTE,
} from "../../lib/support";
import { formatVnd } from "../../utils/format";
import { generateVietQrForAmount } from "../../utils/vietqr";
import { useBackNavigation } from "../../hooks/shared/useBackNavigation";
import "../../styles/admin/admin.css";

const MAX_SUPPORT_AMOUNT = 100_000_000;

function normalizeAmount(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_SUPPORT_AMOUNT, Math.max(0, Math.round(parsed)));
}

export function SupportPage() {
  const { t } = usePlatformI18n();
  const goBack = useBackNavigation("/");
  const [amount, setAmount] = useState<number>(SUPPORT_PRESET_AMOUNTS[1]);
  const [customAmount, setCustomAmount] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [copied, setCopied] = useState<"bank" | "momo" | "">("");
  const selectedAmount = useMemo(
    () => normalizeAmount(customAmount) || amount,
    [amount, customAmount],
  );

  useEffect(() => {
    let cancelled = false;
    void generateVietQrForAmount(
      SUPPORT_BANK_PAYMENT,
      selectedAmount,
      SUPPORT_TRANSFER_NOTE,
    ).then((generated) => {
      if (!cancelled) setQrSrc(generated?.src ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [selectedAmount]);

  async function copyValue(kind: "bank" | "momo", value: string) {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1_800);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="admin-shell platform-home-shell platform-home-landing support-page-shell">
      <AppHeader
        brand={
          <PlatformHeaderBrand
            backTo="/"
            backLabel={t("Back")}
            onBack={(event) => {
              event.preventDefault();
              goBack();
            }}
            subtitle={t(PLATFORM_BRAND.descriptor)}
          />
        }
        actions={<PlatformLanguageToggle />}
      />

      <main className="admin-container platform-home-container support-page-container">
        <section className="support-page-hero">
          <div className="support-page-hero-copy">
            <span className="support-page-kicker">
              <Heart size={15} aria-hidden="true" fill="currentColor" />{" "}
              {t("Community supported")}
            </span>
            <h1>
              <span>
                {t("Keep Matsuri free for artists.")}
                <HighlighterStrokeArt className="support-title-underline" />
              </span>
            </h1>
            <p>
              {t(
                "Matsuri is free for artists. Optional support covers hosting and maintenance.",
              )}
            </p>
          </div>

          <aside className="support-page-promise">
            <WashiTapeArt
              pattern="grid"
              color="rgba(244, 207, 120, 0.85)"
              className="support-promise-tape"
              width={88}
              height={24}
            />
            <PaperClipArt
              variant="rosegold"
              className="support-promise-clip"
              width={20}
              height={40}
            />
            <div className="support-page-promise-tools" aria-hidden="true">
              <Palette size={17} />
              <PenLine size={17} />
            </div>
            <span>{t("Artist first")}</span>
            <strong>100%</strong>
            <p>{t("of booth sales stays with the artist")}</p>
            <ul>
              <li>{t("No artist subscription")}</li>
              <li>{t("No sales cut")}</li>
            </ul>
          </aside>
        </section>

        <section className="support-contribution-section">
          <header className="support-contribution-heading">
            <span>{t("One-time support")}</span>
            <h2>{t("Pick a way to support.")}</h2>
            <p>{t("Bank QR, MoMo, or coffee.")}</p>
          </header>

          <div className="support-payment-layout">
            <section className="support-payment-card support-bank-card">
              <WashiTapeArt
                pattern="dots"
                color="rgba(244, 207, 120, 0.8)"
                className="support-bank-tape"
                width={96}
                height={24}
              />
              <PaperClipArt
                variant="mint"
                className="support-bank-clip"
                width={22}
                height={44}
              />
              <header>
                <img
                  className="support-tpbank-logo"
                  src="/brand/tpbank.svg"
                  alt="TPBank"
                  width="40"
                  height="40"
                />
                <div>
                  <small>{t("Direct bank transfer")}</small>
                </div>
              </header>

              <div className="support-bank-content">
                <div className="support-qr-panel">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt={t("TPBank QR code to support Matsuri")}
                      width="280"
                      height="280"
                    />
                  ) : (
                    <span role="status">{t("Preparing QR code…")}</span>
                  )}
                  <strong>{formatVnd(selectedAmount)}</strong>
                  <small>{SUPPORT_TRANSFER_NOTE}</small>
                </div>

                <div className="support-bank-details">
                  <div>
                    <small>{t("Account name")}</small>
                    <strong>{SUPPORT_BANK_PAYMENT.bank_account_name}</strong>
                  </div>
                  <div>
                    <small>{t("Account number")}</small>
                    <button
                      type="button"
                      aria-label={t("Copy TPBank account number")}
                      onClick={() =>
                        void copyValue(
                          "bank",
                          SUPPORT_BANK_PAYMENT.bank_account_no ?? "",
                        )
                      }
                    >
                      <strong>{SUPPORT_BANK_PAYMENT.bank_account_no}</strong>
                      {copied === "bank" ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="support-amount-picker">
                <span id="support-amount-label">{t("Choose an amount")}</span>
                <div
                  className="support-amount-options"
                  role="group"
                  aria-labelledby="support-amount-label"
                >
                  {SUPPORT_PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={
                        !customAmount && amount === preset ? "is-selected" : ""
                      }
                      aria-pressed={!customAmount && amount === preset}
                      onClick={() => {
                        setAmount(preset);
                        setCustomAmount("");
                      }}
                    >
                      {formatVnd(preset)}
                    </button>
                  ))}
                </div>
                <label className="support-custom-amount">
                  <span>{t("Custom amount")}</span>
                  <span className="support-custom-amount-field">
                    <input
                      type="number"
                      aria-label={t("Custom amount")}
                      inputMode="numeric"
                      min="1000"
                      max={MAX_SUPPORT_AMOUNT}
                      step="1000"
                      value={customAmount}
                      placeholder="0"
                      onChange={(event) => setCustomAmount(event.target.value)}
                    />
                    <strong>VND</strong>
                  </span>
                </label>
              </div>
            </section>

            <aside className="support-side-column">
              <section className="support-coffee-card">
                <PushPinArt
                  color="coral"
                  className="support-coffee-pin"
                  size={24}
                />
                <span className="support-coffee-mark" aria-hidden="true">
                  <img
                    src="/brand/buy-me-a-coffee.svg"
                    alt=""
                    width="26"
                    height="26"
                  />
                </span>
                <div>
                  <small>{t("From anywhere")}</small>
                  <h2>{t("Buy me a coffee")}</h2>
                  <p>
                    {t(
                      "One-time support is enough. There is no automatic renewal.",
                    )}
                  </p>
                </div>
                <a
                  className="button button-primary support-coffee-button"
                  href={SUPPORT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{t("Open Buy Me a Coffee")}</span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </section>

              <section className="support-payment-card support-momo-card">
                <PushPinArt
                  color="lavender"
                  className="support-momo-pin"
                  size={24}
                />
                <header>
                  <span className="support-momo-logo-wrap">
                    <img
                      className="support-momo-logo"
                      src="/brand/momo.svg"
                      alt=""
                      width="40"
                      height="40"
                    />
                  </span>
                  <div>
                    <small>{t("Mobile wallet")}</small>
                    <h2>MoMo</h2>
                  </div>
                </header>
                <div className="support-method-details">
                  <div>
                    <small>{t("Account name")}</small>
                    <strong>{SUPPORT_MOMO.accountName}</strong>
                  </div>
                  <div>
                    <small>{t("Phone number")}</small>
                    <button
                      type="button"
                      aria-label={t("Copy MoMo phone number")}
                      onClick={() => void copyValue("momo", SUPPORT_MOMO.phone)}
                    >
                      <strong>{SUPPORT_MOMO.phone}</strong>
                      {copied === "momo" ? (
                        <Check size={16} />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <a
                  className="support-open-app support-open-momo"
                  href={SUPPORT_MOMO_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{t("Open MoMo")}</span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </section>
            </aside>
          </div>

          <div className="support-page-note">
            <DoodleSparkleArt size={18} className="support-note-sparkle" />
            <span aria-hidden="true">
              <Heart size={15} fill="currentColor" />
            </span>
            <p>{t("Support is optional. Matsuri stays free to use.")}</p>
          </div>
        </section>
      </main>

      <PlatformFooter
        showHomeLink={true}
        showSupportLink={false}
        showDemoLink={true}
        className="support-page-footer"
      />
    </div>
  );
}
