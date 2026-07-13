import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-13T12:00:00Z").getTime();

  it.each([
    ["2026-07-13T11:59:30Z", "Just now"],
    ["2026-07-13T11:55:00Z", "5m ago"],
    ["2026-07-13T03:00:00Z", "9h ago"],
    ["2026-07-12T12:00:00Z", "1 day ago"],
    ["2026-07-10T00:00:00Z", "3 days ago"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatRelativeTime(value, now)).toBe(expected);
  });
});
