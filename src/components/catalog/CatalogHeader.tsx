import { Clock, Info, QrCode, ShoppingBag } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";
import { Button } from "../ui/Button";

type CatalogHeaderProps = {
  booth: BoothSettings;
  onOpenPayment: () => void;
  onOpenInfo: () => void;
};

export function CatalogHeader({ booth, onOpenPayment, onOpenInfo }: CatalogHeaderProps) {
  return (
    <header className="catalog-header">
      <div className="brand-lockup">
        <div className="brand-mark">
          <ShoppingBag size={30} />
        </div>
        <div>
          <h1>{booth.booth_name}</h1>
          <p>Booth {booth.booth_code}</p>
        </div>
      </div>
      <div className="header-actions">
        <div className="open-pill">
          <Clock size={18} />
          <span>Open {booth.open_hours}</span>
        </div>
        <Button icon={<QrCode size={20} />} onClick={onOpenPayment}>
          MoMo QR
        </Button>
        <Button variant="secondary" icon={<Info size={20} />} onClick={onOpenInfo}>
          Booth Info
        </Button>
      </div>
    </header>
  );
}
