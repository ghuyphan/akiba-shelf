const MEDIA_PREFIXES = ["/gacha-simulator/videos/", "/hsr-simulator/videos/"];

export interface SimulatorMediaRange {
  contentRange?: string;
  length: number;
  status: 200 | 206;
}

export function isSimulatorMediaPath(pathname: string): boolean {
  return MEDIA_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getSimulatorMediaKey(pathname: string): string | null {
  const prefix = MEDIA_PREFIXES.find((candidate) =>
    pathname.startsWith(candidate),
  );
  if (!prefix) return null;

  const suffix = pathname.slice(prefix.length);
  const segments = suffix.split("/");
  if (
    !suffix ||
    segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    ) ||
    !segments.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment))
  ) {
    return null;
  }

  return `${prefix.slice(1)}${suffix}`;
}

export function getSimulatorMediaRange(
  size: number,
  range?: R2Range,
): SimulatorMediaRange {
  if (!range) return { length: size, status: 200 };

  const start =
    "suffix" in range ? Math.max(size - range.suffix, 0) : (range.offset ?? 0);
  const length =
    "suffix" in range
      ? Math.min(range.suffix, size)
      : Math.min(range.length ?? size - start, size - start);
  return {
    contentRange: `bytes ${start}-${start + length - 1}/${size}`,
    length,
    status: 206,
  };
}
