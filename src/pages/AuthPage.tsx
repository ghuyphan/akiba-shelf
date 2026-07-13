import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getAppUrl } from "../lib/authUrls";
import { getShopMemberships } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import "../styles/admin.css";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { routeAfterAuthentication } from "../lib/authRouting";

type Mode = "signin" | "signup" | "forgot";
export function AuthPage() {
  const [params, setParams] = useSearchParams();
  const mode = (
    ["signin", "signup", "forgot"].includes(params.get("mode") || "")
      ? params.get("mode")
      : "signin"
  ) as Mode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAppUrl("/auth/callback?next=set-password"),
        });
        if (e) throw e;
        toast.info(
          "If an account can be recovered, a password link is on its way.",
          "Check your email",
        );
        return;
      }
      if (mode === "signup") {
        const { data, error: e } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAppUrl("/auth/callback") },
        });
        if (e) throw e;
        if (!data.session) {
          toast.info(
            "Check your email to confirm your account, then sign in.",
            "Account created",
          );
          return;
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (e) throw e;
      }
      const memberships = await getShopMemberships();
      navigate(routeAfterAuthentication(memberships), { replace: true });
    } catch {
      toast.error(
        "We could not complete that request. Check your details and try again.",
        "Request failed",
      );
    } finally {
      setBusy(false);
    }
  }
  const choose = (next: Mode) => setParams({ mode: next });
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
            <Link
              to="/"
              className="admin-login-back"
              aria-label="Back to homepage"
            >
              <ArrowLeft size={17} />
            </Link>
          </header>
          <div className="admin-login-heading">
            <h1>
              {mode === "signup"
                ? "Create your account"
                : mode === "forgot"
                  ? "Reset your password"
                  : "Welcome back"}
            </h1>
            <p>
              {mode === "signup"
                ? "Start a storefront or accept a staff invitation."
                : mode === "forgot"
                  ? "We’ll email a secure recovery link."
                  : "Sign in to manage your shops."}
            </p>
          </div>
          <form onSubmit={submit} className="admin-login-form">
            <label className="admin-login-field">
              <span>Email address</span>
              <div className="admin-login-input">
                <Mail size={19} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>
            {mode !== "forgot" && (
              <label className="admin-login-field">
                <span>Password</span>
                <div className="admin-login-input">
                  <Lock size={19} />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </label>
            )}
            <button className="admin-login-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send recovery link"
                    : "Sign in"}
            </button>
          </form>
          <div className="auth-mode-links">
            {mode !== "signin" && (
              <button type="button" onClick={() => choose("signin")}>
                Sign in
              </button>
            )}
            {mode !== "signup" && (
              <button type="button" onClick={() => choose("signup")}>
                Create account
              </button>
            )}
            {mode === "signin" && (
              <button type="button" onClick={() => choose("forgot")}>
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
