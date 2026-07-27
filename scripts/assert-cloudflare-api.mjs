import { readFile } from "node:fs/promises";
import { parseCloudflareApiResponse } from "./cloudflare-pages-api.mjs";

const [, , path, operation = "Cloudflare API request"] = process.argv;
const payload = JSON.parse(await readFile(path, "utf8"));
parseCloudflareApiResponse(payload, operation);
