import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getShopMemberships } from "../lib/api";
import type { ShopMembership } from "../types/catalog";

const STORAGE_KEY = "akiba-active-shop";
export type AdminSessionState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; userId: string; email?: string }
  | { status: "authorized"; access: ShopMembership; memberships: ShopMembership[] }
  | { status: "error"; message: string };

export function useAdminSession() {
  const [state, setState] = useState<AdminSessionState>(isSupabaseConfigured ? { status: "checking" } : { status: "unauthenticated" });

  const resolve = useCallback(async () => {
    if (!supabase) { setState({ status: "unauthenticated" }); return; }
    setState({ status: "checking" });
    const { data, error } = await supabase.auth.getSession();
    if (error) { setState({ status: "error", message: error.message }); return; }
    const user = data.session?.user;
    if (!user) { setState({ status: "unauthenticated" }); return; }
    try {
      const memberships = await getShopMemberships();
      if (!memberships.length) { setState({ status: "unauthorized", userId: user.id, email: user.email }); return; }
      const stored = localStorage.getItem(STORAGE_KEY);
      const access = memberships.find((item) => item.shop_id === stored) ?? memberships[0];
      localStorage.setItem(STORAGE_KEY, access.shop_id);
      setState({ status: "authorized", access, memberships });
    } catch (caught) {
      setState({ status: "error", message: caught instanceof Error ? caught.message : "Could not verify shop access." });
    }
  }, []);

  useEffect(() => {
    void resolve();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void resolve(); });
    return () => subscription.unsubscribe();
  }, [resolve]);

  const selectShop = useCallback((shopId: string) => {
    setState((current) => {
      if (current.status !== "authorized") return current;
      const access = current.memberships.find((item) => item.shop_id === shopId);
      if (!access) return current;
      localStorage.setItem(STORAGE_KEY, access.shop_id);
      return { ...current, access };
    });
  }, []);

  return { state, refresh: resolve, selectShop };
}
