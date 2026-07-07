import { ImageUp, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { uploadImage } from "../../lib/api";
import { Alert } from "../ui/Alert";

type ImageUploadProps = {
  bucket: string;
  label: string;
  onUploaded: (url: string) => void;
};

export function ImageUpload({ bucket, label, onUploaded }: ImageUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");

    try {
      const url = await uploadImage(bucket, file);
      onUploaded(url);
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
