import { ChevronRight, Gamepad2, Info, ShoppingBag } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { BoothSettings } from "../../types/catalog";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";
import { safePublicUrl } from "../../lib/branding";
import "../../styles/gacha-entry.css";

type CatalogHeaderProps = {
  booth: BoothSettings;
  onOpenInfo: () => void;
  className?: string;
  isDesigner?: boolean;
  isSelected?: boolean;
  onOpenStaff?: () => void;
  showStaffAccess?: boolean;
  showGacha?: boolean;
  onPrepareGacha?: () => void;
};

export function CatalogHeader({
  booth,
  onOpenInfo,
  className = "",
  isDesigner = false,
  isSelected = false,
  onOpenStaff,
  showStaffAccess = false,
  showGacha = false,
  onPrepareGacha,
}: CatalogHeaderProps) {
  const copy = useCatalogCopy();
  const { shopSlug = "" } = useParams();
  return (
    <header
      className={`catalog-header ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="brand-lockup">
        <div className="brand-mark">
          {safePublicUrl(booth.logo_url) ? (
            <img
              src={safePublicUrl(booth.logo_url)}
              alt={booth.booth_name}
              className="brand-logo-img"
            />
          ) : (
            <ShoppingBag size={30} />
          )}
        </div>
        <div className="brand-lockup-details">
          <h1>{booth.booth_name}</h1>
          <div className="brand-meta">
            {booth.booth_code && (
              <span className="brand-meta-code">Booth {booth.booth_code}</span>
            )}
            <span className="brand-meta-subtitle">{copy.officialShop}</span>
          </div>
        </div>
      </div>
      <div className="header-actions">
        {!isDesigner && showGacha && (
          <Link
            className="gacha-entry-trigger"
            to={`/s/${shopSlug}/play`}
            onClick={(event) => event.stopPropagation()}
            onFocus={onPrepareGacha}
            onPointerEnter={onPrepareGacha}
            onPointerDown={onPrepareGacha}
            aria-label={`${copy.playGacha}. ${copy.playGachaHint}`}
            title={copy.playGacha}
          >
            <Gamepad2 size={22} aria-hidden="true" />
          </Link>
        )}
        {isDesigner ? (
          <div
            className={`designer-header-trigger-wrapper ${isSelected ? "is-selected" : ""}`}
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="booth-info-trigger"
              onClick={onOpenInfo}
            >
              <span className="booth-info-trigger-icon">
                <Info size={18} />
              </span>
              <span className="booth-info-trigger-copy">
                <strong>{copy.boothInfo}</strong>
                <small>{copy.boothInfoHint}</small>
              </span>
              <ChevronRight size={17} className="booth-info-trigger-arrow" />
            </button>
            {showStaffAccess && (
              <button
                type="button"
                className="designer-module-handle designer-staff-handle"
                onClick={onOpenStaff}
              >
                <span>Staff access</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="booth-info-trigger"
            onClick={onOpenInfo}
          >
            <span className="booth-info-trigger-icon">
              <Info size={18} />
            </span>
            <span className="booth-info-trigger-copy">
              <strong>{copy.boothInfo}</strong>
              <small>{copy.boothInfoHint}</small>
            </span>
            <ChevronRight size={17} className="booth-info-trigger-arrow" />
          </button>
        )}
      </div>
    </header>
  );
}
