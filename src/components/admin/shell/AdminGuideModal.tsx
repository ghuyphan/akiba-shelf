import { Fragment, useState, type ReactNode } from "react";
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

  const guideTabs: Array<{
    id: GuideSection;
    label: string;
    shortLabel: string;
    icon: typeof CheckCircle2;
  }> = [
    ...(isOwnerOrAdmin
      ? [
          {
            id: "checklist" as const,
            label: t("Launch Checklist"),
            shortLabel: t("Checklist"),
            icon: CheckCircle2,
          },
        ]
      : []),
    {
      id: "convention" as const,
      label: t("Convention Cheat Sheet"),
      shortLabel: t("Cheat Sheet"),
      icon: Clock,
    },
    {
      id: "features" as const,
      label: t("Feature Playbook"),
      shortLabel: t("Playbook"),
      icon: Sparkles,
    },
  ];

  function handleTabKeyDown(
    e: React.KeyboardEvent,
    currentTab: GuideSection,
  ) {
    const tabIds = guideTabs.map((tab) => tab.id);
    const currentIndex = tabIds.indexOf(currentTab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveSection(tabIds[(currentIndex + 1) % tabIds.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveSection(tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveSection(tabIds[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveSection(tabIds[tabIds.length - 1]);
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
          {guideTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`guide-tab-${tab.id}`}
                aria-controls={`guide-panel-${tab.id}`}
                aria-label={tab.label}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`admin-guide-nav-tab ${isActive ? "is-active" : ""}`}
                onClick={() => setActiveSection(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
              >
                <Icon size={14} />
                <span className="tab-label-full">{tab.label}</span>
                <span className="tab-label-short">{tab.shortLabel}</span>
              </button>
            );
          })}
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
              <ChecklistCard
                visualClass="admin-guide-visual-qr"
                visual={
                  <div className="guide-qr-mockup">
                    <QrCode size={26} />
                    <span className="guide-qr-badge">
                      {paymentBank?.code || "VietQR"}
                    </span>
                  </div>
                }
                title={t("1. VietQR Bank Payment")}
                isComplete={hasPayment}
                badgeContent={
                  hasPayment ? (
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
                  )
                }
                description={t(
                  "Direct VietQR transfer payments to your bank account with automatic order matching.",
                )}
                actionButton={
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
                }
              />

              {/* Step 2: Catalog */}
              <ChecklistCard
                visualClass="admin-guide-visual-catalog"
                visual={
                  <div className="guide-catalog-mockup">
                    <span className="guide-card-pill">120k</span>
                    <Package size={22} />
                    <span className="guide-card-stock">
                      {activeProducts.length || 0}
                    </span>
                  </div>
                }
                title={t("2. Merch Catalog & Stock")}
                isComplete={hasProducts}
                badgeContent={
                  hasProducts ? (
                    <>
                      <Check size={11} />
                      {t("{{count}} active items", {
                        count: activeProducts.length,
                      })}
                    </>
                  ) : (
                    t("0 active items")
                  )
                }
                description={t(
                  "List your prints, acrylic stands, charms, and stickers with prices and inventory limits.",
                )}
                actionButton={
                  <Button
                    variant={hasProducts ? "secondary" : "primary"}
                    onClick={() => handleJump("products", "add-product-btn")}
                  >
                    {hasProducts ? t("Manage products") : t("Add products")}
                  </Button>
                }
              />

              {/* Step 3: Booth Info */}
              <ChecklistCard
                visualClass="admin-guide-visual-booth"
                visual={
                  <div className="guide-booth-mockup">
                    <Store size={22} />
                    <span className="guide-booth-pin">
                      <MapPin size={10} />
                      {booth.booth_code || booth.location || "A1"}
                    </span>
                  </div>
                }
                title={t("3. Booth Identity & Location")}
                isComplete={hasBoothInfo}
                badgeContent={
                  hasBoothInfo ? (
                    <>
                      <Check size={11} />
                      {t("Ready")}
                    </>
                  ) : (
                    t("Missing details")
                  )
                }
                description={t(
                  "Set table number, hall row, booth bio, and opening hours so attendees can locate you easily.",
                )}
                actionButton={
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
                }
              />

              {/* Step 4: Printable Table Stand QR */}
              <ChecklistCard
                visualClass="admin-guide-visual-standee"
                visual={
                  <div className="guide-standee-mockup">
                    <QrCode size={20} />
                    <span className="guide-standee-pill">STAND</span>
                  </div>
                }
                title={t("4. Table QR Stand & Signage")}
                isComplete={hasQrStand}
                badgeContent={
                  hasQrStand ? (
                    <>
                      <Check size={11} />
                      {t("Ready to print")}
                    </>
                  ) : (
                    t("Action needed")
                  )
                }
                description={t(
                  "Display an acrylic QR stand on your table so attendees can scan and place orders instantly.",
                )}
                actionButton={
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
                }
              />

              {/* Step 5: Test Checkout & Preview */}
              <ChecklistCard
                visualClass="admin-guide-visual-storefront"
                visual={
                  <div className="guide-phone-mockup">
                    <Smartphone size={24} />
                    <span className="guide-phone-pill">LIVE</span>
                  </div>
                }
                title={t("5. Customer Storefront Preview")}
                badgeClass="admin-guide-badge-info"
                badgeContent={`/s/${shopSlug}`}
                description={t(
                  "Test adding items to cart, review mobile layout, and verify your VietQR code scan.",
                )}
                actionButton={
                  <Button
                    variant="secondary"
                    icon={<ExternalLink size={14} />}
                    onClick={handleOpenStorefront}
                  >
                    {t("Open preview")}
                  </Button>
                }
              />
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
              <GuideCard
                icon={Clock}
                title={t("15-Minute Order Reservation")}
                badge={{ label: t("Auto Stock Protection"), variant: "info" }}
                description={t(
                  "Reserved for 15 minutes upon checkout; auto-restored to catalog if unpaid.",
                )}
                action={
                  isOwnerOrAdmin
                    ? { label: t("View orders"), onClick: () => handleJump("orders") }
                    : undefined
                }
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("Order Created"), subtitle: t("Stock Reserved") },
                    { title: t("15-Min Window"), subtitle: t("VietQR Payment") },
                    { title: t("Confirmed"), subtitle: t("Stock Finalized"), variant: "success" },
                  ]}
                />
              </GuideCard>

              {/* Emergency Card 2: VietQR Reconciliation & Split Screen */}
              <GuideCard
                icon={ShieldCheck}
                title={t("Confirming Bank Payments")}
                badge={{ label: t("Safe Banking"), variant: "done" }}
                description={t(
                  "Verify the transfer note on your bank app matches the order code before clicking Confirm.",
                )}
                action={
                  isOwnerOrAdmin
                    ? { label: t("View orders"), onClick: () => handleJump("orders") }
                    : undefined
                }
              >
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
              </GuideCard>

              {/* Emergency Card 3: Complete Order Lifecycle */}
              <GuideCard
                icon={Package}
                title={t("Full Order Lifecycle")}
                badge={{ label: t("Fulfillment"), variant: "info" }}
                description={t(
                  "Track orders from customer checkout to packing and fan pickup at the table.",
                )}
              >
                <GuideDiagramFlow
                  className="guide-pipeline-flow"
                  steps={[
                    { title: t("Pending"), subtitle: t("Unpaid (15m)") },
                    { title: t("Confirmed"), subtitle: t("Paid / Verify"), variant: "highlight" },
                    { title: t("Packed"), subtitle: t("Bagged") },
                    { title: t("Completed"), subtitle: t("Picked up"), variant: "success" },
                  ]}
                />
              </GuideCard>

              {/* Emergency Card 4: Spotty / Dead Wi-Fi */}
              <GuideCard
                icon={WifiOff}
                title={t("Spotty / Dead Convention Wi-Fi")}
                badge={{ label: t("Staff Tablet"), variant: "warning" }}
                description={t(
                  "Sell offline without internet; sync orders when back online.",
                )}
                action={
                  isOwnerOrAdmin
                    ? {
                        label: t("Offline Event Tools"),
                        onClick: () => handleJump("orders", "offline-event-tools"),
                      }
                    : undefined
                }
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("Allocate Stock"), subtitle: t("Online Setup") },
                    { title: t("Sell Offline"), subtitle: t("No Wi-Fi Needed") },
                    { title: t("PIN End Session"), subtitle: t("Sync Orders"), variant: "success" },
                  ]}
                />
              </GuideCard>

              {/* Emergency Card 5: Audio & Push Alerts */}
              <GuideCard
                icon={Volume2}
                title={t("Sound Chime & Push Alerts")}
                badge={{ label: t("Live Alert"), variant: "done" }}
                description={t(
                  "Turn on audio and push alerts so your phone rings whenever a fan places an order in a noisy hall.",
                )}
                action={{
                  label: t("Configure alerts"),
                  onClick: () => handleJump("orders", "push-notifications"),
                }}
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("Action Menu (…)"), subtitle: t("Header") },
                    { title: t("Enable Alerts"), subtitle: t("Grant Permission") },
                    { title: t("Audio Chime"), subtitle: t("Never Miss Order"), variant: "success" },
                  ]}
                />
              </GuideCard>
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
              <GuideCard
                icon={Gamepad2}
                title={t("Gacha Minigame & Pity System")}
                badge={{ label: t("Fair Odds"), variant: "done" }}
                description={t(
                  "Standard gacha rates with pity; winning items deduct live catalog stock automatically.",
                )}
                action={
                  isOwnerOrAdmin
                    ? {
                        label: t("Open Gacha Manager"),
                        onClick: () => handleJump("gacha", "gacha-manager"),
                      }
                    : undefined
                }
              >
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
              </GuideCard>

              {/* Feature 2: Staff Tablet & PIN */}
              <GuideCard
                icon={Lock}
                title={t("Staff Tablet & PIN Security")}
                badge={{ label: t("Offline PIN"), variant: "done" }}
                description={t(
                  "Restrict staff to order processing; protect sensitive settings and prevent unauthorized closing.",
                )}
                action={
                  isOwnerOrAdmin
                    ? {
                        label: t("Manage Team Access"),
                        onClick: () => handleJump("team", "team-manager"),
                      }
                    : undefined
                }
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("Staff Role"), subtitle: t("Orders Only") },
                    { title: t("Booth Tablet"), subtitle: t("Shared Device") },
                    { title: t("6-Digit PIN"), subtitle: t("Secure Close"), variant: "success" },
                  ]}
                />
              </GuideCard>

              {/* Feature 3: Dual Catalog Sync */}
              <GuideCard
                icon={Package}
                title={t("Unified Inventory Sync")}
                badge={{ label: t("Real-time"), variant: "done" }}
                description={t(
                  "All sales, offline event orders, and gacha pulls share one live stock pool.",
                )}
                action={
                  isOwnerOrAdmin
                    ? {
                        label: t("Manage live stock"),
                        onClick: () => handleJump("products", "add-product-btn"),
                      }
                    : undefined
                }
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("Storefront & Event"), subtitle: t("Online & Offline") },
                    { title: t("Gacha Pulls"), subtitle: t("Pity Wins") },
                    { title: t("Real-Time Ledger"), subtitle: t("Zero Overselling"), variant: "success" },
                  ]}
                />
              </GuideCard>

              {/* Feature 4: Automated VietQR & payOS Webhooks */}
              <GuideCard
                icon={Sparkles}
                title={t("Automated VietQR & payOS Alerts")}
                badge={{ label: t("Hands-free"), variant: "done" }}
                description={t(
                  "Connect payOS or an Android notification forwarder for 100% automated, hands-free order confirmation.",
                )}
                action={
                  isOwnerOrAdmin
                    ? {
                        label: t("Configure Auto-Confirm"),
                        onClick: () =>
                          handleJump(
                            isCompact ? "settings" : "design",
                            "payment-settings",
                          ),
                      }
                    : undefined
                }
              >
                <GuideDiagramFlow
                  steps={[
                    { title: t("payOS / Bank"), subtitle: t("Open Banking") },
                    { title: t("Webhook Alert"), subtitle: t("HMAC-SHA256") },
                    { title: t("Instant Order Unlock"), subtitle: t("Zero Manual Clicks"), variant: "success" },
                  ]}
                />
              </GuideCard>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ChecklistCard({
  visual,
  visualClass,
  title,
  isComplete,
  badgeContent,
  badgeClass,
  description,
  actionButton,
}: {
  visual: ReactNode;
  visualClass: string;
  title: string;
  isComplete?: boolean;
  badgeContent: ReactNode;
  badgeClass?: string;
  description: string;
  actionButton: ReactNode;
}) {
  const badgeStyle =
    badgeClass ||
    (isComplete ? "admin-guide-badge-done" : "admin-guide-badge-todo");
  return (
    <article className="admin-guide-card admin-guide-card-checklist">
      <div className={`admin-guide-visual ${visualClass}`}>{visual}</div>
      <div className="admin-guide-info">
        <div className="admin-guide-title-row">
          <span className="admin-guide-card-title">{title}</span>
          <span className={`admin-guide-badge ${badgeStyle}`}>
            {badgeContent}
          </span>
        </div>
        <p className="admin-guide-card-desc">{description}</p>
      </div>
      <div className="admin-guide-card-action">{actionButton}</div>
    </article>
  );
}

