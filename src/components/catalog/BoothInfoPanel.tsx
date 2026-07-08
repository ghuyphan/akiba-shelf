import type { ReactNode } from "react";
import { Clock, Facebook, Instagram, MapPin, Music2 } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { SocialQrCard } from "./SocialQrCard";

type BoothInfoPanelProps = {
  booth: BoothSettings;
};

export function BoothInfoPanel({ booth }: BoothInfoPanelProps) {
  const socialLinks = [
    { label: "Instagram", url: booth.instagram_url, icon: <Instagram size={18} /> },
    { label: "Facebook", url: booth.facebook_url, icon: <Facebook size={18} /> },
    { label: "TikTok", url: booth.tiktok_url, icon: <Music2 size={18} /> },
  ].flatMap((item): { label: string; url: string; icon: ReactNode }[] => {
    const url = item.url?.trim();
    return url ? [{ ...item, url }] : [];
  });

  return (
    <aside className="booth-card">
      <div className="info-list booth-info-list">
        <div>
          <MapPin size={20} />
          <span>
            <strong>Booth {booth.booth_code}</strong>
            {booth.location}
          </span>
        </div>
        <div>
          <Clock size={20} />
          <span>
            <strong>Open {booth.open_hours}</strong>
            Festival hours
          </span>
        </div>
      </div>
      {socialLinks.length > 0 && (
        <div className="social-qr-grid" aria-label="Social QR codes">
          {socialLinks.map((item) => (
            <SocialQrCard
              key={item.label}
              label={item.label}
              url={item.url}
              logoUrl={booth.social_qr_logo_url}
              icon={item.icon}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
