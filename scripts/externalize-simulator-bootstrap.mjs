import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BOOTSTRAP_FILE = "internal/matsuri-bootstrap.js";

/**
 * SvelteKit's static adapter emits a small inline module bootstrap. Keep the
 * application bootstrap same-origin so the shared CSP does not need a build-
 * specific hash that would drift on every simulator rebuild.
 */
export function externalizeSimulatorBootstrap(outputDir, basePath) {
  const indexPath = join(outputDir, "index.html");
  const html = readFileSync(indexPath, "utf8");
  const publicBootstrapPath = `${basePath}/${BOOTSTRAP_FILE}`;
  const bootstrapPath = join(outputDir, BOOTSTRAP_FILE);
  if (html.includes(`src="${publicBootstrapPath}"`)) {
    readFileSync(bootstrapPath, "utf8");
    return { bootstrapPath, publicBootstrapPath };
  }

  const bootstrapPattern =
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?__sveltekit_[\s\S]*?kit\.start\([\s\S]*?)<\/script>/i;
  const match = html.match(bootstrapPattern);
  if (!match) {
    throw new Error(`Could not find the SvelteKit bootstrap in ${indexPath}`);
  }

  mkdirSync(join(outputDir, "internal"), { recursive: true });
  writeFileSync(bootstrapPath, `${match[1].trim()}\n`);

  const replacement = `<script src="${publicBootstrapPath}"></script>`;
  const rewritten = html.replace(match[0], replacement);
  writeFileSync(indexPath, rewritten);
  return { bootstrapPath, publicBootstrapPath };
}
