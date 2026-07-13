import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Mail, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { useToast } from "../ui/ToastProvider";

import type { BoothSettings } from "../../types/catalog";
import { PageLoading } from "../ui/PageLoading";
import { PlatformMark } from "../ui/PlatformMark";
import { PLATFORM_BRAND } from "../../lib/branding";
import { getAuthErrorNotice } from "../../lib/authErrors";

type LoginPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  booth?: BoothSettings;
};

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  useEffect(() => {
    if (!error) return;
    const notice = getAuthErrorNotice(null, "signin");
    toast.error(notice.message, notice.title);
    setError("");
  }, [error, setError, toast]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onLogin(email, password))
      .catch(() => undefined)
      .finally(() => {
        setPassword("");
        setShowPassword(false);
      });
  }

  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
        <header className="admin-login-topbar">
          <div className="admin-login-brand">
            <span className="admin-login-logo"><PlatformMark /></span>
            <span><strong>{PLATFORM_BRAND.name}</strong><small>{PLATFORM_BRAND.descriptor}</small></span>
          </div>
          <Link to="/" className="admin-login-back">
            <ArrowLeft size={16} />
            <span>Back to home</span>
          </Link>
        </header>

        <div className="admin-login-heading">
          <h1>Staff sign in</h1>
          <p>Use your admin account to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <label className="admin-login-field">
            <span>Email address</span>
            <div className="admin-login-input">
              <Mail size={19} className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!isSupabaseConfigured}
                autoComplete="email"
                placeholder="staff@example.com"
              />
            </div>
          </label>

          <label className="admin-login-field">
            <span>Password</span>
            <div className="admin-login-input">
              <Lock size={19} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={!isSupabaseConfigured}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={!isSupabaseConfigured}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {!isSupabaseConfigured && (
            <Alert variant="error" title="Supabase is not configured">
              Add the Supabase URL and public key before signing in.
            </Alert>
          )}

          <button
            type="submit"
            className="admin-login-submit"
            disabled={busy || !isSupabaseConfigured}
            aria-busy={busy}
          >
            {busy && <LoaderCircle className="button-spinner" size={18} aria-hidden="true" />}
            <span>{busy ? "Signing in…" : "Open admin"}</span>
            {!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>
        <p className="admin-login-security"><ShieldCheck size={14} /> Only authorised staff can access this workspace.</p>
        </div>
      </section>
    </main>
  );
}

export function AdminAccessCheck() {
  return (
    <PageLoading
      title="Checking your access"
      message="Loading your workspace…"
      icon={<ShieldCheck size={28} />}
    />
  );
}

export function AdminAccessDenied({ kind, message, userId, email, onRetry, onSignOut }: { kind: "unauthorized" | "inactive" | "error"; message?: string; userId?: string; email?: string; onRetry?: () => Promise<void>; onSignOut: () => Promise<void> }) {
  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
          <div className="admin-login-heading">
            <h1>{kind === "inactive" ? "Staff access inactive" : kind === "error" ? "Access check failed" : "Staff access required"}</h1>
            <p>{message || (kind === "inactive" ? "An owner must reactivate your staff membership." : "This signed-in account is not an authorized staff member.")}</p>
            {kind === "unauthorized" && userId && <p className="admin-account-identity">Signed in as <strong>{email || userId}</strong>. Ask an owner to grant this account access.</p>}
          </div>
          {onRetry && <button type="button" className="admin-login-submit" onClick={() => void onRetry()}>Check access again</button>}
          <button type="button" className="admin-login-submit admin-login-secondary" onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </section>
    </main>
  );
}
