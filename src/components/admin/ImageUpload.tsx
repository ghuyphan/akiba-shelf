import { ImageUp } from "lucide-react";
import { uploadImage } from "../../lib/api";

type ImageUploadProps = {
  bucket: string;
  label: string;
  onUploaded: (url: string) => void;
};

export function ImageUpload({ bucket, label, onUploaded }: ImageUploadProps) {
  async function handleChange(file?: File) {
    if (!file) return;
    const url = await uploadImage(bucket, file);
    onUploaded(url);
  }

  return (
    <label className="upload-button">
      <input type="file" accept="image/*" onChange={(event) => void handleChange(event.target.files?.[0])} />
      <span className="upload-button-face">
        <ImageUp size={18} />
        {label}
      </span>
    </label>
  );
}
