import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { platformVietnameseTranslations } from "./platformI18n";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Locale-neutral email placeholders intentionally stay in English.
const allowedUntranslated = new Set(["staff@example.com", "you@example.com"]);

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.test\.(ts|tsx)$/.test(entry.name)) return [];
    if (entry.name === "platformI18n.tsx" || entry.name === "catalogI18n.tsx")
      return [];
    return [fullPath];
  });
}

function collectTranslationKeys() {
  const keyPattern = /\bt\(\s*"((?:[^"\\])*)"/gs;
  const keys = new Set<string>();
  for (const file of collectSourceFiles(srcRoot)) {
    for (const match of readFileSync(file, "utf8").matchAll(keyPattern)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

describe("platform translation parity", () => {
  it("keeps a Vietnamese entry for every platform t() key", () => {
    const missing = [...collectTranslationKeys()].filter(
      (key) =>
        !allowedUntranslated.has(key) &&
        platformVietnameseTranslations[key] === undefined,
    );
    expect(missing).toEqual([]);
  });
});
