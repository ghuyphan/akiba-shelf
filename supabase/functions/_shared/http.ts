export type JsonObject = Record<string, unknown>;

export function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}

export function configuredOrigins(primary: string, additional = "") {
  return new Set(
    [primary, ...additional.split(",")].map(normalizeOrigin).filter(Boolean),
  );
}

export function corsHeaders(
  allowedOrigins: Set<string>,
  requestOrigin: string,
  methods = "POST, OPTIONS",
) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-notification-worker-secret",
    "Access-Control-Allow-Methods": methods,
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (allowedOrigins.has(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  }
  return headers;
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<JsonObject | null> {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > maxBytes) {
      return null;
    }
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

export function jsonFailure(
  error: string,
  status: number,
  headers: Record<string, string>,
) {
  return Response.json({ error }, { status, headers });
}

export function requiredEnv(names: string[]) {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (!value) return null;
    values[name] = value;
  }
  return values;
}
