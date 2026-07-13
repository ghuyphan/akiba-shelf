import { ImageUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { uploadImage, uploadProductImages } from "../../lib/api";
import { compressImage, createProductImageVariants } from "../../lib/image";
import { useToast } from "../ui/ToastProvider";
import { usePlatformI18n } from "../../lib/platformI18n";

type ImageUploadProps = {
  shopId: string;
  bucket: string;
  label: string;
  onUploaded: (url: string, path?: string) => void;
  onProductUploaded?: (variant: { thumbnail: string; detail: string; paths: string[] }) => void;
};

export function ImageUpload({ shopId, bucket, label, onUploaded, onProductUploaded }: ImageUploadProps) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = usePlatformI18n();

  async function handleChange(file?: File) {
    if (!file) return;
    setBusy(true);

    try {
      if (bucket === "product-images" && onProductUploaded) {
        const variants = await createProductImageVariants(file);
        const uploaded = await uploadProductImages(shopId, variants.thumbnail, variants.detail);
        onProductUploaded(uploaded);
      } else {
        const compressedFile = await compressImage(file);
        const uploaded = await uploadImage(shopId, bucket, compressedFile);
        onUploaded(uploaded.url, uploaded.path);
      }
    } catch (caught) {
      toast.error(t(caught instanceof Error ? caught.message : "Could not upload image."), t("Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className={`upload-button ${busy ? "upload-button-loading" : ""}`}>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            void handleChange(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <span className="upload-button-face">
          {busy ? <LoaderCircle className="button-spinner" size={18} /> : <ImageUp size={18} />}
          {busy ? t("Uploading…") : label}
        </span>
      </label>
    </>
  );
}
