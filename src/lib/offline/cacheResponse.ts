const CONTENT_RANGE_PATTERN = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i;

/** Converts a complete byte-range response into a Cache API-compatible response. */
export function prepareResponseForCache(response: Response) {
  if (response.status !== 206) return response;

  const match = CONTENT_RANGE_PATTERN.exec(
    response.headers.get("Content-Range") ?? "",
  );
  const start = Number(match?.[1]);
  const end = Number(match?.[2]);
  const total = Number(match?.[3]);
  if (
    !match ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start !== 0 ||
    total <= 0 ||
    end !== total - 1
  ) {
    throw new Error("The server returned an incomplete offline asset.");
  }

  const headers = new Headers(response.headers);
  headers.delete("Content-Range");
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  return new Response(response.body, {
    status: 200,
    statusText: "OK",
    headers,
  });
}
