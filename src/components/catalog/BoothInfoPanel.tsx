import type { ReactNode } from "react";
import { Clock, Facebook, Instagram, MapPin, ShoppingBag } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { SOCIAL_BRAND_COLORS } from "../../lib/social";
import { SocialQrCard } from "./SocialQrCard";
import { TiktokIcon } from "../ui/TiktokIcon";
import { safePublicUrl } from "../../lib/branding";

type BoothInfoPanelProps = {
  booth: BoothSettings;
};

export function BoothInfoPanel({ booth }: BoothInfoPanelProps) {
  const socialLinks = [
    { label: "Instagram", url: booth.instagram_url, icon: <Instagram size={18} /> },
    { label: "Facebook", url: booth.facebook_url, icon: <Facebook size={18} /> },
    { label: "TikTok", url: booth.tiktok_url, icon: <TiktokIcon size={18} /> },
  ].flatMap((item): { label: string; url: string; icon: ReactNode; brandColor: string; brandGradient: string }[] => {
    const url = safePublicUrl(item.url);
    const brand = SOCIAL_BRAND_COLORS[item.label];
    return url && brand ? [{ ...item, url, brandColor: brand.color, brandGradient: brand.gradient }] : [];
  });

  return (
    <aside className="booth-card booth-card-redesign">
      <div className="booth-card-topline"><span>Booth guide</span><small><i /> Open today</small></div>
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
          <span className="booth-hero-code">{booth.subtitle || "Official shop"}</span>
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
          <div className="social-qr-grid" aria-label="Social QR codes">
            {socialLinks.map((item) => (
              <SocialQrCard
                key={item.label}
                label={item.label}
                url={item.url}
                logoUrl={safePublicUrl(booth.social_qr_logo_url)}
                icon={item.icon}
                brandColor={item.brandColor}
                brandGradient={item.brandGradient}
                showLabel={false}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
