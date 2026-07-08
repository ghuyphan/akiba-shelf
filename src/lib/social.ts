import type { ReactNode } from "react";

export type SocialLink = {
  label: string;
  url: string;
  icon: ReactNode;
  brandColor: string;
  brandGradient: string;
};

export const SOCIAL_BRAND_COLORS: Record<string, { color: string; gradient: string }> = {
  Instagram: {
    color: "#E1306C",
    gradient: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
  },
  Facebook: {
    color: "#1877F2",
    gradient: "linear-gradient(135deg, #18acfe, #1877f2, #0f5cbf)",
  },
  TikTok: {
    color: "#010101",
    gradient: "linear-gradient(135deg, #25f4ee, #fe2c55, #010101)",
  },
};
