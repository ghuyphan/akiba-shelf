import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Clock,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Modal } from "../../ui/Modal";
import { SocialBrandIcon } from "../../ui/SocialBrandIcon";
import { SocialQrCard } from "../social/SocialQrCard";
import { configuredSocialPlatforms } from "../../../utils/social";
import { formatVnd } from "../../../utils/format";
import { useCatalogCopy } from "../../../lib/i18n/catalogI18n";
import type {
  BoothSettings,
  CheckoutSession,
  Order,
  PaymentSettings,
} from "../../../types/catalog";
import type { FlyingItem } from "../../../hooks/catalog/useAddToCartFeedback";
import { safePublicUrl } from "../../../lib/branding";

export function BoothDetailsModal({
  booth,
  payment,
  open,
  onClose,
}: {
  booth: BoothSettings;
  payment: PaymentSettings;
  open: boolean;
  onClose: () => void;
}) {
  const copy = useCatalogCopy();
  const socialLinks = configuredSocialPlatforms(booth)
    .map((item) => ({ ...item, url: safePublicUrl(item.url) }))
    .filter((item) => item.url);

  return (
    <Modal
      title={copy.boothDetails}
      isOpen={open}
      onClose={onClose}
      className="booth-info-modal-container booth-modal-redesign"
      mobileSheet
      closeLabel={copy.closeModal}
    >
      <div className="booth-info-modal booth-modal-content">
        <div className="booth-modal-hero">
          <div className="booth-info-icon-wrap booth-modal-logo">
            {safePublicUrl(booth.logo_url) ? (
              <img
                src={safePublicUrl(booth.logo_url)}
                alt={booth.booth_name}
                className="booth-info-logo-img"
              />
            ) : (
              <ShoppingBag size={28} />
            )}
          </div>
          <div className="booth-modal-identity">
            <span className="booth-modal-eyebrow">{copy.shoppingAt}</span>
            <h3>{booth.booth_name || copy.boothDetails}</h3>
            <p>{booth.subtitle || copy.independentMerchBooth}</p>
          </div>
          <span className="booth-code-pill">
            {copy.boothCode(booth.booth_code)}
          </span>
        </div>
        <div className="booth-modal-facts">
          <div>
            <MapPin size={18} />
            <span>
              <small>{copy.location}</small>
              <strong>{booth.location || copy.notSpecified}</strong>
            </span>
          </div>
          <div>
            <Clock size={18} />
            <span>
              <small>{copy.openHours}</small>
              <strong>{booth.open_hours || copy.notSpecified}</strong>
            </span>
          </div>
        </div>
        {payment.payment_instructions && (
          <div className="booth-modal-note">
            <Sparkles size={18} />
            <div>
              <strong>{copy.beforePay}</strong>
              <span>{payment.payment_instructions}</span>
            </div>
          </div>
        )}

        {socialLinks.length > 0 && (
          <div className="booth-modal-social-section">
            <div className="booth-modal-section-heading">
              <span>{copy.findOnline}</span>
              <strong>{copy.followBooth}</strong>
            </div>
            <div className="booth-modal-social-grid">
              {socialLinks.map((item) => {
                return (
                  <SocialQrCard
                    key={item.label}
                    label={item.label}
                    url={item.url!}
                    logoUrl={safePublicUrl(booth.social_qr_logo_url)}
                    icon={<SocialBrandIcon platform={item.label} size={18} />}
                    brandColor={item.color}
                    brandGradient={item.gradient}
                  />
                );
              })}
            </div>
          </div>
        )}
        <div className="booth-modal-utility-row">
          <Link to="/admin" className="booth-staff-link">
            {copy.staffAccess} →
          </Link>
        </div>
      </div>
    </Modal>
  );
}

