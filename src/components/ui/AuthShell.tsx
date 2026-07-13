import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PLATFORM_BRAND } from "../../lib/branding";
import { PlatformMark } from "./PlatformMark";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useI18n } from "../../lib/i18n";

type AuthShellProps = {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
};

export function AuthShell({
  children,
  backTo = "/",
  backLabel,
}: AuthShellProps) {
  const { copy } = useI18n();
  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
          <header className="admin-login-topbar">
            <div className="admin-login-brand">
              <span className="admin-login-logo">
                <PlatformMark />
              </span>
              <span>
                <strong>{PLATFORM_BRAND.name}</strong>
                <small>{copy.brand.descriptor}</small>
              </span>
            </div>
            <div className="admin-login-topbar-actions"><LocaleSwitcher variant="auth" /><Link to={backTo} className="admin-login-back">
              <ArrowLeft size={16} />
              <span>{backLabel ?? copy.common.backHome}</span>
            </Link></div>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}

export function AuthSecurityNote({ children }: { children: ReactNode }) {
  return (
    <p className="admin-login-security">
      <ShieldCheck size={14} aria-hidden="true" />
      {children}
    </p>
  );
}
