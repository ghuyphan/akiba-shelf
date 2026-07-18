import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

const normalizedSupabaseUrl = (() => {
  if (!supabaseUrl) return undefined;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    return parsed.href.replace(/\/$/, "");
  } catch {
    return undefined;
  }
})();

if (normalizedSupabaseUrl && typeof document !== "undefined") {
  const origin = new URL(normalizedSupabaseUrl).origin;
  if (
    !document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)
  ) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = origin;
    preconnect.crossOrigin = "anonymous";
    document.head.append(preconnect);
  }
}

export const isSupabaseConfigured = Boolean(
  normalizedSupabaseUrl && supabaseAnonKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(normalizedSupabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
