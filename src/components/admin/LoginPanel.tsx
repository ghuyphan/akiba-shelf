import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Mail, ShoppingBag, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";

import type { BoothSettings } from "../../types/catalog";

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
    <main className="admin-login">
      <section className="admin-login-card">
        <Link to="/" className="admin-login-back">
          <ArrowLeft size={16} /> Back to catalog
        </Link>

        <div className="admin-login-brand">
          <span className="admin-login-logo" style={booth?.logo_url ? { background: "transparent", overflow: "hidden" } : undefined}>
            {booth?.logo_url ? (
              <img src={booth.logo_url} alt={booth.booth_name} style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover", display: "block" }} />
            ) : (
              <ShoppingBag size={20} />
            )}
          </span>
          <strong>{booth?.booth_name || "Merch desk"}</strong>
        </div>

        <div className="admin-login-heading">
          <h2>{booth?.booth_name ? `Login to ${booth.booth_name}` : "Welcome back"}</h2>
          <p>Sign in to open the admin workspace.</p>
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
      </section>
    </main>
  );
}
