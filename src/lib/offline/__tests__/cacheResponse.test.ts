import { describe, expect, it } from "vitest";
import { prepareResponseForCache } from "../cacheResponse";

describe("offline cache responses", () => {
  it("keeps normal successful responses unchanged", () => {
    const response = new Response("asset", { status: 200 });

    expect(prepareResponseForCache(response)).toBe(response);
  });

  it("normalizes a full-body 206 response before caching", async () => {
    const response = new Response("asset", {
      status: 206,
      headers: {
        "Content-Encoding": "identity",
        "Content-Length": "5",
        "Content-Range": "bytes 0-4/5",
        "Content-Type": "video/mp4",
      },
    });

    const prepared = prepareResponseForCache(response);

    expect(prepared.status).toBe(200);
    expect(prepared.headers.get("Content-Range")).toBeNull();
    expect(prepared.headers.get("Content-Length")).toBeNull();
    expect(prepared.headers.get("Content-Encoding")).toBeNull();
    expect(prepared.headers.get("Content-Type")).toBe("video/mp4");
    await expect(prepared.text()).resolves.toBe("asset");
  });

  it("rejects a genuinely partial response", () => {
    const response = new Response("set", {
      status: 206,
      headers: { "Content-Range": "bytes 2-4/5" },
    });

    expect(() => prepareResponseForCache(response)).toThrow(
      /incomplete offline asset/i,
    );
  });
});
