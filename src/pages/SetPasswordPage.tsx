import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LoaderCircle, RotateCw } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { PageLoading } from "../components/ui/PageLoading";
import { Button } from "../components/ui/Button";
import "../styles/admin.css";
import {
  clearPasswordFlow,
  clearPendingInvitation,
  getPasswordFlow,
  getPendingInvitation,
  routeAfterAuthentication,
} from "../lib/auth/authRouting";
import {
  acceptShopInvitation,
  clearShopInvitationMetadata,
  getAuthSession,
  updateAdminPassword,
} from "../lib/api/auth";
import { getShopMemberships } from "../lib/api/shops";
import { getAuthErrorNotice } from "../lib/auth/authErrors";
import {
  getNewPasswordError,
  NEW_PASSWORD_HINT,
  NEW_PASSWORD_MIN_LENGTH,
} from "../lib/auth/authValidation";
import { PasswordField } from "../components/ui/PasswordField";
import { AuthSecurityNote, AuthShell } from "../components/ui/AuthShell";
import { usePlatformI18n } from "../lib/i18n/platformI18n";

type RouteState = "checking" | "ready" | "invalid";

export function SetPasswordPage() {
  const { t } = usePlatformI18n();
  const [routeState, setRouteState] = useState<RouteState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordCompleted, setPasswordCompleted] = useState(false);
  const [acceptanceFailed, setAcceptanceFailed] = useState(false);
  const [completionFailed, setCompletionFailed] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const flow = getPasswordFlow();
  const invitationId = getPendingInvitation();

  useEffect(() => {
    if (
      !flow ||
      (flow === "invitation" && !invitationId)
    ) {
      setRouteState("invalid");
      return;
    }
    let active = true;
    void getAuthSession()
      .then(({ session, error }) => {
        if (active) setRouteState(!error && session ? "ready" : "invalid");
      })
      .catch(() => {
        if (active) setRouteState("invalid");
      });
    return () => {
      active = false;
    };
  }, [flow, invitationId]);

  const acceptInvitation = useCallback(async () => {
    if (!invitationId) return;
    setBusy(true);
    setAcceptanceFailed(false);
    let shopId: string;
    try {
      shopId = await acceptShopInvitation(invitationId);
    } catch {
      setBusy(false);
      setAcceptanceFailed(true);
      toast.error(
        t("Your password is saved, but shop access could not be completed. You can retry safely."),
        t("Invitation not completed"),
      );
      return;
    }
    try {
      await clearShopInvitationMetadata();
    } catch {
      setBusy(false);
      setAcceptanceFailed(true);
      toast.error(
        t("Shop access was accepted, but account cleanup could not finish. Retry to complete safely."),
        t("Invitation cleanup incomplete"),
      );
      return;
    }
    clearPendingInvitation();
    clearPasswordFlow();
    localStorage.setItem("akiba-active-shop", shopId);
    navigate("/admin", { replace: true });
  }, [invitationId, navigate, t, toast]);

  async function finishRecovery() {
    setBusy(true);
    setCompletionFailed(false);
    try {
      const memberships = await getShopMemberships();
      clearPasswordFlow();
      navigate(routeAfterAuthentication(memberships), { replace: true });
    } catch {
      setCompletionFailed(true);
      toast.error(
        t("Your password was saved, but we could not open your account. Retry safely without changing it again."),
        t("Could not finish recovery"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (routeState !== "ready") return;
    const passwordError = getNewPasswordError(password, confirm);
    if (passwordError) {
      toast.error(
        t(passwordError),
        passwordError === NEW_PASSWORD_HINT
          ? t("Choose a stronger password")
          : t("Check your password"),
      );
      return;
    }
    setBusy(true);
    try {
      await updateAdminPassword(password);
    } catch (error) {
      setBusy(false);
      const notice = getAuthErrorNotice(error, "password");
      toast.error(t(notice.message), t(notice.title));
      return;
    }
    setPasswordCompleted(true);
    setPassword("");
    setConfirm("");
    if (flow === "invitation") {
      await acceptInvitation();
      return;
    }
    await finishRecovery();
  }

  if (routeState === "checking")
    return (
      <PageLoading
        title={t("Checking password link")}
        message={t("Verifying this secure session…")}
      />
    );
  if (routeState === "invalid")
    return (
      <AuthShell>
        <div className="admin-login-heading">
          <h1>{t("Password link unavailable")}</h1>
          <p>{t("This password link is invalid or has expired.")}</p>
        </div>
        <div className="auth-mode-links">
          <Link className="button button-ghost" to="/auth?mode=signin">
            {t("Return to sign in")}
          </Link>
          <Link className="button button-primary" to="/auth?mode=forgot">
            {t("Request another recovery email")}
          </Link>
        </div>
        <AuthSecurityNote>
          {t("Password links are short-lived and protected by your email session.")}
        </AuthSecurityNote>
      </AuthShell>
    );
  if (passwordCompleted && acceptanceFailed)
    return (
      <AuthShell>
        <div className="admin-login-heading">
          <h1>{t("Finish joining the shop")}</h1>
          <p>
            {t("Your password is saved. Retry the invitation without changing it again.")}
          </p>
        </div>
        <Button
          className="admin-login-submit"
          loading={busy}
          icon={<RotateCw size={17} />}
          onClick={() => void acceptInvitation()}
        >
          {t("Retry invitation")}
        </Button>
        <div className="auth-mode-links">
          <Link className="button button-ghost" to="/auth?mode=signin">
            {t("Return to sign in")}
          </Link>
        </div>
        <AuthSecurityNote>
          {t("Your saved password will not be changed when you retry.")}
        </AuthSecurityNote>
      </AuthShell>
    );
  if (passwordCompleted && completionFailed)
    return (
      <AuthShell>
        <div className="admin-login-heading">
          <h1>{t("Password updated")}</h1>
          <p>
            {t("Your new password is saved. Retry opening your account without changing it again.")}
          </p>
        </div>
        <Button
          className="admin-login-submit"
          loading={busy}
          loadingText={t("Opening account…")}
          icon={<RotateCw size={17} />}
          onClick={() => void finishRecovery()}
        >
          {t("Open my account")}
        </Button>
        <div className="auth-mode-links">
          <Link className="button button-ghost" to="/auth?mode=signin">
            {t("Return to sign in")}
          </Link>
        </div>
        <AuthSecurityNote>
          {t("Your saved password will not be changed when you retry.")}
        </AuthSecurityNote>
      </AuthShell>
    );
  return (
    <AuthShell>
      <div className="admin-login-heading">
        <h1>{t("Set your password")}</h1>
        <p>{t("Choose a secure password to finish account setup.")}</p>
      </div>
      <form onSubmit={submit} className="admin-login-form" noValidate>
        <PasswordField
          label={t("New password")}
          value={password}
          minLength={NEW_PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          describedBy="set-password-hint"
          placeholder={t("Choose a strong password")}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="auth-password-hint" id="set-password-hint">
          {t(NEW_PASSWORD_HINT)}
        </p>
        <PasswordField
          label={t("Confirm password")}
          value={confirm}
          minLength={NEW_PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          describedBy="set-password-hint"
          placeholder={t("Repeat your password")}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <button className="admin-login-submit" disabled={busy} aria-busy={busy}>
          {busy && (
            <LoaderCircle
              className="button-spinner"
              size={18}
              aria-hidden="true"
            />
          )}
          <span>{busy ? t("Saving…") : t("Save password")}</span>
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>
      <AuthSecurityNote>
        {t("Your password is encrypted and never shown to shop staff.")}
      </AuthSecurityNote>
    </AuthShell>
  );
}
