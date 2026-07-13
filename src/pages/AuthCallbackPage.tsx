import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageLoading } from "../components/ui/PageLoading";
import { supabase } from "../lib/supabase";
import { getShopMemberships } from "../lib/api";
import {
  routeAfterAuthentication,
  storePasswordFlow,
  storePendingInvitation,
} from "../lib/authRouting";
import { getAuthErrorNotice } from "../lib/authErrors";
import { AuthSecurityNote, AuthShell } from "../components/ui/AuthShell";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [message, setMessage] = useState("Confirming your secure link…");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (!supabase) throw new Error("Authentication is not configured.");
      const callbackParams = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const callbackError =
        callbackParams.get("error_description") ||
        hash.get("error_description");
      if (callbackError) throw new Error(callbackError);
      const code = callbackParams.get("code");
      const recovery =
        callbackParams.get("next") === "set-password" ||
        hash.get("type") === "recovery";
      window.history.replaceState(
        null,
        "",
        `${import.meta.env.BASE_URL}auth/callback`,
      );
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session)
        throw new Error(
          "This link is invalid or expired. Request a new secure link.",
        );

      if (recovery) {
        storePasswordFlow("recovery");
        navigate("/auth/set-password", { replace: true });
        return;
      }
      const invitationId =
        typeof session.user.user_metadata?.shop_invitation_id === "string"
          ? session.user.user_metadata.shop_invitation_id
          : "";
      if (invitationId && storePendingInvitation(invitationId)) {
        navigate("/auth/set-password", { replace: true });
        return;
      }
      const memberships = await getShopMemberships();
      navigate(routeAfterAuthentication(memberships), { replace: true });
    })().catch((error) => {
      const notice = getAuthErrorNotice(error, "callback");
      setFailed(true);
      setMessage(notice.message);
    });
  }, [navigate, params]);

  if (!failed)
    return <PageLoading title="Finishing sign in" message={message} />;
  return (
    <AuthShell>
      <div className="admin-login-heading">
        <h1>Could not finish sign in</h1>
        <p>{message}</p>
      </div>
      <Link className="button button-primary" to="/auth?mode=signin">
        Back to sign in
      </Link>
      <AuthSecurityNote>
        Expired or used secure links cannot be reopened.
      </AuthSecurityNote>
    </AuthShell>
  );
}
