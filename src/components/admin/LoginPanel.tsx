import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Mail, ShoppingBag, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";

import type { BoothSettings } from "../../types/catalog";
import { getThemeStyle } from "../../lib/theme";

type LoginPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  booth?: BoothSettings;
};

export function LoginPanel({ onLogin, booth }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { busy, error, run, setError } = useAsyncAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onLogin(email, password)).catch(() => undefined);
  }

  return (
    <main className="admin-login" style={booth ? getThemeStyle(booth) : undefined}>
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
        <header className="admin-login-topbar">
          <div className="admin-login-brand">
            <span className="admin-login-logo" style={booth?.logo_url ? { background: "transparent", overflow: "hidden" } : undefined}>
              {booth?.logo_url ? (
                <img src={booth.logo_url} alt={booth.booth_name} style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover", display: "block" }} />
              ) : (
                <ShoppingBag size={20} />
              )}
            </span>
            <span><strong>{booth?.booth_name || "Merch desk"}</strong><small>Admin</small></span>
          </div>
          <Link to="/" className="admin-login-back" aria-label="Back to catalog"><ArrowLeft size={17} /></Link>
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
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {!isSupabaseConfigured && (
            <Alert variant="error" title="Supabase is not configured">
              Add the Supabase URL and public key before signing in.
            </Alert>
          )}

          <button
            type="submit"
            className="admin-login-submit"
            disabled={busy || !isSupabaseConfigured}
          >
            <span>{busy ? "Signing in…" : "Open admin"}</span>
            <ArrowRight size={18} />
          </button>
        </form>
        <p className="admin-login-security"><ShieldCheck size={14} /> Only authorised staff can access this workspace.</p>
        </div>
      </section>
    </main>
  );
}

export function AdminAccessCheck({ booth }: { booth?: BoothSettings }) {
  return (
    <main className="admin-login" style={booth ? getThemeStyle(booth) : undefined}>
      <section className="admin-auth-check" role="status" aria-live="polite">
        <div className="admin-auth-check-mark">
          <span>{booth?.logo_url ? <img src={booth.logo_url} alt="" /> : <ShieldCheck size={28} />}</span>
          <i aria-hidden="true" />
        </div>
        <span className="admin-access-eyebrow">Staff workspace</span>
        <h1>Checking your access</h1>
        <p>We’re securely confirming your admin permissions. This should only take a moment.</p>
        <div className="admin-auth-progress" aria-hidden="true"><span /></div>
        <small>Connecting to {booth?.booth_name || "your merch booth"}…</small>
      </section>
    </main>
  );
}
