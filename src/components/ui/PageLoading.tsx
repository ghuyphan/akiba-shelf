import { ReactNode } from "react";
import { Package } from "lucide-react";

interface PageLoadingProps {
  title?: ReactNode;
  message?: ReactNode;
  icon?: ReactNode;
  style?: React.CSSProperties;
}

export function PageLoading({
  title = "Setting up the shelf",
  message = "Getting the latest booth details ready…",
  icon = <Package size={28} />,
  style
}: PageLoadingProps) {
  return (
    <main className="page-loading" aria-label="Loading Akiba Shelf" aria-busy="true" style={style}>
      <div className="page-loading-brand" aria-hidden="true">{icon}</div>
      <div className="page-loading-copy"><strong>{title}</strong><span>{message}</span></div>
      <div className="page-loading-track" aria-hidden="true"><i /></div>
    </main>
  );
}

