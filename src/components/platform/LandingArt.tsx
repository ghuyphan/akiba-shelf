import { useId, type CSSProperties } from "react";

type PaperClipColor = "silver" | "rosegold" | "gold" | "mint" | "coral";

type PaperClipProps = {
  variant?: PaperClipColor;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
};

/** Illustrated 2D vector paperclip with clean indie-art line style. */
export function PaperClipArt({
  variant = "silver",
  className = "",
  style,
  width = 26,
  height = 48,
}: PaperClipProps) {
  const colorMap: Record<
    PaperClipColor,
    { stroke: string; fill: string; shadow: string }
  > = {
    silver: {
      stroke: "#54657d",
      fill: "#eef2f7",
      shadow: "rgba(30, 41, 59, 0.14)",
    },
    rosegold: {
      stroke: "#c2415d",
      fill: "#ffe9ed",
      shadow: "rgba(190, 24, 93, 0.14)",
    },
    gold: {
      stroke: "#c48818",
      fill: "#fff8db",
      shadow: "rgba(180, 100, 10, 0.14)",
    },
    mint: {
      stroke: "#2a8a64",
      fill: "#e6f7ef",
      shadow: "rgba(20, 90, 60, 0.14)",
    },
    coral: {
      stroke: "#d95c64",
      fill: "#fce9e9",
      shadow: "rgba(217, 92, 100, 0.16)",
    },
  };

  const c = colorMap[variant];

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-paperclip ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Flat illustrative shadow */}
      <path
        d="M8 17V40C8 44.4 11.6 48 16 48C20.4 48 24 44.4 24 40V12C24 6.5 19.5 2 14 2C8.5 2 4 6.5 4 12V42C4 47.5 9.5 52 16 52C22.5 52 27 47.5 27 42V16"
        stroke={c.shadow}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(1, 1.5)"
      />

      {/* Main 2D illustrated wire */}
      <path
        d="M8 17V40C8 44.4 11.6 48 16 48C20.4 48 24 44.4 24 40V12C24 6.5 19.5 2 14 2C8.5 2 4 6.5 4 12V42C4 47.5 9.5 52 16 52C22.5 52 27 47.5 27 42V16"
        stroke={c.stroke}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Cute inner highlight stroke */}
      <path
        d="M14 3.5C18 3.5 22.5 7 22.5 12V20"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
    </svg>
  );
}

type PushPinColor = "coral" | "yellow" | "mint" | "navy" | "lavender";

type PushPinProps = {
  color?: PushPinColor;
  className?: string;
  style?: CSSProperties;
  size?: number;
};

/** 2D illustrated stationery push pin / sticker tack. */
export function PushPinArt({
  color = "coral",
  className = "",
  style,
  size = 26,
}: PushPinProps) {
  const colorSchemes: Record<
    PushPinColor,
    { head: string; outline: string; rim: string }
  > = {
    coral: {
      head: "#d95c64",
      outline: "#9f2b34",
      rim: "#ba3b45",
    },
    yellow: {
      head: "#f4cf78",
      outline: "#a87819",
      rim: "#d4a232",
    },
    mint: {
      head: "#abd9c7",
      outline: "#237254",
      rim: "#48a07c",
    },
    navy: {
      head: "#6ea1d4",
      outline: "#244a73",
      rim: "#3b6998",
    },
    lavender: {
      head: "#caa8f5",
      outline: "#693b9e",
      rim: "#9665d4",
    },
  };

  const c = colorSchemes[color];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-pushpin ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Flat shadow */}
      <ellipse cx="14" cy="24" rx="7" ry="2.5" fill="rgba(60, 40, 45, 0.14)" />

      {/* Pin base rim */}
      <ellipse cx="14" cy="16" rx="8" ry="3.5" fill={c.outline} />
      <ellipse cx="14" cy="15" rx="7.5" ry="3" fill={c.rim} />

      {/* Pin head dome */}
      <circle
        cx="14"
        cy="11"
        r="7"
        fill={c.head}
        stroke={c.outline}
        strokeWidth="1.2"
      />

      {/* Cute shine glint */}
      <circle cx="11.5" cy="8.5" r="2.2" fill="#ffffff" fillOpacity="0.8" />
      <circle cx="15.5" cy="13" r="1" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  );
}

