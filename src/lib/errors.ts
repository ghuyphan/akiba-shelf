import { ZodError } from "zod";

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) return fallback;

  let raw = "";
  if (error instanceof Error) {
    raw = error.message;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    raw = error.message;
  } else {
    return fallback;
  }

  const lower = raw.toLowerCase();

  // Map database constraints to user-friendly messages
  if (lower.includes("gacha_settings_lightcone_legendary_soft_pity_check")) {
    return "The Light Cone 5-star soft pity must be lower than its hard pity.";
  }
  if (lower.includes("gacha_settings_legendary_soft_pity_check")) {
    return "The 5-star soft pity must be lower than its hard pity.";
  }
  if (lower.includes("gacha_settings_rare_soft_pity_check")) {
    return "The 4-star soft pity must be lower than its hard pity.";
  }
  if (lower.includes("gacha_settings_featured_item_rate_check")) {
    return "The featured-item rate must be between 0% and 100%.";
  }
  if (lower.includes("products_sale_price_vnd_check")) {
    return "Sale price must be lower than the regular price.";
  }
  if (lower.includes("shops_slug_format") || lower.includes("shops_slug_key")) {
    return "This shop URL slug is invalid or already taken.";
  }

  // Catch unhandled database error patterns (check/foreign key/unique/not-null constraint leaks)
  if (
    lower.includes("violates check constraint") ||
    lower.includes("violates foreign key constraint") ||
    lower.includes("violates unique constraint") ||
    lower.includes("violates not-null constraint") ||
    lower.includes("new row for relation")
  ) {
    return fallback !== "Something went wrong."
      ? fallback
      : "Database error. Please check your inputs and try again.";
  }

  return raw;
}

export function isSessionNoise(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();

  return [
    "jwt expired",
    "token expired",
    "refresh token",
    "auth session missing",
    "session not found",
    "session_not_found",
    "invalid jwt",
    "invalid token",
  ].some((pattern) => message.includes(pattern));
}

export function isTransportError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;

  const message = getErrorMessage(error, "").toLowerCase();
  return [
    "failed to fetch",
    "fetch failed",
    "network error",
    "network request failed",
    "load failed",
    "connection refused",
    "failed to connect",
    "database connection",
    "timeout",
  ].some((pattern) => message.includes(pattern));
}
