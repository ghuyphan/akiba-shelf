import { ReactNode } from "react";
import { PlatformMark } from "./PlatformMark";
import { PLATFORM_BRAND } from "../../lib/branding";
import { useI18n } from "../../lib/i18n";

interface PageLoadingProps {
  title?: ReactNode;
  message?: ReactNode;
  icon?: ReactNode;
  style?: React.CSSProperties;
  showProgress?: boolean;
  ariaLabel?: string;
}

export function PageLoading({
  title,
  message,
  icon = <PlatformMark />,
  style,
  showProgress = true,
  ariaLabel,
}: PageLoadingProps) {
  const { copy } = useI18n();
  return (
    <main className="page-loading" aria-label={ariaLabel ?? copy.accessibility.loading(PLATFORM_BRAND.name)} aria-busy="true" style={style}>
      <div className="page-loading-brand" aria-hidden="true">{icon}</div>
      <div className="page-loading-copy"><strong>{title ?? copy.loading.preparing(PLATFORM_BRAND.name)}</strong><span>{message ?? copy.loading.ready}</span></div>
      <div
        className={`page-loading-track ${showProgress ? "" : "page-loading-track-pending"}`}
        aria-hidden="true"
      >
        <i />
      </div>
    </main>
  );
}
