import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITED_STOCK_THRESHOLD } from "../../constants";
import { deleteProduct, normalizeProduct, saveProduct } from "../products";
import type { Product } from "../../../types/catalog";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  removeUnreferencedProductImages: vi.fn(),
}));

vi.mock("../shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../shared")>()),
  requireSupabase: () => mocks.client,
}));

vi.mock("../storage", () => ({
  removeUnreferencedProductImages: mocks.removeUnreferencedProductImages,
}));

function productClient(paths: string[] | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: paths ? { image_paths: paths } : null,
    error: null,
  });
  const lookup = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const deleteResult = Promise.resolve({ error: null });
  const deleteQuery = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  };
  deleteQuery.eq
    .mockReturnValueOnce(deleteQuery)
    .mockReturnValueOnce(deleteResult);
  const client = {
    rpc: vi.fn().mockReturnValue(lookup),
    from: vi.fn().mockReturnValue(deleteQuery),
  };
  mocks.client = client;
  return { client, deleteQuery };
}

beforeEach(() => {
  vi.clearAllMocks();
});

const savedProduct: Product = {
  id: "product-1",
  name: "Product",
  collection: "Collection",
  description: "Description",
  price_vnd: 1000,
  sale_price_vnd: null,
  effective_price_vnd: 1000,
  item_code: "PRODUCT-1",
  quantity_available: 2,
  category: "Print",
  stock_status: "in_stock",
  stock_note: "In stock",
  images: ["https://example.test/product.webp"],
  image_paths: ["shop/new.webp"],
  featured: false,
  sort_order: 1,
  active: true,
};

function saveProductClient() {
  const lookup = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { image_paths: ["shop/old.webp"] },
      error: null,
    }),
  };
  const write = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: savedProduct, error: null }),
  };
  mocks.client = {
    rpc: vi.fn().mockReturnValue(lookup),
    from: vi.fn().mockReturnValue(write),
  };
}

describe("product normalization", () => {
  it("uses the shared threshold for limited stock", () => {
    expect(
      normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD })
        .stock_status,
    ).toBe("limited");
    expect(
      normalizeProduct({ quantity_available: LIMITED_STOCK_THRESHOLD + 1 })
        .stock_status,
    ).toBe("in_stock");
    expect(normalizeProduct({ quantity_available: 0 }).stock_status).toBe(
      "sold_out",
    );
  });
});

describe("product deletion", () => {
  it("reports image cleanup separately after the product deletion commits", async () => {
    const { deleteQuery } = productClient(["shop/product.webp"]);
    mocks.removeUnreferencedProductImages.mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    await expect(deleteProduct("shop-1", "product-1")).resolves.toEqual({
      imageCleanupPending: true,
    });
    expect(deleteQuery.delete).toHaveBeenCalledOnce();
    expect(mocks.removeUnreferencedProductImages).toHaveBeenCalledWith(
      mocks.client,
      "shop-1",
      ["shop/product.webp"],
    );
  });

  it("reports a complete deletion when no image cleanup remains", async () => {
    productClient([]);

    await expect(deleteProduct("shop-1", "product-1")).resolves.toEqual({
      imageCleanupPending: false,
    });
    expect(mocks.removeUnreferencedProductImages).not.toHaveBeenCalled();
  });
});

describe("product saving", () => {
  it("reports cleanup separately after the product save commits", async () => {
    saveProductClient();
    mocks.removeUnreferencedProductImages.mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    await expect(saveProduct("shop-1", savedProduct)).resolves.toEqual({
      product: expect.objectContaining({ id: "product-1" }),
      imageCleanupPending: true,
    });
    expect(mocks.removeUnreferencedProductImages).toHaveBeenCalledWith(
      mocks.client,
      "shop-1",
      ["shop/old.webp"],
    );
  });

  it("reports a fully completed save when cleanup succeeds", async () => {
    saveProductClient();
    mocks.removeUnreferencedProductImages.mockResolvedValueOnce(undefined);

    await expect(saveProduct("shop-1", savedProduct)).resolves.toEqual({
      product: expect.objectContaining({ id: "product-1" }),
      imageCleanupPending: false,
    });
  });
});
