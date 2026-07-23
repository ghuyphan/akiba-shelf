import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const sourcePattern = /\.(?:ts|tsx)$/;
const importPattern = /(?:from\s+|import\s*\(|vi\.mock\()\s*["']([^"']+)["']/g;
const supabaseImportAllowlist = new Set([
  "src/components/admin/LoginPanel.tsx",
  "src/components/ui/GoogleAuthButton.tsx",
  "src/hooks/useAdminSession.ts",
  "src/lib/offline/pwa.ts",
  "src/lib/realtime.ts",
]);
const compatibilityBarrelAllowlist = new Set(["src/pages/NewShopPage.tsx"]);

function portable(path) {
  return path.split(sep).join("/");
}

function isTestFile(path) {
  return /(?:^|\/)(?:__tests__|test)(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(
    path,
  );
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (sourcePattern.test(entry.name)) files.push(path);
  }
  return files;
}

export async function architectureViolations(root = process.cwd()) {
  const srcRoot = resolve(root, "src");
  const violations = [];
  for (const file of await sourceFiles(srcRoot)) {
    const path = portable(relative(root, file));
    if (isTestFile(path)) continue;
    const source = await readFile(file, "utf8");
    const imports = [...source.matchAll(importPattern)].map(
      (match) => match[1],
    );

    if (
      !path.startsWith("src/pages/") &&
      !["src/App.tsx", "src/main.tsx"].includes(path)
    ) {
      const pageImport = imports.find((value) =>
        /(?:^|\/)pages(?:\/|$)/.test(value),
      );
      if (pageImport)
        violations.push(
          `${path}: route pages may only be imported by app entry points`,
        );
    }

    if (!path.startsWith("src/lib/api/") && path !== "src/lib/supabase.ts") {
      if (imports.includes("@supabase/supabase-js")) {
        violations.push(
          `${path}: Supabase SDK imports belong in src/lib/api or src/lib/supabase.ts`,
        );
      }
      const directSupabase = imports.find((value) =>
        /(?:^|\/)lib\/supabase$|^\.\.?\/supabase$/.test(value),
      );
      if (directSupabase && !supabaseImportAllowlist.has(path)) {
        violations.push(
          `${path}: direct Supabase access is outside the explicit boundary`,
        );
      }
    }

    if (
      path !== "src/lib/api.ts" &&
      !compatibilityBarrelAllowlist.has(path) &&
      imports.some((value) => /(?:^|\/)lib\/api$/.test(value))
    ) {
      violations.push(
        `${path}: import a focused src/lib/api domain instead of the compatibility barrel`,
      );
    }
  }
  return violations;
}

export async function checkArchitecture(root = process.cwd()) {
  const violations = await architectureViolations(root);
  if (violations.length) throw new Error(violations.join("\n"));
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  await checkArchitecture();
  console.log("Frontend architecture boundaries passed.");
}
