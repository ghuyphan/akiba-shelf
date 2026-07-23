import { getReleaseContext } from "./release";

type EventLevel = "info" | "warning" | "error";
type EventDetails = Record<
  string,
  string | number | boolean | null | undefined
>;

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const environment = import.meta.env.VITE_APP_ENV?.trim() || "production";
const rumSampleRate = Math.min(
  1,
  Math.max(0, Number(import.meta.env.VITE_RUM_SAMPLE_RATE ?? "0.1") || 0),
);

let reporterPromise: Promise<typeof import("@sentry/react") | null> | null =
  null;
let initialized = false;
let removeEarlyErrorListeners: (() => void) | null = null;

const sensitiveHeaderNames = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "referer",
  "referrer",
  "apikey",
  "x-api-key",
]);

type TelemetryBreadcrumb = { data?: Record<string, unknown> };
type TelemetryEvent = {
  request?: { url?: unknown; headers?: unknown };
  breadcrumbs?: unknown[];
};

export function sanitizeTelemetryUrl(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return value;
  try {
    const url = new URL(value, window.location.origin);
    const sanitized = `${url.origin}${url.pathname}`;
    return value.startsWith("/") ? url.pathname : sanitized;
  } catch {
    return value;
  }
}

function sanitizeHeaders(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([name]) => !sensitiveHeaderNames.has(name.toLowerCase()),
    ),
  );
}

function sanitizeTelemetryBreadcrumb<T>(breadcrumb: T): T {
  if (!breadcrumb || typeof breadcrumb !== "object") return breadcrumb;
  const candidate = breadcrumb as TelemetryBreadcrumb;
  if (candidate.data) {
    candidate.data = {
      ...candidate.data,
      url: sanitizeTelemetryUrl(candidate.data.url),
      from: sanitizeTelemetryUrl(candidate.data.from),
      to: sanitizeTelemetryUrl(candidate.data.to),
    };
  }
  return breadcrumb;
}

export function sanitizeTelemetryEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const candidate = event as TelemetryEvent;
  if (candidate.request) {
    candidate.request.url = sanitizeTelemetryUrl(candidate.request.url);
    candidate.request.headers = sanitizeHeaders(candidate.request.headers);
  }
  if (Array.isArray(candidate.breadcrumbs)) {
    candidate.breadcrumbs = candidate.breadcrumbs.map(
      sanitizeTelemetryBreadcrumb,
    );
  }
  return event;
}

function routePattern(pathname = window.location.pathname) {
  if (/^\/s\/[^/]+\/play\/?$/.test(pathname)) return "/s/:shopSlug/play";
  if (/^\/s\/[^/]+\/?$/.test(pathname)) return "/s/:shopSlug";
  if (pathname.startsWith("/auth/")) return "/auth/*";
  if (pathname.startsWith("/dashboard/")) return "/dashboard/*";
  return pathname || "/";
}

function deviceClass() {
  if (window.matchMedia("(max-width: 760px)").matches) return "phone";
  if (window.matchMedia("(max-width: 1100px)").matches) return "tablet";
  return "desktop";
}

function connectionClass() {
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
    }
  ).connection;
  if (connection?.saveData) return "save-data";
  return connection?.effectiveType ?? "unknown";
}

function context(details: EventDetails = {}) {
  return {
    ...getReleaseContext(),
    route: routePattern(),
    device: deviceClass(),
    connection: connectionClass(),
    ...details,
  };
}

function loadReporter() {
  if (!dsn) return Promise.resolve(null);
  if (!reporterPromise) {
    reporterPromise = import("@sentry/react")
      .then((Sentry) => {
        removeEarlyErrorListeners?.();
        removeEarlyErrorListeners = null;
        Sentry.init({
          dsn,
          environment,
          release: getReleaseContext().release,
          sendDefaultPii: false,
          tracesSampleRate: 0,
          beforeSend: (event) => sanitizeTelemetryEvent(event),
          beforeBreadcrumb: (breadcrumb) =>
            sanitizeTelemetryBreadcrumb(breadcrumb),
        });
        return Sentry;
      })
      .catch(() => null);
  }
  return reporterPromise;
}

export function reportError(error: unknown, details: EventDetails = {}) {
  if (!dsn) return;
  void loadReporter().then((Sentry) => {
    if (!Sentry) return;
    Sentry.withScope((scope) => {
      scope.setContext("matsuri", context(details));
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  });
}

export function trackClientEvent(
  name: string,
  details: EventDetails = {},
  level: EventLevel = "info",
) {
  if (!dsn) return;
  void loadReporter().then((Sentry) => {
    if (!Sentry) return;
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      scope.setTag("event_type", name);
      scope.setContext("matsuri", context(details));
      Sentry.captureMessage(name);
    });
  });
}

export function initObservability() {
  if (initialized || !dsn) return;
  initialized = true;
  const onError = (event: ErrorEvent) =>
    reportError(event.error ?? event.message, { stage: "window_error" });
  const onUnhandledRejection = (event: PromiseRejectionEvent) =>
    reportError(event.reason, { stage: "unhandled_rejection" });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  removeEarlyErrorListeners = () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };

  if (Math.random() > rumSampleRate) return;
  const warmReporter = () => void loadReporter();
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warmReporter, { timeout: 2_000 });
  } else {
    globalThis.setTimeout(warmReporter, 500);
  }
  void import("web-vitals")
    .then(({ onCLS, onINP, onLCP }) => {
      const reportMetric = (metric: {
        name: string;
        value: number;
        delta: number;
        id: string;
        rating: string;
        navigationType: string;
      }) => {
        trackClientEvent("web_vital", {
          metric: metric.name,
          value: Number(metric.value.toFixed(3)),
          delta: Number(metric.delta.toFixed(3)),
          rating: metric.rating,
          navigation: metric.navigationType,
          metricId: metric.id,
        });
      };
      onCLS(reportMetric);
      onINP(reportMetric);
      onLCP(reportMetric);
    })
    .catch(() => undefined);
}
