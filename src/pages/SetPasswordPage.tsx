import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, RotateCw } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
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
} from "../lib/authRouting";
import { getShopMemberships } from "../lib/api";
import { getAuthErrorNotice } from "../lib/authErrors";

type RouteState = "checking" | "ready" | "invalid";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function SetPasswordPage() {
  const [routeState, setRouteState] = useState<RouteState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordCompleted, setPasswordCompleted] = useState(false);
  const [acceptanceFailed, setAcceptanceFailed] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const flow = getPasswordFlow();
  const invitationId = getPendingInvitation();

  useEffect(() => {
    if (
      !supabase ||
      !isSupabaseConfigured ||
      !flow ||
      (flow === "invitation" && !invitationId)
    ) {
      setRouteState("invalid");
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) setRouteState(!error && data.session ? "ready" : "invalid");
    });
    return () => {
      active = false;
    };
  }, [flow, invitationId]);

  const acceptInvitation = useCallback(async () => {
    if (!supabase || !invitationId) return;
    setBusy(true);
    setAcceptanceFailed(false);
    const { data: shopId, error } = await supabase.rpc(
      "accept_shop_invitation",
      { p_invitation_id: invitationId },
    );
    if (error || typeof shopId !== "string" || !uuidPattern.test(shopId)) {
      setBusy(false);
      setAcceptanceFailed(true);
      toast.error(
        "Your password is saved, but shop access could not be completed. You can retry safely.",
        "Invitation not completed",
      );
      return;
    }
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { shop_invitation_id: null },
    });
    if (metadataError) {
      setBusy(false);
      setAcceptanceFailed(true);
      toast.error(
        "Shop access was accepted, but account cleanup could not finish. Retry to complete safely.",
        "Invitation cleanup incomplete",
      );
      return;
    }
    clearPendingInvitation();
    clearPasswordFlow();
    localStorage.setItem("akiba-active-shop", shopId);
    navigate("/admin", { replace: true });
  }, [invitationId, navigate, toast]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || routeState !== "ready") return;
    if (password.length < 8 || password !== confirm) {
      toast.error(
        "Use at least 8 characters and make sure both passwords match.",
        "Could not set password",
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      const notice = getAuthErrorNotice(error, "password");
      toast.error(notice.message, notice.title);
      return;
    }
    setPasswordCompleted(true);
    setPassword("");
    setConfirm("");
    if (flow === "invitation") {
      await acceptInvitation();
      return;
    }
    clearPasswordFlow();
    const memberships = await getShopMemberships();
    setBusy(false);
    navigate(routeAfterAuthentication(memberships), { replace: true });
  }

  if (routeState === "checking")
    return (
      <PageLoading
        title="Checking password link"
        message="Verifying this secure session…"
      />
    );
  if (routeState === "invalid")
    return (
      <main className="admin-login">
        <section className="admin-access-card admin-login-card">
          <div className="admin-login-panel">
            <div className="admin-login-heading">
              <h1>Password link unavailable</h1>
              <p>This password link is invalid or has expired.</p>
            </div>
            <div className="auth-mode-links">
              <Link className="button button-ghost" to="/auth?mode=signin">
                Return to sign in
              </Link>
              <Link className="button button-primary" to="/auth?mode=forgot">
                Request another recovery email
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  if (passwordCompleted && acceptanceFailed)
    return (
      <main className="admin-login">
        <section className="admin-access-card admin-login-card">
          <div className="admin-login-panel">
            <div className="admin-login-heading">
              <h1>Finish joining the shop</h1>
              <p>
                Your password is saved. Retry the invitation without changing it
                again.
              </p>
            </div>
            <Button
              loading={busy}
              icon={<RotateCw size={17} />}
              onClick={() => void acceptInvitation()}
            >
              Retry invitation
            </Button>
            <div className="auth-mode-links">
              <Link className="button button-ghost" to="/auth?mode=signin">
                Return to sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  return (
    <main className="admin-login">
      <section className="admin-access-card admin-login-card">
        <div className="admin-login-panel">
          <div className="admin-login-heading">
            <h1>Set your password</h1>
            <p>Choose a secure password to finish account setup.</p>
          </div>
          <form onSubmit={submit} className="admin-login-form">
            {[
              [password, setPassword, "New password"],
              [confirm, setConfirm, "Confirm password"],
            ].map(([value, setValue, label]) => (
              <label className="admin-login-field" key={label as string}>
                <span>{label as string}</span>
                <div className="admin-login-input">
                  <Lock size={19} />
                  <input
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    value={value as string}
                    onChange={(e) =>
                      (setValue as (v: string) => void)(e.target.value)
                    }
                  />
                </div>
              </label>
            ))}
            <button className="admin-login-submit" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
