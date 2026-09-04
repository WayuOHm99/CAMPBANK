import { spawnSync } from "node:child_process";
import path from "node:path";

const supabaseCli = path.join(
  process.cwd(),
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const vitestCli = path.join(
  process.cwd(),
  "node_modules",
  "vitest",
  "vitest.mjs",
);

function run(cli, args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

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
  const output = run(supabaseCli, ["status", "-o", "json"], { capture: true });
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Supabase CLI did not return a JSON status object");
  }

  return JSON.parse(output.slice(start, end + 1));
}

const beforeReset = localStatus();
const localApiUrl = beforeReset.API_URL ?? beforeReset.api_url;
const localDatabaseUrl = beforeReset.DB_URL ?? beforeReset.db_url;

if (
  typeof localApiUrl !== "string" ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(localApiUrl) ||
  typeof localDatabaseUrl !== "string" ||
  !localDatabaseUrl.includes(":54322/")
) {
  throw new Error("Integration reset refused: the active Supabase target is not local");
}

run(supabaseCli, ["db", "reset"]);

const status = localStatus();
const apiUrl = status.API_URL ?? status.api_url;
const anonKey =
  status.ANON_KEY ??
  status.anon_key ??
  status.PUBLISHABLE_KEY ??
  status.publishable_key;

if (typeof apiUrl !== "string" || typeof anonKey !== "string") {
  throw new Error(
    `Local Supabase status is missing API URL or anonymous key. Available keys: ${Object.keys(
      status,
    ).join(", ")}`,
  );
}

const test = spawnSync(
  process.execPath,
  [vitestCli, "run", "tests/integration", "--reporter=verbose"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      EQCAMP_INTEGRATION: "1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    },
    stdio: "inherit",
  },
);

if (test.error) {
  throw test.error;
}

process.exit(test.status ?? 1);
