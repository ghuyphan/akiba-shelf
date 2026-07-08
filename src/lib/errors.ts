export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  return error instanceof Error ? error.message : fallback;
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
