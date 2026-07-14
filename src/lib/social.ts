import type { BoothSettings } from "../types/catalog";

export type SocialPlatform =
  | "Instagram"
  | "Facebook"
  | "TikTok"
  | "X"
  | "Threads"
  | "YouTube";

type SocialUrlKey =
  | "instagram_url"
  | "facebook_url"
  | "tiktok_url"
  | "x_url"
  | "threads_url"
  | "youtube_url";

type SocialVisibleKey =
  | "instagram_visible"
  | "facebook_visible"
  | "tiktok_visible"
  | "x_visible"
  | "threads_visible"
  | "youtube_visible";

export type SocialPlatformDefinition = {
  label: SocialPlatform;
  urlKey: SocialUrlKey;
  visibleKey: SocialVisibleKey;
  color: string;
  gradient: string;
  qrColors: [string, string, string];
};

export const SOCIAL_PLATFORMS: SocialPlatformDefinition[] = [
  {
    label: "Instagram",
    urlKey: "instagram_url",
    visibleKey: "instagram_visible",
    color: "#E1306C",
    gradient:
      "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    qrColors: ["#f06a4f", "#dc2f86", "#a915b7"],
  },
  {
    label: "Facebook",
    urlKey: "facebook_url",
    visibleKey: "facebook_visible",
    color: "#1877F2",
    gradient: "linear-gradient(135deg, #18acfe, #1877f2, #0f5cbf)",
    qrColors: ["#168ee8", "#1877f2", "#1258b5"],
  },
  {
    label: "TikTok",
    urlKey: "tiktok_url",
    visibleKey: "tiktok_visible",
    color: "#010101",
    gradient: "linear-gradient(135deg, #25f4ee, #fe2c55, #010101)",
    qrColors: ["#087f82", "#e52a50", "#111827"],
  },
  {
    label: "X",
    urlKey: "x_url",
    visibleKey: "x_visible",
    color: "#0F1419",
    gradient: "linear-gradient(135deg, #536471, #0f1419, #000000)",
    qrColors: ["#536471", "#202830", "#000000"],
  },
  {
    label: "Threads",
    urlKey: "threads_url",
    visibleKey: "threads_visible",
    color: "#101010",
    gradient: "linear-gradient(135deg, #777777, #242424, #000000)",
    qrColors: ["#6b7280", "#27272a", "#000000"],
  },
  {
    label: "YouTube",
    urlKey: "youtube_url",
    visibleKey: "youtube_visible",
    color: "#FF0033",
    gradient: "linear-gradient(135deg, #ff5a52, #ff0033, #c60027)",
    qrColors: ["#ff5a52", "#ff0033", "#a80022"],
  },
];

export const SOCIAL_BRAND_COLORS = Object.fromEntries(
  SOCIAL_PLATFORMS.map(({ label, color, gradient }) => [
    label,
    { color, gradient },
  ]),
) as Record<string, { color: string; gradient: string }>;

export const SOCIAL_QR_COLORS = Object.fromEntries(
  SOCIAL_PLATFORMS.map(({ label, qrColors }) => [label, qrColors]),
) as Record<string, [string, string, string]>;

export function configuredSocialPlatforms(booth: BoothSettings) {
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = booth[platform.urlKey]?.trim();
    const visible = booth[platform.visibleKey] ?? true;
    return url && visible ? [{ ...platform, url }] : [];
  });
}
