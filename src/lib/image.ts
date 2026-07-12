const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;

export async function validateImageFile(file: File): Promise<{ width: number; height: number }> {
  if (!supportedImageTypes.has(file.type)) throw new Error("Use a JPEG, PNG, or WebP image.");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("Images must be between 1 byte and 10 MB.");
  const source = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) return reject(new Error("The image has invalid dimensions."));
        if (image.naturalWidth > MAX_IMAGE_DIMENSION || image.naturalHeight > MAX_IMAGE_DIMENSION) return reject(new Error("Image dimensions cannot exceed 8000 × 8000."));
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.src = source;
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function compressImage(file: File, maxDimension = 1200, quality = 0.8): Promise<File> {
  await validateImageFile(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("This browser cannot process the image."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("The image could not be encoded."));
              return;
            }
            const originalName = file.name;
            const lastDotIndex = originalName.lastIndexOf(".");
            const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
            const compressedFile = new File([blob], `${baseName}.jpg`, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("The image could not be decoded."));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

export async function createProductImageVariants(file: File) {
  const [thumbnail, detail] = await Promise.all([
    compressImage(file, 600, 0.78),
    compressImage(file, 1400, 0.84),
  ]);
  return { thumbnail, detail };
}