const guideBadgeClassMap = {
  done: "admin-guide-badge-done",
  info: "admin-guide-badge-info",
  warning: "admin-guide-badge-warning",
} as const;

function GuideCard({
  icon: Icon,
  title,
  badge,
  description,
  action,
  children,
}: {
  icon: typeof Clock;
  title: string;
  badge: {
    label: string;
    variant: "done" | "info" | "warning";
  };
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children: ReactNode;
}) {
  return (
    <article className="admin-guide-card">
      <div className="admin-guide-card-header">
        <span className="admin-guide-card-title">
          <Icon size={17} />
          {title}
        </span>
        <span className={`admin-guide-badge ${guideBadgeClassMap[badge.variant]}`}>
          {badge.label}
        </span>
      </div>
      {children}
      <p className="admin-guide-card-desc">{description}</p>
      {action && (
        <div className="admin-guide-card-action">
          <Button variant="secondary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </article>
  );
}

function GuideDiagramFlow({
  steps,
  className = "",
}: {
  steps: Array<{
    title: string;
    subtitle: string;
    variant?: "default" | "highlight" | "success";
  }>;
  className?: string;
}) {
  return (
    <div className={`guide-diagram-flow ${className}`}>
      {steps.map((step, idx) => (
        <Fragment key={idx}>
          {idx > 0 && <ArrowRight size={14} className="guide-diagram-arrow" />}
          <div
            className={`guide-diagram-step ${step.variant === "success" ? "is-success" : step.variant === "highlight" ? "is-highlight" : ""}`}
          >
            <strong>{step.title}</strong>
            <small>{step.subtitle}</small>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
