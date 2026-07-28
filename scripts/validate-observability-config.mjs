import { pathToFileURL } from "node:url";
import { normalizeReleaseId } from "./release-identity.mjs";

function optionalValue(value) {
  return String(value ?? "").trim();
}

export function validateObservabilityConfig(
  env = process.env,
  { production = false } = {},
) {
  const dsn = optionalValue(env.VITE_SENTRY_DSN);
  const environment = optionalValue(env.VITE_APP_ENV) || "production";
  const sampleRateValue = optionalValue(env.VITE_RUM_SAMPLE_RATE) || "0.1";
  const sampleRate = Number(sampleRateValue);

  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    throw new Error("VITE_RUM_SAMPLE_RATE must be a number from 0 through 1");
  }

  if (production && environment !== "production") {
    throw new Error(
      "VITE_APP_ENV must be production for the production Pages build",
    );
  }

  const release = production
    ? normalizeReleaseId(optionalValue(env.MATSURI_RELEASE), "")
    : optionalValue(env.MATSURI_RELEASE);
  if (production && !release) {
    throw new Error(
      "MATSURI_RELEASE is required for the production Pages build",
    );
  }

  if (!dsn) {
    return {
      configured: false,
      environment,
      sampleRate,
      release: release || null,
    };
  }

  let parsed;
  try {
    parsed = new URL(dsn);
  } catch {
    throw new Error("VITE_SENTRY_DSN must be a valid URL");
  }

  if (
    parsed.protocol !== "https:" ||
    !/^\w+$/.test(parsed.username) ||
    parsed.password ||
    parsed.port ||
    !/^\/\d+$/.test(parsed.pathname) ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "VITE_SENTRY_DSN must be an HTTPS public-key DSN with a numeric project ID and no password, port, query, or fragment",
    );
  }

  if (!parsed.hostname.endsWith(".sentry.io")) {
    throw new Error(
      "VITE_SENTRY_DSN host must match the sentry.io origin allowed by the Content Security Policy",
    );
  }

  return {
    configured: true,
    environment,
    sampleRate,
    release: release || null,
  };
}

function main() {
  const result = validateObservabilityConfig(process.env, {
    production: process.argv.includes("--production"),
  });
  const state = result.configured ? "enabled" : "disabled";
  console.log(
    `Browser observability configuration valid (${state}, environment=${result.environment}, release=${result.release ?? "development"}, rumSampleRate=${result.sampleRate}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
