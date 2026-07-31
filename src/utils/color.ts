export type RgbColor = { red: number; green: number; blue: number };

const WHITE = "#ffffff";
const BLACK = "#000000";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((part) => part + part)
      .join("")}`.toLowerCase();
  }
  return null;
}

export function parseHexColor(value: string): RgbColor | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) return null;
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ red, green, blue }: RgbColor) {
  return `#${[red, green, blue]
    .map((value) =>
      Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function channelLuminance(channel: number) {
  const value = channel / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance({ red, green, blue }: RgbColor) {
  return (
    channelLuminance(red) * 0.2126 +
    channelLuminance(green) * 0.7152 +
    channelLuminance(blue) * 0.0722
  );
}

export function getContrastRatio(first: string, second: string) {
  const firstRgb = parseHexColor(first);
  const secondRgb = parseHexColor(second);
  if (!firstRgb || !secondRgb) return 1;
  const lighter = Math.max(luminance(firstRgb), luminance(secondRgb));
  const darker = Math.min(luminance(firstRgb), luminance(secondRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

function mixColor(source: RgbColor, target: RgbColor, amount: number) {
  return {
    red: source.red + (target.red - source.red) * amount,
    green: source.green + (target.green - source.green) * amount,
    blue: source.blue + (target.blue - source.blue) * amount,
  };
}

export function mixHexColors(
  first: string,
  second: string,
  firstWeight = 0.5,
) {
  const firstRgb = parseHexColor(first);
  const secondRgb = parseHexColor(second);
  if (!firstRgb || !secondRgb) return null;
  return rgbToHex(
    mixColor(firstRgb, secondRgb, 1 - clamp(firstWeight, 0, 1)),
  );
}

function findNearestPassingMix(
  source: RgbColor,
  target: RgbColor,
  background: string,
  targetRatio: number,
) {
  const targetHex = rgbToHex(target);
  if (getContrastRatio(targetHex, background) < targetRatio) return null;

  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (low + high) / 2;
    const candidate = rgbToHex(mixColor(source, target, middle));
    if (getContrastRatio(candidate, background) >= targetRatio) high = middle;
    else low = middle;
  }
  return { color: rgbToHex(mixColor(source, target, high)), amount: high };
}

export function ensureColorContrast(
  value: string,
  background: string = WHITE,
  targetRatio = 4.5,
  fallback = "#20304a",
) {
  const normalizedBackground = normalizeHexColor(background) ?? WHITE;
  const normalized = normalizeHexColor(value) ?? normalizeHexColor(fallback);
  if (!normalized) return "#20304a";
  if (getContrastRatio(normalized, normalizedBackground) >= targetRatio)
    return normalized;

  const source = parseHexColor(normalized)!;
  const dark = findNearestPassingMix(
    source,
    parseHexColor(BLACK)!,
    normalizedBackground,
    targetRatio,
  );
  const light = findNearestPassingMix(
    source,
    parseHexColor(WHITE)!,
    normalizedBackground,
    targetRatio,
  );
  const best = [dark, light]
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate),
    )
    .sort((first, second) => first.amount - second.amount)[0];
  return best?.color ?? normalizeHexColor(fallback) ?? "#20304a";
}

export function readableTextColor(
  background: string,
  dark = "#20304a",
  light = WHITE,
) {
  const normalizedBackground = normalizeHexColor(background) ?? WHITE;
  const normalizedDark = normalizeHexColor(dark) ?? "#20304a";
  const normalizedLight = normalizeHexColor(light) ?? WHITE;
  return getContrastRatio(normalizedDark, normalizedBackground) >=
    getContrastRatio(normalizedLight, normalizedBackground)
    ? normalizedDark
    : normalizedLight;
}
