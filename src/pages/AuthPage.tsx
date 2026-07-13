import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getAppUrl } from "../lib/authUrls";
import { getShopMemberships } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import "../styles/admin.css";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { routeAfterAuthentication } from "../lib/authRouting";
import { getAuthErrorNotice } from "../lib/authErrors";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (mode === "signup") {
      const hasStrongPassword =
        password.length >= 10 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password);
      if (!hasStrongPassword) {
        toast.error(
          "Use at least 10 characters with an uppercase letter, a lowercase letter, and a number.",
          "Choose a stronger password",
        );
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Both passwords must match.", "Check your password");
        return;
      }
    }
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
    } catch (error) {
      const action =
        mode === "forgot" ? "recovery" : mode === "signup" ? "signup" : "signin";
      const notice = getAuthErrorNotice(error, action);
      toast.error(notice.message, notice.title);
    } finally {
      if (mode !== "forgot") {
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
      }
      setBusy(false);
    }
  }
  const choose = (next: Mode) => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setParams({ mode: next });
  };
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
            >
              <ArrowLeft size={16} />
              <span>Back to home</span>
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
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "signup" ? 10 : 8}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "signup" && (
              <>
                <p className="auth-password-hint" id="signup-password-hint">
                  Use 10+ characters with uppercase, lowercase, and a number.
                </p>
                <label className="admin-login-field">
                  <span>Confirm password</span>
                  <div className="admin-login-input">
                    <Lock size={19} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={confirmPassword}
                      aria-describedby="signup-password-hint"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </label>
              </>
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
            {mode === "signin" && (
              <button type="button" onClick={() => choose("forgot")}>
                Forgot password?
              </button>
            )}
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
          </div>
        </div>
      </section>
    </main>
  );
}
