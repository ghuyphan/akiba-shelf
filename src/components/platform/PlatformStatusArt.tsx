import { WifiOff } from "lucide-react";

type PlatformStatusArtProps = {
  variant: "missing" | "offline";
};

/** A small booth-shaped visual keeps error states tied to the Matsuri product. */
export function PlatformStatusArt({ variant }: PlatformStatusArtProps) {
  const isMissing = variant === "missing";

  return (
    <div
      className={`platform-status-art platform-status-art-${variant}`}
      aria-hidden="true"
    >
      <span className="platform-status-art-orbit platform-status-art-orbit-one" />
      <span className="platform-status-art-orbit platform-status-art-orbit-two" />
      <div className="platform-status-art-notice">
        <span className="platform-status-art-tape" />
        <strong>
          {isMissing ? "404" : <WifiOff size={30} strokeWidth={2.3} />}
        </strong>
        <small>{isMissing ? "///" : "•••"}</small>
      </div>
      <div className="platform-status-art-booth">
        <div className="platform-status-art-awning">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="platform-status-art-counter">
          <span className="platform-status-art-counter-line" />
          <div className="platform-status-art-shelf platform-status-art-shelf-top">
            <i />
            <i />
          </div>
          <div className="platform-status-art-empty-card">
            <span>{isMissing ? "—" : "…"}</span>
          </div>
          <div className="platform-status-art-shelf platform-status-art-shelf-bottom">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
      <span className="platform-status-art-spark platform-status-art-spark-one">✦</span>
      <span className="platform-status-art-spark platform-status-art-spark-two">+</span>
    </div>
  );
}
