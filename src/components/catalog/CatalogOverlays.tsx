import { createPortal } from "react-dom";
import {
  Check,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { TiktokIcon } from "../ui/TiktokIcon";
import { SocialQrCard } from "./SocialQrCard";
import { SOCIAL_BRAND_COLORS } from "../../lib/social";
import { formatVnd } from "../../lib/format";
import { useCatalogCopy } from "../../lib/catalogI18n";
import type {
  BoothSettings,
  Order,
  PaymentSettings,
} from "../../types/catalog";
import type { FlyingItem } from "../../hooks/useAddToCartFeedback";
import { safePublicUrl } from "../../lib/branding";

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
  const socialLinks = [
    {
      label: "Instagram",
      url: booth.instagram_url,
      icon: <Instagram size={18} />,
    },
    {
      label: "Facebook",
      url: booth.facebook_url,
      icon: <Facebook size={18} />,
    },
    { label: "TikTok", url: booth.tiktok_url, icon: <TiktokIcon size={18} /> },
  ]
    .map((item) => ({ ...item, url: safePublicUrl(item.url) }))
    .filter((item) => item.url);

  return (
    <Modal
      title={copy.boothDetails}
      isOpen={open}
      onClose={onClose}
      className="booth-info-modal-container booth-modal-redesign"
      mobileSheet
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
          <span className="booth-code-pill">{copy.boothCode(booth.booth_code)}</span>
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
                const brand = SOCIAL_BRAND_COLORS[item.label];
                return (
                  <SocialQrCard
                    key={item.label}
                    label={item.label}
                    url={item.url!}
              logoUrl={safePublicUrl(booth.social_qr_logo_url)}
                    icon={item.icon}
                    brandColor={brand?.color}
                    brandGradient={brand?.gradient}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function PendingOrderBar({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: () => void;
}) {
  const copy = useCatalogCopy();
  return (
    <aside className="pending-order-bar" role="status">
      <span className="pending-order-bar-icon">
        <Clock size={18} />
      </span>
      <span>
        <strong>
          {copy.pendingOrder} · {order.order_code}
        </strong>
        <small>{copy.pendingOrderHint}</small>
      </span>
      <b>{formatVnd(order.total_amount)}</b>
      <button type="button" onClick={onOpen}>
        {copy.viewPayment}
      </button>
    </aside>
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
