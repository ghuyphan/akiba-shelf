import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function useAdminSession() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) { setIsCheckingAuth(false); return; }
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(Boolean(data.session));
      setIsCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(Boolean(session));
      setIsCheckingAuth(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  return { isAuthed, setIsAuthed, isCheckingAuth };
}
