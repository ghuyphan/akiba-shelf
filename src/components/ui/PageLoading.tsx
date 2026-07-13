import { ReactNode } from "react";
import { PlatformMark } from "./PlatformMark";
import { PLATFORM_BRAND } from "../../lib/branding";

interface PageLoadingProps {
  title?: ReactNode;
  message?: ReactNode;
  icon?: ReactNode;
  style?: React.CSSProperties;
}

export function PageLoading({
  title = `Preparing ${PLATFORM_BRAND.name}`,
  message = "Getting everything ready…",
  icon = <PlatformMark />,
  style
}: PageLoadingProps) {
  return (
    <main className="page-loading" aria-label={`Loading ${PLATFORM_BRAND.name}`} aria-busy="true" style={style}>
      <div className="page-loading-brand" aria-hidden="true">{icon}</div>
      <div className="page-loading-copy"><strong>{title}</strong><span>{message}</span></div>
      <div className="page-loading-track" aria-hidden="true"><i /></div>
    </main>
  );
}
