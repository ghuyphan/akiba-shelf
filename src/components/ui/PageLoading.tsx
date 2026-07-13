import { ReactNode } from "react";
import { PlatformMark } from "./PlatformMark";
import { PLATFORM_BRAND } from "../../lib/branding";

interface PageLoadingProps {
  title?: ReactNode;
  message?: ReactNode;
}

export function PageLoading({
  title = `Preparing ${PLATFORM_BRAND.name}`,
  message = "Getting everything ready…",
}: PageLoadingProps) {
  return (
    <main
      className="page-loading"
      aria-label={`Loading ${PLATFORM_BRAND.name}`}
      aria-busy="true"
    >
      <div className="page-loading-brand" aria-hidden="true">
        <PlatformMark />
      </div>
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
