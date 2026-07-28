import type { MouseEventHandler, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { PLATFORM_BRAND } from "../../lib/branding";
import { PlatformMark } from "./PlatformMark";

type PlatformHeaderBrandProps = {
  subtitle: string;
  backTo?: string;
  backLabel?: string;
  onBack?: MouseEventHandler<HTMLAnchorElement>;
  mark?: ReactNode;
};

export function PlatformHeaderBrand({
  subtitle,
  backTo,
  backLabel,
  onBack,
  mark = <PlatformMark />,
}: PlatformHeaderBrandProps) {
  return (
    <>
      {backTo && (
        <Link
          to={backTo}
          className="app-header-icon-button"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ArrowLeft size={19} />
        </Link>
      )}
      <span className="app-header-mark">{mark}</span>
      <span className="app-header-title">
        <strong>{PLATFORM_BRAND.name}</strong>
        <small>{subtitle}</small>
      </span>
    </>
  );
}
