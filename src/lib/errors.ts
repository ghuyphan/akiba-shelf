import { ZodError } from "zod";

const unsafeDisplayPatterns = [
  /<\/?[a-z][^>]*>/i,
  /\b(?:column|constraint|database|postgres|postgrest|relation|schema|sqlstate)\b/i,
  /\b(?:permission denied|security definer|function)\b/i,
  /\b(?:delete|insert|select|update)\s+(?:from|into|public\.|set)\b/i,
  /\b(?:api[_ -]?key|authorization|bearer|jwt|service[_ -]?role)\b/i,
  /\b(?:stack trace|typeerror|referenceerror|syntaxerror)\b/i,
  /(?:^|\s)[A-Z0-9_]{4,}(?::|\s)/,
  /[{}[\]]/,
  /https?:\/\//i,
];

function getRawErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "";
}

function mappedErrorMessage(raw: string) {
  const lower = raw.toLowerCase();

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
  return "";
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) return fallback;

  const raw = getRawErrorMessage(error);
  if (!raw) return fallback;

  const lower = raw.toLowerCase();

  // Map database constraints to user-friendly messages
  const mapped = mappedErrorMessage(raw);
  if (mapped) return mapped;

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

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof ZodError) return fallback;
  const raw = getRawErrorMessage(error).trim();
  if (!raw) return fallback;

  const mapped = mappedErrorMessage(raw);
  if (mapped) return mapped;

  if (
    raw.length > 240 ||
    /[\r\n\t\0]/.test(raw) ||
    unsafeDisplayPatterns.some((pattern) => pattern.test(raw))
  ) {
    return fallback;
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
