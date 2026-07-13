import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/ui/ToastProvider";
import "../styles/admin.css";
import {
  clearPendingInvitation,
  getPendingInvitation,
  routeAfterAuthentication,
} from "../lib/authRouting";
import { getShopMemberships } from "../lib/api";
export function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) {
      toast.error(
        "Use at least 8 characters and make sure both passwords match.",
        "Could not set password",
      );
      return;
    }
    setBusy(true);
    const { error: failure } = await supabase!.auth.updateUser({ password });
    if (failure) {
      setBusy(false);
      toast.error(
        "This password link is invalid or expired. Request a new one.",
        "Could not set password",
      );
      return;
    }
    const invitationId = getPendingInvitation();
    if (invitationId) {
      const { data: shopId, error } = await supabase!.rpc(
        "accept_shop_invitation",
        { p_invitation_id: invitationId },
      );
      clearPendingInvitation();
      setBusy(false);
      if (error || !shopId) {
        toast.error(
          "This invitation is invalid, expired, revoked, or belongs to another account.",
          "Could not accept invitation",
        );
        return;
      }
      await supabase!.auth.updateUser({ data: { shop_invitation_id: null } });
      localStorage.setItem("akiba-active-shop", String(shopId));
      navigate("/admin", { replace: true });
      return;
    }
    const memberships = await getShopMemberships();
    setBusy(false);
    navigate(routeAfterAuthentication(memberships), { replace: true });
  }
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
