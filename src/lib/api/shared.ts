import { FunctionsHttpError } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../supabase";

export {
  booleanValue,
  numberValue,
  text,
  textArray,
} from "./valueNormalization";

export type ApiClient = NonNullable<typeof supabase>;

export function requireSupabase(): ApiClient {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return supabase;
}

export async function extractEdgeFunctionError(
  error: unknown,
): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body = await error.context.json();
    return body && typeof body === "object" && typeof body.error === "string"
      ? body.error
      : null;
  } catch {
    return null;
  }
}
