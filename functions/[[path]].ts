import {
  getSimulatorMediaKey,
  getSimulatorMediaRange,
  isSimulatorMediaPath,
  parseSimulatorMediaRange,
} from "./media-route";

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
): number {
  const range = getSimulatorMediaRange(object.size, requestedRange);
  headers.set("content-length", String(range.length));
  if (range.contentRange) headers.set("content-range", range.contentRange);
  return range.status;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const requestUrl = new URL(context.request.url);
  if (!isSimulatorMediaPath(requestUrl.pathname)) return context.next();

  const key = getSimulatorMediaKey(requestUrl.pathname);
  if (!key) return new Response("Not found", { status: 404 });
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
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
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    setObjectHeaders(object, headers);
    if (context.request.method === "HEAD") {
      headers.set("content-length", String(object.size));
      return new Response(null, { headers });
    }
    if (!hasBody(object)) {
      const status = context.request.headers.has("if-none-match") ? 304 : 412;
      return new Response(null, { status, headers });
    }

    const status = setRangeHeaders(object, headers, requestedRange);
    return new Response(object.body, { status, headers });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "simulator media request failed",
        key,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response("Media unavailable", { status: 500 });
  }
};
