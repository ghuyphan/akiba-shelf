import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getStaffAccess, type StaffAccess } from "../lib/api";

export type AdminSessionState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; userId: string; email?: string }
  | { status: "inactive"; access: StaffAccess }
  | { status: "authorized"; access: StaffAccess }
  | { status: "error"; message: string };

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>(isSupabaseConfigured ? { status: "checking" } : { status: "unauthenticated" });

  useEffect(() => {
    if (!supabase) { setState({ status: "unauthenticated" }); return; }
    let mounted = true;
    let lastUserId: string | undefined = undefined;

    async function resolveAccess(hasSession: boolean, userId?: string, email?: string) {
      if (!mounted) return;
      if (!hasSession) {
        lastUserId = undefined;
        setState({ status: "unauthenticated" });
        return;
      }
      if (userId === lastUserId) return;
      lastUserId = userId;

      setState({ status: "checking" });
      try {
        const access = await getStaffAccess();
        if (!mounted) return;
        if (!access) setState({ status: "unauthorized", userId: userId ?? "unknown", email });
        else if (!access.active) setState({ status: "inactive", access });
        else setState({ status: "authorized", access });
      } catch (error) {
        if (mounted) setState({ status: "error", message: error instanceof Error ? error.message : "Could not verify staff access." });
      }
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) { if (mounted) setState({ status: "error", message: error.message }); return; }
      void resolveAccess(Boolean(data.session), data.session?.user.id, data.session?.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveAccess(Boolean(session), session?.user.id, session?.user.email);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return { state, refresh: async () => {
    setState({ status: "checking" });
    const { data, error } = await supabase!.auth.getSession();
    if (error) { setState({ status: "error", message: error.message }); return; }
    if (!data.session) { setState({ status: "unauthenticated" }); return; }
    try {
      const access = await getStaffAccess();
      if (!access) setState({ status: "unauthorized", userId: data.session.user.id, email: data.session.user.email });
      else if (!access.active) setState({ status: "inactive", access });
      else setState({ status: "authorized", access });
    } catch (error) { setState({ status: "error", message: error instanceof Error ? error.message : "Could not verify staff access." }); }
  } };
}
