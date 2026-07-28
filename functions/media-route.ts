const MEDIA_PREFIXES = ["/gacha-simulator/videos/", "/hsr-simulator/videos/"];

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com 'sha256-7FFX34wE80rHafLf6rmb2DGlEh0ZYRRb8xkf6Zp3j+0=' 'sha256-Rx0iKcdR7hHd/ZLx3ZJ+mZzJmnDQFwfliBojPHmK5IM='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io; font-src 'self' data:; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";

export const FUNCTION_SECURITY_HEADERS = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "permissions-policy": "camera=(), geolocation=(), microphone=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
} as const;

export function applyFunctionSecurityHeaders(headers: Headers): Headers {
  for (const [name, value] of Object.entries(FUNCTION_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}

export interface SimulatorMediaRange {
  contentRange?: string;
  length: number;
  status: 200 | 206;
}

export function parseSimulatorMediaRange(
  header: string | null,
): R2Range | undefined {
  if (!header?.startsWith("bytes=")) return undefined;

  const value = header.slice("bytes=".length).split(",", 1)[0]?.trim();
  if (!value) return undefined;

  const separator = value.indexOf("-");
  if (separator < 0) return undefined;

  const startText = value.slice(0, separator).trim();
  const endText = value.slice(separator + 1).trim();
  if (!startText && !endText) return undefined;

  if (!startText) {
    const suffix = Number(endText);
    return Number.isSafeInteger(suffix) && suffix > 0 ? { suffix } : undefined;
  }

  const offset = Number(startText);
  if (!Number.isSafeInteger(offset) || offset < 0) return undefined;
  if (!endText) return { offset };

  const end = Number(endText);
  if (!Number.isSafeInteger(end) || end < offset) return undefined;
  return { offset, length: end - offset + 1 };
}

export function isSimulatorMediaPath(pathname: string): boolean {
  return MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getSimulatorMediaKey(pathname: string): string | null {
  const prefix = MEDIA_PREFIXES.find((candidate) =>
    pathname.startsWith(candidate),
  );
  if (!prefix) return null;

  const suffix = pathname.slice(prefix.length);
  const segments = suffix.split("/");
  if (
    !suffix ||
    segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    ) ||
    !segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment))
  ) {
    return null;
  }

  return `${prefix.slice(1)}${suffix}`;
}

export function getSimulatorMediaRange(
  size: number,
  range?: R2Range,
): SimulatorMediaRange {
  if (!range) return { length: size, status: 200 };

  const start =
    "suffix" in range ? Math.max(size - range.suffix, 0) : (range.offset ?? 0);
  const length =
    "suffix" in range
      ? Math.min(range.suffix, size)
      : Math.min(range.length ?? size - start, size - start);
  return {
    contentRange: `bytes ${start}-${start + length - 1}/${size}`,
    length,
    status: 206,
  };
}
