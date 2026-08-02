import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const usage = `Usage: node scripts/database-security-surface.mjs <--local|--linked|--db-url URL>

Prints a read-only JSON inventory of public RPCs, grants, RLS policies,
triggers, and view security settings.`;

if (process.argv.includes("--help")) {
  console.log(usage);
  process.exit(0);
}

const mode = process.argv.find((argument) =>
  ["--local", "--linked", "--db-url"].includes(argument),
);
if (!mode) {
  console.error(usage);
  process.exit(2);
}

const args = ["--yes", "supabase@2.109.1", "db", "query", mode];
if (mode === "--db-url") {
  const urlIndex = process.argv.indexOf(mode) + 1;
  const databaseUrl = process.argv[urlIndex];
  if (!databaseUrl) {
    console.error("--db-url requires a percent-encoded connection string.");
    process.exit(2);
  }
  args.push(databaseUrl);
}
args.push(
  "--file",
  resolve("supabase/snippets/security_surface_inventory.sql"),
  "--output-format",
  "json",
);

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, args, { encoding: "utf8" });
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

try {
  const payload = JSON.parse(result.stdout);
  if (payload._tag === "Error") throw new Error(payload.error?.message);
  const surface = payload.rows?.[0]?.security_surface;
  if (typeof surface !== "string")
    throw new Error("Supabase returned no security-surface row.");
  console.log(JSON.stringify(JSON.parse(surface), null, 2));
} catch (error) {
  process.stderr.write(result.stderr);
  console.error(`Could not parse database security surface: ${error.message}`);
  process.exit(1);
}