type WashiTapePattern = "dots" | "grid" | "stripes" | "plain";

type WashiTapeProps = {
  color?: string;
  pattern?: WashiTapePattern;
  width?: number | string;
  height?: number;
  className?: string;
  style?: CSSProperties;
};

/** Illustrated washi tape banner with cute deckled torn edges. */
export function WashiTapeArt({
  color = "rgba(244, 207, 120, 0.78)",
  pattern = "grid",
  width = 110,
  height = 26,
  className = "",
  style,
}: WashiTapeProps) {
  const patternId = useId();

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-washitape ${className}`}
      style={style}
      aria-hidden="true"
    >
      <defs>
        {pattern === "grid" && (
          <pattern
            id={patternId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 8 0 L 0 0 0 8"
              fill="none"
              stroke="rgba(60, 40, 45, 0.08)"
              strokeWidth="0.8"
            />
          </pattern>
        )}
        {pattern === "dots" && (
          <pattern
            id={patternId}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="4" cy="4" r="1.1" fill="rgba(60, 40, 45, 0.09)" />
          </pattern>
        )}
        {pattern === "stripes" && (
          <pattern
            id={patternId}
            width="10"
            height="10"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="3"
            />
          </pattern>
        )}
      </defs>

      {/* Deckled torn edge tape shape */}
      <path
        d="M 4 2 
           L 116 2 
           L 118 6 L 115 11 L 119 16 L 116 22 L 118 26 
           L 3 26 
           L 1 21 L 4 16 L 1 11 L 3 6 Z"
        fill={color}
      />
      {pattern !== "plain" && (
        <path
          d="M 4 2 
             L 116 2 
             L 118 6 L 115 11 L 119 16 L 116 22 L 118 26 
             L 3 26 
             L 1 21 L 4 16 L 1 11 L 3 6 Z"
          fill={`url(#${patternId})`}
        />
      )}
      {/* Light edge line */}
      <path
        d="M 4 3 L 116 3"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Hand-drawn organic watercolor marker highlight stroke. */
export function HighlighterStrokeArt({
  className = "",
  style,
  color = "#d95c64",
}: {
  className?: string;
  style?: CSSProperties;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 18"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-highlighter ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M 3 11 
           C 42 7, 85 14, 128 10 
           C 166 6, 204 12, 237 8 
           C 220 16, 172 15, 122 17 
           C 78 18, 35 15, 3 11 Z"
        fill={color}
        fillOpacity="0.26"
      />
      <path
        d="M 6 12 
           C 50 9, 95 13, 140 10 
           C 178 7, 214 11, 234 9"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity="0.2"
      />
    </svg>
  );
}

/** 2D illustrated clipboard clamp for order desk card. */
export function ClipboardClampArt({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width="112"
      height="30"
      viewBox="0 0 112 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-clipboard-clamp ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Flat shadow */}
      <rect
        x="12"
        y="8"
        width="88"
        height="20"
        rx="4"
        fill="rgba(60, 40, 45, 0.12)"
      />

      {/* Main clamp bar */}
      <rect
        x="10"
        y="6"
        width="92"
        height="22"
        rx="5"
        fill="#eae0d5"
        stroke="#8d735b"
        strokeWidth="1.5"
      />

      {/* Top loop */}
      <path
        d="M 44 8 C 44 2, 68 2, 68 8"
        stroke="#8d735b"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Center spring bracket */}
      <rect
        x="36"
        y="11"
        width="40"
        height="10"
        rx="3"
        fill="#c9b199"
        stroke="#755e47"
        strokeWidth="1.2"
      />

      {/* Rivets */}
      <circle cx="22" cy="17" r="2.5" fill="#8d735b" />
      <circle cx="22" cy="16.5" r="0.8" fill="#ffffff" />
      <circle cx="90" cy="17" r="2.5" fill="#8d735b" />
      <circle cx="90" cy="16.5" r="0.8" fill="#ffffff" />
    </svg>
  );
}

