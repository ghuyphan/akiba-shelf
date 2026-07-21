import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useCatalogCopy } from "../../lib/i18n/catalogI18n";
import { SOCIAL_QR_COLORS } from "../../utils/social";
import { Modal } from "../ui/Modal";

type SocialQrCardProps = {
  label: string;
  url: string;
  logoUrl?: string;
  icon: ReactNode;
  brandColor?: string;
  brandGradient?: string;
  showLabel?: boolean;
  deferOnPhone?: boolean;
};

const DEFAULT_QR_COLORS: [string, string, string] = ["#486a55", "#5f8d55", "#17233c"];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundedSquare(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, size, size, radius);
  context.fill();
}

async function generateSocialQr(
  url: string,
  colors: [string, string, string],
  logoUrl?: string,
) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const canvas = document.createElement("canvas");
  const size = 560;
  const margin = 4;
  const moduleCount = qr.modules.size;
  const cell = size / (moduleCount + margin * 2);
  const logoSize = 112;
  const logoInset = (size - logoSize) / 2;
  const context = canvas.getContext("2d");

  if (!context) return "";

  canvas.width = size;
  canvas.height = size;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);

  const gradient = context.createLinearGradient(0, size, size, 0);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.52, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;

  const isFinder = (row: number, col: number) =>
    (row < 7 && col < 7) ||
    (row < 7 && col >= moduleCount - 7) ||
    (row >= moduleCount - 7 && col < 7);

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.modules.get(row, col) || isFinder(row, col)) continue;
      const centerX = (col + margin + 0.5) * cell;
      const centerY = (row + margin + 0.5) * cell;
      context.beginPath();
      context.arc(centerX, centerY, cell * 0.36, 0, Math.PI * 2);
      context.fill();
    }
  }

  const drawFinder = (col: number, row: number) => {
    const x = (col + margin) * cell;
    const y = (row + margin) * cell;
    context.fillStyle = gradient;
    roundedSquare(context, x, y, cell * 7, cell * 1.8);
    context.fillStyle = "#ffffff";
    roundedSquare(context, x + cell, y + cell, cell * 5, cell * 1.25);
    context.fillStyle = gradient;
    roundedSquare(context, x + cell * 2, y + cell * 2, cell * 3, cell * 0.9);
  };

  drawFinder(0, 0);
  drawFinder(moduleCount - 7, 0);
  drawFinder(0, moduleCount - 7);

  if (!logoUrl) return canvas.toDataURL("image/png");

  const logoImage = await loadImage(logoUrl);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(logoInset - 14, logoInset - 14, logoSize + 28, logoSize + 28, 34);
  context.fill();
  context.save();
  context.beginPath();
  context.roundRect(logoInset, logoInset, logoSize, logoSize, 28);
  context.clip();
  context.drawImage(logoImage, logoInset, logoInset, logoSize, logoSize);
  context.restore();

  return canvas.toDataURL("image/png");
}

function profileName(url: string, fallback: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").filter(Boolean)[0];
    return name ? `@${decodeURIComponent(name).replace(/^@/, "")}` : fallback;
  } catch {
    return fallback;
  }
}

export function SocialQrCard({ label, url, logoUrl, icon, brandColor, brandGradient, showLabel = true, deferOnPhone = false }: SocialQrCardProps) {
  const copy = useCatalogCopy();
  const [qrSrc, setQrSrc] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const generationRef = useRef<Promise<void> | null>(null);
  const generationTokenRef = useRef(0);
  const platform = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const handle = profileName(url, label);
  const qrColors = SOCIAL_QR_COLORS[label] ?? DEFAULT_QR_COLORS;

  const ensureQr = useCallback(() => {
    if (qrSrc || generationRef.current) return generationRef.current;
    const token = ++generationTokenRef.current;
    const generation = generateSocialQr(url, qrColors, logoUrl)
      .then((src) => {
        if (generationTokenRef.current === token) setQrSrc(src);
      })
      .catch(() => {
        if (generationTokenRef.current === token) setQrSrc("");
      })
      .finally(() => {
        if (generationTokenRef.current === token) generationRef.current = null;
      });
    generationRef.current = generation;
    return generation;
  }, [logoUrl, qrColors, qrSrc, url]);

  useEffect(() => {
    generationTokenRef.current += 1;
    generationRef.current = null;
    setQrSrc("");
    return () => {
      generationTokenRef.current += 1;
      generationRef.current = null;
    };
  }, [logoUrl, qrColors, url]);

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 760px)");
    if (!phone.matches || !deferOnPhone) void ensureQr();
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (!event.matches) void ensureQr();
    };
    phone.addEventListener("change", handleBreakpoint);
    return () => phone.removeEventListener("change", handleBreakpoint);
  }, [deferOnPhone, ensureQr]);

  const openQr = () => {
    void ensureQr();
    setIsModalOpen(true);
  };

  const accentGradient = brandGradient ?? brandColor ?? undefined;
  const cardStyle = accentGradient
    ? {
        "--social-accent": accentGradient,
        "--social-accent-color": brandColor ?? "#53657d",
      } as React.CSSProperties
    : undefined;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        className={`social-qr-card social-qr-${platform}${accentGradient ? " social-qr-branded" : ""}`}
        style={{ ...cardStyle, cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          openQr();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openQr();
          }
        }}
      >
        <div className="social-qr-header" style={brandColor ? { color: brandColor } : undefined}>
          {icon}
          {showLabel && <span>{label}</span>}
        </div>
        <div className="social-qr-code">
          {qrSrc ? <img src={qrSrc} alt={copy.socialQrAlt(label)} /> : <div className="qr-loading" />}
        </div>
      </article>

      <Modal
        title={copy.socialQrTitle(label)}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="social-qr-zoom-modal"
        mobileSheet
        closeLabel={copy.closeModal}
      >
        <div className="social-qr-zoom-content" onClick={(e) => e.stopPropagation()}>
          <div className="social-qr-zoom-icon" style={brandColor ? { color: brandColor } : undefined}>
            {icon}
            <span>{label}</span>
          </div>
          <div className="social-qr-zoom-image">
            {qrSrc ? (
              <img src={qrSrc} alt={copy.socialQrAlt(label)} />
            ) : (
              <div className="qr-loading" />
            )}
          </div>
          <strong
            className="social-qr-zoom-handle"
            style={brandColor ? { color: brandColor } : undefined}
          >
            {handle}
          </strong>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="social-qr-zoom-link"
            style={brandColor ? { color: brandColor, borderColor: brandColor } : undefined}
          >
            {copy.openSocialProfile}
          </a>
        </div>
      </Modal>
    </>
  );
}
