import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// ============================================================================
// CONFIGURATION & SEVERITY
// ============================================================================

const SEVERITY = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
};

const COLOR = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m\x1b[37m",
  bgYellow: "\x1b[43m\x1b[30m",
  bgBlue: "\x1b[44m\x1b[37m",
};

function portable(p) {
  return p.split(sep).join("/");
}

function isTestFile(filePath) {
  return /(?:^|\/)(?:__tests__|test|e2e)(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(
    filePath,
  );
}

function isDeclarationFile(filePath) {
  return filePath.endsWith(".d.ts") || filePath.endsWith(".d.mts");
}

// ============================================================================
// FILE DISCOVERY
// ============================================================================

async function walkDirectory(
  dir,
  extensions,
  ignoreDirs = [
    "node_modules",
    "dist",
    ".git",
    "coverage",
    "vendor",
    "dev-dist",
    ".perf-dist",
  ],
) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreDirs.includes(entry.name)) continue;
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkDirectory(fullPath, extensions, ignoreDirs)));
      } else if (extensions.includes(extname(entry.name))) {
        files.push(fullPath);
      }
    }
  } catch {
    // skip unreadable
  }
  return files;
}

// ============================================================================
// TYPESCRIPT AST ANALYZER (JS / TS / REACT / A11Y / ARCHITECTURE)
// ============================================================================

