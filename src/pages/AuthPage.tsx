import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getAppUrl } from "../lib/authUrls";
import { getShopMemberships } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import "../styles/admin.css";
import { routeAfterAuthentication } from "../lib/authRouting";
import { getAuthErrorNotice } from "../lib/authErrors";
import {
  getNewPasswordError,
  NEW_PASSWORD_HINT,
  NEW_PASSWORD_MIN_LENGTH,
} from "../lib/authValidation";
import { PasswordField } from "../components/ui/PasswordField";
import { AuthSecurityNote, AuthShell } from "../components/ui/AuthShell";

type Mode = "signin" | "signup" | "forgot";
type EmailCompletion = { mode: "signup" | "forgot"; email: string };

const modeCopy: Record<
  Mode,
  {
    title: string;
    description: string;
    submit: string;
    busy: string;
    security: string;
  }
> = {
  signin: {
    title: "Welcome back",
    description: "Sign in to manage your shops.",
    submit: "Sign in",
    busy: "Signing in…",
    security: "Secure access to your shops and staff workspaces.",
  },
  signup: {
    title: "Create your account",
    description: "Start a storefront or accept a staff invitation.",
    submit: "Create account",
    busy: "Creating account…",
    security: "Email confirmation protects every new account.",
  },
  forgot: {
    title: "Reset your password",
    description: "We’ll email a secure recovery link.",
    submit: "Send recovery link",
    busy: "Sending link…",
    security: "Recovery never reveals whether an account exists.",
  },
};

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
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<EmailCompletion | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const toast = useToast();
  const navigate = useNavigate();
  const copy = modeCopy[mode];

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(
      () => setResendIn((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function requestAccountEmail(
    requestMode: "signup" | "forgot",
    requestEmail: string,
  ) {
    if (!supabase) return;
    if (requestMode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(
        requestEmail,
        { redirectTo: getAppUrl("/auth/callback?next=set-password") },
      );
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: requestEmail,
        password,
        options: { emailRedirectTo: getAppUrl("/auth/callback") },
      });
      if (error) throw error;
      if (data.session) return false;
    }
    setCompletion({ mode: requestMode, email: requestEmail });
    setResendIn(30);
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (mode === "signup") {
      const passwordError = getNewPasswordError(password, confirmPassword);
      if (passwordError) {
        toast.error(
          passwordError,
          passwordError === NEW_PASSWORD_HINT
            ? "Choose a stronger password"
            : "Check your password",
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        await requestAccountEmail("forgot", email);
        return;
      }
      if (mode === "signup") {
        const needsConfirmation = await requestAccountEmail("signup", email);
        if (needsConfirmation) return;
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
        mode === "forgot"
          ? "recovery"
          : mode === "signup"
            ? "signup"
            : "signin";
      const notice = getAuthErrorNotice(error, action);
      toast.error(notice.message, notice.title);
    } finally {
      if (mode !== "forgot") {
        setPassword("");
        setConfirmPassword("");
      }
      setBusy(false);
    }
  }

  async function resendEmail() {
    if (!completion || completion.mode !== "forgot" || resendIn > 0 || busy)
      return;
    setBusy(true);
    try {
      await requestAccountEmail(completion.mode, completion.email);
      toast.success("A new secure link is on its way.", "Email sent");
    } catch (error) {
      const notice = getAuthErrorNotice(
        error,
        completion.mode === "forgot" ? "recovery" : "signup",
      );
      toast.error(notice.message, notice.title);
    } finally {
      setBusy(false);
    }
  }

  const choose = (next: Mode) => {
    setPassword("");
    setConfirmPassword("");
    setCompletion(null);
    setResendIn(0);
    setParams({ mode: next });
  };
  return (
    <AuthShell>
      <div className="admin-login-heading">
        <h1>{completion ? "Check your email" : copy.title}</h1>
        <p>
          {completion
            ? completion.mode === "signup"
              ? `We sent a confirmation link to ${completion.email}.`
              : `If ${completion.email} can be recovered, a secure link is on its way.`
            : copy.description}
        </p>
      </div>
      {completion ? (
        <div className="auth-completion-actions">
          {completion.mode === "forgot" && (
            <button
              type="button"
              className="admin-login-submit"
              disabled={busy || resendIn > 0}
              onClick={() => void resendEmail()}
              aria-busy={busy}
            >
              {busy && (
                <LoaderCircle
                  className="button-spinner"
                  size={18}
                  aria-hidden="true"
                />
              )}
              <span>
                {busy
                  ? "Sending…"
                  : resendIn > 0
                    ? `Send again in ${resendIn}s`
                    : "Send another email"}
              </span>
              {!busy && resendIn === 0 && (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </button>
          )}
          <button type="button" onClick={() => choose("signin")}>
            Return to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="admin-login-form">
          <label className="admin-login-field">
            <span>Email address</span>
            <div className="admin-login-input">
              <Mail size={19} className="input-icon" aria-hidden="true" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          {mode !== "forgot" && (
            <PasswordField
              label="Password"
              value={password}
              minLength={mode === "signup" ? NEW_PASSWORD_MIN_LENGTH : 8}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              placeholder={
                mode === "signup"
                  ? "Choose a strong password"
                  : "Enter your password"
              }
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
          {mode === "signup" && (
            <>
              <p className="auth-password-hint" id="signup-password-hint">
                {NEW_PASSWORD_HINT}
              </p>
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                minLength={NEW_PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                describedBy="signup-password-hint"
                placeholder="Repeat your password"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </>
          )}
          <button
            className="admin-login-submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy && (
              <LoaderCircle
                className="button-spinner"
                size={18}
                aria-hidden="true"
              />
            )}
            <span>{busy ? copy.busy : copy.submit}</span>
            {!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </form>
      )}
      {!completion && (
        <div className="auth-mode-links admin-login-help-links">
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
      )}
      <AuthSecurityNote>
        {completion
          ? "Secure links are short-lived and can only be used through your email."
          : copy.security}
      </AuthSecurityNote>
    </AuthShell>
  );
}
