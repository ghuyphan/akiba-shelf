import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  safeUuid: vi.fn(() => "11000000-0000-4000-8000-000000000001"),
}));

vi.mock("../../../utils/id", () => ({ safeUuid: mocks.safeUuid }));
vi.mock("../shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared")>()),
  requireSupabase: () => mocks.client,
}));

import {
  removeUnreferencedProductImages,
  uploadImage,
  uploadProductImages,
} from "../storage";

function storageBucket() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://cdn.test/${path}` },
  }));
  return { upload, remove, getPublicUrl };
}

beforeEach(() => vi.clearAllMocks());

describe("storage API", () => {
  it("uploads immutable public images with a generated safe path", async () => {
    const bucket = storageBucket();
    mocks.client = { storage: { from: vi.fn(() => bucket) } };
    const file = new File(["image"], "poster.webp", { type: "image/webp" });

    await expect(uploadImage("shop-1", "booth-images", file)).resolves.toEqual({
      path: "shop-1/11000000-0000-4000-8000-000000000001.webp",
      url: "https://cdn.test/shop-1/11000000-0000-4000-8000-000000000001.webp",
    });
    expect(bucket.upload).toHaveBeenCalledWith(
      "shop-1/11000000-0000-4000-8000-000000000001.webp",
      file,
      {
        upsert: false,
        contentType: "image/webp",
        cacheControl: "31536000",
      },
    );
  });

  it("rolls back the first product variant when the second upload fails", async () => {
    const bucket = storageBucket();
    bucket.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("upload failed") });
    mocks.client = { storage: { from: vi.fn(() => bucket) } };
    const thumbnail = new File(["thumb"], "thumb.webp", {
      type: "image/webp",
    });
    const detail = new File(["detail"], "detail.webp", {
      type: "image/webp",
    });

    await expect(
      uploadProductImages("shop-1", thumbnail, detail),
    ).rejects.toThrow("upload failed");
    expect(bucket.remove).toHaveBeenCalledWith([
      "shop-1/11000000-0000-4000-8000-000000000001-thumb.webp",
    ]);
  });

  it("deletes only candidate paths that are no longer referenced", async () => {
    const bucket = storageBucket();
    const query = {
      select: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockResolvedValue({
        data: [{ image_paths: ["shop/keep.webp"] }],
        error: null,
      }),
    };
    const client = {
      rpc: vi.fn(() => query),
      storage: { from: vi.fn(() => bucket) },
    };

    await removeUnreferencedProductImages(
      client as never,
      "shop-1",
      ["shop/keep.webp", "shop/remove.webp"],
    );

    expect(bucket.remove).toHaveBeenCalledWith(["shop/remove.webp"]);
  });
});
