export const APP_RELEASE =
  typeof __MATSURI_RELEASE__ === "string" ? __MATSURI_RELEASE__ : "development";

export type ReleaseMetadata = {
  release: string;
};

export function hasNewerRelease(
  metadata: ReleaseMetadata | null,
  currentRelease = APP_RELEASE,
) {
  return Boolean(
    metadata?.release &&
      currentRelease !== "development" &&
      metadata.release !== currentRelease,
  );
}

export async function fetchReleaseMetadata(
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ReleaseMetadata | null> {
  try {
    const response = await fetcher(`${import.meta.env.BASE_URL}release.json`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as { release?: unknown }).release !== "string"
    )
      return null;
    const release = (value as { release: string }).release.trim();
    return release ? { release } : null;
  } catch {
    return null;
  }
}

export function getReleaseContext() {
  return { release: APP_RELEASE } as const;
}
