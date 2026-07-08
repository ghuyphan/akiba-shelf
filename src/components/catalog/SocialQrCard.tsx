import { ReactNode, useEffect, useState } from "react";
import QRCode from "qrcode";

type SocialQrCardProps = {
  label: string;
  url: string;
  logoUrl?: string;
  icon: ReactNode;
  brandColor?: string;
  brandGradient?: string;
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

export function SocialQrCard({ label, url, logoUrl, icon, brandColor, brandGradient }: SocialQrCardProps) {
  const [qrSrc, setQrSrc] = useState("");
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
    <article
      className={`social-qr-card${accentGradient ? " social-qr-branded" : ""}`}
      style={cardStyle}
    >
      <div className="social-qr-header" style={brandColor ? { color: brandColor } : undefined}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="social-qr-code">
        {qrSrc ? <img src={qrSrc} alt={`${label} QR code`} /> : <div className="qr-loading" />}
      </div>
    </article>
  );
}

