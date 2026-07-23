import { FormEvent, useState } from "react";
import { ArrowRight, Mail, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { Alert } from "../../ui/Alert";
import { useToast } from "../../ui/ToastProvider";

import type { BoothSettings } from "../../../types/catalog";
import { PageLoading } from "../../ui/PageLoading";
import { getAuthErrorNotice } from "../../../lib/auth/authErrors";
import { PasswordField } from "../../ui/PasswordField";
import { AuthSecurityNote, AuthShell } from "../../ui/AuthShell";
import { AuthDivider, GoogleAuthButton } from "../../ui/GoogleAuthButton";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";

type LoginPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  booth?: BoothSettings;
};

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, run } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error(t("Enter a valid email address."), t("Check your email"));
      return;
    }
    if (!password) {
      toast.error(t("Enter your password."), t("Check your password"));
      return;
    }
    await run(() => onLogin(email, password))
      .catch((error) => {
        const notice = getAuthErrorNotice(error, "signin");
        toast.error(t(notice.message), t(notice.title));
      })
      .finally(() => {
        setPassword("");
      });
  }

  return (
    <AuthShell>
      <div className="admin-login-heading">
        <h1>{t("Staff sign in")}</h1>
        <p>{t("Use your admin account to continue.")}</p>
      </div>

      <div className="auth-oauth-actions">
        <GoogleAuthButton />
        <AuthDivider />
      </div>

      <form onSubmit={handleSubmit} className="admin-login-form" noValidate>
        <label className="admin-login-field">
          <span>{t("Email address")}</span>
          <div className="admin-login-input">
            <Mail size={19} className="input-icon" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!isSupabaseConfigured}
              autoComplete="email"
              placeholder={t("staff@example.com")}
            />
          </div>
        </label>

        <PasswordField
          label={t("Password")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          disabled={!isSupabaseConfigured}
          placeholder={t("Enter your password")}
        />

        {!isSupabaseConfigured && (
          <Alert variant="error" title={t("Supabase is not configured")}>
            {t("Add the Supabase URL and public key before signing in.")}
          </Alert>
        )}

        <button
          type="submit"
          className="admin-login-submit"
          disabled={busy || !isSupabaseConfigured}
          aria-busy={busy}
        >
          {busy && (
            <LoaderCircle
              className="button-spinner"
              size={18}
              aria-hidden="true"
            />
          )}
          <span>{busy ? t("Signing in…") : t("Open admin")}</span>
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>
      <div className="auth-mode-links admin-login-help-links">
        <Link to="/auth?mode=forgot">{t("Forgot password?")}</Link>
        <Link to="/auth?mode=signup">{t("Create account")}</Link>
      </div>
      <AuthSecurityNote>
        {t("Only authorised staff can access this workspace.")}
      </AuthSecurityNote>
    </AuthShell>
  );
}

export function AdminAccessCheck() {
  const { t } = usePlatformI18n();
  return (
    <PageLoading
      title={t("Checking your access")}
      message={t("Loading your workspace…")}
    />
  );
}

export function AdminAccessDenied({
  kind,
  message,
  userId,
  email,
  onRetry,
  onSignOut,
}: {
  kind: "unauthorized" | "inactive" | "error";
  message?: string;
  userId?: string;
  email?: string;
  onRetry?: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const { t } = usePlatformI18n();
  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
          <div className="admin-login-heading">
            <h1>
              {kind === "inactive"
                ? t("Staff access inactive")
                : kind === "error"
                  ? t("Access check failed")
                  : t("Staff access required")}
            </h1>
            <p>
              {(message ? t(message) :
                (kind === "inactive"
                  ? t("An owner must reactivate your staff membership.")
                  : t("This signed-in account is not an authorized staff member.")))}
            </p>
            {kind === "unauthorized" && userId && (
              <p className="admin-account-identity">
                {t("Signed in as")} <strong>{email || userId}</strong>. {t("Ask an owner to grant this account access.")}
              </p>
            )}
          </div>
          {onRetry && (
            <button
              type="button"
              className="admin-login-submit"
              onClick={() => void onRetry()}
            >
              {t("Check access again")}
            </button>
          )}
          <button
            type="button"
            className="admin-login-submit admin-login-secondary"
            onClick={() => void onSignOut()}
          >
            {t("Sign out")}
          </button>
        </div>
      </section>
    </main>
  );
}
