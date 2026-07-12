import { Package } from "lucide-react";

export function PageLoading() {
  return (
    <main className="page-loading" aria-label="Loading Akiba Shelf" aria-busy="true">
      <div className="page-loading-brand" aria-hidden="true"><Package size={28} /></div>
      <div className="page-loading-copy"><strong>Setting up the shelf</strong><span>Getting the latest booth details ready…</span></div>
      <div className="page-loading-track" aria-hidden="true"><i /></div>
    </main>
  );
}
