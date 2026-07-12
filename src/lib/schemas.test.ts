import { describe, expect, it } from "vitest";
import { imageVariantSchema, layoutOrderSchema, orderMutationSchema } from "./schemas";

describe("runtime schemas", () => {
  it("accepts only complete storefront permutations", () => { expect(layoutOrderSchema.safeParse(["featured", "booth", "controls", "cart", "products"]).success).toBe(true); expect(layoutOrderSchema.safeParse(["featured", "featured", "controls", "cart", "products"]).success).toBe(false); });
  it("rejects malformed image variants", () => { expect(imageVariantSchema.safeParse({ thumbnail: "not-a-url", detail: "https://example.test/detail.jpg" }).success).toBe(false); });
  it("rejects fabricated order mutation data", () => { expect(orderMutationSchema.safeParse({ outcome: "confirmed", order: { id: "bad" } }).success).toBe(false); });
});
