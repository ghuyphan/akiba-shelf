import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PLATFORM_BRAND } from "../../lib/branding";
import { PlatformMark } from "./PlatformMark";

type AuthShellProps = {
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
};

export function AuthShell({
  children,
  backTo = "/",
  backLabel = "Back to home",
}: AuthShellProps) {
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
                <small>{PLATFORM_BRAND.descriptor}</small>
              </span>
            </div>
            <Link to={backTo} className="admin-login-back">
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </Link>
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