/** 2D illustrated wooden artist palette with paint dollops and brush. */
export function ArtistPaletteArt({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-palette ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Flat shadow */}
      <ellipse cx="46" cy="48" rx="38" ry="36" fill="rgba(83, 54, 58, 0.1)" />

      {/* Palette wooden base */}
      <path
        d="M 44 8 
           C 68 8, 80 22, 80 44 
           C 80 60, 70 74, 54 78 
           C 40 81, 32 72, 24 72 
           C 16 72, 8 62, 8 44 
           C 8 24, 22 8, 44 8 Z"
        fill="#f7ebd8"
        stroke="#b88a5d"
        strokeWidth="2"
      />

      {/* Thumb hole */}
      <ellipse
        cx="26"
        cy="54"
        rx="6"
        ry="8"
        transform="rotate(20 26 54)"
        fill="#fffaf3"
        stroke="#b88a5d"
        strokeWidth="1.5"
      />

      {/* 2D Flat Paint Dollops with cute shine dots */}
      {/* Coral */}
      <circle cx="44" cy="18" r="5.5" fill="#d95c64" />
      <circle cx="42.5" cy="16.5" r="1.5" fill="#ffffff" fillOpacity="0.8" />

      {/* Sunny Amber */}
      <circle cx="62" cy="26" r="5.5" fill="#f4cf78" />
      <circle cx="60.5" cy="24.5" r="1.5" fill="#ffffff" fillOpacity="0.8" />

      {/* Mint green */}
      <circle cx="70" cy="44" r="5.5" fill="#48a07c" />
      <circle cx="68.5" cy="42.5" r="1.5" fill="#ffffff" fillOpacity="0.8" />

      {/* Indigo Blue */}
      <circle cx="62" cy="62" r="5.2" fill="#3b6998" />
      <circle cx="60.5" cy="60.5" r="1.4" fill="#ffffff" fillOpacity="0.8" />

      {/* Lavender */}
      <circle cx="44" cy="68" r="5" fill="#a78bfa" />
      <circle cx="42.5" cy="66.5" r="1.4" fill="#ffffff" fillOpacity="0.8" />

      {/* 2D Cute Wooden Paintbrush */}
      <g transform="rotate(-36 48 44)">
        {/* Handle */}
        <path d="M 48 -8 L 51 -8 L 50.5 50 L 48.5 50 Z" fill="#6d4323" />
        {/* Silver Ferrule */}
        <rect
          x="48"
          y="50"
          width="3"
          height="10"
          rx="0.5"
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth="0.5"
        />
        {/* Bristles with coral tip */}
        <path
          d="M 48 60 C 48 66, 49.5 70, 49.5 74 C 49.5 70, 51 66, 51 60 Z"
          fill="#d95c64"
        />
      </g>
    </svg>
  );
}

