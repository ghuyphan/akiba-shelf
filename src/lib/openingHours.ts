export type OpeningStatus = {
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
};

function minutes(hours: string, minutesValue: string) {
  return Number(hours) * 60 + Number(minutesValue);
}

export function getOpeningStatus(
  openingHours: string | null | undefined,
  now = new Date(),
): OpeningStatus | null {
  const matches = Array.from(
    openingHours?.matchAll(/(?:^|\D)([01]?\d|2[0-3])(?::([0-5]\d))?/g) ?? [],
  );
  if (matches.length < 2) return null;

  const opensMinutes = matches[0][2] ?? "00";
  const closesMinutes = matches[1][2] ?? "00";
  const opensAt = `${matches[0][1]}:${opensMinutes}`;
  const closesAt = `${matches[1][1]}:${closesMinutes}`;
  const opens = minutes(matches[0][1], opensMinutes);
  const closes = minutes(matches[1][1], closesMinutes);
  const current = now.getHours() * 60 + now.getMinutes();
  const isOpen = opens === closes
    ? true
    : opens < closes
      ? current >= opens && current < closes
      : current >= opens || current < closes;

  return { isOpen, opensAt, closesAt };
}
