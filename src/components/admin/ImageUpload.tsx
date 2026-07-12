import { ImageUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { uploadImage, uploadProductImages } from "../../lib/api";
import { compressImage, createProductImageVariants } from "../../lib/image";
import { Alert } from "../ui/Alert";

type ImageUploadProps = {
  shopId: string;
  bucket: string;
  label: string;
  onUploaded: (url: string, path?: string) => void;
  onProductUploaded?: (variant: { thumbnail: string; detail: string; paths: string[] }) => void;
};

export function ImageUpload({ shopId, bucket, label, onUploaded, onProductUploaded }: ImageUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");

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
      setError(caught instanceof Error ? caught.message : "Could not upload image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <Alert variant="error" title="Upload failed" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
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
          {busy ? "Uploading..." : label}
        </span>
      </label>
    </>
  );
}
