import { describe, expect, it } from "vitest";
import { getAuthErrorNotice } from "../authErrors";

describe("getAuthErrorNotice", () => {
  it("turns rate limits into a useful message without exposing backend text", () => {
    const notice = getAuthErrorNotice(
      {
        status: 429,
        code: "over_email_send_rate_limit",
        message: "raw provider response with internal details",
      },
      "signup",
    );

    expect(notice.title).toBe("Please wait a moment");
    expect(notice.message).toContain("Too many emails");
    expect(notice.message).not.toContain("internal details");
  });

  it("uses an allow-listed message for known auth failures", () => {
    expect(
      getAuthErrorNotice({ code: "invalid_credentials" }, "signin"),
    ).toEqual({
      title: "Sign in failed",
      message: "The email address or password is incorrect.",
    });
  });

  it("never returns an unknown backend error message", () => {
    const notice = getAuthErrorNotice(
      { message: "database host and stack trace" },
      "callback",
    );
    expect(notice.message).not.toContain("database host");
    expect(notice.message).toContain("secure link");
  });
});
