import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { PLATFORM_BRAND, PLATFORM_CONTACT } from "../../lib/branding";
import { useOptionalPlatformI18n } from "../../lib/i18n/platformI18n";
import { DoodleSparkleArt } from "./LandingArt";

type PlatformFooterProps = {
  showHomeLink?: boolean;
  showSupportLink?: boolean;
  showDemoLink?: boolean;
  showZaloLink?: boolean;
  className?: string;
};

/** Unified footer across all non-store, non-login, non-admin platform pages. */
export function PlatformFooter({
  showHomeLink = false,
  showSupportLink = false,
  showDemoLink = true,
  showZaloLink = true,
  className = "",
}: PlatformFooterProps) {
  const { t } = useOptionalPlatformI18n();

  return (
    <footer className={`platform-home-footer ${className}`}>
      <div className="platform-home-footer-brand">
        <div className="platform-home-footer-title-row">
          <strong>{PLATFORM_BRAND.name}</strong>
          <DoodleSparkleArt size={13} color="var(--landing-coral)" />
        </div>
        <span>
          {t("Made for independent artists, conventions, and pop-up booths.")}
        </span>
      </div>

      <div className="platform-home-footer-meta">
        {showHomeLink && <Link to="/">{t("Back to Matsuri")}</Link>}
        {showSupportLink && <Link to="/support">{t("Support Matsuri")}</Link>}
        {showDemoLink && <Link to="/s/demo-booth">{t("Demo booth")}</Link>}
        {showZaloLink && (
          <a
            href={PLATFORM_CONTACT.zaloUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("Chat with Matsuri on Zalo")}
          >
            <MessageCircle size={14} aria-hidden="true" />
            {t("Zalo support")}
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
        <small>
          &copy; {new Date().getFullYear()} {PLATFORM_BRAND.name}
        </small>
      </div>
    </footer>
  );
}