export function PendingOrderBar({
  order,
  onOpen,
  style,
}: {
  order: Order;
  onOpen: () => void;
  style?: CSSProperties;
}) {
  const copy = useCatalogCopy();
  const presentation =
    order.status === "confirmed"
      ? {
          icon: <Check size={18} />,
          title: `${copy.paymentComplete} · ${order.order_code}`,
          hint: copy.reservedPickup,
          action: copy.viewOrder,
        }
      : order.status === "cancelled"
        ? {
            icon: <Clock size={18} />,
            title: `${copy.orderCancelled} · ${order.order_code}`,
            hint: copy.cancelledPaymentNote,
            action: copy.viewOrder,
          }
        : order.status === "expired"
          ? {
              icon: <Clock size={18} />,
              title: `${copy.reservationExpired} · ${order.order_code}`,
              hint: copy.reservationExpiredHint,
              action: copy.viewOrder,
            }
          : {
              icon: <Clock size={18} />,
              title: `${copy.pendingOrder} · ${order.order_code}`,
              hint: copy.pendingOrderHint,
              action: copy.viewPayment,
            };
  return (
    <StorefrontDock
      variant="order"
      icon={presentation.icon}
      title={presentation.title}
      hint={presentation.hint}
      total={order.total_amount}
      actionLabel={presentation.action}
      onAction={onOpen}
      style={style}
    />
  );
}

export function RecoverCheckoutBar({
  session,
  total,
  onOpen,
  style,
}: {
  session: CheckoutSession;
  total: number;
  onOpen: () => void;
  style?: CSSProperties;
}) {
  const copy = useCatalogCopy();
  return (
    <StorefrontDock
      variant="order"
      icon={<RefreshCw size={18} />}
      title={copy.checkoutRecoveryTitle}
      hint={
        session.state === "needs_review"
          ? copy.checkoutRecoveryReviewHint
          : copy.checkoutRecoveryHint
      }
      total={total}
      actionLabel={copy.resumeCheckout}
      onAction={onOpen}
      style={style}
    />
  );
}

export function FloatingCartBar({
  itemCount,
  total,
  onOpen,
  style,
}: {
  itemCount: number;
  total: number;
  onOpen: () => void;
  style?: CSSProperties;
}) {
  const copy = useCatalogCopy();
  return (
    <StorefrontDock
      variant="cart"
      icon={<ShoppingBag size={20} />}
      badge={itemCount}
      title={copy.cartDockTitle(itemCount)}
      hint={copy.cartDockHint}
      total={total}
      actionLabel={copy.viewCart}
      onAction={onOpen}
      style={style}
    />
  );
}

type StorefrontDockProps = {
  variant: "order" | "cart";
  icon: ReactNode;
  badge?: number;
  title: ReactNode;
  hint: ReactNode;
  total: number;
  actionLabel: ReactNode;
  onAction: () => void;
  style?: CSSProperties;
};

function StorefrontDock({
  variant,
  icon,
  badge,
  title,
  hint,
  total,
  actionLabel,
  onAction,
  style,
}: StorefrontDockProps) {
  const compatibilityClass =
    variant === "order" ? "pending-order-bar" : "floating-cart-bar";

  return createPortal(
    <aside
      className={`storefront-dock storefront-dock-${variant} ${compatibilityClass}`}
      role="status"
      style={style}
    >
      <span className="storefront-dock-icon">
        {icon}
        {badge !== undefined && (
          <b className="storefront-dock-badge">{badge}</b>
        )}
      </span>
      <span className="storefront-dock-copy">
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <strong className="storefront-dock-total">{formatVnd(total)}</strong>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </aside>,
    document.body,
  );
}

export function FlyingItemsLayer({ items }: { items: FlyingItem[] }) {
  return createPortal(
    items.map((item) => (
      <div
        key={item.id}
        className="flying-product-item"
        style={{
          left: item.startX - (item.mobile ? 22 : 36),
          top: item.startY - (item.mobile ? 25 : 41),
          ...({
            "--tx": `${item.tx}px`,
            "--ty": `${item.ty}px`,
            "--tx-half": `${item.tx * 0.5}px`,
            "--ty-half": `${item.tyHalf}px`,
          } as React.CSSProperties),
        }}
        aria-hidden="true"
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" />
        ) : (
          <ShoppingBag size={24} />
        )}
        <span>
          <Check size={13} />
        </span>
      </div>
    )),
    document.body,
  );
}
