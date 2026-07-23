import { execFileSync } from "node:child_process";

const safeRelease = /^[A-Za-z0-9._-]+$/;

export function normalizeReleaseId(value, fallback = "development") {
  const release = String(value ?? "").trim();
  if (!release) return fallback;
  if (release.length > 120 || !safeRelease.test(release)) {
    throw new Error(
      "Release identifiers may contain only letters, numbers, dot, underscore, and dash.",
    );
  }
  return release;
}

export function resolveReleaseId(env = process.env) {
  const configured = env.MATSURI_RELEASE || env.GITHUB_SHA;
  if (configured) return normalizeReleaseId(configured);
  try {
    return normalizeReleaseId(
      execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return "development";
  }
}
