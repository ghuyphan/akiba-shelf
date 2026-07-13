import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getShopMemberships } from "../lib/api";
import type { ShopMembership } from "../types/catalog";

const STORAGE_KEY = "akiba-active-shop";
export type AdminSessionState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; userId: string; email?: string }
  | { status: "authorized"; access: ShopMembership; memberships: ShopMembership[]; userId: string; email?: string }
  | { status: "inactive"; userId: string; email?: string }
  | { status: "error"; message: string };

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>(isSupabaseConfigured ? { status: "checking" } : { status: "unauthenticated" });
  const resolvedUserId = useRef<string | null>(null);
  const resolvingUserId = useRef<string | null>(null);
  const requestId = useRef(0);

  const resolve = useCallback(async (showChecking = true) => {
    if (!supabase) { setState({ status: "unauthenticated" }); return; }
    const currentRequest = ++requestId.current;
    if (showChecking) setState({ status: "checking" });
    const { data, error } = await supabase.auth.getSession();
    if (currentRequest !== requestId.current) return;
    if (error) { resolvingUserId.current = null; setState({ status: "error", message: error.message }); return; }
    const user = data.session?.user;
    if (!user) { resolvedUserId.current = null; resolvingUserId.current = null; setState({ status: "unauthenticated" }); return; }
    resolvingUserId.current = user.id;
    try {
      const memberships = await getShopMemberships();
      if (currentRequest !== requestId.current) return;
      resolvedUserId.current = user.id;
      resolvingUserId.current = null;
      if (!memberships.length) { setState({ status: "unauthorized", userId: user.id, email: user.email }); return; }
      const activeMemberships = memberships.filter((item) => item.active && item.shop_active);
      if (!activeMemberships.length) { setState({ status: "inactive", userId: user.id, email: user.email }); return; }
      const stored = localStorage.getItem(STORAGE_KEY);
      const access = activeMemberships.find((item) => item.shop_id === stored) ?? activeMemberships[0];
      localStorage.setItem(STORAGE_KEY, access.shop_id);
      setState({ status: "authorized", access, memberships, userId: user.id, email: user.email });
    } catch (caught) {
      resolvingUserId.current = null;
      setState({ status: "error", message: caught instanceof Error ? caught.message : "Could not verify shop access." });
    }
  }, []);

  useEffect(() => {
    void resolve();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      if (event === "SIGNED_OUT") {
        requestId.current += 1;
        resolvedUserId.current = null;
        resolvingUserId.current = null;
        setState({ status: "unauthenticated" });
        return;
      }
      const nextUserId = session?.user.id ?? null;
      if (!nextUserId || nextUserId === resolvedUserId.current || nextUserId === resolvingUserId.current) return;
      // Leave an already-authorized workspace mounted while Supabase confirms the same session.
      window.setTimeout(() => { void resolve(false); }, 0);
    });
    return () => subscription.unsubscribe();
  }, [resolve]);

  const selectShop = useCallback((shopId: string) => {
    setState((current) => {
      if (current.status !== "authorized") return current;
      const access = current.memberships.find((item) => item.shop_id === shopId);
      if (!access || !access.active || !access.shop_active) return current;
      localStorage.setItem(STORAGE_KEY, access.shop_id);
      return { ...current, access };
    });
  }, []);

  const refresh = useCallback(() => resolve(true), [resolve]);

  return { state, refresh, selectShop };
}
