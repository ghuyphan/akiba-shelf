import { describe, expect, it } from "vitest";
import {
  COMPRESSED_IMAGE_MIME_TYPE,
  getCompressedImageName,
  MAX_IMAGE_BYTES,
  validateImageFile,
} from "./image";

describe("image validation", () => {
  it("rejects unsupported MIME types", async () => {
    await expect(
      validateImageFile(new File(["x"], "x.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow(/JPEG, PNG, or WebP/);
  });
  it("rejects empty and oversized files before decoding", async () => {
    await expect(
      validateImageFile(new File([], "x.png", { type: "image/png" })),
    ).rejects.toThrow(/between 1 byte/);
    const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "x.png", {
      type: "image/png",
    });
    await expect(validateImageFile(oversized)).rejects.toThrow(/10 MB/);
  });
});

describe("compressed image output", () => {
  it("uses WebP for compressed image names and content", () => {
    expect(COMPRESSED_IMAGE_MIME_TYPE).toBe("image/webp");
    expect(getCompressedImageName("poster.final.png")).toBe(
      "poster.final.webp",
    );
    expect(getCompressedImageName("poster")).toBe("poster.webp");
    expect(getCompressedImageName(".poster")).toBe(".poster.webp");
  });
});
