import { readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import { platformVietnameseTranslations } from "../platformI18n";

const srcRoot = path.resolve(process.cwd(), "src");

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
  const keys = new Set<string>();
  for (const file of collectSourceFiles(srcRoot)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t" &&
        node.arguments.length > 0
      ) {
        const collectLiterals = (argument: ts.Node) => {
          if (
            ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument)
          ) {
            keys.add(argument.text);
            return;
          }
          if (ts.isConditionalExpression(argument)) {
            collectLiterals(argument.whenTrue);
            collectLiterals(argument.whenFalse);
          } else if (ts.isParenthesizedExpression(argument)) {
            collectLiterals(argument.expression);
          }
        };
        collectLiterals(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
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
