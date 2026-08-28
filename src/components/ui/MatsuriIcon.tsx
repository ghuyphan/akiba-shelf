import type { CSSProperties } from "react";

export type MatsuriIconName =
  | "gacha-capsule"
  | "tote-bag"
  | "booth-awning"
  | "lantern"
  | "star-sparkle"
  | "acrylic-stand"
  | "pin-badge"
  | "art-print";

type MatsuriIconProps = {
  name: MatsuriIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

export function MatsuriIcon({
  name,
  size = 20,
  className = "",
  style,
  "aria-hidden": ariaHidden = true,
  "aria-label": ariaLabel,
}: MatsuriIconProps) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: `matsuri-icon matsuri-icon-${name} ${className}`.trim(),
    style,
    "aria-hidden": ariaHidden,
    "aria-label": ariaLabel,
  };

  switch (name) {
    case "gacha-capsule":
      return (
        <svg {...common}>
          {/* Outer sphere */}
          <circle cx="12" cy="12" r="8.5" />
          {/* Center rim seam */}
          <path d="M3.5 12h17" />
          {/* Top dome specular highlight arc */}
          <path
            d="M7.5 7.5a6.5 6.5 0 0 1 4.5-1.5"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Bottom opaque cup tonal fill */}
          <path
            d="M3.5 12A8.5 8.5 0 0 0 20.5 12Z"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="none"
          />
        </svg>
      );

    case "tote-bag":
      return (
        <svg {...common}>
          {/* Bag body */}
          <path d="M5 8.5h14l-1.2 11.2A2 2 0 0 1 15.8 21.5H8.2a2 2 0 0 1-2-1.8L5 8.5Z" />
          {/* Folded loop handles */}
          <path d="M8.5 8.5V5.5a3.5 3.5 0 0 1 7 0v3" />
          {/* Diamond festival stamp emblem */}
          <path
            d="M12 12.5l2 2-2 2-2-2z"
            strokeWidth="1.5"
            fill="currentColor"
            fillOpacity="0.18"
          />
        </svg>
      );

    case "booth-awning":
      return (
        <svg {...common}>
          {/* Awning drape / noren scallops */}
          <path d="M2 5h20l-1.5 5.5a2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0 2.5 2.5 0 0 1-4.5 0L2 5Z" />
          {/* Stall corner poles */}
          <path d="M4 11v9.5M20 11v9.5" />
          {/* Counter shelf */}
          <path d="M2 20.5h20" />
          {/* Mini lantern hanging on stall */}
          <path d="M12 11v3.5M10.5 14.5h3" strokeWidth="1.5" />
        </svg>
      );

    case "lantern":
      return (
        <svg {...common}>
          {/* Top suspension loop & cap */}
          <path d="M12 2v2M9 4h6" />
          {/* Ribbed oval paper body */}
          <path d="M7 4h10c2 0 3.5 3.5 3.5 8s-1.5 8-3.5 8H7c-2 0-3.5-3.5-3.5-8S5 4 7 4Z" />
          {/* Center bamboo rib */}
          <path d="M12 4v16" strokeWidth="1.5" />
          {/* Side curve ribs */}
          <path d="M8.5 4.5c-1 3.5-1 11.5 0 15M15.5 4.5c1 3.5 1 11.5 0 15" strokeWidth="1.5" />
          {/* Bottom cap & tassel */}
          <path d="M9 20h6M12 20v3.5" />
        </svg>
      );

    case "star-sparkle":
      return (
        <svg {...common}>
          {/* 4-point manga sparkle */}
          <path d="M12 2c0 4.5-3.5 8-8 8 4.5 0 8 3.5 8 8 0-4.5 3.5-8 8-8-4.5 0-8-3.5-8-8Z" />
          {/* Small companion sparkle */}
          <path d="M19 4v3M17.5 5.5h3" strokeWidth="1.5" />
        </svg>
      );

    case "acrylic-stand":
      return (
        <svg {...common}>
          {/* Standee base plate */}
          <ellipse cx="12" cy="19.5" rx="8" ry="2.5" />
          {/* Acrylic character figure silhouette */}
          <path d="M9 19V8.5a3 3 0 0 1 6 0V19" />
          {/* Character head mark */}
          <circle cx="12" cy="6" r="1.5" fill="currentColor" />
          {/* Slotted tab insert */}
          <path d="M10.5 19v1M13.5 19v1" strokeWidth="1.5" />
        </svg>
      );

    case "pin-badge":
      return (
        <svg {...common}>
          {/* Circular can badge frame */}
          <circle cx="12" cy="12" r="8.5" />
          {/* Inner star stamp */}
          <path
            d="M12 7.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z"
            strokeWidth="1.2"
            fill="currentColor"
            fillOpacity="0.2"
          />
        </svg>
      );

    case "art-print":
      return (
        <svg {...common}>
          {/* Postcard/canvas frame */}
          <rect x="4" y="3" width="16" height="18" rx="2" />
          {/* Mini landscape/figure horizon artwork */}
          <circle cx="8.5" cy="8" r="1.5" fill="currentColor" />
          <path d="M4 17l4.5-4 3.5 3 3-2.5 5 4.5" />
        </svg>
      );

    default:
      return null;
  }
}