/** 2D illustrated Japanese Gacha capsule toy / event prize ball SVG. */
export function GachaCapsuleArt({
  size = 32,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-capsule ${className}`}
      style={style}
      aria-hidden="true"
    >
      {/* Flat shadow */}
      <ellipse cx="16" cy="29" rx="10" ry="3" fill="rgba(83, 54, 58, 0.12)" />

      {/* Bottom half: colorful coral base */}
      <path
        d="M 5 16 C 5 22.0751 9.92487 27 16 27 C 22.0751 27 27 22.0751 27 16 Z"
        fill="#d95c64"
        stroke="#9f2b34"
        strokeWidth="1.5"
      />

      {/* Top half: clear pastel tinted dome */}
      <path
        d="M 5 16 C 5 9.92487 9.92487 5 16 5 C 22.0751 5 27 9.92487 27 16 Z"
        fill="#fff8f3"
        stroke="#9f2b34"
        strokeWidth="1.5"
      />

      {/* Center seam ring */}
      <rect
        x="4"
        y="14.5"
        width="24"
        height="3"
        rx="1.5"
        fill="#fef08a"
        stroke="#a87819"
        strokeWidth="1"
      />

      {/* Lucky Star prize inside */}
      <path
        d="M 16 8.5 L 17.2 11.8 L 20.5 12 L 18 14.2 L 18.8 17.5 L 16 15.8 L 13.2 17.5 L 14 14.2 L 11.5 12 L 14.8 11.8 Z"
        fill="#f4cf78"
        stroke="#ca8a04"
        strokeWidth="0.8"
      />

      {/* Dome shine glint */}
      <path
        d="M 8 13 C 8 9.5 10.5 7 14 7"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 2D illustrated event raffle ticket / prize coupon badge. */
export function GachaTicketBadgeArt({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width="38"
      height="26"
      viewBox="0 0 38 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-ticket-badge ${className}`}
      style={style}
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="36"
        height="24"
        rx="3"
        fill="#ffebd9"
        stroke="#d95c64"
        strokeWidth="1.4"
        strokeDasharray="3 2"
      />
      {/* Mini Star */}
      <path
        d="M 19 6 L 20.3 9.8 L 24 10 L 21.2 12.5 L 22.1 16.2 L 19 14.3 L 15.9 16.2 L 16.8 12.5 L 14 10 L 17.7 9.8 Z"
        fill="#d95c64"
      />
    </svg>
  );
}

/** Hand-drawn decorative doodle sparkle (✦). */
export function DoodleSparkleArt({
  size = 20,
  color = "var(--landing-coral)",
  className = "",
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-sparkle ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M 12 2 
           C 12 7.5, 16.5 12, 22 12 
           C 16.5 12, 12 16.5, 12 22 
           C 12 16.5, 7.5 12, 2 12 
           C 7.5 12, 12 7.5, 12 2 Z"
        fill={color}
      />
    </svg>
  );
}

/** Hand-drawn decorative doodle star (★). */
export function DoodleStarArt({
  size = 18,
  color = "#f4cf78",
  className = "",
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`landing-art-star ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M 12 2.5 
           L 14.8 8.8 
           L 21.7 9.5 
           L 16.5 14.2 
           L 18 21 
           L 12 17.5 
           L 6 21 
           L 7.5 14.2 
           L 2.3 9.5 
           L 9.2 8.8 Z"
        fill={color}
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mini stationery craft badge icons for the Benefits section. */
export function BenefitBadgeArt({
  kind,
}: {
  kind: "scan" | "stock" | "orders" | "style";
}) {
  switch (kind) {
    case "scan":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="benefit-badge-art"
        >
          <rect
            x="5"
            y="2"
            width="14"
            height="20"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="8" y="6" width="3" height="3" rx="0.5" fill="currentColor" />
          <rect
            x="13"
            y="6"
            width="3"
            height="3"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="8"
            y="11"
            width="3"
            height="3"
            rx="0.5"
            fill="currentColor"
          />
          <rect x="13" y="11.5" width="2" height="2" rx="0.5" fill="currentColor" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case "stock":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="benefit-badge-art"
        >
          <path
            d="M3 8L12 3L21 8V18L12 22L3 18V8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 3V22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 8L12 13L21 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="13"
            r="2"
            fill="var(--landing-coral, #d95c64)"
          />
        </svg>
      );
    case "orders":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="benefit-badge-art"
        >
          <rect
            x="4"
            y="4"
            width="16"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 2H16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 9L10.5 11.5L15 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="8"
            y1="14.5"
            x2="16"
            y2="14.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="18"
            x2="13"
            y2="18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "style":
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="benefit-badge-art"
        >
          <path
            d="M12 3C6.477 3 2 7.03 2 12C2 16.97 6.477 21 12 21C13.5 21 14.5 19.8 14.5 18.5C14.5 17.8 14.2 17.2 13.8 16.7C13.4 16.2 13.2 15.6 13.2 15C13.2 13.6 14.3 12.5 15.7 12.5H18C20.2 12.5 22 10.7 22 8.5C22 5.5 17.5 3 12 3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7.5" cy="9.5" r="1.5" fill="currentColor" />
          <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
        </svg>
      );
  }
}
