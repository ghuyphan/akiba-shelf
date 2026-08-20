import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gamepad2,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  WifiOff,
} from "lucide-react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { hasUsablePayment } from "../../../utils/vietqr";
import { getPaymentBank } from "../../../utils/banks";
import { useMediaQuery } from "../../../hooks/shared/useMediaQuery";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
} from "../../../types/catalog";
import type { AdminViewTab } from "./adminWorkspaceTypes";

export type GuideSection = "checklist" | "convention" | "features";

type AdminGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
  booth: BoothSettings;
  payment: PaymentSettings;
  products: Product[];
  shopRole: "owner" | "admin" | "staff";
  shopSlug: string;
  onNavigateTab: (tab: AdminViewTab) => void;
  initialSection?: GuideSection;
};

export function AdminGuideModal({
  isOpen,
  onClose,
  booth,
  payment,
  products,
  shopRole,
  shopSlug,
  onNavigateTab,
  initialSection = "checklist",
}: AdminGuideModalProps) {
  const { t } = usePlatformI18n();
  const isCompact = useMediaQuery("(max-width: 1100px)");
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [activeSection, setActiveSection] = useState<GuideSection>(
    shopRole === "staff" ? "convention" : initialSection,
  );

  const isOwnerOrAdmin = shopRole !== "staff";
  const hasPayment = hasUsablePayment(payment);
  const paymentBank = hasPayment
    ? getPaymentBank(payment.bank_code, payment.bank_acq_id, payment.bank_label)
    : null;
  const activeProducts = products.filter((p) => p.active);
  const hasProducts = activeProducts.length > 0;
  const hasBoothInfo = Boolean(
    booth.booth_name.trim() && booth.subtitle.trim() && booth.location.trim(),
  );

  function handleJump(tab: AdminViewTab) {
    onClose();
    onNavigateTab(tab);
  }

  function handleOpenStorefront() {
    onClose();
    window.open(
      `/s/${encodeURIComponent(shopSlug)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <Modal
      title={t("Booth Guide & Playbook")}
      isOpen={isOpen}
      onClose={onClose}
      appearance="admin"
      mobileSheet={isMobile}
      wide
      className="admin-guide-modal"
    >
      <div className="admin-guide-shell">
        <div
          className="admin-guide-nav"
          role="tablist"
          aria-label={t("Guide categories")}
        >
          {isOwnerOrAdmin && (
            <button
              type="button"
              role="tab"
              aria-label={t("Launch Checklist")}
              aria-selected={activeSection === "checklist"}
              className={`admin-guide-nav-tab ${activeSection === "checklist" ? "is-active active" : ""}`}
              onClick={() => setActiveSection("checklist")}
            >
              <CheckCircle2 size={14} />
              <span className="tab-label-full">{t("Launch Checklist")}</span>
              <span className="tab-label-short">{t("Checklist")}</span>
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-label={t("Convention Cheat Sheet")}
            aria-selected={activeSection === "convention"}
            className={`admin-guide-nav-tab ${activeSection === "convention" ? "is-active active" : ""}`}
            onClick={() => setActiveSection("convention")}
          >
            <Clock size={14} />
            <span className="tab-label-full">{t("Convention Cheat Sheet")}</span>
            <span className="tab-label-short">{t("Cheat Sheet")}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-label={t("Feature Playbook")}
            aria-selected={activeSection === "features"}
            className={`admin-guide-nav-tab ${activeSection === "features" ? "is-active active" : ""}`}
            onClick={() => setActiveSection("features")}
          >
            <Sparkles size={14} />
            <span className="tab-label-full">{t("Feature Playbook")}</span>
            <span className="tab-label-short">{t("Playbook")}</span>
          </button>
        </div>

        <div className="admin-guide-content">
          {activeSection === "checklist" && isOwnerOrAdmin && (
            <>
              <div
                className="admin-guide-banner-tip is-clickable"
                role="button"
                tabIndex={0}
                aria-label={t("Open event mode")}
                onClick={() => handleJump("orders")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleJump("orders");
                  }
                }}
              >
                <div className="admin-guide-tip-content">
                  <WifiOff size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t(
                      "Spotty convention Wi-Fi? Use Offline Event Mode in Orders to sell without internet.",
                    )}
                  </span>
                </div>
                <span className="admin-guide-tip-action">
                  {t("Open event mode")} <ArrowRight size={12} />
                </span>
              </div>

              {/* Step 1: Payment */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-qr">
                  <div className="guide-qr-mockup">
                    <QrCode size={26} />
                    <span className="guide-qr-badge">
                      {paymentBank?.code || "QR"}
                    </span>
                  </div>
                </div>
                <div className="admin-guide-info">
                  <div className="admin-guide-title-row">
                    <span className="admin-guide-card-title">
                      {t("1. VietQR Bank Payment")}
                    </span>
                    <span
                      className={`admin-guide-badge ${hasPayment ? "admin-guide-badge-done" : "admin-guide-badge-todo"}`}
                    >
                      {hasPayment ? (
                        <>
                          <Check size={11} />
                          {t("Configured ({{bank}})", {
                            bank:
                              paymentBank?.name ||
                              payment.bank_label ||
                              payment.bank_code ||
                              "VietQR",
                          })}
                        </>
                      ) : (
                        t("Action needed")
                      )}
                    </span>
                  </div>
                  <p className="admin-guide-card-desc">
                    {t(
                      "Direct VietQR transfer payments to your bank account with automatic order matching.",
                    )}
                  </p>
                </div>
                <div className="admin-guide-card-action">
                  <Button
                    variant={hasPayment ? "secondary" : "primary"}
                    onClick={() =>
                      handleJump(isCompact ? "settings" : "design")
                    }
                  >
                    {hasPayment ? t("Review payment") : t("Set up payment")}
                  </Button>
                </div>
              </article>

              {/* Step 2: Catalog */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-catalog">
                  <div className="guide-catalog-mockup">
                    <span className="guide-card-pill">120k</span>
                    <Package size={22} />
                    <span className="guide-card-stock">
                      {activeProducts.length || 0}
                    </span>
                  </div>
                </div>
                <div className="admin-guide-info">
                  <div className="admin-guide-title-row">
                    <span className="admin-guide-card-title">
                      {t("2. Merch Catalog & Stock")}
                    </span>
                    <span
                      className={`admin-guide-badge ${hasProducts ? "admin-guide-badge-done" : "admin-guide-badge-todo"}`}
                    >
                      {hasProducts ? (
                        <>
                          <Check size={11} />
                          {t("{{count}} active items", {
                            count: activeProducts.length,
                          })}
                        </>
                      ) : (
                        t("0 active items")
                      )}
                    </span>
                  </div>
                  <p className="admin-guide-card-desc">
                    {t(
                      "List your prints, acrylic stands, charms, and stickers with prices and inventory limits.",
                    )}
                  </p>
                </div>
                <div className="admin-guide-card-action">
                  <Button
                    variant={hasProducts ? "secondary" : "primary"}
                    onClick={() => handleJump("products")}
                  >
                    {hasProducts ? t("Manage products") : t("Add products")}
                  </Button>
                </div>
              </article>

              {/* Step 3: Booth Info */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-booth">
                  <div className="guide-booth-mockup">
                    <Store size={22} />
                    <span className="guide-booth-pin">
                      <MapPin size={10} />
                      {booth.booth_code || booth.location || "A1"}
                    </span>
                  </div>
                </div>
                <div className="admin-guide-info">
                  <div className="admin-guide-title-row">
                    <span className="admin-guide-card-title">
                      {t("3. Booth Identity & Location")}
                    </span>
                    <span
                      className={`admin-guide-badge ${hasBoothInfo ? "admin-guide-badge-done" : "admin-guide-badge-todo"}`}
                    >
                      {hasBoothInfo ? (
                        <>
                          <Check size={11} />
                          {t("Ready")}
                        </>
                      ) : (
                        t("Missing details")
                      )}
                    </span>
                  </div>
                  <p className="admin-guide-card-desc">
                    {t(
                      "Set table number, hall row, booth bio, and opening hours so attendees can locate you easily.",
                    )}
                  </p>
                </div>
                <div className="admin-guide-card-action">
                  <Button
                    variant={hasBoothInfo ? "secondary" : "primary"}
                    onClick={() =>
                      handleJump(isCompact ? "settings" : "design")
                    }
                  >
                    {hasBoothInfo ? t("Edit booth info") : t("Complete booth")}
                  </Button>
                </div>
              </article>

              {/* Step 4: Test Checkout */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-storefront">
                  <div className="guide-phone-mockup">
                    <Smartphone size={24} />
                    <span className="guide-phone-pill">LIVE</span>
                  </div>
                </div>
                <div className="admin-guide-info">
                  <div className="admin-guide-title-row">
                    <span className="admin-guide-card-title">
                      {t("4. Customer Storefront Preview")}
                    </span>
                    <span className="admin-guide-badge admin-guide-badge-info">
                      /s/{shopSlug}
                    </span>
                  </div>
                  <p className="admin-guide-card-desc">
                    {t(
                      "Test adding items to cart, review mobile layout, and verify your VietQR code scan.",
                    )}
                  </p>
                </div>
                <div className="admin-guide-card-action">
                  <Button
                    variant="secondary"
                    icon={<ExternalLink size={14} />}
                    onClick={handleOpenStorefront}
                  >
                    {t("Open preview")}
                  </Button>
                </div>
              </article>
            </>
          )}

          {activeSection === "convention" && (
            <>
              {/* Emergency Card 1: 15-min reservation */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Clock size={17} />
                    {t("15-Minute Order Reservation")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-info">
                    {t("Auto Stock Protection")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Order Created")}</strong>
                    <small>{t("Stock Reserved")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("15-Min Window")}</strong>
                    <small>{t("VietQR Payment")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("Confirmed")}</strong>
                    <small>{t("Items Packed")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Reserved for 15 minutes upon checkout; auto-restored if unpaid.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("orders")}
                    >
                      {t("View orders")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Emergency Card 2: VietQR Reconciliation */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <ShieldCheck size={17} />
                    {t("Confirming Bank Payments")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Safe Banking")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Transfer Note")}</strong>
                    <code>MS-XXXX</code>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Order Code")}</strong>
                    <code>MS-XXXX</code>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("1-Click Confirm")}</strong>
                    <small>{t("Ready for Pickup")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Verify the transfer note on your bank app matches the order code.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("orders")}
                    >
                      {t("View orders")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Emergency Card 3: Offline Event Mode */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <WifiOff size={17} />
                    {t("Spotty / Dead Convention Wi-Fi")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-warning">
                    {t("Staff Tablet")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Allocate Stock")}</strong>
                    <small>{t("Online Setup")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Sell Offline")}</strong>
                    <small>{t("No Wi-Fi Needed")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("PIN End Session")}</strong>
                    <small>{t("Sync Orders")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Sell offline without internet; sync orders when back online.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("orders")}
                    >
                      {t("Offline Event Tools")}
                    </Button>
                  </div>
                )}
              </article>
            </>
          )}

          {activeSection === "features" && (
            <>
              {/* Feature 1: Gacha Pity Engine */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Gamepad2 size={17} />
                    {t("Gacha Minigame & Pity System")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Fair Odds")}
                  </span>
                </div>
                <div className="guide-diagram-pity">
                  <div className="guide-pity-bar">
                    <div className="guide-pity-progress" style={{ width: "80%" }} />
                  </div>
                  <div className="guide-pity-labels">
                    <span>{t("1 Roll")}</span>
                    <strong>{t("74 Soft Pity")}</strong>
                    <span>{t("90 Guaranteed 5★")}</span>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Standard gacha rates with pity; winning items deduct live catalog stock.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("gacha")}
                    >
                      {t("Open Gacha Manager")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Feature 2: Staff Tablet & PIN */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <ShieldCheck size={17} />
                    {t("Staff Tablet & PIN Security")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Offline PIN")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Staff Role")}</strong>
                    <small>{t("Orders Only")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Booth Tablet")}</strong>
                    <small>{t("Shared Device")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("6-Digit PIN")}</strong>
                    <small>{t("Secure Close")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Restrict staff to order processing; protect sensitive settings.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("team")}
                    >
                      {t("Manage Team Access")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Feature 3: Dual Catalog Sync */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Package size={17} />
                    {t("Unified Inventory Sync")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Real-time")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Storefront & Event")}</strong>
                    <small>{t("Online & Offline")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Gacha Pulls")}</strong>
                    <small>{t("Pity Wins")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("Real-Time Ledger")}</strong>
                    <small>{t("Zero Overselling")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t("All sales and gacha pulls share one live stock pool.")}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("products")}
                    >
                      {t("Manage live stock")}
                    </Button>
                  </div>
                )}
              </article>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
