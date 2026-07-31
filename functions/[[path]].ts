import {
  applyFunctionSecurityHeaders,
  getConditionalResponseStatus,
  getSimulatorMediaKey,
  getSimulatorMediaRange,
  isSimulatorMediaPath,
  parseSimulatorMediaRange,
} from "./media-route";
import {
  createStaleAppAssetResponse,
  isJavaScriptResponse,
  isVersionedAppScriptPath,
} from "./app-asset-route";

function mediaResponse(
  body: BodyInit | null,
  init: ResponseInit = {},
): Response {
  const headers = applyFunctionSecurityHeaders(new Headers(init.headers));
  return new Response(body, { ...init, headers });
}

function setObjectHeaders(object: R2Object, headers: Headers): void {
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
}

function hasBody(object: R2Object): object is R2ObjectBody {
  return "body" in object;
}

function setRangeHeaders(
  object: R2ObjectBody,
  headers: Headers,
  requestedRange?: R2Range,
): ReturnType<typeof getSimulatorMediaRange> {
  const range = getSimulatorMediaRange(object.size, requestedRange);
  headers.set("content-length", String(range.length));
  if (range.contentRange) headers.set("content-range", range.contentRange);
  return range;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const requestUrl = new URL(context.request.url);
  if (
    (context.request.method === "GET" || context.request.method === "HEAD") &&
    isVersionedAppScriptPath(requestUrl.pathname)
  ) {
    const response = await context.next();
    if (isJavaScriptResponse(response)) return response;
    await response.body?.cancel();
    return createStaleAppAssetResponse(context.request.method);
  }
  if (!isSimulatorMediaPath(requestUrl.pathname)) return context.next();

  const key = getSimulatorMediaKey(requestUrl.pathname);
  if (!key) return mediaResponse("Not found", { status: 404 });
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return mediaResponse("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    const requestedRange = parseSimulatorMediaRange(
      context.request.headers.get("range"),
    );
    const object =
      context.request.method === "HEAD"
        ? await context.env.SIMULATOR_MEDIA.head(key)
        : await context.env.SIMULATOR_MEDIA.get(key, {
            onlyIf: context.request.headers,
            range: requestedRange,
          });
    if (!object) return mediaResponse("Not found", { status: 404 });

    const headers = new Headers();
    setObjectHeaders(object, headers);
    if (context.request.method === "HEAD") {
      headers.set("content-length", String(object.size));
      return mediaResponse(null, { headers });
    }
    if (!hasBody(object)) {
      const status = getConditionalResponseStatus(context.request.headers);
      return mediaResponse(null, { status, headers });
    }

    const range = setRangeHeaders(object, headers, requestedRange);
    if (range.status === 416) {
      await object.body.cancel();
      return mediaResponse(null, { status: range.status, headers });
    }
    return mediaResponse(object.body, { status: range.status, headers });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "simulator media request failed",
        key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return mediaResponse("Media unavailable", { status: 500 });
  }
};
