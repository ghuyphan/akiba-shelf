import type { SocialPlatform } from "../../lib/social";

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
    fill: "currentColor",
    "aria-hidden": true,
  } as const;

  if (platform === "Instagram")
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (platform === "Facebook")
    return <svg {...common}><path d="M13.5 22v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V14h2.8v8h3.4Z" /></svg>;
  if (platform === "TikTok")
    return <svg {...common}><path d="M15.6 3c.3 2.2 1.6 3.6 3.8 3.8v3.1a8.5 8.5 0 0 1-3.8-1v6.2A6.1 6.1 0 1 1 10.3 9v3.2a3 3 0 1 0 2.1 2.9V3h3.2Z" /></svg>;
  if (platform === "X")
    return <svg {...common}><path d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.2 2.3h6.9l4.7 6.2 5.4-6.2Zm-1.1 17.5h1.8L7.1 4.1H5.2l11.9 15.7Z" /></svg>;
  if (platform === "Threads")
    return <svg {...common}><path d="M12.2 2C6.5 2 3 6.2 3 12.1c0 6 3.7 9.9 9.4 9.9 5 0 8.6-2.8 8.6-7.1 0-3.6-2.4-5.6-6.4-5.9-.4-1.8-1.5-3-3.3-3.4-2.4-.5-4.5.5-5.5 2.4l2.1 1.1c.6-1.1 1.7-1.6 2.9-1.3.8.2 1.3.6 1.6 1.3-4.1.3-6.4 2-6.4 4.7 0 2.4 1.9 4.1 4.6 4.1 2.8 0 4.7-1.6 4.7-4.2 0-.8-.1-1.6-.2-2.4 2.3.3 3.5 1.5 3.5 3.5 0 2.9-2.5 4.8-6.2 4.8-4.3 0-7-2.9-7-7.6 0-4.6 2.6-7.7 6.8-7.7 3.5 0 5.9 1.8 6.8 5.1l2.3-.6C20.1 4.6 16.8 2 12.2 2Zm.8 9.4c.1.7.2 1.4.2 2.1 0 1.4-.9 2.2-2.5 2.2-1.3 0-2.2-.7-2.2-1.8 0-1.4 1.5-2.3 4.5-2.5Z" /></svg>;
  return <svg {...common}><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" /></svg>;
}
