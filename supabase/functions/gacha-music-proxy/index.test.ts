import { assertEquals } from "jsr:@std/assert@1";

Deno.env.set("PUBLIC_SITE_URL", "https://matsuri.pro");

const { handleGachaMusicRequest, upstreamClient } = await import("./index.ts");

function request(
  body: string,
  origin = "https://matsuri.pro",
  method = "POST",
) {
  return new Request(
    "https://project.test/functions/v1/gacha-music-proxy",
    {
      method,
      body: method === "POST" ? body : undefined,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
    },
  );
}

Deno.test("gacha music preflight is scoped to the configured site", async () => {
  const response = await handleGachaMusicRequest(
    request("", "https://matsuri.pro", "OPTIONS"),
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://matsuri.pro",
  );
  assertEquals(response.headers.get("Vary"), "Origin");
});

Deno.test("gacha music rejects disallowed origins and methods", async () => {
  assertEquals(
    (
      await handleGachaMusicRequest(
        request(
          JSON.stringify({ videoID: "abcdefghijk", type: "audio" }),
          "https://evil.test",
        ),
      )
    ).status,
    403,
  );
  assertEquals(
    (
      await handleGachaMusicRequest(
        request("", "https://matsuri.pro", "GET"),
      )
    ).status,
    405,
  );
});

Deno.test("gacha music validates its bounded request contract", async () => {
  assertEquals((await handleGachaMusicRequest(request("{"))).status, 400);
  assertEquals(
    (
      await handleGachaMusicRequest(
        request(JSON.stringify({ videoID: "bad id", type: "audio" })),
      )
    ).status,
    400,
  );
  assertEquals(
    (
      await handleGachaMusicRequest(
        request(JSON.stringify({ videoID: "abcdefghijk", type: "archive" })),
      )
    ).status,
    400,
  );
});

Deno.test("gacha music forwards a valid request", async () => {
  const originalFetch = upstreamClient.fetch;
  let forwardedBody = "";
  upstreamClient.fetch = async (_input, init) => {
    forwardedBody = String(init?.body ?? "");
    return Response.json({
      status: "success",
      download: "https://media.test/track.mp3",
    });
  };

  try {
    const response = await handleGachaMusicRequest(
      request(JSON.stringify({ videoID: "abcdefghijk", type: "audio" })),
    );
    assertEquals(response.status, 200);
    assertEquals(
      JSON.parse(forwardedBody),
      { videoID: "abcdefghijk", type: "audio" },
    );
  } finally {
    upstreamClient.fetch = originalFetch;
  }
});
