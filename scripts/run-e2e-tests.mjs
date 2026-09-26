import { spawnSync } from "node:child_process";
import path from "node:path";

const supabaseCli = path.join(
  process.cwd(),
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const playwrightCli = path.join(
  process.cwd(),
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

function run(cli, args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr ?? "");
      process.stderr.write(result.stdout ?? "");
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout ?? "";
}

function localStatus() {
  const output = run(supabaseCli, ["status", "-o", "json"], {
    capture: true,
  });
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Supabase CLI did not return a JSON status object");
  }

  return JSON.parse(output.slice(start, end + 1));
}

const status = localStatus();
const apiUrl = status.API_URL ?? status.api_url;
const databaseUrl = status.DB_URL ?? status.db_url;

if (
  typeof apiUrl !== "string" ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(apiUrl) ||
  typeof databaseUrl !== "string" ||
  !databaseUrl.includes(":54322/")
) {
  throw new Error("E2E reset refused: the active Supabase target is not local");
}

run(supabaseCli, ["db", "reset"]);
const currentStatus = localStatus();
const anonKey =
  currentStatus.ANON_KEY ??
  currentStatus.anon_key ??
  currentStatus.PUBLISHABLE_KEY ??
  currentStatus.publishable_key;
if (typeof anonKey !== "string" || !anonKey) {
  throw new Error("Local Supabase status is missing the public API key");
}
run(playwrightCli, ["test", ...process.argv.slice(2)], {
  env: {
    ...process.env,
    EQCAMP_ACCESS_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  },
});
