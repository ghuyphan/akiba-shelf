import { useEffect, useState } from "react";
import { BadgeInfo } from "lucide-react";
import type { Product } from "../../types/catalog";
import { getItemQrPayload, getStockLabel } from "../../lib/product";
import { Modal } from "../ui/Modal";
import { ProductPrice } from "./ProductPrice";

type ItemCodeModalProps = {
  isOpen: boolean;
  product?: Product;
  onClose: () => void;
};

export function ItemCodeModal({ isOpen, product, onClose }: ItemCodeModalProps) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!isOpen || !product) return;

    import("qrcode").then(({ default: QRCode }) => {
      QRCode.toDataURL(getItemQrPayload(product), {
        margin: 1,
        width: 420,
        color: { dark: "#061b34", light: "#ffffff" },
      }).then(setQrUrl);
    });
  }, [isOpen, product]);

  if (!product) return null;
  const primaryImage = product.images.find(Boolean);

  return (
    <Modal title="Item QR" isOpen={isOpen} onClose={onClose} mobileSheet>
      <div className="code-modal-layout">
        <div className="item-qr-card">
          {qrUrl ? <img src={qrUrl} alt={`QR for ${product.item_code}`} /> : <div className="qr-loading" />}
        </div>
        <div className="code-modal-title">
          <div className="code-modal-icon">
            <BadgeInfo size={28} />
          </div>
          <div>
            <p className="code-modal-kicker">Staff scans this to identify item</p>
            <strong className="code-modal-code">{product.item_code}</strong>
          </div>
        </div>
        <div className="code-modal-item">
          {primaryImage ? <img src={primaryImage} alt="" /> : <div className="code-modal-image-placeholder" />}
          <span>
            <strong>{product.name}</strong>
            <ProductPrice product={product} />
            <small>{getStockLabel(product)}</small>
          </span>
        </div>
      </div>
    </Modal>
  );
}
