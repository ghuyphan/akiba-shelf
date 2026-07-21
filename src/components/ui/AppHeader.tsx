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
    <header className={["app-header", className].filter(Boolean).join(" ")}>
      <div
        className={`app-header-surface ${
          navigation
            ? "app-header-surface-with-nav"
            : "app-header-surface-simple"
        }`}
      >
        <div className="app-header-brand">{brand}</div>
        {navigation && (
          <div className="app-header-navigation">{navigation}</div>
        )}
        <div className="app-header-actions">{actions}</div>
      </div>
    </header>
  );
}
