import { storefrontBootstrapSchema } from "../schemas";
import type { StorefrontBootstrap } from "../../types/catalog";
import {
  releaseStorefrontBootstrapRequest,
  requestStorefrontBootstrap,
} from "./storefrontBootstrapRequest";
import { normalizeStorefrontBootstrap } from "./storefrontBootstrapNormalization";

/** Fast anonymous storefront bootstrap that avoids loading the full SDK. */
export async function getStorefrontBootstrapFast(
  shopSlug: string,
): Promise<StorefrontBootstrap> {
  const request = requestStorefrontBootstrap(shopSlug);
  let parsed;
  try {
    parsed = storefrontBootstrapSchema.parse(await request);
  } finally {
    releaseStorefrontBootstrapRequest(shopSlug, request);
  }
  return normalizeStorefrontBootstrap(parsed);
}
