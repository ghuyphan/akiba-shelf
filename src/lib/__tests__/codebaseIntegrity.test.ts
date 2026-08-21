import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const srcDir = path.resolve(rootDir, "src");
const stylesDir = path.resolve(srcDir, "styles");

function getAllFiles(dir: string, pattern: RegExp): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "vendor" || entry.name === "dist") {
        continue;
      }
      files.push(...getAllFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Codebase & CSS integrity checks", () => {
  it("resolves all @import paths in stylesheets to real files", () => {
    const cssFiles = getAllFiles(stylesDir, /\.css$/);
    const brokenImports: string[] = [];

    for (const file of cssFiles) {
      const content = fs.readFileSync(file, "utf8");
      const importMatches = content.matchAll(/@import\s+["']([^"']+)["'];/g);
      for (const match of importMatches) {
        const importTarget = match[1];
        const resolvedPath = path.resolve(path.dirname(file), importTarget);
        if (!fs.existsSync(resolvedPath)) {
          brokenImports.push(
            `${path.relative(rootDir, file)}: broken import "${importTarget}"`,
          );
        }
      }
    }

    expect(brokenImports).toEqual([]);
  });

  it("ensures all guide modal CSS classes are referenced in components", () => {
    const guideCssPath = path.resolve(stylesDir, "admin/shell/guide-modal.css");
    const guideCss = fs.readFileSync(guideCssPath, "utf8");

    // Extract all class selectors (e.g., .admin-guide-visual, .guide-qr-mockup)
    const classMatches = guideCss.matchAll(/\.([a-z0-9_-]+)/g);
    const classes = new Set<string>();
    for (const match of classMatches) {
      const name = match[1];
      // Skip state pseudo-class helpers or dynamic utility names
      if (
        name.startsWith("admin-guide") ||
        name.startsWith("guide-") ||
        name.startsWith("tab-label")
      ) {
        classes.add(name);
      }
    }

    const sourceFiles = getAllFiles(srcDir, /\.(?:ts|tsx)$/);
    const allSource = sourceFiles
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n");

    const unreferencedClasses: string[] = [];
    for (const cls of classes) {
      if (!allSource.includes(cls)) {
        unreferencedClasses.push(cls);
      }
    }

    expect(unreferencedClasses).toEqual([]);
  });

  it("checks for duplicate imports in TypeScript source files", () => {
    const tsFiles = getAllFiles(srcDir, /\.(?:ts|tsx)$/);
    const duplicateImports: string[] = [];

    for (const file of tsFiles) {
      if (file.includes(".test.") || file.includes(".spec.")) continue;
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      const importedModules = new Set<string>();

      for (const line of lines) {
        const match = line.match(/^import\s+.*from\s+["']([^"']+)["'];/);
        if (match) {
          const moduleName = match[1];
          if (importedModules.has(moduleName)) {
            duplicateImports.push(
              `${path.relative(rootDir, file)}: duplicate import of "${moduleName}"`,
            );
          }
          importedModules.add(moduleName);
        }
      }
    }

    expect(duplicateImports).toEqual([]);
  });

  it("ensures no leftover debugging statements in production source files", () => {
    const tsFiles = getAllFiles(srcDir, /\.(?:ts|tsx)$/);
    const debugIssues: string[] = [];

    for (const file of tsFiles) {
      if (file.includes(".test.") || file.includes(".spec.") || file.includes("__tests__")) {
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      if (/\bdebugger\b/.test(content)) {
        debugIssues.push(`${path.relative(rootDir, file)} contains debugger statement`);
      }
      if (/\bconsole\.log\(/.test(content)) {
        debugIssues.push(`${path.relative(rootDir, file)} contains console.log`);
      }
    }

    expect(debugIssues).toEqual([]);
  });

  it("verifies all AdminGuideModal translation keys exist in platformTranslations", async () => {
    const guideModalPath = path.resolve(srcDir, "components/admin/shell/AdminGuideModal.tsx");
    const guideSource = fs.readFileSync(guideModalPath, "utf8");
    const { platformVietnameseTranslations } = await import("../i18n/platformTranslations");

    // Match all t("...") calls
    const keyMatches = guideSource.matchAll(/\bt\(["']([^"']+)["']/g);
    const missingKeys: string[] = [];

    for (const match of keyMatches) {
      const key = match[1];
      if (platformVietnameseTranslations[key] === undefined) {
        missingKeys.push(key);
      }
    }

    expect(missingKeys).toEqual([]);
  });

  it("ensures zero duplicate top-level CSS selector blocks within stylesheets", () => {
    const cssFiles = getAllFiles(stylesDir, /\.css$/);
    const duplicates: string[] = [];

    for (const file of cssFiles) {
      const rel = path.relative(rootDir, file);
      const raw = fs.readFileSync(file, "utf8");
      const content = raw.replace(/\/\*[\s\S]*?\*\//g, "");

      const selectors: string[] = [];
      let depth = 0;
      let currentSelector = "";

      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === "{" && depth === 0) {
          const sel = currentSelector.trim().replace(/\s+/g, " ");
          if (
            sel &&
            !sel.startsWith("@") &&
            !sel.startsWith("from") &&
            !sel.startsWith("to") &&
            !/^\d+%/.test(sel)
          ) {
            selectors.push(sel);
          }
          currentSelector = "";
          depth++;
        } else if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth = Math.max(0, depth - 1);
          if (depth === 0) currentSelector = "";
        } else if (depth === 0) {
          currentSelector += char;
        }
      }

      const counts = new Map<string, number>();
      for (const s of selectors) {
        counts.set(s, (counts.get(s) || 0) + 1);
      }

      for (const [sel, count] of counts.entries()) {
        if (count > 1) {
          duplicates.push(`${rel}: duplicate selector "${sel}" (${count}x)`);
        }
      }
    }

    expect(duplicates).toEqual([]);
  });
});
