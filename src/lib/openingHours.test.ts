import { describe, expect, it } from "vitest";
import { getOpeningStatus } from "./openingHours";

function at(hours: number, minutes: number) {
  const date = new Date(2026, 6, 14, hours, minutes);
  return date;
}

describe("getOpeningStatus", () => {
  it("reports a daytime range using the current local time", () => {
    expect(getOpeningStatus("7:00 - 17:00", at(12, 0))).toMatchObject({ isOpen: true });
    expect(getOpeningStatus("7:00 - 17:00", at(18, 0))).toMatchObject({ isOpen: false });
  });

  it("supports ranges that cross midnight", () => {
    expect(getOpeningStatus("18:00–02:00", at(23, 0))).toMatchObject({ isOpen: true });
    expect(getOpeningStatus("18:00–02:00", at(12, 0))).toMatchObject({ isOpen: false });
  });

  it("supports compact whole-hour ranges", () => {
    expect(getOpeningStatus("10–18", at(12, 0))).toEqual({
      isOpen: true,
      opensAt: "10:00",
      closesAt: "18:00",
    });
  });

  it("does not guess when a usable range is missing", () => {
    expect(getOpeningStatus("Weekends only", at(12, 0))).toBeNull();
  });
});
