import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getObservabilityHealth,
  initObservability,
  sanitizeTelemetryEvent,
  sanitizeTelemetryUrl,
} from "../observability";

afterEach(() => {
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.observabilityStatus;
});

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

  it("exposes a sanitized disabled health state without a client identifier", () => {
    expect(initObservability()).toEqual({
      configured: false,
      status: "disabled",
      environment: "production",
      release: expect.any(String),
    });
    expect(getObservabilityHealth()).not.toHaveProperty("dsn");
    expect(document.documentElement.dataset.observabilityStatus).toBe(
      "disabled",
    );
  });

  it("reports configured startup without exposing the configured DSN", async () => {
    vi.resetModules();
    vi.stubEnv(
      "VITE_SENTRY_DSN",
      "https://public-key@example.ingest.sentry.io/123",
    );
    vi.stubEnv("VITE_RUM_SAMPLE_RATE", "0");
    const configuredModule = await import("../observability");

    expect(configuredModule.initObservability()).toEqual({
      configured: true,
      status: "listening",
      environment: "production",
      release: expect.any(String),
    });
    expect(configuredModule.getObservabilityHealth()).not.toHaveProperty("dsn");
    expect(document.documentElement.dataset.observabilityStatus).toBe(
      "listening",
    );
  });
});
