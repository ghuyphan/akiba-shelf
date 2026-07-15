import { ZodError } from "zod";

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ZodError) return fallback;
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
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
