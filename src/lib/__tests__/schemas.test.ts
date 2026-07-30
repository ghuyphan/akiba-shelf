import { describe, expect, it } from "vitest";
import {
  boothSettingsSchema,
  imageVariantSchema,
  invitationOutcomeSchema,
  layoutOrderSchema,
  orderMutationSchema,
  promotionSettingsSchema,
  pushRegisterResultSchema,
  salesSummarySchema,
  shopInvitationSchema,
  shopMembershipSchema,
  staffAccessSchema,
} from "../schemas";

describe("runtime schemas", () => {
  it("accepts only complete storefront permutations", () => {
    expect(
      layoutOrderSchema.safeParse([
        "featured",
        "booth",
        "controls",
        "cart",
        "products",
      ]).success,
    ).toBe(true);
    expect(
      layoutOrderSchema.safeParse([
        "featured",
        "featured",
        "controls",
        "cart",
        "products",
      ]).success,
    ).toBe(false);
  });
  it("rejects malformed image variants", () => {
    expect(
      imageVariantSchema.safeParse({
        thumbnail: "not-a-url",
        detail: "https://example.test/detail.jpg",
      }).success,
    ).toBe(false);
  });
  it("rejects fabricated order mutation data", () => {
    expect(
      orderMutationSchema.safeParse({
        outcome: "confirmed",
        order: { id: "bad" },
      }).success,
    ).toBe(false);
  });
  it("accepts only supported storefront card personalities", () => {
    expect(
      boothSettingsSchema.shape.card_style.safeParse("playful").success,
    ).toBe(true);
    expect(
      boothSettingsSchema.shape.card_style.safeParse("glassmorphism").success,
    ).toBe(false);
  });
  it("validates each section-specific storefront style", () => {
    expect(
      boothSettingsSchema.shape.featured_style.safeParse("poster").success,
    ).toBe(true);
    expect(
      boothSettingsSchema.shape.controls_style.safeParse("compact").success,
    ).toBe(true);
    expect(
      boothSettingsSchema.shape.product_style.safeParse("framed").success,
    ).toBe(true);
    expect(
      boothSettingsSchema.shape.featured_style.safeParse("neon").success,
    ).toBe(false);
  });
  it("accepts Postgres timestamp offsets", () => {
    expect(
      promotionSettingsSchema.shape.starts_at.parse(
        "2026-07-29T15:00:00+00:00",
      ),
    ).toBe("2026-07-29T15:00:00+00:00");
    expect(
      salesSummarySchema.shape.from.parse("2026-07-29T15:00:00+00:00"),
    ).toBe("2026-07-29T15:00:00+00:00");
  });
  it("rejects malformed admin membership and team responses", () => {
    expect(
      shopMembershipSchema.safeParse({
        shop_id: "shop-1",
        shop_name: "Shop",
        shop_slug: "shop",
        role: "superadmin",
        active: true,
        shop_active: true,
      }).success,
    ).toBe(false);
    expect(
      staffAccessSchema.safeParse({
        email: "not-an-email",
        role: "staff",
        active: true,
      }).success,
    ).toBe(false);
    expect(
      shopInvitationSchema.safeParse({
        id: "invite-1",
        shop_id: "shop-1",
        email: "staff@example.com",
        role: "staff",
        status: "unknown",
        expires_at: "2026-08-01T00:00:00Z",
        created_at: "2026-07-30T00:00:00Z",
      }).success,
    ).toBe(false);
  });
  it("requires exact Edge Function success envelopes", () => {
    expect(
      invitationOutcomeSchema.safeParse({ outcome: "processed" }).success,
    ).toBe(true);
    expect(
      invitationOutcomeSchema.safeParse({ outcome: "queued" }).success,
    ).toBe(false);
    expect(
      pushRegisterResultSchema.safeParse({ outcome: "registered" }).success,
    ).toBe(true);
    expect(pushRegisterResultSchema.safeParse({ outcome: "ok" }).success).toBe(
      false,
    );
  });
});
