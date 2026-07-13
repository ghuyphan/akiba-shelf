/**
 * Re-encode existing, app-managed product images in Supabase Storage as WebP.
 *
 * Dry run (default):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     deno run --allow-env --allow-net --allow-read scripts/backfill-product-images-webp.ts
 *
 * Apply:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     deno run --allow-env --allow-net --allow-read scripts/backfill-product-images-webp.ts --apply
 *
 * Keep the service-role key in the terminal environment only. Never expose it
 * through a VITE_* variable or commit it to the repository.
 */
import { createClient } from "npm:@supabase/supabase-js@2.110.0";
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.41";

type ImageVariant = { thumbnail: string; detail: string };
type ProductRow = {
  id: string;
  shop_id: string;
  name: string;
  image_paths: string[];
  updated_at: string;
};

const apply = Deno.args.includes("--apply");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isWebpPath(path: string) {
  return /\.webp$/i.test(path);
}

function toWebpPath(path: string) {
  return /\.[^./]+$/.test(path)
    ? path.replace(/\.[^./]+$/, ".webp")
    : `${path}.webp`;
}

async function initializeEncoder() {
  const moduleUrl = import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.41");
  const wasmBytes = await Deno.readFile(new URL("magick.wasm", moduleUrl));
  await initializeImageMagick(wasmBytes);
}

function encodeWebp(source: Uint8Array, quality: number) {
  let output: Uint8Array | undefined;
  ImageMagick.read(source, (image) => {
    image.quality = quality;
    image.write(MagickFormat.WebP, (bytes) => {
      // Copy the WASM-owned view before the ImageMagick callback returns.
      output = Uint8Array.from(bytes);
    });
  });
  if (!output?.byteLength)
    throw new Error("ImageMagick returned an empty WebP image.");
  return output;
}

async function convertPath(path: string, quality: number) {
  if (isWebpPath(path)) return path;

  const { data, error: downloadError } = await supabase.storage
    .from("product-images")
    .download(path);
  if (downloadError) throw downloadError;

  const destination = toWebpPath(path);
  const webp = encodeWebp(new Uint8Array(await data.arrayBuffer()), quality);
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(destination, webp, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  return destination;
}

const { data, error } = await supabase
  .from("products")
  .select("id,shop_id,name,image_paths,updated_at")
  .order("shop_id")
  .order("sort_order");
if (error) throw error;

const candidates = ((data ?? []) as ProductRow[]).filter(
  (product) =>
    Array.isArray(product.image_paths) &&
    product.image_paths.length > 0 &&
    product.image_paths.some((path) => !isWebpPath(path)),
);

console.log(
  `${apply ? "APPLY" : "DRY RUN"}: ${candidates.length} product(s) need WebP conversion.`,
);
for (const product of candidates) {
  if (product.image_paths.length % 2 !== 0) {
    console.warn(
      `SKIP ${product.id} (${product.name}): image_paths is not a thumbnail/detail pair list.`,
    );
    continue;
  }
  console.log(
    `${apply ? "CONVERT" : "WOULD CONVERT"} ${product.id} (${product.name})`,
  );
  for (const path of product.image_paths) {
    if (!isWebpPath(path)) console.log(`  ${path} -> ${toWebpPath(path)}`);
  }
}

if (!apply || candidates.length === 0) {
  if (!apply && candidates.length > 0)
    console.log("Run again with --apply after reviewing this list.");
  Deno.exit(0);
}

await initializeEncoder();
let convertedProducts = 0;
let failedProducts = 0;

for (const product of candidates) {
  if (product.image_paths.length % 2 !== 0) continue;

  try {
    const newPaths: string[] = [];
    for (let index = 0; index < product.image_paths.length; index += 1) {
      const quality = index % 2 === 0 ? 78 : 84;
      newPaths.push(await convertPath(product.image_paths[index], quality));
    }

    const variants: ImageVariant[] = [];
    for (let index = 0; index < newPaths.length; index += 2) {
      const thumbnail = supabase.storage
        .from("product-images")
        .getPublicUrl(newPaths[index]).data.publicUrl;
      const detail = supabase.storage
        .from("product-images")
        .getPublicUrl(newPaths[index + 1]).data.publicUrl;
      variants.push({ thumbnail, detail });
    }

    // The timestamp guard avoids overwriting an admin edit made after this run began.
    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({
        image_paths: newPaths,
        image_variants: variants,
        images: variants.map((variant) => variant.detail),
      })
      .eq("id", product.id)
      .eq("shop_id", product.shop_id)
      .eq("updated_at", product.updated_at)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated)
      throw new Error(
        "The product changed during conversion; its database row was not overwritten.",
      );

    convertedProducts += 1;
    console.log(`UPDATED ${product.id}`);
  } catch (caught) {
    failedProducts += 1;
    console.error(
      `FAILED ${product.id}:`,
      caught instanceof Error ? caught.message : caught,
    );
  }
}

console.log(
  `Converted ${convertedProducts} of ${candidates.length} candidate product(s).`,
);
console.log(
  "Original JPEG/PNG objects were retained as rollback copies. Use the audit SQL to identify unreferenced originals.",
);
if (failedProducts > 0) Deno.exit(1);
