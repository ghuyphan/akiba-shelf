import { ReactNode, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "../ui/Modal";

type SocialQrCardProps = {
  label: string;
  url: string;
  logoUrl?: string;
  icon: ReactNode;
  brandColor?: string;
  brandGradient?: string;
  showLabel?: boolean;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function generateSocialQr(url: string, dotColor: string, logoUrl?: string) {
  const qrUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 520,
    color: { dark: dotColor, light: "#ffffff" },
  });

  if (!logoUrl) return qrUrl;

  const [qrImage, logoImage] = await Promise.all([loadImage(qrUrl), loadImage(logoUrl)]);
  const canvas = document.createElement("canvas");
  const size = 520;
  const logoSize = 112;
  const logoInset = (size - logoSize) / 2;
  const context = canvas.getContext("2d");

  if (!context) return qrUrl;

  canvas.width = size;
  canvas.height = size;
  context.drawImage(qrImage, 0, 0, size, size);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(logoInset - 14, logoInset - 14, logoSize + 28, logoSize + 28, 24);
  context.fill();
  context.drawImage(logoImage, logoInset, logoInset, logoSize, logoSize);

  return canvas.toDataURL("image/png");
}

export function SocialQrCard({ label, url, logoUrl, icon, brandColor, brandGradient, showLabel = true }: SocialQrCardProps) {
  const [qrSrc, setQrSrc] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dotColor = "#0f172a";

  useEffect(() => {
    let cancelled = false;

    generateSocialQr(url, dotColor, logoUrl)
      .then((src) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch(() => {
        if (!cancelled) setQrSrc("");
      });

    return () => {
      cancelled = true;
    };
  }, [logoUrl, url, dotColor]);

  const accentGradient = brandGradient ?? brandColor ?? undefined;
  const cardStyle = accentGradient
    ? { "--social-accent": accentGradient } as React.CSSProperties
    : undefined;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        className={`social-qr-card${accentGradient ? " social-qr-branded" : ""}`}
        style={{ ...cardStyle, cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          setIsModalOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsModalOpen(true);
          }
        }}
      >
        <div className="social-qr-header" style={brandColor ? { color: brandColor } : undefined}>
          {icon}
          {showLabel && <span>{label}</span>}
        </div>
        <div className="social-qr-code">
          {qrSrc ? <img src={qrSrc} alt={`${label} QR code`} /> : <div className="qr-loading" />}
        </div>
      </article>

      <Modal
        title={`${label} Link`}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="social-qr-zoom-modal"
        mobileSheet
      >
        <div className="social-qr-zoom-content" onClick={(e) => e.stopPropagation()}>
          <div className="social-qr-zoom-icon" style={brandColor ? { color: brandColor } : undefined}>
            {icon}
            <span>{label}</span>
          </div>
          <div className="social-qr-zoom-image">
            {qrSrc ? (
              <img src={qrSrc} alt={`${label} enlarged QR code`} />
            ) : (
              <div className="qr-loading" />
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-qr-zoom-link"
            style={brandColor ? { color: brandColor, borderColor: brandColor } : undefined}
          >
            Open Profile Link
          </a>
        </div>
      </Modal>
    </>
  );
}
