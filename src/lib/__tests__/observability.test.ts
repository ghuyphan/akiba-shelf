import { describe, expect, it } from "vitest";
import { sanitizeTelemetryEvent, sanitizeTelemetryUrl } from "../observability";

describe("observability privacy", () => {
  it("removes query strings and fragments from auth-bearing URLs", () => {
    expect(
      sanitizeTelemetryUrl(
        "https://matsuri.pro/auth/callback?code=secret#access_token=token",
      ),
    ).toBe("https://matsuri.pro/auth/callback");
    expect(sanitizeTelemetryUrl("/auth/recovery?token=secret#next")).toBe(
      "/auth/recovery",
    );
  });

  it("sanitizes request headers and breadcrumb navigation URLs", () => {
    const event = sanitizeTelemetryEvent({
      request: {
        url: "https://matsuri.pro/auth/callback?code=secret",
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=secret",
          Accept: "application/json",
        },
      },
      breadcrumbs: [
        {
          category: "navigation",
          data: {
            from: "/auth/callback?code=secret",
            to: "/dashboard#token",
          },
        },
      ],
    });

    expect(event.request).toEqual({
      url: "https://matsuri.pro/auth/callback",
      headers: { Accept: "application/json" },
    });
    expect(event.breadcrumbs[0].data).toEqual({
      from: "/auth/callback",
      to: "/dashboard",
      url: undefined,
    });
  });
});
