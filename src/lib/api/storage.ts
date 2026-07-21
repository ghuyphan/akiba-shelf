import { safeUuid } from "../../utils/id";
import { requireSupabase, textArray } from "./shared";
import type { ApiClient } from "./shared";

export async function removeUnreferencedProductImages(
  client: ApiClient,
  shopId: string,
  paths: string[],
) {
  // Only fetch rows that overlap the candidate paths before deleting storage.
  const { data, error } = await client
    .rpc("get_admin_products", { p_shop_id: shopId })
    .select("image_paths")
    .overlaps("image_paths", paths);
  if (error) throw error;
  const referenced = new Set(
    ((data ?? []) as { image_paths?: unknown }[]).flatMap((row) =>
      textArray(row.image_paths),
    ),
  );
  const removable = paths.filter((path) => !referenced.has(path));
  if (removable.length) {
    const { error: removeError } = await client.storage
      .from("product-images")
      .remove(removable);
    if (removeError) throw removeError;
  }
}

export async function uploadImage(
  shopId: string,
  bucket: string,
  file: File,
): Promise<{ url: string; path: string }> {
  const client = requireSupabase();
  const extension = file.name.split(".").pop() ?? "png";
  const path = `${shopId}/${safeUuid()}.${extension}`;
  const { error } = await client.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function uploadProductImages(
  shopId: string,
  thumbnail: File,
  detail: File,
) {
  if (thumbnail.type !== "image/webp" || detail.type !== "image/webp") {
    throw new Error("Product image variants must be WebP files.");
  }
  const client = requireSupabase();
  const id = safeUuid();
  const uploadedPaths: string[] = [];
  async function upload(suffix: string, file: File) {
    const path = `${shopId}/${id}-${suffix}.webp`;
    const { error } = await client.storage
      .from("product-images")
      .upload(path, file, {
        upsert: false,
        contentType: "image/webp",
        cacheControl: "31536000",
      });
    if (error) throw error;
    uploadedPaths.push(path);
    return client.storage.from("product-images").getPublicUrl(path).data
      .publicUrl;
  }
  try {
    const thumbnailUrl = await upload("thumb", thumbnail);
    const detailUrl = await upload("detail", detail);
    return {
      thumbnail: thumbnailUrl,
      detail: detailUrl,
      paths: [...uploadedPaths],
    };
  } catch (error) {
    if (uploadedPaths.length) {
      await client.storage.from("product-images").remove(uploadedPaths);
    }
    throw error;
  }
}
