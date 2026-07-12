import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, validateImageFile } from "./image";

describe("image validation", () => {
  it("rejects unsupported MIME types", async () => { await expect(validateImageFile(new File(["x"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow(/JPEG, PNG, or WebP/); });
  it("rejects empty and oversized files before decoding", async () => { await expect(validateImageFile(new File([], "x.png", { type: "image/png" }))).rejects.toThrow(/between 1 byte/); const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "x.png", { type: "image/png" }); await expect(validateImageFile(oversized)).rejects.toThrow(/10 MB/); });
});
