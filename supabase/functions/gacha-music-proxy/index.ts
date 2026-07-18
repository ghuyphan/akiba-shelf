const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "";
const siteOrigin = (() => {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "";
  }
})();

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": siteOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

const videoIdPattern = /^[A-Za-z0-9_-]{6,64}$/;
const allowedTypes = new Set(["audio", "video"]);
const maxBodyLength = 1_024;

export const upstreamClient: { fetch: typeof fetch } = {
  fetch: globalThis.fetch,
};

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: corsHeaders });
}

async function parseBody(request: Request) {
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return null;
  }
  if (!raw || raw.length > maxBodyLength) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function handleGachaMusicRequest(
  request: Request,
): Promise<Response> {
  if (!siteOrigin)
    return failure("Gacha music is not configured.", 503);

  const origin = request.headers.get("Origin");
  if (origin !== siteOrigin) return failure("Origin not allowed.", 403);
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return failure("Method not allowed.", 405);

  const body = await parseBody(request);
  const videoID =
    typeof body?.videoID === "string" ? body.videoID.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "audio";
  if (!videoIdPattern.test(videoID) || !allowedTypes.has(type))
    return failure("Invalid media request.", 400);

  try {
    const response = await upstreamClient.fetch(
      "https://api.wishsimulator.app/track",
      {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "Origin": "https://hsr.wishsimulator.app",
      },
      body: JSON.stringify({ videoID, type }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok)
      return failure("The upstream music service is unavailable.", 502);

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return failure("The upstream music response was invalid.", 502);
    }
    if (!data || typeof data !== "object")
      return failure("The upstream music response was invalid.", 502);

    return Response.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error(
      "gacha-music-proxy failed",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return failure("The music request could not be completed.", 502);
  }
}

if (import.meta.main) Deno.serve(handleGachaMusicRequest);
