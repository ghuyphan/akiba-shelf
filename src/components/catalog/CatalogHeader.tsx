import { Info, ShoppingBag } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { Button } from "../ui/Button";

type CatalogHeaderProps = {
  booth: BoothSettings;
  onOpenInfo: () => void;
};

export function CatalogHeader({ booth, onOpenInfo }: CatalogHeaderProps) {
  return (
    <header className="catalog-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          {booth.logo_url ? (
            <img src={booth.logo_url} alt={booth.booth_name} className="brand-logo-img" />
          ) : (
            <ShoppingBag size={30} />
          )}
        </div>
        <div className="brand-lockup-details">
          <h1>{booth.booth_name}</h1>
          <div className="brand-meta">
            {booth.booth_code && <span className="brand-meta-code">Booth {booth.booth_code}</span>}
            <span className="brand-meta-subtitle">{booth.subtitle || "Official Shop"}</span>
          </div>
        </div>
      </div>
      <div className="header-actions">
        <Button variant="secondary" icon={<Info size={20} />} onClick={onOpenInfo}>
          Booth Info
        </Button>
      </div>
    </header>
  );
}
