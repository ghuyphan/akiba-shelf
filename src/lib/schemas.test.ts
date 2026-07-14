import { describe, expect, it } from "vitest";
import { boothSettingsSchema, imageVariantSchema, layoutOrderSchema, orderMutationSchema } from "./schemas";

describe("runtime schemas", () => {
  it("accepts only complete storefront permutations", () => { expect(layoutOrderSchema.safeParse(["featured", "booth", "controls", "cart", "products"]).success).toBe(true); expect(layoutOrderSchema.safeParse(["featured", "featured", "controls", "cart", "products"]).success).toBe(false); });
  it("rejects malformed image variants", () => { expect(imageVariantSchema.safeParse({ thumbnail: "not-a-url", detail: "https://example.test/detail.jpg" }).success).toBe(false); });
  it("rejects fabricated order mutation data", () => { expect(orderMutationSchema.safeParse({ outcome: "confirmed", order: { id: "bad" } }).success).toBe(false); });
  it("accepts only supported storefront card personalities", () => { expect(boothSettingsSchema.shape.card_style.safeParse("playful").success).toBe(true); expect(boothSettingsSchema.shape.card_style.safeParse("glassmorphism").success).toBe(false); });
  it("validates each section-specific storefront style", () => {
    expect(boothSettingsSchema.shape.featured_style.safeParse("poster").success).toBe(true);
    expect(boothSettingsSchema.shape.controls_style.safeParse("compact").success).toBe(true);
    expect(boothSettingsSchema.shape.product_style.safeParse("framed").success).toBe(true);
    expect(boothSettingsSchema.shape.featured_style.safeParse("neon").success).toBe(false);
  });
});
