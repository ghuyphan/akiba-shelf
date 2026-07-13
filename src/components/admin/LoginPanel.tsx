import { FormEvent, useState } from "react";
import { ArrowRight, Mail, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { useToast } from "../ui/ToastProvider";

import type { BoothSettings } from "../../types/catalog";
import { PageLoading } from "../ui/PageLoading";
import { getAuthErrorNotice } from "../../lib/authErrors";
import { PasswordField } from "../ui/PasswordField";
import { AuthSecurityNote, AuthShell } from "../ui/AuthShell";
import { useI18n } from "../../lib/i18n";

type LoginPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  booth?: BoothSettings;
};

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const { copy } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, run } = useAsyncAction();
  const toast = useToast();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onLogin(email, password))
      .catch((error) => {
        const notice = getAuthErrorNotice(error, "signin");
        toast.error(notice.message, notice.title);
      })
      .finally(() => {
        setPassword("");
      });
  }

  return (
    <AuthShell>
      <div className="admin-login-heading">
        <h1>{copy.auth.staffSignIn}</h1><p>{copy.auth.adminContinue}</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-login-form">
        <label className="admin-login-field">
          <span>{copy.auth.email}</span>
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

        <PasswordField
          label={copy.auth.password}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          disabled={!isSupabaseConfigured}
          placeholder={copy.auth.enterPassword}
        />

        {!isSupabaseConfigured && (
          <Alert variant="error" title={copy.errors.supabaseTitle}>
            {copy.errors.supabaseMessage}
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
          <span>{busy ? copy.common.loading : copy.auth.openAdmin}</span>
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>
      <div className="auth-mode-links admin-login-help-links">
        <Link to="/auth?mode=forgot">{copy.auth.forgotPassword}</Link>
        <Link to="/auth?mode=signup">{copy.auth.createAccount}</Link>
      </div>
      <AuthSecurityNote>
        {copy.auth.authorisedOnly}
      </AuthSecurityNote>
    </AuthShell>
  );
}

export function AdminAccessCheck() {
  const { copy } = useI18n();
  return (
    <PageLoading
      title={copy.auth.checkingAccess}
      message={copy.auth.loadingWorkspace}
      icon={<ShieldCheck size={28} />}
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
  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
          <div className="admin-login-heading">
            <h1>
              {kind === "inactive"
                ? "Staff access inactive"
                : kind === "error"
                  ? "Access check failed"
                  : "Staff access required"}
            </h1>
            <p>
              {message ||
                (kind === "inactive"
                  ? "An owner must reactivate your staff membership."
                  : "This signed-in account is not an authorized staff member.")}
            </p>
            {kind === "unauthorized" && userId && (
              <p className="admin-account-identity">
                Signed in as <strong>{email || userId}</strong>. Ask an owner to
                grant this account access.
              </p>
            )}
          </div>
          {onRetry && (
            <button
              type="button"
              className="admin-login-submit"
              onClick={() => void onRetry()}
            >
              Check access again
            </button>
          )}
          <button
            type="button"
            className="admin-login-submit admin-login-secondary"
            onClick={() => void onSignOut()}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
