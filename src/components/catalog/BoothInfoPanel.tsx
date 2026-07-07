import { Clock, MapPin } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";

type BoothInfoPanelProps = {
  booth: BoothSettings;
};

export function BoothInfoPanel({ booth }: BoothInfoPanelProps) {
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
    </aside>
  );
}
