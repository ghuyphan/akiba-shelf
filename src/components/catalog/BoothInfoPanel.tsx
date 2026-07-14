import { useEffect, useState } from "react";
import { Clock, MapPin, ShoppingBag } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { configuredSocialPlatforms } from "../../lib/social";
import { SocialQrCard } from "./SocialQrCard";
import { SocialBrandIcon } from "../ui/SocialBrandIcon";
import { safePublicUrl } from "../../lib/branding";
import { useCatalogCopy } from "../../lib/catalogI18n";
import { getOpeningStatus } from "../../lib/openingHours";

type BoothInfoPanelProps = {
  booth: BoothSettings;
};

export function BoothInfoPanel({ booth }: BoothInfoPanelProps) {
  const copy = useCatalogCopy();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const openingStatus = getOpeningStatus(booth.open_hours, currentTime);
  const openingLabel = openingStatus
    ? openingStatus.isOpen
      ? copy.openNowUntil(openingStatus.closesAt)
      : copy.closedOpensAt(openingStatus.opensAt)
    : copy.hoursNotSet;

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const socialLinks = configuredSocialPlatforms(booth).flatMap((item) => {
    const url = safePublicUrl(item.url);
    return url ? [{ ...item, url }] : [];
  });

  return (
    <aside className="booth-card booth-card-redesign">
      <div className="booth-card-topline">
        <span>{copy.boothGuide}</span>
        <small className={openingStatus?.isOpen ? "is-open" : "is-closed"}>{openingLabel}</small>
      </div>
      <div className="booth-hero booth-card-identity">
        <div className="booth-hero-logo">
          {safePublicUrl(booth.logo_url) ? (
            <img src={safePublicUrl(booth.logo_url)} alt={booth.booth_name} />
          ) : (
            <ShoppingBag size={22} />
          )}
        </div>
        <div className="booth-hero-info">
          <strong className="booth-hero-name">{booth.booth_name}</strong>
          <span className="booth-hero-code">{booth.subtitle || copy.officialShop}</span>
        </div>
      </div>
      <div className="booth-detail-chips">
        {booth.location && (
          <div className="booth-chip">
            <MapPin size={14} />
            <span>{booth.location}</span>
          </div>
        )}
        {booth.open_hours && (
          <div className="booth-chip">
            <Clock size={14} />
            <span>{booth.open_hours}</span>
          </div>
        )}
      </div>
      {socialLinks.length > 0 && (
        <div className="booth-card-socials">
          <div className="social-qr-grid" aria-label={copy.socialQrCodes}>
            {socialLinks.map((item) => (
              <SocialQrCard
                key={item.label}
                label={item.label}
                url={item.url}
                logoUrl={safePublicUrl(booth.social_qr_logo_url)}
                icon={<SocialBrandIcon platform={item.label} size={18} />}
                brandColor={item.color}
                brandGradient={item.gradient}
                showLabel={false}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
