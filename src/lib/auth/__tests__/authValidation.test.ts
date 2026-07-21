import { describe, expect, it } from "vitest";
import { getNewPasswordError, isStrongPassword } from "../authValidation";

describe("new password validation", () => {
  it("applies one policy to signup, recovery, and invitations", () => {
    expect(isStrongPassword("short1A")).toBe(false);
    expect(isStrongPassword("alllowercase1")).toBe(false);
    expect(isStrongPassword("ALLUPPERCASE1")).toBe(false);
    expect(isStrongPassword("StrongPassword1")).toBe(true);
  });

  it("reports strength before confirmation mismatch", () => {
    expect(getNewPasswordError("weak", "different")).toContain("10+");
    expect(getNewPasswordError("StrongPassword1", "StrongPassword2")).toBe(
      "Both passwords must match.",
    );
    expect(
      getNewPasswordError("StrongPassword1", "StrongPassword1"),
    ).toBeNull();
  });
});
