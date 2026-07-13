import type { ReactNode } from "react";

type AppHeaderProps = {
  brand: ReactNode;
  actions: ReactNode;
  navigation?: ReactNode;
  className?: string;
};

export function AppHeader({
  brand,
  actions,
  navigation,
  className = "",
}: AppHeaderProps) {
  return (
    <header className={["admin-header", className].filter(Boolean).join(" ")}>
      <div
        className={`admin-header-pill ${
          navigation ? "admin-header-pill-with-nav" : "admin-header-pill-simple"
        }`}
      >
        <div className="admin-header-brand">{brand}</div>
        {navigation}
        <div className="admin-header-actions">{actions}</div>
      </div>
    </header>
  );
}
