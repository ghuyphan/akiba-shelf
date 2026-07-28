import { describe, expect, it, vi } from "vitest";
import { fetchReleaseMetadata, hasNewerRelease } from "../release";

describe("release update detection", () => {
  it("reads no-store release metadata", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ release: "release-2" }),
      ) as unknown as typeof fetch;

    await expect(fetchReleaseMetadata(fetcher)).resolves.toEqual({
      release: "release-2",
    });
    expect(fetcher).toHaveBeenCalledWith("/release.json", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("ignores invalid or unavailable metadata", async () => {
    const invalid = vi
      .fn()
      .mockResolvedValue(
        Response.json({ release: "" }),
      ) as unknown as typeof fetch;
    const unavailable = vi
      .fn()
      .mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    await expect(fetchReleaseMetadata(invalid)).resolves.toBeNull();
    await expect(fetchReleaseMetadata(unavailable)).resolves.toBeNull();
  });

  it("only flags a different production release", () => {
    expect(hasNewerRelease({ release: "release-2" }, "release-1")).toBe(true);
    expect(hasNewerRelease({ release: "release-1" }, "release-1")).toBe(false);
    expect(hasNewerRelease({ release: "release-2" }, "development")).toBe(
      false,
    );
  });
});
