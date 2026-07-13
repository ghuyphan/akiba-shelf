import { describe, expect, it } from "vitest";
import { en } from "../locales/en";
import { vi } from "../locales/vi";

function shape(value: unknown): unknown {
  if (typeof value === "function") return "function";
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]));
  return typeof value;
}

describe("translation schema", () => {
  it("keeps English and Vietnamese structurally identical", () => expect(shape(vi)).toEqual(shape(en)));
  it("contains no undefined required translation", () => {
    const visit = (value: unknown) => { expect(value).not.toBeUndefined(); if (value && typeof value === "object") Object.values(value).forEach(visit); };
    visit(en); visit(vi);
  });
  it("keeps Vietnamese staff terminology", () => {
    expect(vi.auth.staffSignIn).toContain("staff");
    expect(vi.catalog.waitingConfirmation).toContain("staff");
  });
});

