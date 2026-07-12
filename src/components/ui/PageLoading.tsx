import { Package } from "lucide-react";

type PageLoadingProps = {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
};

export function PageLoading({
  title = "Setting up the shelf",
  message = "Getting the latest booth details ready…",
  icon = <Package size={28} />
}: PageLoadingProps) {
  return (
    <main className="page-loading" aria-label={title} aria-busy="true">
      <div className="page-loading-brand" aria-hidden="true">{icon}</div>
      <div className="page-loading-copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <div className="page-loading-track" aria-hidden="true">
        <i />
      </div>
    </main>
  );
}
