import type { SocialPlatform } from "../../utils/social";

export function SocialBrandIcon({
  platform,
  size = 18,
}: {
  platform: SocialPlatform;
  size?: number;
}) {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  } as const;

  if (platform === "Instagram") {
    return (
      <svg
        {...common}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }

  if (platform === "Facebook") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.52-.14-2.71-.14-2.84 0-4.79 1.73-4.79 4.92v2.58H7v4h3V22h4v-8.5z" />
      </svg>
    );
  }

  if (platform === "TikTok") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M12.525.02c1.31 0 2.491.496 3.393 1.312a7.35 7.35 0 0 0 4.148 1.326v3.42a10.686 10.686 0 0 1-4.148-1.026v8.528a7.564 7.564 0 1 1-7.564-7.564c.57 0 1.116.066 1.638.188V9.33a4.15 4.15 0 1 0 2.533 3.824V.02Z" />
      </svg>
    );
  }

  if (platform === "X") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (platform === "Threads") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M12.186 2c-5.59 0-9.878 3.99-9.878 10.15 0 6.07 4.22 10.15 9.878 10.15 4.88 0 8.35-3.08 8.78-7.5h-2.92c-.38 2.87-2.67 4.79-5.86 4.79-4.09 0-6.84-2.88-6.84-7.44 0-4.57 2.75-7.44 6.84-7.44 3.73 0 6.06 2.37 6.46 5.86h-6.73c-2.4 0-3.9 1.25-3.9 3.12 0 1.77 1.45 2.97 3.55 2.97 2.26 0 3.77-1.32 4.14-3.15.2-1.02.24-2.16.24-3.32C19.78 5.75 16.59 2 12.186 2Zm.26 12.89c-1.09 0-1.74-.58-1.74-1.34 0-.81.69-1.38 1.95-1.38h2.08c-.14 1.74-1.07 2.72-2.29 2.72Z" />
      </svg>
    );
  }

  return (
    <svg {...common} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}