function analyzeTsAst(sourceFile, filePath, content) {
  if (isDeclarationFile(filePath)) return [];

  const issues = [];
  const isTest = isTestFile(filePath);

  function getLine(node) {
    return (
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
      1
    );
  }

  function getSnippet(node) {
    return node.getText(sourceFile).slice(0, 90).replace(/\s+/g, " ");
  }

  function isInsideConditionalOrLoop(node) {
    let current = node.parent;
    while (current && current !== sourceFile) {
      if (
        ts.isIfStatement(current) ||
        ts.isForStatement(current) ||
        ts.isForInStatement(current) ||
        ts.isForOfStatement(current) ||
        ts.isWhileStatement(current) ||
        ts.isDoStatement(current) ||
        ts.isConditionalExpression(current) ||
        ts.isSwitchStatement(current)
      ) {
        return true;
      }
      if (
        ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current)
      ) {
        if (
          current.parent &&
          (ts.isSourceFile(current.parent) ||
            ts.isVariableDeclaration(current.parent) ||
            ts.isExportAssignment(current.parent))
        ) {
          return false;
        }
      }
      current = current.parent;
    }
    return false;
  }

  function visit(node) {
    // 1. React Conditional Hooks Check
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (/^use[A-Z]/.test(exprText) && isInsideConditionalOrLoop(node)) {
        issues.push({
          ruleId: "react/no-conditional-hooks",
          category: "React",
          severity: SEVERITY.ERROR,
          file: filePath,
          line: getLine(node),
          sample: getSnippet(node),
          message: `React Hook '${exprText}' called conditionally or inside a loop/nested function. Hooks must be top-level.`,
        });
      }

      // 2. React Random Keys Check
      if (
        (exprText === "Math.random" ||
          exprText === "Date.now" ||
          exprText.includes("uuid") ||
          exprText.includes("randomUUID")) &&
        node.parent &&
        ts.isJsxExpression(node.parent) &&
        node.parent.parent &&
        ts.isJsxAttribute(node.parent.parent) &&
        node.parent.parent.name.getText(sourceFile) === "key"
      ) {
        issues.push({
          ruleId: "react/no-random-key",
          category: "React",
          severity: SEVERITY.ERROR,
          file: filePath,
          line: getLine(node),
          sample: getSnippet(node),
          message:
            "Random key generated in render. Causes full component destruction and remount on every render.",
        });
      }

      // 3. Unsafe eval / Function
      if (exprText === "eval" || exprText === "new Function") {
        issues.push({
          ruleId: "js/no-eval",
          category: "JavaScript",
          severity: SEVERITY.ERROR,
          file: filePath,
          line: getLine(node),
          sample: getSnippet(node),
          message:
            "Unsafe code execution via eval/Function. Vulnerable to injection and performance degradation.",
        });
      }

      // 4. Console.log in production code (outside test/scripts)
      if (
        !isTest &&
        !filePath.startsWith("scripts/") &&
        (exprText === "console.log" || exprText === "console.debug")
      ) {
        const lineText = content.split("\n")[getLine(node) - 1] || "";
        if (!lineText.includes("audit-ignore")) {
          issues.push({
            ruleId: "js/no-console-log",
            category: "JavaScript",
            severity: SEVERITY.WARNING,
            file: filePath,
            line: getLine(node),
            sample: getSnippet(node),
            message:
              "Direct `console.log` in production code. Prefer telemetry or structured logging.",
          });
        }
      }

      // 5. Direct DOM Query in React Components (outside root mount and dedicated script helpers)
      if (
        !isTest &&
        filePath.endsWith(".tsx") &&
        filePath !== "src/main.tsx" &&
        !filePath.includes("/lib/offline/pwa.ts") &&
        !filePath.includes("TurnstileWidget") &&
        (exprText === "document.getElementById" ||
          exprText === "document.querySelector" ||
          exprText === "document.querySelectorAll")
      ) {
        const lineText = content.split("\n")[getLine(node) - 1] || "";
        if (!lineText.includes("audit-ignore")) {
          issues.push({
            ruleId: "react/no-direct-dom-query",
            category: "React",
            severity: SEVERITY.WARNING,
            file: filePath,
            line: getLine(node),
            sample: getSnippet(node),
            message:
              "Direct DOM query in React component. Use React `useRef` or event targets instead.",
          });
        }
      }
    }

    // 6. JSX Accessibility & React Best Practices
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagNode = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = tagNode.tagName.getText(sourceFile);
      const attributes = tagNode.attributes.properties;

      // 6a. <img> missing alt attribute
      if (tagName === "img") {
        const hasAlt = attributes.some(
          (attr) =>
            ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === "alt",
        );
        if (!hasAlt) {
          issues.push({
            ruleId: "a11y/img-missing-alt",
            category: "A11y/HTML",
            severity: SEVERITY.ERROR,
            file: filePath,
            line: getLine(node),
            sample: getSnippet(node),
            message:
              '`<img>` element is missing required `alt` attribute for screen readers (use alt="" if decorative).',
          });
        }
      }

      // 6b. autoFocus attribute check
      const autoFocusAttr = attributes.find(
        (attr) =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText(sourceFile) === "autoFocus",
      );
      if (autoFocusAttr) {
        const lineText = content.split("\n")[getLine(autoFocusAttr) - 1] || "";
        if (
          !lineText.includes("audit-ignore") &&
          !lineText.includes("eslint-disable")
        ) {
          issues.push({
            ruleId: "a11y/no-autofocus",
            category: "A11y/HTML",
            severity: SEVERITY.WARNING,
            file: filePath,
            line: getLine(autoFocusAttr),
            sample: getSnippet(autoFocusAttr),
            message:
              "`autoFocus` attribute disrupts assistive technologies. Prefer focusing after user action.",
          });
        }
      }

      // 6c. <a target="_blank"> missing rel="noopener noreferrer"
      if (tagName === "a") {
        const targetAttr = attributes.find(
          (attr) =>
            ts.isJsxAttribute(attr) &&
            attr.name.getText(sourceFile) === "target",
        );
        if (
          targetAttr &&
          targetAttr.initializer &&
          targetAttr.initializer.getText(sourceFile).includes("_blank")
        ) {
          const relAttr = attributes.find(
            (attr) =>
              ts.isJsxAttribute(attr) &&
              attr.name.getText(sourceFile) === "rel",
          );
          const relVal =
            relAttr && relAttr.initializer
              ? relAttr.initializer.getText(sourceFile)
              : "";
          if (!relVal.includes("noreferrer") && !relVal.includes("noopener")) {
            issues.push({
              ruleId: "a11y/target-blank-rel",
              category: "A11y/HTML",
              severity: SEVERITY.WARNING,
              file: filePath,
              line: getLine(node),
              sample: getSnippet(node),
              message:
                '`<a target="_blank">` missing `rel="noopener noreferrer"`. Security risk for reverse tabnabbing.',
            });
          }
        }
      }

      // 6d. Array index used as key
      const keyAttr = attributes.find(
        (attr) =>
          ts.isJsxAttribute(attr) && attr.name.getText(sourceFile) === "key",
      );
      if (
        keyAttr &&
        keyAttr.initializer &&
        ts.isJsxExpression(keyAttr.initializer) &&
        keyAttr.initializer.expression
      ) {
        const keyExpr = keyAttr.initializer.expression.getText(sourceFile);
        if (["index", "idx", "i"].includes(keyExpr)) {
          const lineText = content.split("\n")[getLine(keyAttr) - 1] || "";
          if (!lineText.includes("audit-ignore")) {
            issues.push({
              ruleId: "react/no-index-key",
              category: "React",
              severity: SEVERITY.WARNING,
              file: filePath,
              line: getLine(keyAttr),
              sample: getSnippet(keyAttr),
              message: `Array index \`${keyExpr}\` used as React \`key\`. Can cause reorder bugs and state desync.`,
            });
          }
        }
      }

      // 6e. dangerouslySetInnerHTML check
      const dangerAttr = attributes.find(
        (attr) =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText(sourceFile) === "dangerouslySetInnerHTML",
      );
      if (dangerAttr) {
        issues.push({
          ruleId: "react/dangerously-set-inner-html",
          category: "React",
          severity: SEVERITY.WARNING,
          file: filePath,
          line: getLine(dangerAttr),
          sample: getSnippet(dangerAttr),
          message:
            "`dangerouslySetInnerHTML` in use. Ensure HTML payload is rigorously sanitized against XSS.",
        });
      }
    }

    // 7. Deprecated `var` keyword in application source code
    if (ts.isVariableDeclarationList(node)) {
      if ((node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) === 0) {
        issues.push({
          ruleId: "js/no-var",
          category: "JavaScript",
          severity: SEVERITY.ERROR,
          file: filePath,
          line: getLine(node),
          sample: getSnippet(node),
          message: "Use `const` or `let` instead of `var`.",
        });
      }
    }

    // 8. Explicit `any` type (info level)
    if (!isTest && node.kind === ts.SyntaxKind.AnyKeyword) {
      issues.push({
        ruleId: "ts/no-explicit-any",
        category: "TypeScript",
        severity: SEVERITY.INFO,
        file: filePath,
        line: getLine(node),
        sample: getSnippet(node.parent || node),
        message:
          "Explicit `any` type detected. Prefer `unknown`, generics, or specific union types.",
      });
    }

    // 9. Architecture Boundaries
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier
        .getText(sourceFile)
        .replace(/['"]/g, "");

      // 9a. Direct Supabase Client Outside Bound
      if (
        !filePath.startsWith("src/lib/api/") &&
        filePath !== "src/lib/supabase.ts" &&
        !isTest &&
        ![
          "src/components/admin/auth/LoginPanel.tsx",
          "src/components/platform/GoogleAuthButton.tsx",
          "src/hooks/admin/useAdminSession.ts",
          "src/lib/offline/pwa.ts",
          "src/lib/realtime.ts",
        ].includes(filePath)
      ) {
        if (
          moduleSpecifier === "@supabase/supabase-js" ||
          moduleSpecifier.endsWith("/lib/supabase") ||
          moduleSpecifier === "./supabase"
        ) {
          issues.push({
            ruleId: "arch/direct-supabase-boundary",
            category: "Architecture",
            severity: SEVERITY.ERROR,
            file: filePath,
            line: getLine(node),
            sample: getSnippet(node),
            message:
              "Direct Supabase import outside allowed boundary. Encapsulate in `src/lib/api/`.",
          });
        }
      }

      // 9b. Compatibility Barrel Import
      if (
        filePath !== "src/lib/api.ts" &&
        !isTest &&
        moduleSpecifier.endsWith("/lib/api")
      ) {
        issues.push({
          ruleId: "arch/barrel-api-import",
          category: "Architecture",
          severity: SEVERITY.WARNING,
          file: filePath,
          line: getLine(node),
          sample: getSnippet(node),
          message:
            "Import specific domain (e.g. `src/lib/api/orders.ts`) instead of barrel `src/lib/api`.",
        });
      }

      // 9c. Page imported inside components
      if (
        !filePath.startsWith("src/pages/") &&
        !["src/App.tsx", "src/main.tsx"].includes(filePath) &&
        !isTest
      ) {
        if (/(?:^|\/)pages(?:\/|$)/.test(moduleSpecifier)) {
          issues.push({
            ruleId: "arch/no-page-import-in-components",
            category: "Architecture",
            severity: SEVERITY.ERROR,
            file: filePath,
            line: getLine(node),
            sample: getSnippet(node),
            message:
              "Route pages may only be imported by app entry points (App.tsx / main.tsx).",
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

// ============================================================================
// CSS ANALYZER
// ============================================================================

function analyzeCssFile(content, filePath) {
  const issues = [];
  const lines = content.split("\n");
  const isTokensFile =
    filePath.endsWith("tokens.css") || filePath.endsWith("vars.css");
  const isDesignerWorkspace =
    filePath.includes("builder-workspace.css") || filePath.includes("designer");

  // 1. !important usage
  lines.forEach((line, idx) => {
    if (line.includes("!important") && !line.includes("/* audit-ignore */")) {
      issues.push({
        ruleId: "css/no-important",
        category: "CSS",
        severity: isDesignerWorkspace ? SEVERITY.INFO : SEVERITY.WARNING,
        file: filePath,
        line: idx + 1,
        sample: line.trim(),
        message:
          "`!important` overrides cascade rules. Use CSS specificity or order instead.",
      });
    }
  });

  // 2. Hardcoded Hex Colors (outside tokens)
  if (!isTokensFile) {
    const hexPattern = /(?<!var\([^)]*|url\([^)]*)#[0-9a-fA-F]{3,8}\b/;
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("/*") ||
        trimmed.startsWith("--") ||
        trimmed.includes("var(")
      )
        return;
      if (
        hexPattern.test(trimmed) &&
        (trimmed.includes("color:") ||
          trimmed.includes("background") ||
          trimmed.includes("border"))
      ) {
        issues.push({
          ruleId: "css/hardcoded-colors",
          category: "CSS",
          severity: SEVERITY.INFO,
          file: filePath,
          line: idx + 1,
          sample: trimmed,
          message:
            "Hardcoded color value. Use design system tokens (`var(--surface)`, `var(--ink)`, `var(--page-bg)`, etc.).",
        });
      }
    });
  }

  // 3. Fixed container heights on content
  const heightPattern = /^\s*height:\s*\d{2,4}px;/;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (
      heightPattern.test(trimmed) &&
      !trimmed.includes("icon") &&
      !trimmed.includes("avatar") &&
      !trimmed.includes("badge") &&
      !trimmed.includes("skeleton")
    ) {
      issues.push({
        ruleId: "css/fixed-container-height",
        category: "CSS",
        severity: SEVERITY.WARNING,
        file: filePath,
        line: idx + 1,
        sample: trimmed,
        message:
          "Fixed `height: Npx`. Use `min-height` or intrinsic sizing so translated text doesn't overflow.",
      });
    }
  });

  // 4. prefers-reduced-motion for @keyframes
  if (
    content.includes("@keyframes") &&
    !content.includes("prefers-reduced-motion")
  ) {
    issues.push({
      ruleId: "css/prefers-reduced-motion",
      category: "CSS",
      severity: SEVERITY.INFO,
      file: filePath,
      line: 1,
      sample: "@keyframes definition",
      message:
        "Stylesheet defines `@keyframes` without an `@media (prefers-reduced-motion)` alternative.",
    });
  }

  // 5. Legacy CSS references
  lines.forEach((line, idx) => {
    if (line.includes("legacy.css") || line.includes("legacy-compat.css")) {
      issues.push({
        ruleId: "css/no-legacy-files",
        category: "CSS",
        severity: SEVERITY.ERROR,
        file: filePath,
        line: idx + 1,
        sample: line.trim(),
        message:
          "Reference to retired legacy.css file. Use modular entry stylesheets instead.",
      });
    }
  });

  return issues;
}

// ============================================================================
// CODE DUPLICATION DETECTOR WITH CONTIGUOUS CLONE MERGING
// ============================================================================

function normalizeCodeLine(line) {
  return line
    .trim()
    .replace(/\/\/.*$/, "")
    .replace(/\/\*.*?\*\//g, "")
    .replace(/\s+/g, " ");
}

export function detectDuplicates(
  fileContents,
  { minLines = 8, minChars = 140 } = {},
) {
  // 1. Index normalized lines for all files
  const fileLinesMap = [];

  for (const { path, content } of fileContents) {
    if (isTestFile(path) || isDeclarationFile(path)) continue;
    const rawLines = content.split("\n");
    const normLines = rawLines.map(normalizeCodeLine);
    fileLinesMap.push({
      path,
      rawLines,
      normLines,
    });
  }

  // 2. Sliding window hash map for finding initial seeds
  const seedMap = new Map();

  for (let fileIdx = 0; fileIdx < fileLinesMap.length; fileIdx++) {
    const file = fileLinesMap[fileIdx];
    for (let i = 0; i <= file.normLines.length - minLines; i++) {
      const chunk = file.normLines.slice(i, i + minLines);
      const joined = chunk.join("\n");
      const substantiveChars = joined.replace(/[{}\s;,()]/g, "").length;
      if (substantiveChars < minChars) continue;

      if (!seedMap.has(joined)) {
        seedMap.set(joined, []);
      }
      seedMap.get(joined).push({ fileIdx, line: i });
    }
  }

  // 3. Extend seeds forward & backward to build contiguous clones
  const clonePairs = [];
  const processedPairs = new Set();

  for (const occurrences of seedMap.values()) {
    if (occurrences.length < 2) continue;

    for (let a = 0; a < occurrences.length; a++) {
      for (let b = a + 1; b < occurrences.length; b++) {
        const occA = occurrences[a];
        const occB = occurrences[b];

        if (
          occA.fileIdx === occB.fileIdx &&
          Math.abs(occA.line - occB.line) < minLines
        ) {
          continue; // Self-overlap
        }

        const fileA = fileLinesMap[occA.fileIdx];
        const fileB = fileLinesMap[occB.fileIdx];

        // Extend backward
        let startA = occA.line;
        let startB = occB.line;
        while (
          startA > 0 &&
          startB > 0 &&
          fileA.normLines[startA - 1] === fileB.normLines[startB - 1] &&
          fileA.normLines[startA - 1].length > 0
        ) {
          startA--;
          startB--;
        }

        // Extend forward
        let endA = occA.line + minLines;
        let endB = occB.line + minLines;
        while (
          endA < fileA.normLines.length &&
          endB < fileB.normLines.length &&
          fileA.normLines[endA] === fileB.normLines[endB] &&
          fileA.normLines[endA].length > 0
        ) {
          endA++;
          endB++;
        }

        const spanLines = endA - startA;
        if (spanLines < minLines) continue;

        const pairKey = `${fileA.path}:${startA}-${endA}|${fileB.path}:${startB}-${endB}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        clonePairs.push({
          lines: spanLines,
          pathA: fileA.path,
          startA: startA + 1,
          endA,
          pathB: fileB.path,
          startB: startB + 1,
          endB,
          preview: fileA.rawLines.slice(startA, endA).join("\n"),
        });
      }
    }
  }

  // 4. Sort by clone block size descending
  clonePairs.sort((x, y) => y.lines - x.lines);

  // Group pairs into unique clusters
  const clusters = [];
  for (const pair of clonePairs) {
    // Check if covered by existing cluster
    const isRedundant = clusters.some(
      (c) =>
        c.preview.includes(pair.preview.slice(0, 100)) &&
        ((c.pathA === pair.pathA && c.pathB === pair.pathB) ||
          (c.pathA === pair.pathB && c.pathB === pair.pathA)),
    );
    if (!isRedundant) {
      clusters.push(pair);
    }
  }

  return clusters;
}

// ============================================================================
// MAIN AUDIT ENGINE
// ============================================================================

export async function runCodeAudit(rootDir = process.cwd(), options = {}) {
  const srcDir = resolve(rootDir, "src");
  const fnDir = resolve(rootDir, "functions");

  const tsExts = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
  const cssExts = [".css"];

  const [tsFiles, cssFiles] = await Promise.all([
    walkDirectory(srcDir, tsExts).then((f) =>
      walkDirectory(fnDir, tsExts).then((fnF) => [...f, ...fnF]),
    ),
    walkDirectory(srcDir, cssExts),
  ]);

  const allFilePaths = [...tsFiles, ...cssFiles];
  const fileContents = [];

  for (const fullPath of allFilePaths) {
    try {
      const content = await readFile(fullPath, "utf8");
      fileContents.push({
        fullPath,
        path: portable(relative(rootDir, fullPath)),
        ext: extname(fullPath),
        content,
      });
    } catch {
      // skip
    }
  }

  let issues = [];

  // 1. Analyze AST for JS/TS/React/A11y
  for (const file of fileContents) {
    if (tsExts.includes(file.ext)) {
      const scriptKind =
        file.ext === ".tsx"
          ? ts.ScriptKind.TSX
          : file.ext === ".jsx"
            ? ts.ScriptKind.JSX
            : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(
        file.path,
        file.content,
        ts.ScriptTarget.Latest,
        true,
        scriptKind,
      );
      const fileIssues = analyzeTsAst(sourceFile, file.path, file.content);
      issues.push(...fileIssues);
    } else if (cssExts.includes(file.ext)) {
      const cssIssues = analyzeCssFile(file.content, file.path);
      issues.push(...cssIssues);
    }
  }

  // Filter category if requested
  if (options.category) {
    const targetCat = options.category.toLowerCase();
    issues = issues.filter((i) => i.category.toLowerCase() === targetCat);
  }

  // 2. Analyze Code Clones / Duplication
  const minLines = options.minLines ? Number(options.minLines) : 8;
  const duplicates = detectDuplicates(fileContents, { minLines });

  const summary = {
    errors: issues.filter((i) => i.severity === SEVERITY.ERROR).length,
    warnings: issues.filter((i) => i.severity === SEVERITY.WARNING).length,
    infos: issues.filter((i) => i.severity === SEVERITY.INFO).length,
    duplicateClusters: duplicates.length,
  };

  return {
    totalFiles: fileContents.length,
    issues,
    duplicates,
    summary,
  };
}

// ============================================================================
// FORMATTER & CLI REPORTER
// ============================================================================

export function formatReport(result, { json = false, quiet = false } = {}) {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const output = [];
  const { issues, duplicates, summary, totalFiles } = result;

  output.push("");
  output.push(
    `${COLOR.bold}${COLOR.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLOR.reset}`,
  );
  output.push(
    `${COLOR.bold}${COLOR.cyan}║             MATSURI CODE QUALITY & BEST PRACTICES AUDIT              ║${COLOR.reset}`,
  );
  output.push(
    `${COLOR.bold}${COLOR.cyan}╚══════════════════════════════════════════════════════════════════════╝${COLOR.reset}`,
  );
  output.push(
    `${COLOR.dim}Scanned ${totalFiles} files in src/ & functions/${COLOR.reset}\n`,
  );

  if (!quiet && issues.length > 0) {
    const byCategory = new Map();
    for (const issue of issues) {
      if (!byCategory.has(issue.category)) byCategory.set(issue.category, []);
      byCategory.get(issue.category).push(issue);
    }

    for (const [cat, catIssues] of byCategory.entries()) {
      output.push(
        `${COLOR.bold}${COLOR.magenta}▶ [${cat}] (${catIssues.length} findings)${COLOR.reset}`,
      );
      for (const item of catIssues) {
        const badge =
          item.severity === SEVERITY.ERROR
            ? `${COLOR.bgRed} ERROR ${COLOR.reset}`
            : item.severity === SEVERITY.WARNING
              ? `${COLOR.bgYellow} WARN ${COLOR.reset}`
              : `${COLOR.bgBlue} INFO ${COLOR.reset}`;

        output.push(
          `  ${badge} ${COLOR.cyan}${item.file}:${item.line}${COLOR.reset} ${COLOR.dim}(${item.ruleId})${COLOR.reset}`,
        );
        output.push(`    ${COLOR.bold}${item.message}${COLOR.reset}`);
        if (item.sample) {
          output.push(`    ${COLOR.dim}› ${item.sample}${COLOR.reset}`);
        }
        output.push("");
      }
    }
  }

  if (!quiet && duplicates.length > 0) {
    output.push(
      `${COLOR.bold}${COLOR.yellow}▶ [Code Duplication / Clones] (${duplicates.length} duplicate patterns detected)${COLOR.reset}`,
    );
    duplicates.slice(0, 8).forEach((dup, idx) => {
      output.push(
        `  ${COLOR.bold}Clone #${idx + 1} (${dup.lines} identical lines):${COLOR.reset}`,
      );
      output.push(
        `    - ${COLOR.cyan}${dup.pathA}:${dup.startA}-${dup.endA}${COLOR.reset}`,
      );
      output.push(
        `    - ${COLOR.cyan}${dup.pathB}:${dup.startB}-${dup.endB}${COLOR.reset}`,
      );
      const preview = dup.preview
        .split("\n")
        .slice(0, 4)
        .map((l) => `      ${COLOR.dim}${l}${COLOR.reset}`)
        .join("\n");
      output.push(`    Preview:\n${preview}`);
      output.push("");
    });
    if (duplicates.length > 8) {
      output.push(
        `  ${COLOR.dim}... and ${duplicates.length - 8} more duplicate patterns (adjust with --min-lines <N>)${COLOR.reset}\n`,
      );
    }
  }

  // Health Score Calculation
  const healthScore = Math.max(
    0,
    100 -
      summary.errors * 5 -
      summary.warnings * 2 -
      Math.min(15, summary.duplicateClusters),
  );
  let grade = "A";
  if (healthScore < 60) grade = "F";
  else if (healthScore < 70) grade = "D";
  else if (healthScore < 80) grade = "C";
  else if (healthScore < 90) grade = "B";

  output.push(
    `${COLOR.bold}══════════════════════════════════════════════════════════════════════${COLOR.reset}`,
  );
  output.push(`${COLOR.bold}AUDIT SCORECARD:${COLOR.reset}`);
  output.push(
    `  • Health Score:       ${healthScore >= 80 ? COLOR.green : healthScore >= 60 ? COLOR.yellow : COLOR.red}${healthScore}/100 (Grade: ${grade})${COLOR.reset}`,
  );
  output.push(
    `  • Critical Errors:    ${summary.errors > 0 ? COLOR.red : COLOR.green}${summary.errors}${COLOR.reset}`,
  );
  output.push(
    `  • Warnings:           ${summary.warnings > 0 ? COLOR.yellow : COLOR.green}${summary.warnings}${COLOR.reset}`,
  );
  output.push(
    `  • Info / Suggestions: ${COLOR.blue}${summary.infos}${COLOR.reset}`,
  );
  output.push(
    `  • Duplicate Clones:   ${summary.duplicateClusters > 0 ? COLOR.yellow : COLOR.green}${summary.duplicateClusters}${COLOR.reset}`,
  );
  output.push(
    `${COLOR.bold}══════════════════════════════════════════════════════════════════════${COLOR.reset}`,
  );

  return output.join("\n");
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes("--json"),
    quiet: args.includes("--quiet"),
    strict: args.includes("--strict"),
  };

  const categoryIdx = args.indexOf("--category");
  if (categoryIdx !== -1 && args[categoryIdx + 1]) {
    options.category = args[categoryIdx + 1];
  }

  const minLinesIdx = args.indexOf("--min-lines");
  if (minLinesIdx !== -1 && args[minLinesIdx + 1]) {
    options.minLines = Number(args[minLinesIdx + 1]);
  }

  const result = await runCodeAudit(process.cwd(), options);
  console.log(formatReport(result, options));

  if (
    options.strict &&
    (result.summary.errors > 0 || result.summary.warnings > 0)
  ) {
    process.exit(1);
  } else if (result.summary.errors > 0) {
    process.exit(1);
  }
}
