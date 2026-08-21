import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gamepad2,
  Lock,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Volume2,
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
  onNavigateTab: (tab: AdminViewTab, spotlightKey?: string) => void;
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
  const hasQrStand = hasPayment && Boolean(booth.booth_name.trim());

  // Overall readiness checklist
  const checklistItems = [
    { key: "payment", complete: hasPayment },
    { key: "catalog", complete: hasProducts },
    { key: "identity", complete: hasBoothInfo },
    { key: "table-stand", complete: hasQrStand },
  ];
  const completedCount = checklistItems.filter((item) => item.complete).length;
  const totalCount = checklistItems.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  function handleJump(tab: AdminViewTab, spotlightKey?: string) {
    onClose();
    onNavigateTab(tab, spotlightKey);
  }

  function handleOpenStorefront() {
    onClose();
    window.open(
      `/s/${encodeURIComponent(shopSlug)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleTabKeyDown(
    e: React.KeyboardEvent,
    currentTab: GuideSection,
  ) {
    const tabs: GuideSection[] = isOwnerOrAdmin
      ? ["checklist", "convention", "features"]
      : ["convention", "features"];
    const currentIndex = tabs.indexOf(currentTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextTab = tabs[(currentIndex + 1) % tabs.length];
      setActiveSection(nextTab);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      setActiveSection(prevTab);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveSection(tabs[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveSection(tabs[tabs.length - 1]);
    }
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
              id="guide-tab-checklist"
              aria-controls="guide-panel-checklist"
              aria-label={t("Launch Checklist")}
              aria-selected={activeSection === "checklist"}
              tabIndex={activeSection === "checklist" ? 0 : -1}
              className={`admin-guide-nav-tab ${activeSection === "checklist" ? "is-active" : ""}`}
              onClick={() => setActiveSection("checklist")}
              onKeyDown={(e) => handleTabKeyDown(e, "checklist")}
            >
              <CheckCircle2 size={14} />
              <span className="tab-label-full">{t("Launch Checklist")}</span>
              <span className="tab-label-short">{t("Checklist")}</span>
            </button>
          )}
          <button
            type="button"
            role="tab"
            id="guide-tab-convention"
            aria-controls="guide-panel-convention"
            aria-label={t("Convention Cheat Sheet")}
            aria-selected={activeSection === "convention"}
            tabIndex={activeSection === "convention" ? 0 : -1}
            className={`admin-guide-nav-tab ${activeSection === "convention" ? "is-active" : ""}`}
            onClick={() => setActiveSection("convention")}
            onKeyDown={(e) => handleTabKeyDown(e, "convention")}
          >
            <Clock size={14} />
            <span className="tab-label-full">{t("Convention Cheat Sheet")}</span>
            <span className="tab-label-short">{t("Cheat Sheet")}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="guide-tab-features"
            aria-controls="guide-panel-features"
            aria-label={t("Feature Playbook")}
            aria-selected={activeSection === "features"}
            tabIndex={activeSection === "features" ? 0 : -1}
            className={`admin-guide-nav-tab ${activeSection === "features" ? "is-active" : ""}`}
            onClick={() => setActiveSection("features")}
            onKeyDown={(e) => handleTabKeyDown(e, "features")}
          >
            <Sparkles size={14} />
            <span className="tab-label-full">{t("Feature Playbook")}</span>
            <span className="tab-label-short">{t("Playbook")}</span>
          </button>
        </div>

        <div className="admin-guide-content">
          {activeSection === "checklist" && isOwnerOrAdmin && (
            <div
              id="guide-panel-checklist"
              role="tabpanel"
              aria-labelledby="guide-tab-checklist"
              className="admin-guide-tabpanel"
            >
              {/* Readiness Progress Bar Header */}
              <div className="admin-guide-progress-card">
                <div className="admin-guide-progress-header">
                  <span className="admin-guide-progress-title">
                    <CheckCircle2 size={15} />
                    {t("Shop readiness progress")}
                  </span>
                  <span className="admin-guide-progress-stat">
                    {t("{{done}}/{{total}} ready ({{percent}}%)", {
                      done: completedCount,
                      total: totalCount,
                      percent: progressPercent,
                    })}
                  </span>
                </div>
                <div className="admin-guide-progress-track">
                  <div
                    className="admin-guide-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Fast Banner Tip */}
              <button
                type="button"
                className="admin-guide-banner-tip is-clickable"
                aria-label={t("Open event mode")}
                onClick={() => handleJump("orders", "offline-event-tools")}
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
              </button>

              {/* Step 1: Payment */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-qr">
                  <div className="guide-qr-mockup">
                    <QrCode size={26} />
                    <span className="guide-qr-badge">
                      {paymentBank?.code || "VietQR"}
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
                      handleJump(
                        isCompact ? "settings" : "design",
                        "payment-settings",
                      )
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
                    onClick={() => handleJump("products", "add-product-btn")}
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
                      handleJump(
                        isCompact ? "settings" : "design",
                        "booth-settings",
                      )
                    }
                  >
                    {hasBoothInfo ? t("Edit booth info") : t("Complete booth")}
                  </Button>
                </div>
              </article>

              {/* Step 4: Printable Table Stand QR */}
              <article className="admin-guide-card admin-guide-card-checklist">
                <div className="admin-guide-visual admin-guide-visual-standee">
                  <div className="guide-standee-mockup">
                    <QrCode size={20} />
                    <span className="guide-standee-pill">STAND</span>
                  </div>
                </div>
                <div className="admin-guide-info">
                  <div className="admin-guide-title-row">
                    <span className="admin-guide-card-title">
                      {t("4. Table QR Stand & Signage")}
                    </span>
                    <span
                      className={`admin-guide-badge ${hasQrStand ? "admin-guide-badge-done" : "admin-guide-badge-todo"}`}
                    >
                      {hasQrStand ? (
                        <>
                          <Check size={11} />
                          {t("Ready to print")}
                        </>
                      ) : (
                        t("Action needed")
                      )}
                    </span>
                  </div>
                  <p className="admin-guide-card-desc">
                    {t(
                      "Display an acrylic QR stand on your table so attendees can scan and place orders instantly.",
                    )}
                  </p>
                </div>
                <div className="admin-guide-card-action">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleJump(
                        isCompact ? "settings" : "design",
                        "qr-table-stand",
                      )
                    }
                  >
                    {t("View table stand")}
                  </Button>
                </div>
              </article>

              {/* Step 5: Test Checkout & Preview */}
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
                      {t("5. Customer Storefront Preview")}
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
            </div>
          )}

          {activeSection === "convention" && (
            <div
              id="guide-panel-convention"
              role="tabpanel"
              aria-labelledby="guide-tab-convention"
              className="admin-guide-tabpanel"
            >
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
                    <small>{t("Stock Finalized")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Reserved for 15 minutes upon checkout; auto-restored to catalog if unpaid.",
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

              {/* Emergency Card 2: VietQR Reconciliation & Split Screen */}
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
                <div className="guide-bank-split-preview">
                  <div className="guide-split-box guide-split-banking">
                    <span className="guide-split-tag">
                      <BellRing size={11} /> {t("Bank notification")}
                    </span>
                    <strong>+120.000 VND</strong>
                    <code>ND: MS-4821</code>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-split-box guide-split-matsuri">
                    <span className="guide-split-tag">
                      <Package size={11} /> {t("Order #MS-4821")}
                    </span>
                    <span className="guide-split-btn">
                      <Check size={11} /> {t("1-Click Confirm")}
                    </span>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Verify the transfer note on your bank app matches the order code before clicking Confirm.",
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

              {/* Emergency Card 3: Complete Order Lifecycle */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Package size={17} />
                    {t("Full Order Lifecycle")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-info">
                    {t("Fulfillment")}
                  </span>
                </div>
                <div className="guide-diagram-flow guide-pipeline-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Pending")}</strong>
                    <small>{t("Unpaid (15m)")}</small>
                  </div>
                  <ArrowRight size={13} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-highlight">
                    <strong>{t("Confirmed")}</strong>
                    <small>{t("Paid / Verify")}</small>
                  </div>
                  <ArrowRight size={13} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Packed")}</strong>
                    <small>{t("Bagged")}</small>
                  </div>
                  <ArrowRight size={13} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("Completed")}</strong>
                    <small>{t("Picked up")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Track orders from customer checkout to packing and fan pickup at the table.",
                  )}
                </p>
              </article>

              {/* Emergency Card 4: Spotty / Dead Wi-Fi */}
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
                      onClick={() =>
                        handleJump("orders", "offline-event-tools")
                      }
                    >
                      {t("Offline Event Tools")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Emergency Card 5: Audio & Push Alerts */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Volume2 size={17} />
                    {t("Sound Chime & Push Alerts")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Live Alert")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("Action Menu (…)")}</strong>
                    <small>{t("Header")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Enable Alerts")}</strong>
                    <small>{t("Grant Permission")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("Audio Chime")}</strong>
                    <small>{t("Never Miss Order")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Turn on audio and push alerts so your phone rings whenever a fan places an order in a noisy hall.",
                  )}
                </p>
                <div className="admin-guide-card-action">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      handleJump("orders", "push-notifications")
                    }
                  >
                    {t("Configure alerts")}
                  </Button>
                </div>
              </article>
            </div>
          )}

          {activeSection === "features" && (
            <div
              id="guide-panel-features"
              role="tabpanel"
              aria-labelledby="guide-tab-features"
              className="admin-guide-tabpanel"
            >
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
                    <div
                      className="guide-pity-progress"
                      style={{ width: "82%" }}
                    />
                  </div>
                  <div className="guide-pity-labels">
                    <span>{t("1 Roll")}</span>
                    <strong>
                      <Sparkles size={11} /> {t("74 Soft Pity")}
                    </strong>
                    <span>{t("90 Guaranteed 5★")}</span>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Standard gacha rates with pity; winning items deduct live catalog stock automatically.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("gacha", "gacha-manager")}
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
                    <Lock size={17} />
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
                    "Restrict staff to order processing; protect sensitive settings and prevent unauthorized closing.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("team", "team-manager")}
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
                  {t(
                    "All sales, offline event orders, and gacha pulls share one live stock pool.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() => handleJump("products", "add-product-btn")}
                    >
                      {t("Manage live stock")}
                    </Button>
                  </div>
                )}
              </article>

              {/* Feature 4: Automated VietQR & payOS Webhooks */}
              <article className="admin-guide-card">
                <div className="admin-guide-card-header">
                  <span className="admin-guide-card-title">
                    <Sparkles size={17} />
                    {t("Automated VietQR & payOS Alerts")}
                  </span>
                  <span className="admin-guide-badge admin-guide-badge-done">
                    {t("Hands-free")}
                  </span>
                </div>
                <div className="guide-diagram-flow">
                  <div className="guide-diagram-step">
                    <strong>{t("payOS / Bank")}</strong>
                    <small>{t("Open Banking")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step">
                    <strong>{t("Webhook Alert")}</strong>
                    <small>{t("HMAC-SHA256")}</small>
                  </div>
                  <ArrowRight size={14} className="guide-diagram-arrow" />
                  <div className="guide-diagram-step is-success">
                    <strong>{t("Instant Order Unlock")}</strong>
                    <small>{t("Zero Manual Clicks")}</small>
                  </div>
                </div>
                <p className="admin-guide-card-desc">
                  {t(
                    "Connect payOS or an Android notification forwarder for 100% automated, hands-free order confirmation.",
                  )}
                </p>
                {isOwnerOrAdmin && (
                  <div className="admin-guide-card-action">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        handleJump(
                          isCompact ? "settings" : "design",
                          "payment-settings",
                        )
                      }
                    >
                      {t("Configure Auto-Confirm")}
                    </Button>
                  </div>
                )}
              </article>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
