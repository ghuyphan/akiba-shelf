const MEDIA_PREFIXES = ["/gacha-simulator/videos/", "/hsr-simulator/videos/"];

export interface SimulatorMediaRange {
  contentRange?: string;
  length: number;
  status: 200 | 206;
}

export function parseSimulatorMediaRange(
  header: string | null,
): R2Range | undefined {
  if (!header?.startsWith("bytes=")) return undefined;

  const value = header.slice("bytes=".length).split(",", 1)[0]?.trim();
  if (!value) return undefined;

  const separator = value.indexOf("-");
  if (separator < 0) return undefined;

  const startText = value.slice(0, separator).trim();
  const endText = value.slice(separator + 1).trim();
  if (!startText && !endText) return undefined;

  if (!startText) {
    const suffix = Number(endText);
    return Number.isSafeInteger(suffix) && suffix > 0 ? { suffix } : undefined;
  }

  const offset = Number(startText);
  if (!Number.isSafeInteger(offset) || offset < 0) return undefined;
  if (!endText) return { offset };

  const end = Number(endText);
  if (!Number.isSafeInteger(end) || end < offset) return undefined;
  return { offset, length: end - offset + 1 };
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
